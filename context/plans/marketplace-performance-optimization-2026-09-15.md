# Marketplace Performance Optimization Plan — 8s → Sub-300ms TTV

**Date:** 2026-09-15
**Scope:** `GET /marketplace` + `GET /api/v1/public/marketplace`, `/public/categories`, `/notifications/unread-count`, `/client/saved-professionals`
**Har symptom:** 4 concurrent API `wait` 1250–9444ms, total page ~8s
**Companion report:** `context/reports/marketplace-performance-report-2026-09-15.md`

## 1. Principles (Next.js Best Practices + Veterans Bay Architecture)

- **Server-first, client-last:** Public marketplace is read-heavy → fetch on server (RSC) and stream via `Suspense`. Client `"use client"` only for filter interaction. Follow `context/architecture.md:92` (Next.js owns presentation, Hono owns business rules) — server can call `MarketplaceService` directly or via `fetch` with caching, avoiding HTTP hop in RSC.
- **Parallel, not waterfall:** One server render does `Promise.all([marketplace, categories, saved])` instead of 3 sequential `useEffect` + header `useEffect`. Use Next.js request memoization + `fetch` dedup.
- **Cache at the right layer:** Public projections (`marketplace`, `categories`) get short-lived CDN/Workers cache (`revalidate:30`, `unstable_cache`, `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` already in `src/platform/http/public-cache.ts:5` but ignored by client `fetch`); private data (`unread-count`, `saved`) stays `no-store` and is fetched lazily/conditionally.
- **Keep routes thin, services authoritative:** `src/workers/api/app.ts:65` — Hono validates → resolves workspace → calls `MarketplaceService` → maps contract. No direct DB in `page.tsx`.
- **Don't pay connection tax per request:** `src/platform/database/client.ts:15` `new Pool` + `end()` per request is anti-pattern on Workers; use singleton or `Hyperdrive`.

## 2. Architectural Decisions Required (ADRs)

| ID | Decision | Why | Default Recommendation |
|---|---|---|---|
| ADR-P1 | DB access in Workers: singleton `Pool` vs `Hyperdrive` vs `neon` HTTP | Fixes 70%-likelihood root cause; approved foundation lists `Neon Serverless Driver` but not pooling. | Singleton `Pool` globally cached per isolate (immediate, free) → later bind `Hyperdrive` (`wrangler.api.jsonc`) for production edge pooling. |
| ADR-P2 | Marketplace rendering model: RSC server fetch vs CSR + React Query | Eliminates client waterfall; `AGENTS.md:8` says Hono authoritative but allows server import of service. | RSC `async page.tsx` with `searchParams` prop + server `MarketplaceService` via `unstable_cache`; keep client for filter `draft` only. |
| ADR-P3 | Cache tolerance for public marketplace | `context/architecture.md:244` allows short-lived public cache; need product sign-off on staleness. | `revalidate:30` for `marketplace`, `revalidate:300` for `categories`; `s-maxage=30, stale-while-revalidate=60` + `CDN-Cache-Control: s-maxage=60`. |

## 3. Target Architecture

```
Browser
  → Next.js 16 App Router (RSC, Node or Edge, PPR incremental)
      page.tsx (async, revalidate:30)
        ├─ Promise.all([
        │    fetch marketplace (next:{revalidate:30, tags:["marketplace"]}) // or direct service call
        │    fetch categories (unstable_cache, revalidate:300)
        │    conditional fetch saved (only if session)
        │  ])
        ├─ <Suspense fallback={<ResultsSkeleton/>}> <ResultsGrid data={...} /> </Suspense>
        └─ <Suspense> <Filters categories={...} /> </Suspense>  // streams immediately
      Client islands: FilterForm (draft state), Save button (useMutation)
  → Cloudflare Web Worker (OpenNext) → service binding → Hono API Worker (singleton Pool, reused auth)
  → Neon PostgreSQL (Hyperdrive, composite indexes, LATERAL join for images)
  → CDN (Cloudflare Cache API): Cache Everything for /api/v1/public/* with Origin Cache Control
```

