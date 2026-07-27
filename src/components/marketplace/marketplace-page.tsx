"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Grid2X2,
  Heart,
  Headphones,
  List,
  MapPin,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import type {
  MarketplaceListing,
  MarketplaceSearchResult,
} from "@/modules/marketplace/types";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";

const trustItems = [
  { label: "Active professionals", icon: ShieldCheck },
  { label: "Authoritative pricing", icon: Tag },
  { label: "Verification shown", icon: BadgeCheck },
  { label: "Published services only", icon: Medal },
] as const;

const fallbackCategoryOptions = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Painting",
  "Appliance Repair",
] as const;

type FilterDraft = {
  q: string;
  category: string;
  location: string;
  fulfilmentModel: string;
  pricingModel: string;
  availability: string;
  verified: string;
};

const emptyDraft: FilterDraft = {
  q: "",
  category: "",
  location: "",
  fulfilmentModel: "",
  pricingModel: "",
  availability: "",
  verified: "",
};

function draftFrom(searchParams: URLSearchParams): FilterDraft {
  return {
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "",
    location: searchParams.get("location") ?? "",
    fulfilmentModel: searchParams.get("fulfilmentModel") ?? "",
    pricingModel: searchParams.get("pricingModel") ?? "",
    availability: searchParams.get("availability") ?? "",
    verified: searchParams.get("verified") ?? "",
  };
}

function apiSearchParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of [
    "q",
    "category",
    "location",
    "fulfilmentModel",
    "pricingModel",
    "availability",
    "verified",
    "sort",
    "page",
  ]) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  next.set("pageSize", "10");
  return next;
}

function formatPrice(listing: MarketplaceListing) {
  if (listing.pricingModel === "custom_quote") return "Custom quote";
  const amount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: listing.currency,
    maximumFractionDigits: 0,
  }).format((listing.priceMinor ?? 0) / 100);
  return listing.pricingModel === "starting_from" ? `From ${amount}` : amount;
}

function activeFilters(searchParams: URLSearchParams) {
  const labels: Record<string, string> = {
    q: "Search",
    category: "Category",
    location: "Location",
    fulfilmentModel: "Fulfilment",
    pricingModel: "Pricing",
    availability: "Availability",
    verified: "Verification",
  };
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = searchParams.get(key);
    return value ? [{ key, label, value }] : [];
  });
}

