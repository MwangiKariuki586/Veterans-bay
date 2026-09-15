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
import Image from "next/image";
import { Star, ArrowRight } from "lucide-react";

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

const popularServices = [
  { name: "Water Heater Repair", price: "From KSh 3,500", image: "/images/category-appliance.png" },
  { name: "Toilet Installation", price: "From KSh 3,000", image: "/images/category-plumbing.png" },
  { name: "Leak Detection", price: "From KSh 2,000", image: "/images/category-plumbing.png" },
] as const;

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

function PopularServicesStatic() {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4">
      <h2 className="font-semibold">Popular near you</h2>
      <div className="mt-3 border-t border-black/8 pt-2">
        {popularServices.map((service) => (
          <div key={service.name} className="flex gap-3 border-b border-black/8 py-3 last:border-0">
            <Image src={service.image} alt="" width={54} height={54} className="size-[54px] rounded-lg object-cover" />
            <div className="min-w-0 text-[0.68rem] leading-4">
              <p className="font-semibold">{service.name}</p>
              <p className="text-[#52647a]">{service.price}</p>
              <p className="mt-1 text-[#52647a]">
                <Star className="mr-1 inline size-3 fill-[#ffb000] text-[#ffb000]" />
                Popular locally
              </p>
            </div>
          </div>
        ))}
      </div>
      <Link href="/categories" prefetch={false} className="mt-3 flex min-h-9 items-center justify-between text-[0.7rem] font-semibold text-[#17304f]">
        View all popular services <ArrowRight className="size-4" />
      </Link>
    </div>
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

          {/* Right: Help + Popular - static, no suspense, renders instantly */}
          <aside className="hidden space-y-4 min-[960px]:block">
            <HelpCardStatic />
            <PopularServicesStatic />
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