Next.js features to enable: `experimental.ppr: "incremental"`, `experimental.optimizePackageImports: ["lucide-react","recharts"]`, `compress: true`, `images.formats: ["image/avif","image/webp"]`.

## 4. Ordered Workstreams

### Phase A — Measure Baseline (0.5 day, non-breaking, on `main`)

**Goal:** Make TTFB observable; confirm hypotheses with numbers.

1. **Instrument Hono:** Add `Server-Timing` in `src/workers/api/middleware/request-logging.ts:1` — time `dbConnect`, `auth`, `query`, `serialize`. Log `requestId` + `duration` already there; extend to include `pool` timing.
2. **Add script** `scripts/explain-marketplace.mjs` — `EXPLAIN (ANALYZE, BUFFERS)` for `MarketplaceRepository.search` with `pageSize:9` on seeded 31 services; capture before/after index.
3. **Bundle:** `ANALYZE=true npm run build` + `next-bundle-analyzer` — record `/_next/static` sizes, JS chunks waterfall. Confirm `lucide-react` tree-shaking.
4. **Vitest perf:** Add `src/modules/marketplace/repository.perf.test.ts` — `performance.now()` around `search()`.

*Exit:* Baseline metrics file `context/reports/marketplace-baseline-2026-09-15.md` (p50/p95 for each endpoint).

### Phase B — Fix DB Connection Storm (P0, 1 day, biggest win 7s → <500ms)

**Files:** `src/platform/database/client.ts:15`, `src/workers/api/middleware/authorization.ts:101`, `src/platform/auth/create-auth.ts:41`, `src/modules/*/routes.ts`, `wrangler.api.jsonc`

5. **Singleton Pool** (`src/platform/database/client.ts:15`):
   ```ts
   // Workers isolates reuse global; keep one Pool per isolate
   import { Pool, neonConfig } from "@neondatabase/serverless";
   // optional: neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
   let globalPool: Pool | null = null;
   export function createDatabaseClient(cs: string){
     if (!globalPool) globalPool = new Pool({ connectionString: cs });
     const db = drizzle({ client: globalPool, schema });
     return { db, close: async()=>{} }; // no-op; Workers isolates reuse
   }
   export function closeDatabaseClient(){ return globalPool?.end(); } // only on shutdown/test
   ```
   Alternative prod: `wrangler.api.jsonc` add `"hyperdrive": [{ "binding":"HYPERDRIVE", "id":"<hyperdrive-id>" }]` and `drizzle(hyperdrive)`; keep `neon` HTTP only for Better Auth.

6. **Reuse auth DB client** (`src/workers/api/middleware/authorization.ts:101` + `src/modules/saved-professionals/routes.ts:41`, `src/modules/notifications/routes.ts:31`):
   - Remove `createService()` new `Pool` inside handlers; instead `const db = c.get("databaseClient")?.db ?? createDatabaseClient(env.DATABASE_URL).db` and pass to `SavedProfessionalsRepository` / `NotificationsRepository`.
   - Trust `activeAccountProfile` set by middleware; don't re-call `requireActiveAccount` in service.
   - For public routes (`src/modules/marketplace/routes.ts:20`, `src/modules/marketplace-moderation/routes.ts:38`), keep single Pool but via singleton.

7. **Better Auth reuse:** In `src/workers/api/middleware/authorization.ts:103` `auth.api.getSession` uses its own `neon` HTTP; keep but ensure it doesn't also create `Pool`. Consider caching `session` per request via `c.set("session", session)`.

8. **Verify:** `curl -w "%{time_starttransfer}\n" http://localhost:3000/api/v1/public/categories` → expect **<100ms p50** (was 1250ms). `wrangler tail --format pretty` shows `Server-Timing: db;dur=…`.

### Phase C — Serverize Marketplace Rendering (P0, 1.5 days, eliminates client waterfall)

**Files:** `src/app/marketplace/page.tsx:7`, `src/app/marketplace/loading.tsx` (new), `src/components/marketplace/marketplace-page.tsx:216`, `src/components/public/site-header.tsx:441`, `src/components/notifications/notification-api.ts:11`, `next.config.ts`, `src/lib/marketplace-server.ts` (new)

