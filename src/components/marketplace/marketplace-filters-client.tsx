"use client";

import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MARKETPLACE_LOCATION_OPTIONS } from "@/lib/locations";
import { LocationPicker } from "@/components/ui/location-picker";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";
import { SlidersHorizontal } from "lucide-react";

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

export function MarketplaceFiltersClient({
  initialCategories,
  variant = "both",
}: {
  initialCategories?: readonly string[];
  variant?: "both" | "desktop" | "mobile";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearchParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftState, setDraftState] = useState(() => ({
    key: searchKey,
    value: draftFrom(currentSearchParams),
  }));
  const [categoryOptions, setCategoryOptions] = useState<readonly string[]>(
    initialCategories && initialCategories.length > 0 ? initialCategories : fallbackCategoryOptions,
  );

  const draft = draftState.key === searchKey ? draftState.value : draftFrom(currentSearchParams);
  const setDraft = (value: FilterDraft) => setDraftState({ key: searchKey, value });

  const activeCount = useMemo(() => {
    return Object.values(draftFrom(currentSearchParams)).filter(Boolean).length;
  }, [currentSearchParams]);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategoryOptions(initialCategories);
    }
  }, [initialCategories]);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) return;
    const controller = new AbortController();
    void fetch("/api/v1/public/categories", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceCategorySummary[];
        } | null;
        if (response.ok && body?.data?.length) setCategoryOptions(body.data.map((item) => item.name));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialCategories]);

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    const href = query ? `/marketplace?${query}` : "/marketplace";
    startTransition(() => router.push(href));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(currentSearchParams);
    for (const [key, value] of Object.entries(draft)) {
      if (value.trim()) next.set(key, value.trim());
      else next.delete(key);
    }
    next.delete("page");
    setMobileFiltersOpen(false);
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(currentSearchParams);
    for (const key of Object.keys(emptyDraft)) next.delete(key);
    next.delete("page");
    setDraft(emptyDraft);
    navigate(next);
  }

  if (variant === "mobile") {
    return (
      <MobileFilterSheet
        draft={draft}
        categoryOptions={categoryOptions}
        onDraftChange={setDraft}
        onSubmit={applyFilters}
        onClear={clearFilters}
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        activeCount={activeCount}
        isPending={isPending}
      />
    );
  }

  if (variant === "desktop") {
    return (
      <div className="sticky top-5 rounded-2xl border border-black/8 bg-white p-4" aria-busy={isPending || undefined}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Refine your search</h2>
          {isPending ? <span className="text-xs text-[#68717b]" aria-live="polite">Updating…</span> : null}
        </div>
        <FilterForm
          draft={draft}
          categoryOptions={categoryOptions}
          onDraftChange={setDraft}
          onSubmit={applyFilters}
          onClear={clearFilters}
          compact
          isPending={isPending}
        />
      </div>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="min-[960px]:hidden">
        <MobileFilterSheet
          draft={draft}
          categoryOptions={categoryOptions}
          onDraftChange={setDraft}
          onSubmit={applyFilters}
          onClear={clearFilters}
          open={mobileFiltersOpen}
          onOpenChange={setMobileFiltersOpen}
          activeCount={activeCount}
          isPending={isPending}
        />
      </div>
      {/* Desktop */}
      <div className="hidden min-[960px]:block">
        <div className="sticky top-5 rounded-2xl border border-black/8 bg-white p-4" aria-busy={isPending || undefined}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Refine your search</h2>
            {isPending ? <span className="text-xs text-[#68717b]" aria-live="polite">Updating…</span> : null}
          </div>
          <FilterForm
            draft={draft}
            categoryOptions={categoryOptions}
            onDraftChange={setDraft}
            onSubmit={applyFilters}
            onClear={clearFilters}
            compact
            isPending={isPending}
          />
        </div>
      </div>
    </>
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
  isPending = false,
}: {
  draft: FilterDraft;
  categoryOptions: readonly string[];
  onDraftChange: (draft: FilterDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  isPending?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          disabled={isPending}
          aria-busy={isPending}
          className="h-12 justify-start rounded-xl border-black/10 bg-white px-4 min-[960px]:hidden disabled:opacity-60"
        >
          <SlidersHorizontal className="size-5" /> Filter
          {isPending ? <span className="text-xs">…</span> : null}
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
          <SheetTitle className="text-xl font-semibold">Refine your search</SheetTitle>
          <SheetDescription id="marketplace-filter-description" className="mt-1 text-sm text-[#68717b]">
            Choose the service details that matter to you.
          </SheetDescription>
        </div>
        <FilterForm
          draft={draft}
          categoryOptions={categoryOptions}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          onClear={onClear}
          isPending={isPending}
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
  isPending = false,
}: {
  draft: FilterDraft;
  categoryOptions: readonly string[];
  onDraftChange: (draft: FilterDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  compact?: boolean;
  isPending?: boolean;
}) {
  const fieldClass = compact
    ? "mt-1 h-9 w-full max-w-full min-w-0 rounded-sm border-b border-black/10 bg-white px-2.5 text-[0.7rem] outline-none focus:border-[#7cae17] disabled:opacity-60"
    : "mt-2 h-11 w-full max-w-full min-w-0 rounded-sm border-b border-black/10 bg-white px-3 text-sm outline-none focus:border-[#7cae17] disabled:opacity-60";
  const update = (key: keyof FilterDraft, value: string) => onDraftChange({ ...draft, [key]: value });
  return (
    <form onSubmit={onSubmit} className={cn("grid min-w-0 max-w-full", compact ? "mt-4 gap-3" : "gap-5 overflow-y-auto p-6")} aria-busy={isPending || undefined}>
      <FilterSelect label="Category" value={draft.category} onChange={(value) => update("category", value)} className={fieldClass} disabled={isPending}>
        <option value="">All categories</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </FilterSelect>
      <div className={cn("min-w-0 max-w-full font-medium", compact ? "text-[0.7rem]" : "text-sm")}>
        Location
        <LocationPicker value={draft.location} onSelect={(value) => update("location", value)} compact={compact} field />
      </div>
      <FilterSelect label="Service type" value={draft.fulfilmentModel} onChange={(value) => update("fulfilmentModel", value)} className={fieldClass} disabled={isPending}>
        <option value="">All service types</option>
        <option value="on_site">On-site</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
      </FilterSelect>
      <FilterSelect label="Pricing" value={draft.pricingModel} onChange={(value) => update("pricingModel", value)} className={fieldClass} disabled={isPending}>
        <option value="">Any price</option>
        <option value="fixed">Fixed price</option>
        <option value="starting_from">Starting from</option>
        <option value="custom_quote">Custom quote</option>
      </FilterSelect>
      <FilterSelect label="Availability" value={draft.availability} onChange={(value) => update("availability", value)} className={fieldClass} disabled={isPending}>
        <option value="">Any availability</option>
        <option value="today">Available today</option>
      </FilterSelect>
      <FilterSelect label="Verification" value={draft.verified} onChange={(value) => update("verified", value)} className={fieldClass} disabled={isPending}>
        <option value="">All professionals</option>
        <option value="true">Verified professionals only</option>
        <option value="false">Not yet verified</option>
      </FilterSelect>
      <p className="sr-only">Published services only</p>
      <div className={cn("grid gap-2 border-t border-black/8 pt-3", !compact && "sticky bottom-0 -mx-6 bg-white px-6 sm:grid-cols-2")}>
        <Button type="submit" className="h-10 rounded-xl text-xs" loading={isPending} disabled={isPending}>
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="min-w-0 max-w-full text-[0.7rem] font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={className} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}
