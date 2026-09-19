"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock3,
  Grid2X2,
  Heart,
  Headphones,
  List,
  MapPin,
  ShieldCheck,
  Star,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useOptionalQueryClient } from "@/lib/optional-query-client";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

import { ServiceCard } from "./service-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/utils";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import type { MarketplaceListing, MarketplaceSearchResult } from "@/modules/marketplace/types";
import { MarketplaceResultsSkeleton, QuickFiltersSkeleton } from "./marketplace-skeletons";

function apiSearchParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of ["q", "category", "location", "fulfilmentModel", "pricingModel", "availability", "verified", "topRated", "instantBooking", "sort", "page"]) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  next.set("pageSize", "9");
  return next;
}

function formatPrice(listing: MarketplaceListing) {
  if (listing.pricingModel === "custom_quote") return "Custom quote";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: listing.currency, maximumFractionDigits: 0 })
    .format((listing.priceMinor ?? 0) / 100)
    .replace("KES", "KSh");
}

function formatNextSlot(listing: MarketplaceListing) {
  const slot = listing.provider.nextAvailableSlot;
  if (!slot) return "Check availability";
  const startsAt = new Date(slot.startsAt);
  const day = new Intl.DateTimeFormat("en-KE", { timeZone: slot.timezone, weekday: "short" }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-KE", { timeZone: slot.timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(startsAt);
  return listing.provider.availableToday ? time : `${day}, ${time}`;
}

function activeFilters(searchParams: URLSearchParams) {
  const labels: Record<string, string> = {
    q: "Search",
    category: "Category",
    location: "Location",
    fulfilmentModel: "Service type",
    pricingModel: "Pricing",
    availability: "Availability",
    verified: "Verification",
    topRated: "Top rated",
    instantBooking: "Instant booking",
  };
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = searchParams.get(key);
    return value ? [{ key, label, value: formatActiveFilterValue(key, value) }] : [];
  });
}

function formatActiveFilterValue(key: string, value: string) {
  const values: Record<string, Record<string, string>> = {
    availability: { today: "Available Today" },
    verified: { true: "Verified", false: "Not Verified" },
    topRated: { true: "Top Rated" },
    instantBooking: { true: "Instant Booking" },
    fulfilmentModel: { on_site: "On-site", remote: "Remote", hybrid: "Hybrid" },
    pricingModel: { fixed: "Fixed Price", starting_from: "Starting From", custom_quote: "Custom Quote" },
  };
  return values[key]?.[value] ?? value.replaceAll("_", " ");
}

function fallbackImage(category: string) {
  const value = category.toLowerCase();
  if (value.includes("electric")) return "/images/category-electrical.png";
  if (value.includes("clean")) return "/images/category-cleaning.png";
  if (value.includes("paint")) return "/images/category-painting.png";
  if (value.includes("appliance")) return "/images/category-appliance.png";
  return "/images/category-plumbing.png";
}

