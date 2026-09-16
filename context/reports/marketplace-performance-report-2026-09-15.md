# Marketplace Performance Report — 8s Load Investigation

**Date:** 2026-09-15
**Route:** `http://localhost:3000/marketplace` → `http://localhost:3000/services/outdoor-security-lighting` (HAR `page_1`)
**Environment:** Next.js 16.2.12 + Hono on Cloudflare Workers + Neon PostgreSQL (serverless) — `npm run dev` (web `next dev` + api `wrangler dev`)
**HAR:** Firefox 155.0.1 — 4 concurrent `/api/v1/*` on marketplace mount

## 1. Summary

Marketplace perceived load ~8s is dominated by **server TTFB (`timings.wait`)** not download. Four concurrent API calls share the same `startedDateTime` (`12:17:56.570+03:00`) and each blocks 1.2–9.4s before first byte:

| Request | `wait` | `time` | `cache-control` |
|---|---|---|---|
| `GET /api/v1/notifications/unread-count` | 9221ms | 9221ms | none (`200`) |
| `GET /api/v1/client/saved-professionals` | 9443ms | 9444ms | none (`200`) |
| `GET /api/v1/public/marketplace?pageSize=9` | 7437ms | 7437ms | `public, max-age=30, stale-while-revalidate=60` |
| `GET /api/v1/public/categories` | 1250ms | 1250ms | `public, max-age=30, stale-while-revalidate=60` |
| `POST /api/v1/public/marketplace/events` | 1101ms | 1101ms | — (`202`) |

Even the 6-row `marketplace_categories` table (indexed `status,name`) costs **1250ms** — a strong signal that the bottleneck is **connection / auth overhead per request**, not data size. `Content size` 410B–1598B and `bodySize` 321B–719B are trivial.

Additional HAR noise: 8 RSC `?_rsc=` prefetches for `/privacy` and `/contact` (`Next.js` `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`) + 2 duplicate `GET /images/veterans-bay-favicon.png` + 6 `GET /_next/image` transforms competing for HTTP/2 slots and Worker concurrency.

No `middleware.ts` exists. Web → API hop is via `next.config.ts:24` rewrite `source:"/api/:path*"` → `${apiOrigin}/api/:path*` (dev) and `web-worker.ts:15` `env.API.fetch(request)` (preview/prod service binding).

## 2. Rendering Path — Pure Client Waterfall

### 2.1 Server shell

`src/app/marketplace/page.tsx:7` is a thin server wrapper:

```ts
export default function MarketplaceRoute(){
  return (
    <PublicShell marketplace>
      <main>
        <Suspense fallback={<StatePanel variant="loading".../>}>
          <MarketplacePage /> // "use client"
        </Suspense>
      </main>
    </PublicShell>
  );
}
```

- No `async` data fetch, no `fetch` with `next.revalidate`, no `unstable_cache`, no streaming data.
- `Suspense` only covers hydration of `MarketplacePage`, not data.

### 2.2 Client page

`src/components/marketplace/marketplace-page.tsx:216` (`"use client"`, 1249 LOC):

- State via `useState` + `useSearchParams` forces client boundary after hydration.
- **Three independent `useEffect` on mount, each bare `fetch` + `AbortController`, no `React Query`, no deduplication:**

  - `src/components/marketplace/marketplace-page.tsx:259` — `GET /api/v1/public/categories` — unconditional, fallback `fallbackCategoryOptions` (5 hardcoded) ignored.
  - `src/components/marketplace/marketplace-page.tsx:273` — `GET /api/v1/public/marketplace?${apiSearchParams(currentSearchParams)}` — depends on `currentSearchParams`, `filters`, `requestKey`; sets `requestKey=${searchKey}:${retryAttempt}`; loading = `request.key !== requestKey`; fires `recordMarketplaceEvent` after success (`src/lib/marketplace-analytics.ts`).
  - `src/components/marketplace/marketplace-page.tsx:317` — `GET /api/v1/client/saved-professionals` with `credentials:"include"` — even for guests (silent 401, still a round-trip + auth check + DB pool).

- `src/components/marketplace/marketplace-page.tsx:335` `toggleSaved` — per-card `POST`/`DELETE /api/v1/client/saved-professionals/${slug}` + `router.push("/login?redirect=...")` on 401.

