"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  ChevronDown,
  Grid2X2,
  Heart,
  Headphones,
  List,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
import { cn } from "@/lib/utils";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import type {
  MarketplaceListing,
  MarketplaceSearchResult,
} from "@/modules/marketplace/types";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";

const fallbackCategoryOptions = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Painting",
  "Appliance Repair",
] as const;
const locationOptions = [
  { value: "Nairobi", label: "Nairobi, Kenya" },
  { value: "Westlands", label: "Westlands, Nairobi" },
  { value: "Kilimani", label: "Kilimani, Nairobi" },
  { value: "Karen", label: "Karen, Nairobi" },
  { value: "Lavington", label: "Lavington, Nairobi" },
  { value: "Runda", label: "Runda, Nairobi" },
  { value: "Langata", label: "Langata, Nairobi" },
  { value: "South B", label: "South B, Nairobi" },
  { value: "Kasarani", label: "Kasarani, Nairobi" },
  { value: "Embakasi", label: "Embakasi, Nairobi" },
] as const;
const popularServices = [
  {
    name: "Water Heater Repair",
    price: "From KSh 3,500",
    image: "/images/category-appliance.png",
  },
  {
    name: "Toilet Installation",
    price: "From KSh 3,000",
    image: "/images/category-plumbing.png",
  },
  {
    name: "Leak Detection",
    price: "From KSh 2,000",
    image: "/images/category-plumbing.png",
  },
] as const;

type FilterDraft = {
  q: string;
  category: string;
  location: string;
  fulfilmentModel: string;
  pricingModel: string;
  availability: string;
  verified: string;
  topRated: string;
  instantBooking: string;
};

const emptyDraft: FilterDraft = {
  q: "",
  category: "",
  location: "",
  fulfilmentModel: "",
  pricingModel: "",
  availability: "",
  verified: "",
  topRated: "",
  instantBooking: "",
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
    topRated: searchParams.get("topRated") ?? "",
    instantBooking: searchParams.get("instantBooking") ?? "",
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
    "topRated",
    "instantBooking",
    "sort",
    "page",
  ]) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  next.set("pageSize", "9");
  return next;
}

function formatPrice(listing: MarketplaceListing) {
  if (listing.pricingModel === "custom_quote") return "Custom quote";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: listing.currency,
    maximumFractionDigits: 0,
  })
    .format((listing.priceMinor ?? 0) / 100)
    .replace("KES", "KSh");
}

function formatNextSlot(listing: MarketplaceListing) {
  const slot = listing.provider.nextAvailableSlot;
  if (!slot) return "Check availability";
  const startsAt = new Date(slot.startsAt);
  const day = new Intl.DateTimeFormat("en-KE", {
    timeZone: slot.timezone,
    weekday: "short",
  }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-KE", {
    timeZone: slot.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(startsAt);
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
    return value
      ? [{ key, label, value: formatActiveFilterValue(key, value) }]
      : [];
  });
}

