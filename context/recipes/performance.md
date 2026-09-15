# Performance Recipe — Veterans Bay

Load when: any page lists, filters, paginates, or loads >300ms TTFB / >2.5s LCP / shows no pending state on filter/pagination.

This is the distilled checklist from `marketplace 32s → <600ms`. Apply the same 8 levers to `client/*`, `professional/*`, `admin/*`.

## 1. Database — Connection

**Anti-pattern** `src/platform/database/client.ts:15` `new Pool()` + `pool.end()` per request → TLS handshake 200-800ms, 4 parallel fetches = 7 pools + Better Auth `neon` HTTP = thundering herd.

```ts
// src/platform/database/client.ts — pooled per isolate, no-op close
const pooled = new Map<string, Pool>();
export function createDatabaseClient(cs: string){
  if (process.env.VITEST === "true") { const p=new Pool({connectionString:cs}); return {db:drizzle({client:p,schema}), close:()=>p.end()} }
  let pool = pooled.get(cs); if(!pool){ pool=new Pool({connectionString:cs}); pooled.set(cs,pool) }
  return { db: drizzle({client:pool,schema}), close: async()=>{} };
}
export async function destroyPooledClients(){ await Promise.all([...pooled.values()].map(p=>p.end())) }
```

Handler reuse:
```ts
// src/modules/*/routes.ts
const existing = c.get("databaseClient");
const {client, ownsClient} = existing ? {client:existing, ownsClient:false} : {client:createDatabaseClient(env.DATABASE_URL), ownsClient:true};
try { ... } finally { if(ownsClient) await client.close() }
```
And `src/workers/api/middleware/authorization.ts:101` `requireSessionMiddleware` sets `c.set("databaseClient",client)` once; handlers reuse. Do not `await client.close()` in middleware when pooled (now no-op).

Verify: `curl -w "%{time_starttransfer}\n" /api/v1/public/categories` — `1250ms → <100ms` p50.

## 2. Database — Query

**Correlated subquery** `src/modules/marketplace/repository.ts:146` 9× `SELECT cloudinaryPublicId ... WHERE serviceId = professionalServices.id LIMIT 1` → 9 index lookups.

Fix: select `serviceId` + batch fetch:

```ts
const [itemsWithoutImages,[total]] = await Promise.all([ base.limit(9), countQuery ]);
if (itemsWithoutImages.length){
  const ids = itemsWithoutImages.map(i=>i.serviceId);
  const images = await db.select({serviceId: professionalServiceImages.serviceId, publicId: fileAssets.cloudinaryPublicId})
    .from(professionalServiceImages).innerJoin(fileAssets, eq(fileAssets.id, professionalServiceImages.assetId))
    .where(and(inArray(professionalServiceImages.serviceId, ids), eq(fileAssets.visibility,"public"), eq(fileAssets.status,"ready"), eq(fileAssets.purpose,"SERVICE_IMAGE")))
    .orderBy(asc(professionalServiceImages.position));
  const map = new Map(); for(const r of images) if(!map.has(r.serviceId)) map.set(r.serviceId, r.publicId);
  items = itemsWithoutImages.map(({serviceId,...rest})=>({...rest, imagePublicId: map.get(serviceId)??null}));
}
```

**Volatile JSONB per-row** `availability=today` `sql`coalesce(working_hours -> lower(to_char(now() at time zone 'Africa/Nairobi','FMDay'))->>'enabled','false')='true'`` → seq scan 32s.

Fix: compute day in JS, use GIN `@>`:

```ts
if(input.availability==="today"){
  const day = new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Nairobi",weekday:"long"}).format(new Date()).toLowerCase();
  conditions.push(sql`${professionalProfiles.workingHours} @> ${JSON.stringify({[day]:{enabled:true}})}::jsonb`);
}
// + migration: CREATE INDEX professional_profiles_working_hours_gin_idx ON professional_profiles USING gin (working_hours);
```

**OR with GIN/btree** `location` `serviceAreas @> OR serviceAreas @> OR lower(operatingLocation)=` → planner skips indexes. Keep but ensure `professional_profiles_service_areas_idx USING gin`, `professional_profiles_operating_location_lower_idx USING btree(lower(...))`, and consider `UNION ALL` if still slow.

**Case-sensitive btree miss** `lower(category)=lower($1)` without functional index → seq scan. Added `CREATE INDEX professional_services_category_lower_idx ON professional_services USING btree (lower(category));` `src/platform/database/schema/professional-services.ts:139`. Same for `operating_location`.