9. **New server helper** `src/lib/marketplace-server.ts`:
   ```ts
   import "server-only";
   import { unstable_cache } from "next/cache";
   import { createDatabaseClient } from "@/platform/database/client";
   import { MarketplaceRepository } from "@/modules/marketplace/repository";
   import { MarketplaceService } from "@/modules/marketplace/service";
   // ...
   export const getCachedCategories = unstable_cache(
     async () => {
       const c = createDatabaseClient(process.env.DATABASE_URL!);
       try { return new MarketplaceModerationService(new MarketplaceModerationRepository(c.db)).listPublicCategories(); }
       finally { await c.close(); }
     },
     ["marketplace-categories"],
     { revalidate: 300, tags: ["categories"] }
   );
   export async function searchMarketplace(input: MarketplaceSearchQuery){
     // direct service call, no HTTP hop, revalidate via unstable_cache or fetch with next.revalidate
   }
   ```

10. **Convert `src/app/marketplace/page.tsx:7` to async Server Component:**
    ```ts
    export const revalidate = 30; // or: export const dynamic = "force-static" with revalidate
    export default async function MarketplaceRoute({ searchParams }: { searchParams: Promise<Record<string,string>> }){
      const sp = await searchParams;
      const input = parseMarketplaceQuery(sp); // reuse Zod schema from src/modules/marketplace/schemas.ts:10
      const [categories, data] = await Promise.all([
        getCachedCategories(),
        searchMarketplace(input), // or fetch(`${apiOrigin}/api/v1/public/marketplace?...`, { next: { revalidate: 30, tags:["marketplace"] }})
      ]);
      return (
        <PublicShell marketplace>
          <Suspense fallback={<ResultsSkeleton />}>
            <MarketplacePage initialData={data} categories={categories} searchParams={sp} />
          </Suspense>
        </PublicShell>
      );
    }
    ```
    Keep `src/components/marketplace/marketplace-page.tsx` as `"use client"` but **remove** 3 `useEffect` fetches (`259`, `273`, `317`). Accept props: `initialData`, `categories`, `searchParams`. Keep `draft`, `view`, `savingProviders`, `toggleSaved` (now via `useMutation`).

11. **Add `src/app/marketplace/loading.tsx`:**
    ```ts
    import { StatePanel } from "@/components/ui/state-panel";
    export default function Loading(){ return <StatePanel variant="loading" title="Loading marketplace" description="Searching the latest published listings." className="min-h-72" />; }
    ```
    This streams instantly while server fetch runs; replaces client `loading = request.key !== requestKey`.

12. **Gate private fetches:**
    - `src/components/marketplace/marketplace-page.tsx:317` — only fetch `saved-professionals` if `authClient.useSession().data?.user` exists; otherwise render `Save` as `Link` to login (already does in `toggleSaved`).
    - `src/components/public/site-header.tsx:441` — `NotificationBell`: `if (!session) return null;` + `useQuery({ queryKey:["notifications","unread"], queryFn:getUnreadNotificationCount, staleTime:30_000, enabled: !!session })` instead of bare `useEffect` + `setInterval`; remove `cache:"no-store"` or use `stale-while-revalidate`.
    - `src/components/notifications/notification-api.ts:11` — change `fetch(path,{cache:"no-store"})` to `fetch(path,{next:{revalidate:10}})` or `cache:"force-cache"` with `revalidateTag` on mutation.

13. **Analytics non-blocking:** `src/lib/marketplace-analytics.ts` `recordMarketplaceEvent` → `navigator.sendBeacon` or `fetch(...,{keepalive:true, priority:"low" as any})` fire-and-forget after `setRequest`; don't `await`.

14. **Router:** Keep `useSearchParams` for `draft` only; use `useTransition` + `router.push` with `shallow` update; previous data stays visible (React Query `keepPreviousData` or `useOptimistic`).