function formatActiveFilterValue(key: string, value: string) {
  const values: Record<string, Record<string, string>> = {
    availability: { today: "Available Today" },
    verified: { true: "Verified", false: "Not Verified" },
    topRated: { true: "Top Rated" },
    instantBooking: { true: "Instant Booking" },
    fulfilmentModel: {
      on_site: "On-site",
      remote: "Remote",
      hybrid: "Hybrid",
    },
    pricingModel: {
      fixed: "Fixed Price",
      starting_from: "Starting From",
      custom_quote: "Custom Quote",
    },
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

function LocationPicker({
  value,
  onSelect,
  compact = false,
  field = false,
  className,
}: {
  value: string;
  onSelect: (value: string) => void;
  compact?: boolean;
  field?: boolean;
  className?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = locationOptions.find((option) => option.value === value);
  const visibleOptions = locationOptions.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-0 max-w-full",
        field && "w-full",
        className,
      )}
    >
      <div
        className={cn(
          "flex max-w-full min-w-0 items-center gap-2 bg-white",
          compact
            ? "mt-1 h-9 rounded-sm border-b border-black/10 px-2.5"
            : field
              ? "mt-2 h-11 rounded-sm border-b border-black/10 px-3"
              : "min-h-11 rounded-xl px-3",
        )}
      >
        <MapPin className="size-4 shrink-0 text-[#17304f]" />
        <input
          role="combobox"
          aria-label="Search locations"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={open ? query : (selected?.label ?? value)}
          placeholder="e.g. Nairobi"
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8a98aa]",
            compact
              ? "text-[0.7rem]"
              : field
                ? "text-sm"
                : "text-sm font-medium",
          )}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && visibleOptions[0]) {
              event.preventDefault();
              onSelect(visibleOptions[0].value);
              setOpen(false);
            }
          }}
        />
        {open ? (
          <Search
            className={cn(
              "size-4 shrink-0 text-[#68717b]",
              compact && "-mr-1.5",
            )}
          />
        ) : (
          <ChevronDown
            data-location-chevron
            className={cn(
              "size-4 shrink-0 text-[#17304f]",
              compact && "-mr-1.5",
            )}
          />
        )}
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-40 max-h-60 overflow-y-auto rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_14px_36px_rgba(7,21,34,0.16)]"
        >
          {field ? (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f8e8]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect("");
                setOpen(false);
              }}
            >
              All locations {!value ? <Check className="size-3.5" /> : null}
            </button>
          ) : null}
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f8e8]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
              {option.value === value ? <Check className="size-3.5" /> : null}
            </button>
          ))}
          {visibleOptions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[#68717b]">
              No matching location
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
  const [draftState, setDraftState] = useState(() => ({
    key: searchKey,
    value: draftFrom(currentSearchParams),
  }));
  const [view, setView] = useState<"grid" | "list">("grid");
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());
  const [savingProviders, setSavingProviders] = useState<Set<string>>(
    new Set(),
  );
  const [categoryOptions, setCategoryOptions] = useState<readonly string[]>(
    fallbackCategoryOptions,
  );
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
        if (response.ok && body?.data?.length)
          setCategoryOptions(body.data.map((item) => item.name));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/v1/public/marketplace?${apiSearchParams(currentSearchParams)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceSearchResult;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data)
          throw new Error(
            body?.error?.message ?? "Marketplace results could not be loaded.",
          );
        setRequest({ key: requestKey, result: body.data, error: null });
        recordMarketplaceEvent({
          eventType: "marketplace.search_performed",
          activeFilters: filters.map(
            (filter) => filter.key as keyof FilterDraft,
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
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
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
        if (response.ok && body?.data)
          setSavedProviders(new Set(body.data.map((item) => item.slug)));
      })
      .catch(() => undefined);
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
      if (!response.ok)
        throw new Error(
          body?.error?.message ?? "Saved professionals could not be updated.",
        );
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

  function toggleQuickFilter(
    key:
      | "availability"
      | "verified"
      | "location"
      | "topRated"
      | "instantBooking",
    value: string,
  ) {
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

  function updateLocation(location: string) {
    const next = new URLSearchParams(currentSearchParams);
    if (location) next.set("location", location);
    else next.delete("location");
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
    <div className="marketplace-page">
      <nav
        className="hidden text-[0.7rem] text-[#607087] sm:block"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Find Services</span>
      </nav>

      <header className="mt-1 flex flex-wrap items-end justify-between gap-5 sm:mt-3">
        <div>
          <h1 className="text-[2rem] leading-tight font-medium tracking-title sm:text-[2.15rem]">
            Find Services
          </h1>
          <p className="mt-1 text-[0.82rem] text-[#334a68]">
            Search trusted home service professionals in Nairobi.
          </p>
        </div>
        <LocationPicker
          value={currentSearchParams.get("location") ?? "Nairobi"}
          onSelect={updateLocation}
          className="w-full sm:w-[13rem]"
        />
      </header>

      <section
        className="mt-5 rounded-2xl border border-black/8 bg-white/85 p-3 sm:p-4 min-[960px]:hidden"
        aria-label="Marketplace controls"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
          <label className="relative">
            <span className="sr-only">Sort services</span>
            <select
              value={currentSearchParams.get("sort") ?? "relevance"}
              onChange={(event) => updateSort(event.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-black/10 bg-white px-4 pr-9 text-sm font-semibold"
              aria-label="Sort services"
            >
              <option value="relevance">Sort: Most relevant</option>
              <option value="newest">Sort: Newest</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          </label>
          <div className="hidden rounded-xl border border-black/10 bg-white p-1 sm:col-span-1 sm:flex">
            <ViewButton
              label="Grid view"
              active={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Grid2X2 className="size-5" />
            </ViewButton>
            <ViewButton
              label="List view"
              active={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="size-5" />
            </ViewButton>
          </div>
        </div>
        <QuickFilters
          current={currentSearchParams}
          onToggle={toggleQuickFilter}
        />
      </section>

      {filters.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          aria-label="Active filters"
        >
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => removeFilter(filter.key)}
              className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#eef8c8] px-3 text-xs font-medium text-[#486d09]"
            >
              {filter.value} <X className="size-3.5" />
              <span className="sr-only">Remove {filter.label} filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-8 px-2 text-xs font-semibold text-[#486d09]"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 min-[960px]:grid-cols-[236px_minmax(0,1fr)_220px] min-[1200px]:grid-cols-[250px_minmax(0,1fr)_230px]">
        <aside className="hidden min-[960px]:block">
          <div className="sticky top-5 rounded-2xl border border-black/8 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Refine your search</h2>
            </div>

            <FilterForm
              draft={draft}
              categoryOptions={categoryOptions}
              onDraftChange={setDraft}
              onSubmit={applyFilters}
              onClear={clearFilters}
              compact
            />
          </div>
        </aside>

        <section
          aria-labelledby="marketplace-results-heading"
          className="min-w-0"
        >
          <div className="hidden items-center justify-between gap-3 min-[960px]:flex">
            <p id="marketplace-results-heading" className="text-lg font-medium">
              {loading ? (
                "Loading services"
              ) : (
                <>
                  {result?.totalItems ?? 0} services{" "}
                  <span className="text-[#6d9e13]">in Nairobi</span>
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={currentSearchParams.get("sort") ?? "relevance"}
                onChange={(event) => updateSort(event.target.value)}
                className="h-10 rounded-xl border border-black/8 bg-white px-3 text-[0.5rem] font-semibold"
                aria-label="Sort services"
              >
                <option value="relevance">Sort by: Most relevant</option>
                <option value="newest">Sort by: Newest</option>
              </select>
              <ViewButton
                label="Grid view"
                active={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Grid2X2 className="size-4" />
              </ViewButton>
              <ViewButton
                label="List view"
                active={view === "list"}
                onClick={() => setView("list")}
              >
                <List className="size-4" />
              </ViewButton>
            </div>
          </div>
          <div className="hidden min-[960px]:block">
            <QuickFilters
              current={currentSearchParams}
              onToggle={toggleQuickFilter}
            />
          </div>

          <div className="mt-4">
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
                className="min-h-72 font-semibold"
              />
            ) : result && result.items.length > 0 ? (
              <div
                className={cn(
                  "grid gap-3",
                  view === "grid"
                    ? "sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1",
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
              className="mt-7 flex items-center justify-between gap-3"
              aria-label="Marketplace pagination"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={result.page <= 1}
                onClick={() => updatePage(result.page - 1)}
              >
                <ArrowLeft className="size-4" /> Previous
              </Button>
              <p className="text-xs text-[#68717b]">
                Page {result.page} of {result.totalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={result.page >= result.totalPages}
                onClick={() => updatePage(result.page + 1)}
              >
                Next <ArrowRight className="size-4" />
              </Button>
            </nav>
          ) : null}
          <HelpCard className="mt-5 min-[960px]:hidden" />
        </section>

        <aside className="hidden space-y-4 min-[960px]:block">
          <HelpCard />
          <div className="rounded-2xl border border-black/8 bg-white p-4">
            <h2 className="font-semibold">Popular near you</h2>
            <div className="mt-3 border-t border-black/8 pt-2">
              {popularServices.map((service) => (
                <div
                  key={service.name}
                  className="flex gap-3 border-b border-black/8 py-3 last:border-0"
                >
                  <Image
                    src={service.image}
                    alt=""
                    width={54}
                    height={54}
                    className="size-[54px] rounded-lg object-cover"
                  />
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
            <Link
              href="/categories"
              className="mt-3 flex min-h-9 items-center justify-between text-[0.7rem] font-semibold text-[#17304f]"
            >
              View all popular services <ArrowRight className="size-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg",
        active
          ? "bg-primary shadow-[0_5px_14px_rgba(173,222,0,0.3)]"
          : "bg-white",
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
}: {
  current: URLSearchParams;
  onToggle: (
    key:
      | "availability"
      | "verified"
      | "location"
      | "topRated"
      | "instantBooking",
    value: string,
  ) => void;
}) {
  const itemClass =
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-black/8 bg-white px-4 text-xs font-medium text-[#203953] transition hover:border-[#a7d923]";
  return (
    <div
      className="mt-3 flex gap-2 overflow-x-auto pb-1"
      aria-label="Quick filters"
    >
      <button
        type="button"
        onClick={() => onToggle("availability", "today")}
        aria-pressed={current.get("availability") === "today"}
        className={cn(
          itemClass,
          current.get("availability") === "today" &&
            "border-[#9aca1d] bg-[#f6fce8]",
        )}
      >
        <CalendarDays className="size-4 text-[#6d9e13]" />
        Available Today
      </button>
      <button
        type="button"
        onClick={() => onToggle("verified", "true")}
        aria-pressed={current.get("verified") === "true"}
        className={cn(
          itemClass,
          current.get("verified") === "true" && "border-[#9aca1d] bg-[#f6fce8]",
        )}
      >
        <ShieldCheck className="size-4 text-[#6d9e13]" />
        Verified
      </button>
      <button
        type="button"
        onClick={() => onToggle("topRated", "true")}
        aria-pressed={current.get("topRated") === "true"}
        className={cn(
          itemClass,
          current.get("topRated") === "true" && "border-[#9aca1d] bg-[#f6fce8]",
        )}
      >
        <Star className="size-4 text-[#ffb000]" />
        Top Rated
      </button>
      <button
        type="button"
        onClick={() => onToggle("location", "Nairobi")}
        aria-pressed={current.get("location") === "Nairobi"}
        className={cn(
          itemClass,
          current.get("location") === "Nairobi" &&
            "border-[#9aca1d] bg-[#f6fce8]",
        )}
      >
        <MapPin className="size-4" />
        Near Me
      </button>
      <button
        type="button"
        onClick={() => onToggle("instantBooking", "true")}
        aria-pressed={current.get("instantBooking") === "true"}
        className={cn(
          itemClass,
          current.get("instantBooking") === "true" &&
            "border-[#9aca1d] bg-[#f6fce8]",
        )}
      >
        <Zap className="size-4 text-[#ffb000]" />
        Instant Booking
      </button>
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
          variant="outline"
          className="h-12 justify-start rounded-xl border-black/10 bg-white px-4 min-[960px]:hidden"
        >
          <SlidersHorizontal className="size-5" /> Filter
          {activeCount > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.65rem]">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby="marketplace-filter-description"
        className="max-h-[92vh] p-0 min-[960px]:hidden"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <div className="border-b border-black/8 px-6 py-5 pr-16">
          <SheetTitle className="text-xl font-semibold">
            Refine your search
          </SheetTitle>
          <SheetDescription
            id="marketplace-filter-description"
            className="mt-1 text-sm text-[#68717b]"
          >
            Choose the service details that matter to you.
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
  const fieldClass = compact
    ? "mt-1 h-9 w-full max-w-full min-w-0 rounded-sm border-b border-black/10 bg-white px-2.5 text-[0.7rem] outline-none focus:border-[#7cae17]"
    : "mt-2 h-11 w-full max-w-full min-w-0 rounded-sm border-b border-black/10 bg-white px-3 text-sm outline-none focus:border-[#7cae17]";
  const update = (key: keyof FilterDraft, value: string) =>
    onDraftChange({ ...draft, [key]: value });
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid min-w-0 max-w-full",
        compact ? "mt-4 gap-3" : "gap-5 overflow-y-auto p-6",
      )}
    >
      <FilterSelect
        label="Category"
        value={draft.category}
        onChange={(value) => update("category", value)}
        className={fieldClass}
      >
        <option value="">All categories</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </FilterSelect>
      <div
        className={cn(
          "min-w-0 max-w-full font-medium",
          compact ? "text-[0.7rem]" : "text-sm",
        )}
      >
        Location
        <LocationPicker
          value={draft.location}
          onSelect={(value) => update("location", value)}
          compact={compact}
          field
        />
      </div>
      <FilterSelect
        label="Service type"
        value={draft.fulfilmentModel}
        onChange={(value) => update("fulfilmentModel", value)}
        className={fieldClass}
      >
        <option value="">All service types</option>
        <option value="on_site">On-site</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
      </FilterSelect>
      <FilterSelect
        label="Pricing"
        value={draft.pricingModel}
        onChange={(value) => update("pricingModel", value)}
        className={fieldClass}
      >
        <option value="">Any price</option>
        <option value="fixed">Fixed price</option>
        <option value="starting_from">Starting from</option>
        <option value="custom_quote">Custom quote</option>
      </FilterSelect>
      <FilterSelect
        label="Availability"
        value={draft.availability}
        onChange={(value) => update("availability", value)}
        className={fieldClass}
      >
        <option value="">Any availability</option>
        <option value="today">Available today</option>
      </FilterSelect>
      <FilterSelect
        label="Verification"
        value={draft.verified}
        onChange={(value) => update("verified", value)}
        className={fieldClass}
      >
        <option value="">All professionals</option>
        <option value="true">Verified professionals only</option>
        <option value="false">Not yet verified</option>
      </FilterSelect>
      <p className="sr-only">Published services only</p>
      <div
        className={cn(
          "grid gap-2 border-t border-black/8 pt-3",
          !compact && "sticky bottom-0 -mx-6 bg-white px-6 sm:grid-cols-2",
        )}
      >
        <Button type="submit" className="h-10 rounded-xl text-xs">
          Show results
        </Button>
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 max-w-full text-[0.7rem] font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {children}
      </select>
    </label>
  );
}

function HelpCard({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "rounded-2xl border border-[#e8ecd7] bg-[#fbfdf4] p-5",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-[#eff8cf] text-[#648f12]">
        <Headphones className="size-5" />
      </span>
      <h2 className="mt-3 text-base font-semibold">Need help choosing?</h2>
      <p className="mt-2 text-sm leading-6 text-[#425671]">
        Tell us what you need and we&apos;ll help you find the right
        professional.
      </p>
      <Link
        href="/contact"
        className={cn(
          buttonVariants(),
          "mt-4 h-10 w-full justify-between rounded-xl px-4 text-xs",
        )}
      >
        Get matched <ArrowRight className="size-4" />
      </Link>
    </aside>
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
  const topRated =
    service.provider.rating != null &&
    service.provider.rating >= 4.7 &&
    service.provider.reviewCount > 0;
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,38,52,0.1)]",
        listView && "sm:grid sm:grid-cols-[220px_minmax(0,1fr)]",
        "max-sm:grid max-sm:grid-cols-[42%_58%]",
      )}
    >
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
          "absolute top-2.5 right-2.5 z-20 grid size-8 place-items-center rounded-full border border-black/10 bg-white text-[#17304f] shadow-[0_3px_10px_rgba(7,21,34,0.16)]",
          saved && "bg-[#eff8cf] text-[#5f8d11]",
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} />
      </button>
      <Link
        href={`/services/${service.slug}`}
        className={cn(
          "relative block min-h-[150px] bg-[#edf5d5] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          listView
            ? "sm:h-full sm:min-h-full sm:self-stretch sm:aspect-auto"
            : "sm:aspect-[16/9] sm:min-h-0",
        )}
        aria-label={`Open ${service.name}`}
      >
        <Image
          src={service.imageUrl ?? fallbackImage(service.category)}
          alt={service.name}
          fill
          className="object-cover"
          sizes="(max-width: 639px) 42vw, (max-width: 1199px) 45vw, 24vw"
        />
        {service.provider.availableToday ? (
          <span
            aria-label="Service status: Available Today"
            className="absolute top-2.5 left-2.5 rounded-full bg-primary px-2.5 py-1 text-[0.58rem] font-medium text-[#102300]"
          >
            Available Today
          </span>
        ) : topRated ? (
          <span
            aria-label="Service status: Top Rated"
            className="absolute top-2.5 left-2.5 rounded-full bg-[#ffc21a] px-2.5 py-1 text-[0.58rem] font-medium text-[#2d2400]"
          >
            Top Rated
          </span>
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-col p-3 sm:p-4">
        <h2 className="pr-8 text-sm leading-5 font-semibold sm:text-[0.88rem]">
          <Link href={`/services/${service.slug}`} className="hover:underline">
            {service.name}
          </Link>
        </h2>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[0.72rem] text-[#40536c]">
          <span className="truncate">{service.provider.businessName}</span>
          {service.provider.verified ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[#65970d]">
              <BadgeCheck className="size-3.5" />
              Verified
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
                {service.provider.rating.toFixed(1)} (
                {service.provider.reviewCount})
              </span>
            </>
          )}
          <span aria-hidden="true">•</span>
          <span>
            {service.provider.experienceYears == null
              ? "Experience not listed"
              : service.provider.experienceYears === 0
                ? "Under 1 year"
                : `${service.provider.experienceYears}+ years`}
          </span>
        </p>
        <p className="mt-1 line-clamp-1 text-[0.72rem] text-[#52647a]">
          <MapPin className="mr-1 inline size-3" />
          {location}
        </p>
        <p className="mt-1 mb-2 line-clamp-1 text-[0.72rem ] text-[#52647a]">
          <Clock3 className="mr-1 inline size-3 text-[#789a1d]" />
          Next slot:{" "}
          <span className="font-medium text-[0.72rem]">
            {formatNextSlot(service)}
          </span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/8 pt-2 max-sm:mt-2">
          <div>
            <p className="text-[0.58rem] text-[#68717b]">
              {service.pricingModel === "custom_quote"
                ? "Pricing"
                : service.pricingModel === "starting_from"
                  ? "Starting from"
                  : "Fixed price"}
            </p>
            <p className="text-sm font-semibold">{formatPrice(service)}</p>
          </div>
          <Link
            href={`/services/${service.slug}`}
            aria-label={`View ${service.name}`}
            className="grid size-8 place-items-center rounded-full bg-primary"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