export function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearchParams = useMemo(
    () => new URLSearchParams(searchKey),
    [searchKey],
  );
  const [retryAttempt, setRetryAttempt] = useState(0);
  const requestKey = `${searchKey}:${retryAttempt}`;
  const [request, setRequest] = useState<{
    key: string;
    result: MarketplaceSearchResult | null;
    error: string | null;
  }>({ key: "", result: null, error: null });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftState, setDraftState] = useState<{
    key: string;
    value: FilterDraft;
  }>(() => ({ key: searchKey, value: draftFrom(currentSearchParams) }));
  const [view, setView] = useState<"grid" | "list">("grid");
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());
  const [categoryOptions, setCategoryOptions] = useState<readonly string[]>(
    fallbackCategoryOptions,
  );
  const [savingProviders, setSavingProviders] = useState<Set<string>>(new Set());
  const filters = useMemo(
    () => activeFilters(currentSearchParams),
    [currentSearchParams],
  );
  const draft =
    draftState.key === searchKey
      ? draftState.value
      : draftFrom(currentSearchParams);
  const setDraft = (value: FilterDraft) =>
    setDraftState({ key: searchKey, value });
  const loading = request.key !== requestKey;
  const result = loading ? null : request.result;
  const error = loading ? null : request.error;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/public/categories", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceCategorySummary[];
        } | null;
        if (response.ok && Array.isArray(body?.data) && body.data.length > 0) {
          setCategoryOptions(body.data.map((category) => category.name));
        }
      })
      .catch(() => {
        // The seeded fallback keeps discovery usable during a category API outage.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/v1/public/marketplace?${apiSearchParams(currentSearchParams)}`,
      {
      signal: controller.signal,
      },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceSearchResult;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(
            body?.error?.message ?? "Marketplace results could not be loaded.",
          );
        }
        setRequest({ key: requestKey, result: body.data, error: null });
        recordMarketplaceEvent({
          eventType: "marketplace.search_performed",
          activeFilters: filters.map(
            (filter) =>
              filter.key as
                | "q"
                | "category"
                | "location"
                | "fulfilmentModel"
                | "pricingModel"
                | "availability"
                | "verified",
          ),
          page: body.data.page,
          resultCount: body.data.totalItems,
          sort:
            currentSearchParams.get("sort") === "newest"
              ? "newest"
              : "relevance",
        });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRequest({
          key: requestKey,
          result: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Marketplace results could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [currentSearchParams, filters, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/client/saved-professionals", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) return;
        const body = (await response.json().catch(() => null)) as {
          data?: Array<{ slug: string }>;
        } | null;
        if (response.ok && Array.isArray(body?.data)) {
          setSavedProviders(new Set(body.data.map((item) => item.slug)));
        }
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          // Saving remains available even if initial saved state could not load.
        }
      });
    return () => controller.abort();
  }, []);

  async function toggleSaved(providerSlug: string) {
    if (savingProviders.has(providerSlug)) return;
    const isSaved = savedProviders.has(providerSlug);
    setSavingProviders((current) => new Set(current).add(providerSlug));
    try {
      const response = await fetch(
        `/api/v1/client/saved-professionals/${encodeURIComponent(providerSlug)}`,
        {
          method: isSaved ? "DELETE" : "POST",
          credentials: "include",
        },
      );
      if (response.status === 401) {
        const returnPath = `/marketplace${searchKey ? `?${searchKey}` : ""}`;
        router.push(`/login?redirect=${encodeURIComponent(returnPath)}`);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "Saved professionals could not be updated.",
        );
      }
      setSavedProviders((current) => {
        const next = new Set(current);
        if (isSaved) next.delete(providerSlug);
        else next.add(providerSlug);
        return next;
      });
      toast.success(isSaved ? "Removed from saved." : "Professional saved.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Saved professionals could not be updated.",
      );
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
    router.push(query ? `/marketplace?${query}` : "/marketplace");
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(currentSearchParams);
    for (const [key, value] of Object.entries(draft)) {
      if (value.trim()) next.set(key, value.trim());
      else next.delete(key);
    }
    next.delete("page");
    navigate(next);
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    const next = new URLSearchParams(currentSearchParams);
    for (const key of Object.keys(emptyDraft)) next.delete(key);
    next.delete("page");
    setDraft(emptyDraft);
    navigate(next);
  }

  function removeFilter(key: string) {
    const next = new URLSearchParams(currentSearchParams);
    next.delete(key);
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
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Find Services</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            Find Services
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Search published services from active professionals, with clear
            pricing and verification status.
          </p>
        </div>
        <MobileFilterSheet
          draft={draft}
          categoryOptions={categoryOptions}
          onDraftChange={setDraft}
          onSubmit={applyFilters}
          onClear={clearFilters}
          open={mobileFiltersOpen}
          onOpenChange={setMobileFiltersOpen}
          activeCount={filters.length}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map(({ label, icon: Icon }) => (
          <Surface key={label} className="flex items-center gap-3 p-4 shadow-none">
            <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </Surface>
        ))}
      </div>

      {filters.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => removeFilter(filter.key)}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/8 bg-white px-3 text-xs font-semibold"
            >
              {filter.label}: {filter.value.replaceAll("_", " ")}
              <X className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Remove {filter.label} filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-9 px-2 text-xs font-semibold text-[#5f8d11]"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_240px]">
        <aside className="hidden xl:block">
          <Surface className="sticky top-6 p-5 shadow-none">
            <h2 className="text-lg font-bold">Search and filters</h2>
            <p className="mt-1 text-xs leading-5 text-[#68717b]">
              Refine published services. Applied filters are saved in the URL.
            </p>
            <FilterForm
              draft={draft}
              categoryOptions={categoryOptions}
              onDraftChange={setDraft}
              onSubmit={applyFilters}
              onClear={clearFilters}
              compact
            />
          </Surface>
        </aside>
        <section aria-labelledby="marketplace-results-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="marketplace-results-heading" className="text-sm font-semibold">
              {loading
                ? "Loading services"
                : `${result?.totalItems ?? 0} ${
                    result?.totalItems === 1 ? "service" : "services"
                  } found`}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={currentSearchParams.get("sort") ?? "relevance"}
                onChange={(event) => updateSort(event.target.value)}
                className="h-10 rounded-full border border-black/8 bg-white px-3 text-xs"
                aria-label="Sort services"
              >
                <option value="relevance">Most relevant</option>
                <option value="newest">Newest published</option>
              </select>
              <button
                type="button"
                className={cn(
                  "grid size-10 place-items-center rounded-full border border-black/8",
                  view === "grid" && "bg-primary",
                )}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Grid2X2 className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={cn(
                  "grid size-10 place-items-center rounded-full border border-black/8",
                  view === "list" && "bg-primary",
                )}
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <StatePanel
                variant="loading"
                title="Loading services"
                description="Searching the latest published marketplace listings."
                className="min-h-72"
              />
            ) : error ? (
              <StatePanel
                variant="error"
                title="Marketplace unavailable"
                description={error}
                actionLabel="Try again"
                onAction={() => setRetryAttempt((current) => current + 1)}
                className="min-h-72"
              />
            ) : result && result.items.length > 0 ? (
              <div
                className={cn(
                  "grid gap-4",
                  view === "grid" ? "md:grid-cols-2" : "grid-cols-1",
                )}
              >
                {result.items.map((service) => (
                  <MarketplaceCard
                    key={service.slug}
                    service={service}
                    listView={view === "list"}
                    saved={savedProviders.has(service.provider.slug)}
                    saving={savingProviders.has(service.provider.slug)}
                    onToggleSaved={() => toggleSaved(service.provider.slug)}
                  />
                ))}
              </div>
            ) : (
              <StatePanel
                variant={filters.length > 0 ? "filtered" : "empty"}
                title={
                  filters.length > 0
                    ? "No services match these filters"
                    : "No published services yet"
                }
                description={
                  filters.length > 0
                    ? "Try removing a filter or broadening your search."
                    : "Published services from active professionals will appear here."
                }
                actionLabel={filters.length > 0 ? "Clear filters" : undefined}
                onAction={filters.length > 0 ? clearFilters : undefined}
                className="min-h-72"
              />
            )}
          </div>

          {result && result.totalPages > 1 ? (
            <nav
              className="mt-8 flex flex-wrap items-center justify-between gap-3"
              aria-label="Marketplace pagination"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={result.page <= 1}
                onClick={() => updatePage(result.page - 1)}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <p className="text-xs text-[#68717b]">
                Page {result.page} of {result.totalPages} · 10 per page
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={result.page >= result.totalPages}
                onClick={() => updatePage(result.page + 1)}
              >
                Next
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </section>

        <aside className="space-y-4">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Need help choosing?</h2>
            <p className="mt-2 text-sm text-[#68717b]">
              Tell us what needs attention and we’ll help you prepare a clear
              service request.
            </p>
            <Link
              href="/contact"
              className={cn(
                buttonVariants(),
                "mt-4 h-11 w-full justify-between rounded-full pr-1 pl-4 text-xs",
              )}
            >
              Get guidance
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </Surface>
          <Surface className="p-5 shadow-none">
            <h2 className="inline-flex items-center gap-2 font-bold">
              <Headphones className="size-4 text-[#5f8d11]" aria-hidden="true" />
              Need support?
            </h2>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-11 w-full justify-between rounded-full border-black/8 pr-1 pl-4 text-xs",
              )}
            >
              Contact support
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </Surface>
        </aside>
      </div>
    </div>
  );
}