**Partial indexes for hot filters** `drizzle/0046_marketplace_filter_optimizations.sql`:
```sql
CREATE INDEX professional_services_fulfilment_marketplace_idx ON professional_services (fulfilment_model) WHERE status='published' AND moderation_status='clear';
CREATE INDEX professional_services_pricing_marketplace_idx ON professional_services (pricing_model) WHERE status='published' AND moderation_status='clear';
CREATE INDEX professional_services_direct_booking_marketplace_idx ON professional_services (direct_booking_enabled, estimated_duration_minutes) WHERE status='published' AND moderation_status='clear';
CREATE INDEX professional_profiles_working_hours_gin_idx ON professional_profiles USING gin (working_hours);
```

**Pagination** `professional_services_marketplace_pagination_idx ON (status, moderation_status, published_at DESC, id)` `src/platform/database/schema/professional-services.ts:133` — always `ORDER BY published_at DESC, id` with `LIMIT/OFFSET`. Keep tiebreaker `id`.

**Count** — same `WHERE` as `base`, ensure it hits same partial indexes. For >1000 rows consider `EXPLAIN ANALYZE` + cached total.

## 3. Caching — Server

```ts
// src/lib/marketplace-server.ts
export const getCachedCategories = unstable_cache(fetchCategoriesDirect, ["marketplace-categories-v2"], {revalidate:300, tags:["marketplace-categories"]});
function stableKey(input: MarketplaceSearchQuery){ return JSON.stringify([input.q,input.category,input.location,input.fulfilmentModel,input.pricingModel,input.availability,input.verified,input.topRated,input.instantBooking,input.sort,input.page,input.pageSize]) }
export async function searchMarketplaceServer(input){
  const key=stableKey(input);
  const cached=unstable_cache(()=>fetchMarketplaceDirect(input), ["marketplace-search-v2",key], {revalidate:30, tags:["marketplace"]});
  return cached();
}
// src/app/marketplace/page.tsx
export const revalidate = 30;
```

Client `fetch` for same route should not re-fetch if server provided `initialResult` / `initialSearchKey`. Guard `useEffect` `src/components/marketplace/marketplace-results-client.tsx:145` `if(initialSearchKey===searchKey) return;`.

Private `unread-count` / `saved-professionals` — `cache:"force-cache", next:{revalidate:30}` `src/components/notifications/notification-api.ts:15` only when `session?.user`; otherwise skip fetch `src/components/marketplace/marketplace-filters-client.tsx:391` `if(!session?.user) return`.

## 4. Caching — CDN / Headers

```ts
// next.config.ts
async headers(){ return [{source:"/api/v1/public/:path*", headers:[{key:"Cache-Control",value:"public, max-age=30, stale-while-revalidate=60"},{key:"CDN-Cache-Control",value:"public, s-maxage=60, stale-while-revalidate=120"}]}] }
// src/platform/http/public-cache.ts
export function applyPublicProjectionCache(c){ c.header("cache-control","public, max-age=30, stale-while-revalidate=60"); c.header("vary","Origin, Accept-Encoding"); }
```

Cloudflare `Cache Everything` + `Origin Cache Control` for `/api/v1/public/*`.

## 5. Streaming — Chunked Suspense

Single `await Promise.all([cats,result])` before `return` blocks shell 12s. Stream:

```tsx
// src/app/marketplace/page.tsx
import { Suspense } from "react";
import { MarketplaceHeaderSection } from "@/components/marketplace/marketplace-header-section"; // client, no data
import { FiltersDesktopServer, FiltersMobileServer } from "@/components/marketplace/filters-server"; // async getCachedCategories
import { ResultsServer } from "@/components/marketplace/results-server"; // async searchMarketplaceServer
import { MarketplaceFiltersSkeleton, MarketplaceResultsSkeleton, QuickFiltersSkeleton } from "@/components/marketplace/marketplace-skeletons";

export default async function Page({searchParams}){
  const sp=await searchParams; const input=parse(sp); const searchKey=toSearchParams(sp).toString();
  return (
    <PublicShell marketplace>
      <MarketplaceHeaderSection /> {/* instant */}
      <div className="mt-5 min-[960px]:hidden"><Suspense fallback={<MarketplaceFiltersSkeleton compact/>}><FiltersMobileServer/></Suspense></div>
      <div className="mt-4 grid gap-4 min-[960px]:grid-cols-[236px_1fr_220px]">
        <aside className="hidden min-[960px]:block"><Suspense fallback={<MarketplaceFiltersSkeleton/>}><FiltersDesktopServer/></Suspense></aside>
        <div className="min-w-0"><Suspense fallback={<><QuickFiltersSkeleton/><MarketplaceResultsSkeleton count={9}/></>}><ResultsServer input={input} searchKey={searchKey}/></Suspense></div>
        <aside className="hidden min-[960px]:block"><HelpCardStatic/><PopularServicesStatic/></aside> {/* static, no suspense */}
      </div>
    </PublicShell>
  );
}
```

