import { Suspense } from "react";
import Link from "next/link";

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
import { Star, ArrowRight } from "lucide-react";
import { PopularServicesServer } from "@/components/marketplace/popular-services-server";

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



function HelpCardStatic({ className }: { className?: string }) {
  return (
    <aside className={className ?? "rounded-2xl border border-[#e8ecd7] bg-[#fbfdf4] p-5"}>
      <span className="grid size-11 place-items-center rounded-full bg-[#eff8cf] text-[#648f12]">?</span>
      <h2 className="mt-3 text-base font-semibold">Need help choosing?</h2>
      <p className="mt-2 text-sm leading-6 text-[#425671]">Tell us what you need and we&apos;ll help you find the right professional.</p>
      <Link href="/contact" prefetch={false} className="mt-4 flex h-10 w-full items-center justify-between rounded-xl bg-primary px-4 text-xs font-semibold">
        Get matched <ArrowRight className="size-4" />
      </Link>
    </aside>
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
              <HelpCardStatic />
              <Suspense fallback={<PopularServicesSkeleton />}>
                <PopularServicesServer location={input.location} />
              </Suspense>
            </div>
          </aside>
        </div>

        {/* Mobile help - static */}
        <div className="mt-5 min-[960px]:hidden">
          <HelpCardStatic />
        </div>
      </main>
    </PublicShell>
  );
}