*Exit:* Marketplace loads with **streaming HTML in <100ms**, results appear when server fetch completes (~300ms), no 4-way concurrent API on reload. Browser shows one RSC payload, not 4 `/api` JSON.

### Phase D — Query & Index Optimization (P1, 1 day, 1–2s → <200ms per query)

**Files:** `src/modules/marketplace/repository.ts:68`, `src/platform/database/schema/professional-services.ts:100`, `src/modules/marketplace/service.ts:34`, `drizzle/*` new migration

15. **Indexes** (new migration `drizzle/00xx_marketplace-perf-indexes.sql`, then `npm run db:check`):
    ```sql
    CREATE INDEX CONCURRENTLY professional_services_marketplace_pagination_idx
      ON professional_services (status, moderation_status, published_at DESC, id)
      WHERE status='published' AND moderation_status='clear';
    CREATE INDEX CONCURRENTLY professional_services_category_lower_idx
      ON professional_services (lower(category)) WHERE status='published';
    CREATE INDEX CONCURRENTLY professional_profiles_operating_location_lower_idx
      ON professional_profiles (lower(operating_location));
    CREATE INDEX CONCURRENTLY professional_reputation_rating_idx
      ON professional_reputation (average_rating_hundredths) WHERE review_count > 0;
    -- Optional: functional index for availability Today filter (if product keeps it)
    -- CREATE INDEX CONCURRENTLY professional_profiles_available_today_idx
    --   ON professional_profiles ((coalesce((working_hours -> lower(to_char(now() at time zone 'Africa/Nairobi','FMDay')) ->> 'enabled'),'false')));
    ```

16. **Image join:** Replace correlated `imagePublicId` (`src/modules/marketplace/repository.ts:144`) with:
    ```ts
    // Lateral join avoids 9× correlated subquery per page
    const db = this.db;
    const imageJoin = sql`LEFT JOIN LATERAL (
      SELECT fa.cloudinary_public_id AS "publicId"
      FROM professional_service_images psi
      JOIN file_assets fa ON fa.id = psi.asset_id
      WHERE psi.service_id = professional_services.id
        AND fa.visibility='public' AND fa.status='ready' AND fa.purpose='SERVICE_IMAGE'
      ORDER BY psi.position, psi.id
      LIMIT 1
    ) img ON true`;
    ```
    Or two-step: fetch `items` without image, then `SELECT ... WHERE serviceId IN (...) ORDER BY position` and map in JS.

17. **Count optimization:** For first page without `q`, `totalItems` can be approximated or cached; otherwise keep `Promise.all` but ensure `count` query doesn't select image lateral join. Add covering index above so `count` is index-only.

18. **Availability laziness:** `src/modules/marketplace/service.ts:34` — only call `slotInputsByOrganisation` for 9 `directBookingEnabled` items, and memoize per `organisationId` + 14-day window via `unstable_cache` 5min.

19. **Verify with** `EXPLAIN (ANALYZE, BUFFERS)` — expect `Index Scan` on `marketplace_pagination_idx` + `Bitmap Heap Scan` on `serviceAreas` GIN only when needed, not `Seq Scan`.

### Phase E — Caching & CDN (P1, 0.5 day)

**Files:** `src/platform/http/public-cache.ts:5`, `next.config.ts:11`, `open-next.config.ts`, `wrangler.api.jsonc`, `web-worker.ts`

20. **Hono cache headers:** `src/platform/http/public-cache.ts:5` → add `CDN-Cache-Control: public, s-maxage=60` and `Netlify-CDN-Cache-Control` if needed (Cloudflare respects `CDN-Cache-Control`). Keep `Vary: Origin, Accept-Encoding`.

21. **Cloudflare Cache API:** For `GET /api/v1/public/marketplace` and `/public/categories`, add `caches.default` pattern in Workers:
    ```ts
    const cache = caches.default;
    const cacheKey = new Request(url, request);
    let res = await cache.match(cacheKey);
    if (res) return res;
    res = await next();
    res.headers.set("Cache-Control","public, max-age=30, stale-while-revalidate=60");
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
    ```
    Or enable `Cache Everything` + `Origin Cache Control` for `/api/v1/public/*` in Cloudflare dashboard.