Each `async` server component suspends independently → `TTFB <200ms` (header), `filters <50ms` (300s cache), `results <300ms` (30s). `loading.tsx` should use `MarketplacePageSkeleton` `src/app/marketplace/loading.tsx:1`, not `StatePanel`.

Skeletons must match layout exactly: `ServiceCardSkeleton` `src/components/marketplace/service-card.tsx:48` `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`, `FilterChipSkeleton` `src/components/ui/workspace-skeletons.tsx:62`, `Skeleton` `src/components/ui/skeleton.tsx:1` `animate-pulse bg-muted`, wrappers `role="status" aria-label aria-busy="true"` like `SavedItemsLoadingSkeleton`.

## 6. Pending UI — Filters & Pagination

`router.push` without `useTransition` shows no fallback on same-route `?category=` navigations.

```tsx
// marketplace-filters-client.tsx + marketplace-results-client.tsx
const [isPending, startTransition] = useTransition();
function navigate(next: URLSearchParams){
  const href = next.toString() ? `/marketplace?${next}` : "/marketplace";
  startTransition(()=> router.push(href));
}
// then
const loading = fetching || isPending;
const hasStaleResult = isPending && request.result;
// UI:
// - Show results: <Button loading={isPending} disabled={isPending} aria-busy>
// - Selects: disabled={isPending} aria-busy
// - QuickFilters pills: disabled={isPending} aria-busy, opacity-60
// - Active pills: disabled
// - Pagination: <Button disabled={isPending||page<=1} loading={isPending}>
// - Grid: if(isPending && result) => keep previous cards opacity-60 + overlay <div role="status">Updating…</div> else if(loading) => <MarketplaceResultsSkeleton/>
```

Filters stay interactive, results dim with overlay — no CLS.

## 7. Images

Cloudinary already `f_auto,q_auto,c_fill,w_600,h_400` `src/modules/marketplace/service.ts:17`. Next `/_next/image?url=https://res.cloudinary.com...` was re-optimizing via `sharp` 900ms per image 101 requests.

Fix: `<Image unoptimized={Boolean(src.includes("res.cloudinary.com"))} priority={index<3} loading={priority?undefined:"lazy"} fetchPriority={priority?"high":"low"} sizes="(max-width:639px)50vw,(max-width:1199px)33vw,400px" />` `src/components/marketplace/marketplace-results-client.tsx:450`.

`next.config.ts` keep `formats:["image/avif","image/webp"]`, `deviceSizes/imageSizes`, but for Cloudinary use `unoptimized` to avoid double transform. `FALLBACK`/category PNGs still via `/_next/image` cached.

## 8. Prefetch & Bundle

``tsx
// footer, header, cards beyond viewport
<Link href="/how-it-works" prefetch={false} />
<Link href={`/services/${slug}`} prefetch={false} />
// only first 3 cards priority, rest lazy
```

`next.config.ts` `experimental:{optimizePackageImports:["lucide-react","recharts","@radix-ui/react-dialog","@radix-ui/react-dropdown-menu","@radix-ui/react-label","@radix-ui/react-tooltip"]}`, `compress:true`.

## 9. Checklist for Other Pages

For `src/app/client/requests/page.tsx`, `professional/jobs/page.tsx`, `admin/*` etc:

- [ ] `createDatabaseClient` pooled? Remove `pool.end()` per request, reuse via `databaseClient` context.
- [ ] `unstable_cache` + `revalidate` + `tags`? Stable key, not `Date.now()` in key.
- [ ] Partial / GIN index for every `where` column used in filters? Run `EXPLAIN (ANALYZE, BUFFERS)` on seeded 30 rows.
- [ ] No correlated `SELECT ... WHERE x.id = y.id LIMIT 1` — batch with `inArray`.
- [ ] `Suspense` per data dependency, not one `Promise.all` before shell. `loading.tsx` uses matching skeletons, not generic `StatePanel`.
- [ ] `useTransition` for every `router.push` from filters/sort/page/quick-pill/location. Disable inputs, show overlay/skeleton, `aria-busy`.
- [ ] `prefetch={false}` for footer/secondary cards, `unoptimized` for Cloudinary, `priority` first viewport only.
- [ ] `applyPublicProjectionCache` + `next.config.ts headers` for `GET /api/v1/public/*`.
- [ ] Measure: `curl -w %{time_starttransfer}` p50 `<100ms categories / <400ms search (cached <50ms)`, DevTools `TTFB <600ms / LCP <2.5s / JS <300kb gz`.

## 10. Verification (per AGENTS.md)

`npm run typecheck` `npm run lint` `npm run build --webpack` (86 routes) `npm run test` (`vitest.*.config.ts`) + `EXPLAIN ANALYZE` shows `Index Scan` not `Seq Scan`, `npx playwright test e2e/marketplace.spec.ts` for filter/pagination/sort with `isPending` skeleton.