export function MarketplaceResultsClient({
  initialResult,
  initialError,
  initialSearchKey,
}: {
  initialResult?: MarketplaceSearchResult | null;
  initialError?: string | null;
  initialSearchKey?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useOptionalQueryClient();
  const searchKey = searchParams.toString();
  const currentSearchParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const [isPending, startTransition] = useTransition();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const requestKey = `${searchKey}:${retryAttempt}`;
  const hasServerResultForKey = initialSearchKey !== undefined && initialSearchKey === requestKey;
  const [request, setRequest] = useState<{ key: string; result: MarketplaceSearchResult | null; error: string | null }>(() => {
    if (hasServerResultForKey) {
      return { key: requestKey, result: initialResult ?? null, error: initialError ?? null };
    }
    if (initialSearchKey !== undefined && initialSearchKey === searchKey && retryAttempt === 0) {
      return { key: `${initialSearchKey}:0`, result: initialResult ?? null, error: initialError ?? null };
    }
    return { key: "", result: null, error: null };
  });
  const [view, setView] = useState<"grid" | "list">("grid");
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());
  const [savingProviders, setSavingProviders] = useState<Set<string>>(new Set());
  const filters = useMemo(() => activeFilters(currentSearchParams), [currentSearchParams]);
  const fetching = request.key !== requestKey;
  const loading = fetching || isPending;
  const result = fetching ? null : request.result;
  const error = fetching ? null : request.error;
  const hasStaleResult = isPending && request.result && request.key === `${searchKey}:${retryAttempt}`;

  useEffect(() => {
    if (initialSearchKey === undefined) return;
    if (initialSearchKey === searchKey && retryAttempt === 0) {
      const key = `${searchKey}:0`;
      if (request.key !== key) {
        setRequest({ key, result: initialResult ?? null, error: initialError ?? null });
      }
    }
  }, [initialSearchKey, initialResult, initialError, searchKey, retryAttempt, request.key]);

  useEffect(() => {
    if (request.key === requestKey) return;
    // Perf: rely on server RSC streaming (unstable_cache) for marketplace search.
    // Client fetch is only for retry after server error or when server didn't provide data.
    // This eliminates duplicate fetch on navigation that bypasses 30s cache.
    if (initialSearchKey !== undefined && request.error == null && retryAttempt === 0) {
      if (initialSearchKey === searchKey) return;
      // During navigation, let RSC stream new result (show pending) instead of client fetch.
      return;
    }
    if (initialSearchKey !== undefined && initialSearchKey === searchKey && retryAttempt === 0 && initialResult !== undefined) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/v1/public/marketplace?${apiSearchParams(currentSearchParams)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { data?: MarketplaceSearchResult; error?: { message?: string } } | null;
        if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Marketplace results could not be loaded.");
        setRequest({ key: requestKey, result: body.data, error: null });
        recordMarketplaceEvent({
          eventType: "marketplace.search_performed",
          activeFilters: filters.map((filter) => filter.key as any),
          page: body.data.page,
          resultCount: body.data.totalItems,
          sort: currentSearchParams.get("sort") === "newest" ? "newest" : "relevance",
        });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRequest({ key: requestKey, result: null, error: cause instanceof Error ? cause.message : "Marketplace results could not be loaded." });
      });
    return () => controller.abort();
  }, [currentSearchParams, filters, requestKey, request.key, request.error, initialSearchKey, initialResult, searchKey, retryAttempt]);

  const { data: session } = authClient.useSession();
  useEffect(() => {
    if (!session?.user) return;
    const controller = new AbortController();
    void fetch("/api/v1/client/saved-professionals", { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return;
        const body = (await response.json().catch(() => null)) as { data?: Array<{ slug: string }> } | null;
        if (response.ok && body?.data) setSavedProviders(new Set(body.data.map((item) => item.slug)));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [session?.user]);

  async function toggleSaved(providerSlug: string) {
    if (savingProviders.has(providerSlug)) return;
    const isSaved = savedProviders.has(providerSlug);
    setSavingProviders((current) => new Set(current).add(providerSlug));
    try {
      const response = await fetch(`/api/v1/client/saved-professionals/${encodeURIComponent(providerSlug)}`, {
        method: isSaved ? "DELETE" : "POST",
        credentials: "include",
      });
      if (response.status === 401) {
        const returnPath = `/marketplace${searchKey ? `?${searchKey}` : ""}`;
        router.push(`/login?redirect=${encodeURIComponent(returnPath)}`);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Saved professionals could not be updated.");
      setSavedProviders((current) => {
        const next = new Set(current);
        if (isSaved) next.delete(providerSlug);
        else next.add(providerSlug);
        return next;
      });
      void queryClient?.invalidateQueries({ queryKey: ["client-overview"] });
      toast.success(isSaved ? "Removed from saved." : "Professional saved.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Saved professionals could not be updated.");
    } finally {
      setSavingProviders((current) => {
        const next = new Set(current);
        next.delete(providerSlug);
        return next;
      });
    }
  }

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    const href = query ? `/marketplace?${query}` : "/marketplace";
    startTransition(() => router.push(href));
  }

  function clearFilters() {
    const next = new URLSearchParams(currentSearchParams);
    for (const key of ["q", "category", "location", "fulfilmentModel", "pricingModel", "availability", "verified", "topRated", "instantBooking"]) next.delete(key);
    next.delete("page");
    navigate(next);
  }

  function removeFilter(key: string) {
    const next = new URLSearchParams(currentSearchParams);
    next.delete(key);
    next.delete("page");
    navigate(next);
  }

  function toggleQuickFilter(key: "availability" | "verified" | "location" | "topRated" | "instantBooking", value: string) {
    const next = new URLSearchParams(currentSearchParams);
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    navigate(next);
  }

  function updateSort(sort: string) {
    const next = new URLSearchParams(currentSearchParams);
    if (sort === "relevance") next.delete("sort");
    else next.set("sort", sort);
    next.delete("page");
    navigate(next);
  }

  function updatePage(page: number) {
    const next = new URLSearchParams(currentSearchParams);
    if (page === 1) next.delete("page");
    else next.set("page", String(page));
    navigate(next);
  }

  return (
    <>
      {isPending ? (
        <div role="status" aria-live="polite" className="sr-only">
          Updating marketplace results
        </div>
      ) : null}
      {filters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters" aria-busy={isPending || undefined}>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => removeFilter(filter.key)}
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#eef8c8] px-3 text-xs font-medium text-[#486d09] disabled:opacity-60"
            >
              {filter.value} <X className="size-3.5" />
              <span className="sr-only">Remove {filter.label} filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            disabled={isPending}
            className="min-h-8 px-2 text-xs font-semibold text-[#486d09] disabled:opacity-60"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <section aria-labelledby="marketplace-results-heading" className="mt-4 min-w-0" aria-busy={loading || isPending || undefined}>
        <div className="flex gap-2 min-[960px]:hidden">
          <select
            value={currentSearchParams.get("sort") ?? "relevance"}
            onChange={(event) => updateSort(event.target.value)}
            disabled={isPending}
            className="h-12 flex-1 appearance-none rounded-xl border border-black/10 bg-white px-4 pr-9 text-sm font-semibold disabled:opacity-60"
            aria-label="Sort services"
            aria-busy={isPending}
          >
            <option value="relevance">Sort: Most relevant</option>
            <option value="newest">Sort: Newest</option>
          </select>
          <ViewButton label="Grid view" active={view === "grid"} onClick={() => setView("grid")} disabled={isPending}>
            <Grid2X2 className="size-5" />
          </ViewButton>
          <ViewButton label="List view" active={view === "list"} onClick={() => setView("list")} disabled={isPending}>
            <List className="size-5" />
          </ViewButton>
        </div>
        <div className="hidden items-center justify-between gap-3 min-[960px]:flex">
          <p id="marketplace-results-heading" className="text-lg font-medium" aria-live="polite">
            {loading || isPending ? "Loading services" : <>{result?.totalItems ?? 0} services <span className="text-[#6d9e13]">in Nairobi</span></>}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={currentSearchParams.get("sort") ?? "relevance"}
              onChange={(event) => updateSort(event.target.value)}
              disabled={isPending}
              className="h-10 rounded-xl border border-black/8 bg-white px-3 text-[0.5rem] font-semibold disabled:opacity-60"
              aria-label="Sort services"
              aria-busy={isPending}
            >
              <option value="relevance">Sort by: Most relevant</option>
              <option value="newest">Sort by: Newest</option>
            </select>
            <ViewButton label="Grid view" active={view === "grid"} onClick={() => setView("grid")} disabled={isPending}>
              <Grid2X2 className="size-4" />
            </ViewButton>
            <ViewButton label="List view" active={view === "list"} onClick={() => setView("list")} disabled={isPending}>
              <List className="size-4" />
            </ViewButton>
          </div>
        </div>
        <div aria-busy={isPending || undefined} className={cn(isPending && "opacity-60")}>
          <QuickFilters current={currentSearchParams} onToggle={toggleQuickFilter} disabled={isPending} />
        </div>

        <div className="mt-4">
          {loading ? (
            <MarketplaceResultsSkeleton />
          ) : isPending && result ? (
            <div className="relative">
              <div className="grid gap-3 opacity-60 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
                {result.items.map((service, index) => (
                  <MarketplaceCard
                    key={service.slug}
                    service={service}
                    listView={view === "list"}
                    priority={index < 3}
                    saved={savedProviders.has(service.provider.slug)}
                    saving={savingProviders.has(service.provider.slug)}
                    onToggleSaved={() => toggleSaved(service.provider.slug)}
                  />
                ))}
              </div>
              <div className="absolute inset-0 grid place-items-center bg-white/40">
                <div role="status" aria-label="Updating results" className="rounded-full bg-white px-4 py-2 text-xs font-semibold shadow">
                  Updating…
                </div>
              </div>
              <div className="sr-only" aria-live="polite">
                Updating marketplace results
              </div>
            </div>
          ) : error ? (
            <StatePanel variant="error" title="Marketplace unavailable" description={error} actionLabel="Try again" onAction={() => setRetryAttempt((c) => c + 1)} className="min-h-72 font-semibold" />
          ) : result && result.items.length > 0 ? (
            <div className={cn("grid gap-3", view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {result.items.map((service, index) => (
                <MarketplaceCard
                  key={service.slug}
                  service={service}
                  listView={view === "list"}
                  priority={index < 3}
                  saved={savedProviders.has(service.provider.slug)}
                  saving={savingProviders.has(service.provider.slug)}
                  onToggleSaved={() => toggleSaved(service.provider.slug)}
                />
              ))}
            </div>
          ) : (
            <StatePanel
              variant={filters.length > 0 ? "filtered" : "empty"}
              title={filters.length > 0 ? "No services match these filters" : "No published services yet"}
              description={filters.length > 0 ? "Try removing a filter or broadening your search." : "Published services from active professionals will appear here."}
              actionLabel={filters.length > 0 ? "Clear filters" : undefined}
              onAction={filters.length > 0 ? clearFilters : undefined}
              className="min-h-72"
            />
          )}
        </div>

        {result && result.totalPages > 1 ? (
          <nav className="mt-7 flex items-center justify-between gap-3" aria-label="Marketplace pagination" aria-busy={isPending || undefined}>
            <Button type="button" variant="outline" size="sm" disabled={isPending || result.page <= 1} loading={isPending} onClick={() => updatePage(result.page - 1)}>
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <p className="text-xs text-[#68717b]">Page {result.page} of {result.totalPages}</p>
            <Button type="button" variant="outline" size="sm" disabled={isPending || result.page >= result.totalPages} loading={isPending} onClick={() => updatePage(result.page + 1)}>
              Next <ArrowRight className="size-4" />
            </Button>
          </nav>
        ) : isPending && !result ? (
          <div className="mt-7 flex items-center justify-between gap-3" aria-busy="true">
            <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : null}
      </section>
    </>
  );
}

function ViewButton({ label, active, onClick, children, disabled }: { label: string; active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg disabled:opacity-60",
        active ? "bg-primary shadow-[0_5px_14px_rgba(173,222,0,0.3)]" : "bg-white",
      )}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function QuickFilters({
  current,
  onToggle,
  disabled,
}: {
  current: URLSearchParams;
  onToggle: (key: "availability" | "verified" | "location" | "topRated" | "instantBooking", value: string) => void;
  disabled?: boolean;
}) {
  const itemClass =
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-black/8 bg-white px-4 text-xs font-medium text-[#203953] transition hover:border-[#a7d923] disabled:opacity-60";
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Quick filters" aria-busy={disabled || undefined}>
      <button type="button" disabled={disabled} onClick={() => onToggle("availability", "today")} aria-pressed={current.get("availability") === "today"} className={cn(itemClass, current.get("availability") === "today" && "border-[#9aca1d] bg-[#f6fce8]")}>
        <CalendarDays className="size-4 text-[#6d9e13]" /> Available Today
      </button>
      <button type="button" disabled={disabled} onClick={() => onToggle("verified", "true")} aria-pressed={current.get("verified") === "true"} className={cn(itemClass, current.get("verified") === "true" && "border-[#9aca1d] bg-[#f6fce8]")}>
        <ShieldCheck className="size-4 text-[#6d9e13]" /> Verified
      </button>
      <button type="button" disabled={disabled} onClick={() => onToggle("topRated", "true")} aria-pressed={current.get("topRated") === "true"} className={cn(itemClass, current.get("topRated") === "true" && "border-[#9aca1d] bg-[#f6fce8]")}>
        <Star className="size-4 text-[#ffb000]" /> Top Rated
      </button>
      <button type="button" disabled={disabled} onClick={() => onToggle("location", "Nairobi")} aria-pressed={current.get("location") === "Nairobi"} className={cn(itemClass, current.get("location") === "Nairobi" && "border-[#9aca1d] bg-[#f6fce8]")}>
        <MapPin className="size-4" /> Near Me
      </button>
      <button type="button" disabled={disabled} onClick={() => onToggle("instantBooking", "true")} aria-pressed={current.get("instantBooking") === "true"} className={cn(itemClass, current.get("instantBooking") === "true" && "border-[#9aca1d] bg-[#f6fce8]")}>
        <Zap className="size-4 text-[#ffb000]" /> Instant Booking
      </button>
    </div>
  );
}

function MarketplaceCard({
  service,
  listView,
  saved,
  saving,
  onToggleSaved,
  priority = false,
}: {
  service: MarketplaceListing;
  listView: boolean;
  saved: boolean;
  saving: boolean;
  onToggleSaved: () => void;
  priority?: boolean;
}) {
  const location = service.provider.operatingLocation ?? service.serviceAreas[0] ?? "Location confirmed with provider";
  const topRated = service.provider.rating != null && service.provider.rating >= 4.7 && service.provider.reviewCount > 0;
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,38,52,0.1)]", listView && "sm:grid sm:grid-cols-[220px_minmax(0,1fr)]", "max-sm:grid max-sm:grid-cols-[42%_58%]")}>
      <button
        type="button"
        onClick={onToggleSaved}
        disabled={saving}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${service.provider.businessName} from saved` : `Save ${service.provider.businessName}`}
        className={cn("absolute top-2.5 right-2.5 z-20 grid size-8 place-items-center rounded-full border border-black/10 bg-white text-[#17304f] shadow-[0_3px_10px_rgba(7,21,34,0.16)]", saved && "bg-[#eff8cf] text-[#5f8d11]")}
      >
        <Heart className={cn("size-4", saved && "fill-current")} />
      </button>
      <Link
        href={`/services/${service.slug}`}
        prefetch={false}
        className={cn("relative block min-h-[150px] bg-[#edf5d5] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", listView ? "sm:h-full sm:min-h-full sm:self-stretch sm:aspect-auto" : "sm:aspect-[16/9] sm:min-h-0")}
        aria-label={`Open ${service.name}`}
      >
        <Image
          src={service.imageUrl ?? fallbackImage(service.category)}
          alt={service.name}
          fill
          unoptimized={Boolean(service.imageUrl?.includes("res.cloudinary.com"))}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          className="object-cover"
          sizes="(max-width: 639px) 50vw, (max-width: 1199px) 33vw, 400px"
        />
        {service.provider.availableToday ? (
          <span aria-label="Service status: Available Today" className="absolute top-2.5 left-2.5 rounded-full bg-primary px-2.5 py-1 text-[0.58rem] font-medium text-[#102300]">
            Available Today
          </span>
        ) : topRated ? (
          <span aria-label="Service status: Top Rated" className="absolute top-2.5 left-2.5 rounded-full bg-[#ffc21a] px-2.5 py-1 text-[0.58rem] font-medium text-[#2d2400]">
            Top Rated
          </span>
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-col p-3 sm:p-4">
        <h2 className="pr-8 text-sm leading-5 font-semibold sm:text-[0.88rem]">
          <Link href={`/services/${service.slug}`} prefetch={false} className="hover:underline">
            {service.name}
          </Link>
        </h2>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[0.72rem] text-[#40536c]">
          <span className="truncate">{service.provider.businessName}</span>
          {service.provider.verified ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[#65970d]">
              <BadgeCheck className="size-3.5" /> Verified
            </span>
          ) : null}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-[#52647a]">
          {service.provider.rating == null ? (
            <span>New professional</span>
          ) : (
            <>
              <Star className="size-3 fill-[#ffb000] text-[#ffb000]" />
              <span>
                {service.provider.rating.toFixed(1)} ({service.provider.reviewCount})
              </span>
            </>
          )}
          <span aria-hidden="true">•</span>
          <span>
            {service.provider.experienceYears == null ? "Experience not listed" : service.provider.experienceYears === 0 ? "Under 1 year" : `${service.provider.experienceYears}+ years`}
          </span>
        </p>
        <p className="mt-1 line-clamp-1 text-[0.72rem] text-[#52647a]">
          <MapPin className="mr-1 inline size-3" />
          {location}
        </p>
        <p className="mt-1 mb-2 line-clamp-1 text-[0.72rem] text-[#52647a]">
          <Clock3 className="mr-1 inline size-3 text-[#789a1d]" /> Next slot: <span className="font-medium text-[0.72rem]">{formatNextSlot(service)}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/8 pt-2 max-sm:mt-2">
          <div>
            <p className="text-[0.58rem] text-[#68717b]">{service.pricingModel === "custom_quote" ? "Pricing" : service.pricingModel === "starting_from" ? "Starting from" : "Fixed price"}</p>
            <p className="text-sm font-semibold">{formatPrice(service)}</p>
          </div>
          <Link href={`/services/${service.slug}`} prefetch={false} aria-label={`View ${service.name}`} className="grid size-8 place-items-center rounded-full bg-primary">
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