22. **Next.js ISR:** `fetch(...,{next:{revalidate:30, tags:["marketplace"]}})` + `revalidateTag("marketplace")` on `POST /v1/public/marketplace/events` or on publish webhook.

23. **Prefetch tuning:** In `src/components/marketplace/service-card.tsx` / footer, set `<Link prefetch={false}>` for non-critical routes (`/privacy`, `/contact`, `/services/*` beyond viewport) to stop 8 extra RSC `?_rsc=` fetches competing with API. Next 16: `experimental.prefetch` threshold or `Link` `prefetch={false}`.

### Phase F — Bundle & Assets (P2, 0.5 day, perceived load)

**Files:** `src/modules/marketplace/service.ts:11`, `src/components/marketplace/marketplace-page.tsx:1160`, `next.config.ts:11`

24. **Image sizing:** Change Cloudinary URL to `w_384,h_256` for cards (`service-card`), `w_768` for detail. Update `sizes` to `"(max-width: 639px) 50vw, (max-width: 1199px) 33vw, 400px"`. Add `priority` only for first 2–3 cards above fold.
25. **Bundle:** `next.config.ts` add:
    ```ts
    experimental: { optimizePackageImports: ["lucide-react","recharts","@radix-ui/react-dialog"], ppr: "incremental" },
    compress: true,
    images: { formats: ["image/avif","image/webp"], deviceSizes:[640,750,828,1080,1200] },
    headers: async() => [{ source:"/api/v1/public/:path*", headers:[{key:"Cache-Control",value:"public, max-age=30, stale-while-revalidate=60"}]}],
    ```
26. **Dynamic imports:** For `popularServices` / `HelpCard` below fold, `dynamic(()=>import("./popular-services"),{ssr:true})` to reduce initial JS.

### Phase G — Verify Correctness (per `AGENTS.md: Verification`)

27. **Type & build:** `npm run typecheck && npm run lint && npm run build:all` — must pass (82 routes).
28. **Auth isolation:** `vitest run --config vitest.worker.config.ts` — `requireSessionMiddleware` still blocks unauthenticated `saved`/`unreadCount`; guest does not see private data after singleton change.
29. **Org isolation:** `marketplace.search` still filters `published+clear+active`; `lower(category)` change still respects index via functional index.
30. **Workflow:** `quotation.accepted → booking → job` outbox tests still pass; `recordAnalytics` `202` still idempotent.
31. **Responsive/a11y:** New `loading.tsx` skeleton has `role="status"` + `aria-busy`; `marketplace-page.tsx` error `StatePanel` retains `Try again`.

## 5. File Change Inventory

| File | Action | Reason |
|---|---|---|
| `src/platform/database/client.ts:15` | modify | singleton Pool / Hyperdrive |
| `src/workers/api/middleware/authorization.ts:101` | modify | reuse `databaseClient`, trust `activeAccountProfile` |
| `src/platform/auth/create-auth.ts:41` | modify | reuse pool, cache session |
| `src/workers/api/middleware/request-logging.ts:1` | modify | Server-Timing |
| `src/workers/api/middleware/rate-limit.ts:28` | verify | ensure not throttling public |
| `src/workers/api/app.ts:65` | modify | middleware order |
| `src/modules/marketplace/routes.ts:20` | modify | singleton, cache headers, no double pool |
| `src/modules/marketplace-moderation/routes.ts:38` | modify | same |
| `src/modules/notifications/routes.ts:31` | modify | reuse db |
| `src/modules/saved-professionals/routes.ts:41` | modify | reuse db |
| `src/modules/marketplace/repository.ts:68` | modify | lateral join, indexes, lower() |
| `src/modules/marketplace/service.ts:34` | modify | lazy availability, image size |
| `src/platform/database/schema/professional-services.ts:100` | modify | add composite + functional indexes |
| `src/platform/database/schema/professional-onboarding.ts:76` | modify | lower index |
| `src/platform/database/schema/reviews.ts:104` | modify | rating index |
| `src/platform/http/public-cache.ts:5` | modify | CDN-Cache-Control |
| `src/app/marketplace/page.tsx:7` | modify | async Server Component, Promise.all, revalidate |
| `src/app/marketplace/loading.tsx` | create | streaming skeleton |
| `src/components/marketplace/marketplace-page.tsx:216` | modify | remove useEffects, props, useMutation, gate saved |
| `src/components/public/site-header.tsx:441` | modify | gate unread count, useQuery |
| `src/components/notifications/notification-api.ts:11` | modify | cache policy |
| `src/lib/marketplace-server.ts` | create | server helper + unstable_cache |
| `src/lib/marketplace-analytics.ts` | modify | sendBeacon/keepalive |
| `next.config.ts:11` | modify | ppr, optimizePackageImports, headers, images |
| `open-next.config.ts:1` | modify | incrementalCache |
| `wrangler.api.jsonc` | modify | hyperdrive binding |
| `web-worker.ts:15` | verify | service binding hop |
| `drizzle/00xx_marketplace-perf-indexes.sql` | create | indexes |
| `scripts/explain-marketplace.mjs` | create | EXPLAIN |