Result: **3 fetches fire immediately after hydration**, plus `src/components/public/site-header.tsx:441` `AdaptiveSiteHeader` → `NotificationBell` effect → `GET /api/v1/notifications/unread-count` (`src/components/notifications/notification-api.ts:11` with `cache:"no-store"`). HAR's 4 concurrent `/api/*` matches this. `src/components/providers.tsx:14` defines `QueryClient({ staleTime:30_000, gcTime:15min, retry:2 })` but marketplace never uses it. `src/lib/use-cached-resource.ts:21` / `src/lib/client-resource-cache.ts:19` TTL helpers exist but unused.

### 2.3 Global providers

`src/app/layout.tsx:28` → `src/components/providers.tsx:10` → `QueryClientProvider`. `PublicShell` → `SiteHeader` → `authClient.useSession()` (`src/lib/auth-client.ts:6`) fetches `/api/auth/get-session` via cookies, then `NotificationBell` polls every 30s (`setInterval(refresh,30_000)`). On public `/marketplace`, `authoritativeCount` is `undefined` → always fires.

## 3. API Path — Hono + Per-Request Neon Pool + Double Auth Hit

### 3.1 Router

`src/workers/api/app.ts:65`:

```ts
api.use("*", requestContextMiddleware);
api.use("*", requestLoggingMiddleware);
api.use("*", trustedOriginMiddleware);
api.use("/api/*", bodyLimit(...));
api.use("/api/*", rateLimitMiddleware);
api.on(["GET","POST"], "/api/auth/*", (c)=> createAuth(c.get("environment")).handler(c.req.raw));
api.route("/api", createMarketplaceRoutes());
api.route("/api", createMarketplaceModerationRoutes());
api.route("/api", createSavedProfessionalsRoutes());
api.route("/api", createNotificationRoutes());
```

- `requestContextMiddleware` (`src/workers/api/middleware/request-context.ts:18`) — Zod `apiEnvironmentSchema.safeParse` per request + `crypto.randomUUID()` `requestId`.
- `rateLimitMiddleware` (`src/workers/api/middleware/rate-limit.ts:28`) — `API_RATE_LIMITER.limit({key:`api:${ip}:${path}`})` via Cloudflare Rate Limiting (KV/Durable Object) — per-request sync hop.
- `trustedOriginMiddleware` — exact origin match, rejects credentials-laden origins.

### 3.2 Public routes (no auth)

- `src/modules/marketplace/routes.ts:20` — `GET /v1/public/marketplace`: `applyPublicProjectionCache(c)` → `parseQuery(marketplaceSearchQuerySchema)` → `createDatabaseClient(DATABASE_URL)` → `new MarketplaceService(new MarketplaceRepository(client.db),..., new BookingsRepository(client.db)).search(input)` → `finally { await client.close(); }`.
- `src/modules/marketplace-moderation/routes.ts:38` — `GET /v1/public/categories`: same `applyPublicProjectionCache` + `createService` → `service.listPublicCategories()` (`SELECT * FROM marketplace_categories WHERE status? ORDER BY name` — trivial) → `close()`.
- `src/modules/marketplace/routes.ts:40` — `POST /v1/public/marketplace/events`: same pool-per-request + `recordAnalytics` inserts into `outboxEvents`.

`src/platform/http/public-cache.ts:5`:

```ts
export function applyPublicProjectionCache(c: Context){
  c.header("cache-control","public, max-age=30, stale-while-revalidate=60");
  c.header("vary","Origin, Accept-Encoding");
}
```

Client `fetch` never sends `next:{revalidate}` or `If-None-Match`, so this is origin-only; browser still re-fetches on reload (and `notification-api.ts` explicitly `cache:"no-store"`).

### 3.3 Authenticated routes (double pool)

- `src/modules/notifications/routes.ts:65` — `GET /v1/notifications/unread-count`: `requireSessionMiddleware` → `createService` → `service.unreadCount(authUserId(c))` → `close()`.
- `src/modules/saved-professionals/routes.ts:41` — `GET /v1/client/saved-professionals`: `requireSessionMiddleware` → `createService` → `service.list(requireAccount(c).authUserId)` → `close()`.

`requireSessionMiddleware` (`src/workers/api/middleware/authorization.ts:101`):

```ts
export const requireSessionMiddleware = createMiddleware(async (c,next)=>{
  const auth=createAuth(c.get("environment"));
  const session=await auth.api.getSession({headers:c.req.raw.headers}); // neon HTTP query to session table
  if(!session) throw new UnauthorizedError();
  const client=createDatabaseClient(environment.DATABASE_URL);
  try {
    const activeAccount=await new IdentityService(new IdentityRepository(client.db)).requireActiveAccount(session.user.id);
    c.set("databaseClient",client); c.set("activeAccountProfile",activeAccount.profile);
    c.set("account",{authUserId:session.user.id,...});
    await next();
  } finally { await client.close(); } // closes before handler's own client
});
```

