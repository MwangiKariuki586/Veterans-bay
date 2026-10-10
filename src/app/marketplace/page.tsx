import { Suspense } from "react";

import { PublicShell } from "@/components/public/public-shell";
import { FiltersDesktopServer, FiltersMobileServer } from "@/components/marketplace/filters-server";
import { ResultsServer } from "@/components/marketplace/results-server";
import { MarketplaceHeaderSection } from "@/components/marketplace/marketplace-header-section";
import {
  HelpCardSkeleton,
  MarketplaceFiltersSkeleton,
  MarketplaceResultsSkeleton,
  PopularServicesSkeleton,
  QuickFiltersSkeleton,
} from "@/components/marketplace/marketplace-skeletons";
import { marketplaceSearchQuerySchema } from "@/modules/marketplace/schemas";
import { PopularServicesServer } from "@/components/marketplace/popular-services-server";
import { GetMatchedHelpCard } from "@/components/matching/get-matched-help-card";

type SearchParams = Record<string, string | string[] | undefined>;

function toSearchParams(input: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

function parseMarketplaceInput(searchParams: SearchParams) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    raw[k] = Array.isArray(v) ? v[0] : v;
  }
  const parsed = marketplaceSearchQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return marketplaceSearchQuerySchema.parse({});
}

export const revalidate = 30;

function MarketplaceMobileControlsFallback() {
  return (
    <section className="mt-5 rounded-2xl border border-black/8 bg-white/85 p-3 sm:p-4 min-[960px]:hidden" aria-label="Marketplace controls" aria-busy="true">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
      </div>
      <QuickFiltersSkeleton />
    </section>
  );
}

export default async function MarketplaceRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const input = parseMarketplaceInput(sp);
  const searchKey = toSearchParams(sp).toString();

  return (
    <PublicShell marketplace>
      <main>
        {/* Header streams instantly - no data dependency */}
        <MarketplaceHeaderSection />

        {/* Mobile filters - streams fast (categories) */}
        <div className="mt-5 min-[960px]:hidden">
          <Suspense fallback={<MarketplaceFiltersSkeleton compact />}>
            <FiltersMobileServer />
          </Suspense>
        </div>

        <div className="mt-4 grid gap-4 min-[960px]:grid-cols-[236px_minmax(0,1fr)_220px] min-[1200px]:grid-cols-[250px_minmax(0,1fr)_230px]">
          {/* Left: Refine - streams independently (categories 300s) */}
          <aside className="hidden min-[960px]:block">
            <Suspense fallback={<MarketplaceFiltersSkeleton />}>
              <FiltersDesktopServer />
            </Suspense>
          </aside>

          {/* Center: Results - streams after search (30s cache, slower) */}
          <div className="min-w-0">
            <Suspense
              fallback={
                <div className="space-y-4">
                  <QuickFiltersSkeleton />
                  <MarketplaceResultsSkeleton count={9} />
                </div>
              }
            >
              <ResultsServer input={input} searchKey={searchKey} />
            </Suspense>
          </div>

          {/* Right: Help + Popular - sticky like filters, CSS-only */}
          <aside className="hidden min-[960px]:block">
            <div className="sticky top-5 space-y-4">
              <GetMatchedHelpCard />
              <Suspense fallback={<PopularServicesSkeleton />}>
                <PopularServicesServer location={input.location} />
              </Suspense>
            </div>
          </aside>
        </div>

        {/* Mobile help - static */}
        <div className="mt-5 min-[960px]:hidden">
          <GetMatchedHelpCard />
        </div>
      </main>
    </PublicShell>
  );
}