function MobileFilterSheet({
  draft,
  categoryOptions,
  onDraftChange,
  onSubmit,
  onClear,
  open,
  onOpenChange,
  activeCount,
}: {
  draft: FilterDraft;
  categoryOptions: readonly string[];
  onDraftChange: (draft: FilterDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          className="xl:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Search & filters
          {activeCount > 0 ? (
            <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby="marketplace-filter-description"
        className="max-h-[90vh] p-0 xl:hidden"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <div className="border-b border-black/8 px-6 py-5 pr-16">
          <SheetTitle className="text-xl font-bold">Search and filter services</SheetTitle>
          <SheetDescription
            id="marketplace-filter-description"
            className="mt-1 text-sm leading-6 text-[#68717b]"
          >
            Narrow published marketplace services. Applying filters updates the
            URL so this search can be shared.
          </SheetDescription>
        </div>
        <FilterForm
          draft={draft}
          categoryOptions={categoryOptions}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          onClear={onClear}
        />
      </SheetContent>
    </Sheet>
  );
}

function FilterForm({
  draft,
  categoryOptions,
  onDraftChange,
  onSubmit,
  onClear,
  compact = false,
}: {
  draft: FilterDraft;
  categoryOptions: readonly string[];
  onDraftChange: (draft: FilterDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const fieldClass =
    "mt-2 h-11 w-full rounded-xl border border-black/8 bg-white px-3 text-sm outline-none focus:border-[#5f8d11] focus:ring-2 focus:ring-[#b8f52a]/35";
  const update = (key: keyof FilterDraft, value: string) =>
    onDraftChange({ ...draft, [key]: value });

  return (
    <form
      onSubmit={onSubmit}
      className={cn("grid gap-5", compact ? "mt-5" : "p-6")}
    >
          <label className="text-sm font-semibold">
            Search
            <span className="mt-1 block text-xs font-normal text-[#68717b]">
              Service name, category, or description
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#68717b]" />
              <input
                value={draft.q}
                onChange={(event) => update("q", event.target.value)}
                className={cn(fieldClass, "pl-10")}
                placeholder="e.g. leaking pipe"
                minLength={2}
                maxLength={100}
              />
            </span>
          </label>

          <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
            <label className="text-sm font-semibold">
              Category
              <select
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
                className={fieldClass}
              >
                <option value="">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Location
              <input
                value={draft.location}
                onChange={(event) => update("location", event.target.value)}
                className={fieldClass}
                placeholder="e.g. Nairobi"
                maxLength={120}
              />
            </label>
            <label className="text-sm font-semibold">
              Fulfilment
              <select
                value={draft.fulfilmentModel}
                onChange={(event) => update("fulfilmentModel", event.target.value)}
                className={fieldClass}
              >
                <option value="">Any model</option>
                <option value="on_site">On-site</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Pricing
              <select
                value={draft.pricingModel}
                onChange={(event) => update("pricingModel", event.target.value)}
                className={fieldClass}
              >
                <option value="">Any price type</option>
                <option value="fixed">Fixed price</option>
                <option value="starting_from">Starting from</option>
                <option value="custom_quote">Custom quote</option>
              </select>
            </label>
            <label className={cn("text-sm font-semibold", !compact && "sm:col-span-2")}>
              Availability
              <select
                value={draft.availability}
                onChange={(event) => update("availability", event.target.value)}
                className={fieldClass}
              >
                <option value="">Any availability</option>
                <option value="today">Available today</option>
              </select>
            </label>
            <label className={cn("text-sm font-semibold", !compact && "sm:col-span-2")}>
              Verification
              <select
                value={draft.verified}
                onChange={(event) => update("verified", event.target.value)}
                className={fieldClass}
              >
                <option value="">All professionals</option>
                <option value="true">Verified professionals</option>
                <option value="false">Not yet verified</option>
              </select>
            </label>
          </div>

          <div
            className={cn(
              "mt-2 flex flex-col-reverse gap-2 border-t border-black/8 pt-5",
              !compact && "sticky bottom-0 -mx-6 bg-white px-6 sm:flex-row",
            )}
          >
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              onClick={onClear}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Clear filters
            </Button>
            <Button type="submit" className="sm:flex-1">
              Show results
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
    </form>
  );
}

function MarketplaceCard({
  service,
  listView,
  saved,
  saving,
  onToggleSaved,
}: {
  service: MarketplaceListing;
  listView: boolean;
  saved: boolean;
  saving: boolean;
  onToggleSaved: () => void;
}) {
  const location =
    service.provider.operatingLocation ??
    service.serviceAreas[0] ??
    "Location confirmed with provider";

  return (
    <Surface
      className={cn(
        "overflow-hidden p-0 shadow-none transition-transform hover:-translate-y-0.5",
        listView && "sm:grid sm:grid-cols-[220px_minmax(0,1fr)]",
      )}
    >
        <Link
          href={`/services/${service.slug}`}
          className="relative block aspect-[4/3] bg-[#eef8c8] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:aspect-auto sm:min-h-52"
          aria-label={`Open ${service.name}`}
        >
          {service.imageUrl ? (
            <Image
              src={service.imageUrl}
              alt={service.name}
              fill
              className="object-cover"
              sizes={listView ? "220px" : "(max-width: 768px) 100vw, 40vw"}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center">
              <Wrench className="size-9 text-[#5f8d11]" aria-hidden="true" />
            </span>
          )}
          <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-semibold">
            {service.category}
          </span>
        </Link>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#5f8d11]">
                {service.provider.businessName}
              </p>
              <h2 className="mt-1 text-lg font-bold">
                <Link
                  href={`/services/${service.slug}`}
                  className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {service.name}
                </Link>
              </h2>
            </div>
            <button
              type="button"
              onClick={onToggleSaved}
              disabled={saving}
              aria-pressed={saved}
              aria-label={
                saved
                  ? `Remove ${service.provider.businessName} from saved`
                  : `Save ${service.provider.businessName}`
              }
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full border border-black/8 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                saved ? "bg-[#eef8c8] text-[#5f8d11]" : "bg-white",
              )}
            >
              <Heart
                className={cn("size-4", saved && "fill-current")}
                aria-hidden="true"
              />
            </button>
          </div>
          {service.provider.verified ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2.5 py-1 text-[0.65rem] font-semibold text-[#5f8d11]">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="mt-3 inline-flex rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground">
              Not yet verified
            </span>
          )}
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#68717b]">
            {service.description}
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#68717b]">
            <MapPin className="size-3.5" aria-hidden="true" />
            {location}
          </p>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-black/8 pt-4">
            <div>
              <p className="text-[0.65rem] text-[#68717b]">Price</p>
              <p className="text-sm font-bold">{formatPrice(service)}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-primary" aria-hidden="true">
              <ArrowRight className="size-4" />
            </span>
          </div>
        </div>
    </Surface>
  );
}