## 6. Rollout & Risk Mitigation

- **Risk: Singleton retains bad connection** → add `pool.on("error",...)` + `neonConfig` reconnect; test `wrangler dev --local` restart; Fallback: `Hyperdrive` auto-recovers.
- **Risk: RSC breaks filter URL sync** → keep `draft` client state + `useTransition`; add Playwright test `e2e/marketplace.spec.ts` for pagination/sort.
- **Risk: Cache serves stale marketplace after publish** → `revalidateTag` on `POST /api/v1/professional/services` publish; TTL 30s bounds staleness.
- **Sequence:** B (DB) → C (RSC) → D (indexes) → E (CDN) → F (bundle). Each phase independently releasable; B alone proves 1250ms→<100ms for categories.
- **No speculative work:** Per `AGENTS.md:2`, only marketplace path is changed; no new search infrastructure (e.g., Meilisearch) until ADR.

## 7. Verification Gates (Must Pass Before `COMPLETE`)

- `npm run typecheck` — pass
- `npm run lint` — pass (no new `react-hooks/*`)
- `npm run build:all` — 82 routes, no `pool.end` error
- `npm run test` — `vitest.*.config.ts` all suites pass (212 tests + 2 pre-existing marketplace/site-header remain)
- **Perf:**
  - `curl -w "%{time_starttransfer}\n" http://localhost:3000/api/v1/public/categories` — p50 **<100ms** (was 1250ms)
  - `curl http://localhost:3000/api/v1/public/marketplace?pageSize=9` — p50 **<400ms** first, **<50ms** cached (was 7437ms), `X-Cache: HIT` / `CF-Cache-Status: HIT` on repeat
  - Chrome DevTools: `/marketplace` TTFB **<600ms**, LCP **<2.5s**, JS **<300kb** gzipped
  - `EXPLAIN ANALYZE` shows `Index Scan` not `Seq Scan`
- **Correctness:** `marketplace.search` still returns 9/9/9/4 pages; `Cleaning` filter 7 results; seeded detail routes `200`.
- **Auth:** Guest `saved` not fetched (no 401 cost); signed-in `saved` + `unreadCount` still enforce `requireSessionMiddleware`.

## 8. Open Questions for Delivery Owner

1. **Hyperdrive budget** — Approve Hyperdrive (free tier) vs singleton Pool only? Hyperdrive is authoritative for prod.
2. **Cache tolerance** — `30s` stale acceptable for `marketplace` search? `q` could be `revalidate:10`.
3. **Guest saved fetch** — Skip entirely (recommended, saves 9444ms) vs lazy after auth?
4. **RSC prefetch** — Disable `prefetch` for footer `/privacy` `/contact` (cuts 8 RSC fetches) — OK?

---
*Generated: 2026-09-15 — local inspection only; no DB `EXPLAIN` or production deploy executed.*
