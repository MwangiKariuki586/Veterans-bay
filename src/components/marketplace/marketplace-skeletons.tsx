import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCardSkeleton } from "./service-card";

export function MarketplaceFiltersSkeleton({ compact = false }: { compact?: boolean } = {}) {
  return (
    <div
      role="status"
      aria-label="Loading filters"
      aria-busy="true"
      className={
        compact
          ? "grid gap-3"
          : "rounded-2xl border border-black/8 bg-white p-4"
      }
    >
      {!compact ? (
        <Skeleton className="h-5 w-32" />
      ) : null}
      <div className={compact ? "grid gap-3" : "mt-4 grid gap-3"}>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
        <Skeleton className="mt-2 h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function QuickFiltersSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading quick filters"
      aria-busy="true"
      className="mt-3 flex gap-2 overflow-hidden pb-1"
    >
      <Skeleton className="h-11 w-36 shrink-0 rounded-xl" />
      <Skeleton className="h-11 w-28 shrink-0 rounded-xl" />
      <Skeleton className="h-11 w-28 shrink-0 rounded-xl" />
      <Skeleton className="h-11 w-28 shrink-0 rounded-xl" />
      <Skeleton className="h-11 w-36 shrink-0 rounded-xl" />
    </div>
  );
}

export function MarketplaceResultsSkeleton({ count = 9 }: { count?: number } = {}) {
  return (
    <div
      role="status"
      aria-label="Loading services"
      aria-busy="true"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MarketplaceHeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading header" aria-busy="true" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/[0.06] pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
          <Skeleton className="h-4 w-64 sm:w-80" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl sm:w-[13rem]" />
      </div>
      <div className="hidden items-center justify-between gap-3 min-[960px]:flex">
        <Skeleton className="h-6 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </div>
      <QuickFiltersSkeleton />
    </div>
  );
}

export function PopularServicesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading popular services"
      aria-busy="true"
      className="rounded-2xl border border-black/8 bg-white p-4"
    >
      <Skeleton className="h-5 w-32" />
      <div className="mt-3 border-t border-black/8 pt-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-3 border-b border-black/8 py-3 last:border-0">
            <Skeleton className="size-[54px] shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  );
}

export function HelpCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading help"
      aria-busy="true"
      className="rounded-2xl border border-[#e8ecd7] bg-[#fbfdf4] p-5"
    >
      <Skeleton className="size-11 rounded-full" />
      <Skeleton className="mt-3 h-5 w-40" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-5/6" />
      <Skeleton className="mt-4 h-10 w-full rounded-xl" />
    </div>
  );
}

export function PaginationSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading pagination"
      aria-busy="true"
      className="mt-7 flex items-center justify-between gap-3"
    >
      <Skeleton className="h-9 w-24 rounded-xl" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-24 rounded-xl" />
    </div>
  );
}

export function MarketplacePageSkeleton() {
  return (
    <div className="marketplace-page" aria-busy="true">
      <MarketplaceHeaderSkeleton />
      <div className="mt-4 grid gap-4 min-[960px]:grid-cols-[236px_minmax(0,1fr)_220px] min-[1200px]:grid-cols-[250px_minmax(0,1fr)_230px]">
        <aside className="hidden min-[960px]:block">
          <MarketplaceFiltersSkeleton />
        </aside>
        <section className="min-w-0 space-y-4">
          <MarketplaceResultsSkeleton />
          <PaginationSkeleton />
        </section>
        <aside className="hidden space-y-4 min-[960px]:block">
          <HelpCardSkeleton />
          <PopularServicesSkeleton />
        </aside>
      </div>
    </div>
  );
}