Handlers then create **a second `createDatabaseClient`** inside `createService` (`src/modules/saved-professionals/routes.ts:41`, `src/modules/notifications/routes.ts:31`). So per authenticated request: **Pool#1 (middleware) + Pool#2 (handler) + Better-Auth `neon` HTTP** serially. For 4 concurrent authenticated fetches → ~7–8 pools competing.

`IdentityService.requireActiveAccount` (`src/modules/identity/service.ts:67`):

```ts
const profile=await repository.findProfileByAuthUserId(authUserId); // SELECT ... FROM account_profiles LEFT JOIN file_assets WHERE auth_user_id=...
if(profile.status==="deactivated") throw ...
const restrictions=await repository.findActiveRestrictions(profile.id); // SELECT FROM account_restrictions ...
```

`IdentityRepository.findProfileByAuthUserId` (`src/modules/identity/repository.ts:128`) joins `file_assets` for avatar; `findActiveRestrictions` hits `account_restrictions_active_idx`. Two queries per auth check.

`createAuth` (`src/platform/auth/create-auth.ts:41`):

```ts
const sql=neon(env.DATABASE_URL); const db=drizzle(sql,{schema:authSchema});
return betterAuth({ database:drizzleAdapter(db,{provider:"pg"}), session:{expiresIn:7d,updateAge:24h,freshAge:10m}, databaseHooks:{session:{create:{before: async (s)=> createDatabaseClient(...).requireActiveAccount(...)}}}})
```

Better Auth uses `@neondatabase/serverless` `neon` (HTTP) driver — TLS + header per request.

## 4. Database — Client, Indexes, Query

### 4.1 Client

`src/platform/database/client.ts:15`:

```ts
export function createDatabaseClient(cs:string): DatabaseClient{
  const pool=new Pool({connectionString:cs});
  const db=drizzle({client:pool,schema});
  return {db, close: async()=>{await pool.end();}};
}
```

- No singleton, no `Hyperdrive` binding, no `neonConfig.fetchEndpoint`, no connection caching.
- `Pool` creation + `pool.end()` per request is expensive in Workers isolates (`nodejs_compat` fetch-based transport, no TCP keepalive across isolates).
- Cold pools contend for Neon compute autoscale (scale-to-zero after idle). Explains why `categories` 1250ms and heavy queries 7–9s.

`wrangler.api.jsonc` — `name:"veterans-bay-api"`, `compatibility_date:"2026-07-16"`, no `hyperdrive`/`smart_placement`. `wrangler.jsonc` (web) has `services:{binding:"API", service:"veterans-bay-api-preview"}` for preview, but API worker itself has no DB acceleration.

### 4.2 Marketplace query

`src/modules/marketplace/repository.ts:68` `MarketplaceRepository.search(input)`:

- Builds `conditions: SQL[]` with:
  - `eq(status,"published")`, `eq(moderationStatus,"clear")`, `eq(organisations.status,"active")`, `isNotNull(category,description,fulfilmentModel,pricingModel)`, `pricingModel='custom_quote' OR priceMinor IS NOT NULL`
  - `if(input.q)` → `sql`${searchVector()} @@ websearch_to_tsquery('simple',${input.q})`` where `searchVector()` (`src/modules/marketplace/repository.ts:59`) is `to_tsvector('simple', coalesce(name,'')||' '||coalesce(category,'')||' '||coalesce(description,''))`
  - `if(input.category)` → `sql`lower(category)=lower(${input.category})`` — not indexable via `category_status_idx` btree on raw `category`.
  - `if(input.location)` → `sql`(serviceAreas @> jsonb OR professionalProfiles.serviceAreas @> jsonb OR lower(operatingLocation)=lower(...))`` — GIN `serviceAreas` indexes bypassed by `OR` + `lower()`.
  - `if(input.availability==="today")` → `sql`coalesce(workingHours->lower(to_char(now() at time zone 'Africa/Nairobi','FMDay'))->>'enabled','false')='true'`` — JSONB extraction per row, no index.
  - `if(input.verified)` → `eq(verificationStatus,"verified")` or `<>`.
  - `if(input.topRated==="true")` → `averageRatingHundredths>=470` + `reviewCount>0` — no index on `professionalReputation.averageRatingHundredths`.
  - `if(input.instantBooking==="true")` → `directBookingEnabled=true` + `isNotNull(estimatedDurationMinutes)`.

- `imagePublicId` (`src/modules/marketplace/repository.ts:144`) — correlated `SELECT cloudinaryPublicId FROM professional_service_images JOIN file_assets WHERE serviceId=professionalServices.id ... ORDER BY position LIMIT 1` — executes per result row (9×).

- `relevance` (`src/modules/marketplace/repository.ts:156`) — `ts_rank(searchVector(), websearch...)` only when `q`.

- **Two queries via `Promise.all`** (`src/modules/marketplace/repository.ts:201`):

  ```ts
  const [items, [total]] = await Promise.all([
    base.orderBy(...relevance?, desc(publishedAt), asc(id)).limit(pageSize).offset((page-1)*pageSize),
    db.select({value:count()}).from(professionalServices).innerJoin(...).innerJoin(...).leftJoin(...).where(where)
  ]);
  ```

  `count()` repeats full filtered scan; no covering index for `publishedAt desc` pagination.

- **Sequential post-processing** — `src/modules/marketplace/service.ts:34`:

  ```ts
  const result=await this.store.search(input);
  const bookableOrganisationIds=result.items.filter(i=>i.directBookingEnabled&&...).map(i=>i.organisationId);
  const availability=this.availabilityStore ? await this.availabilityStore.slotInputsByOrganisation({organisationIds:bookableOrganisationIds, from:now, to:+14d}) : new Map();
  ```

  `BookingsRepository.slotInputsByOrganisation` (`src/modules/bookings/repository.ts:542`) does `Promise.all` of 3 `SELECT ... WHERE organisationId IN (...)` for `availabilityRules`, `availabilityBlocks`, `bookingReservations` + in-memory grouping — adds second round-trip after search.

### 4.3 Other tables

- `notifications` (`src/platform/database/schema/notifications.ts:62`) — `notifications_recipient_unread_idx` `(recipientAccountId,createdAt,id) WHERE readAt IS NULL` correct, but `unreadCount` still pays auth overhead.
- `saved_professionals` (`src/platform/database/schema/saved-professionals.ts:26`) — `saved_professionals_account_created_idx` exists, but `list` does correlated `logoPublicId` subquery + `serviceCount` subquery + `publicServiceExists` `EXISTS` per row (`src/modules/saved-professionals/repository.ts:32`).
- `professional_profiles` (`src/platform/database/schema/professional-onboarding.ts:76`) — `verification_status_idx`, `service_areas_idx` GIN, `operating_location_idx` (btree on raw, not `lower()`).
- `professionalReputation` (`src/platform/database/schema/reviews.ts:104`) — PK `organisationId`, no index on `averageRatingHundredths`.

### 4.4 `next.config.ts` / Workers

`next.config.ts:11`:

```ts
const apiOrigin=z.url().parse(process.env.API_ORIGIN||"http://127.0.0.1:8787");
export default { images:{remotePatterns:[{hostname:"images.unsplash.com"},{hostname:"res.cloudinary.com"}]}, async rewrites(){return [{source:"/api/:path*",destination:`${apiOrigin}/api/:path*`}];} }
```

- No `cacheComponents`, `compress`, `headers()`, `experimental.optimizePackageImports` / `ppr`.
- Web→API is service binding `web-worker.ts:15` `env.API.fetch(request)` — adds Worker-to-Worker RPC latency.

`open-next.config.ts` — `defineCloudflareConfig()` defaults.

### 4.5 Images

`src/modules/marketplace/service.ts:11` — `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_fill,w_1200,h_800/${publicId}` — 1200w for `sizes="(max-width:639px)42vw, (max-width:1199px)45vw, 24vw"` (`src/components/marketplace/marketplace-page.tsx:1165`). `fallbackImage` (`src/components/marketplace/marketplace-page.tsx:207`) uses `/images/category-*.png` via `next/image` (allowed via `remotePatterns` for Cloudinary, but local `/_next/image` transforms still cost).

## 5. Hypotheses (Ranked by Likelihood)

| # | Hypothesis | Likelihood | Evidence |
|---|---|---|---|
| 1 | **Neon Pool-per-request storm** | 70% | `client.ts:15` cold `Pool`+`end()` per request; 4 concurrent page fetches → 7 pools + Better Auth `neon`; categories baseline 1250ms; TTFB dominates. |
| 2 | **Double auth DB hit per authenticated request** | 60% | `requireSessionMiddleware` Pool#1 + handler Pool#2; `unreadCount`/`saved` do 4 queries across 2 pools serially. |
| 3 | **Heavy marketplace query + correlated image subquery + count scan** | 55% | `repository.ts:71` 7-condition `where` with `lower()`/`OR`/`to_char` no functional indexes; `imagePublicId` 9×; `Promise.all` items+count; sequential `slotInputsByOrganisation`. |
| 4 | **Missing HTTP/RSC cache — every load hits origin** | 50% | `public-cache.ts:5` sets header but client `fetch` has no `next.revalidate`/`force-cache`; `notification-api.ts:11` `cache:"no-store"`; no `unstable_cache`; `Providers` `retry:2`. |
| 5 | **Service binding hop + OpenNext double worker** | 45% | `web-worker.ts:15` adds RPC latency per `/api` call; prod path Browser→Web Worker→API Worker→Neon. |
| 6 | **Client thundering herd + `refetchOnWindowFocus` + polling** | 40% | 4 parallel `fetch(cache:"no-store")`, `NotificationBell` 30s interval, 8 RSC prefetches queue behind 6-slot HTTP/2. |
| 7 | **Missing composite indexes** | 35% | No `(status,moderationStatus,publishedAt desc)` covering; no `lower(category)` / `lower(operatingLocation)` / `averageRatingHundredths`. |
| 8 | **Rate limiter KV contention** | 25% | `rateLimitMiddleware` sync KV per request; not 7s alone. |
| 9 | **`availability=today` JSONB per-row `to_char`** | 20% | Only when filter used; no functional index. |
| 10 | **Image oversize contention** | 10% | 1200w Cloudinary for 24vw card; competes with API bandwidth for LCP. |

## 6. Absolute File Paths for Triage

- `src/app/marketplace/page.tsx`
- `src/components/marketplace/marketplace-page.tsx` (effects `259`, `273`, `317`, `apiSearchParams` `117`, `toggleSaved` `335`)
- `src/components/public/public-shell.tsx`
- `src/components/public/site-header.tsx` (66 `NotificationBell`, 441 `AdaptiveSiteHeader`)
- `src/components/notifications/notification-api.ts` (11 `cache:"no-store"`)
- `src/components/providers.tsx` (14 `QueryClient` defaults)
- `src/lib/auth-client.ts` (6 `createAuthClient`)
- `src/lib/use-cached-resource.ts` (21), `src/lib/client-resource-cache.ts` (19)
- `src/workers/api/app.ts` (65), `src/workers/api/index.ts`, `src/workers/api/environment.ts`
- `src/workers/api/middleware/request-context.ts` (18), `src/workers/api/middleware/authorization.ts` (101), `src/workers/api/middleware/rate-limit.ts` (28)
- `src/platform/http/public-cache.ts` (1)
- `src/platform/database/client.ts` (15)
- `src/platform/auth/create-auth.ts` (41)
- `src/modules/marketplace/routes.ts` (20), `src/modules/marketplace/repository.ts` (68), `src/modules/marketplace/service.ts` (34), `src/modules/marketplace/schemas.ts` (10)
- `src/modules/notifications/routes.ts` (41), `src/modules/notifications/repository.ts` (215), `src/modules/saved-professionals/routes.ts` (41), `src/modules/saved-professionals/repository.ts` (51)
- `src/modules/marketplace-moderation/routes.ts` (38)
- `src/modules/bookings/repository.ts` (542 `slotInputsByOrganisation`)
- `src/platform/database/schema/professional-services.ts` (100), `notifications.ts` (62), `saved-professionals.ts` (26), `professional-onboarding.ts` (76), `reviews.ts` (104), `organisations.ts` (31)
- `src/modules/identity/repository.ts` (128), `src/modules/identity/service.ts` (67)
- `next.config.ts` (11), `wrangler.api.jsonc`, `wrangler.jsonc`, `web-worker.ts` (10), `open-next.config.ts`, `src/app/layout.tsx` (28)

## 7. Next Steps

See companion plan: `context/plans/marketplace-performance-optimization-2026-09-15.md` for ordered workstreams (DB singleton/Hyperdrive → serverize marketplace rendering → query/index fixes → caching/CDN → bundle/assets) with verification gates.

---
*Generated: 2026-09-15 — local inspection only; no production DB `EXPLAIN ANALYZE` executed.*
