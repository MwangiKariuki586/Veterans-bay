"use client";

import { ArrowRight, BadgeCheck, MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "@/components/ui/location-picker";
import { Sheet, SheetDescription, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatePanel } from "@/components/ui/state-panel";
import { ServiceCard, ServiceCardSkeleton } from "@/components/marketplace/service-card";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import { cn } from "@/lib/utils";
import {
  buildMatchReasons,
  filterListingsByBudget,
  mapGetMatchedAnswersToQuery,
  toMarketplaceSearchParams,
  type MappedMatchQuery,
} from "@/lib/matching/map-answers-to-query";
import type { MarketplaceListing, MarketplaceSearchResult } from "@/modules/marketplace/types";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";

const fallbackCategoryOptions = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Painting",
  "Appliance Repair",
] as const;

const STEPS = ["What you need", "Preferences", "Budget & urgency", "Matches"] as const;

type Draft = {
  q: string;
  category: string;
  location: string;
  fulfilmentModel: "" | "on_site" | "remote" | "hybrid";
  pricingModel: "" | "fixed" | "starting_from" | "custom_quote";
  budgetMin: string;
  budgetMax: string;
  urgency: "FLEXIBLE" | "SOON" | "URGENT";
  verifiedOnly: boolean;
  topRatedOnly: boolean;
};

const emptyDraft: Draft = {
  q: "",
  category: "",
  location: "",
  fulfilmentModel: "",
  pricingModel: "",
  budgetMin: "",
  budgetMax: "",
  urgency: "FLEXIBLE",
  verifiedOnly: false,
  topRatedOnly: false,
};

function fallbackImage(category: string) {
  const value = category.toLowerCase();
  if (value.includes("electric")) return "/images/category-electrical.png";
  if (value.includes("clean")) return "/images/category-cleaning.png";
  if (value.includes("paint")) return "/images/category-painting.png";
  if (value.includes("appliance")) return "/images/category-appliance.png";
  return "/images/category-plumbing.png";
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

function formatBudget(value: string) {
  const amount = Number(value);
  if (!value.trim() || Number.isNaN(amount)) return null;
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

function stepIssues(step: number, draft: Draft): string[] {
  if (step === 1) {
    return draft.category.trim() ? [] : ["category"];
  }
  if (step === 3) {
    const issues: string[] = [];
    const min = draft.budgetMin.trim() ? Number(draft.budgetMin) : null;
    const max = draft.budgetMax.trim() ? Number(draft.budgetMax) : null;
    if (draft.budgetMin.trim() && (min == null || Number.isNaN(min) || min < 0)) issues.push("budgetMin");
    if (draft.budgetMax.trim() && (max == null || Number.isNaN(max) || max < 0)) issues.push("budgetMax");
    if (
      min != null &&
      max != null &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      max < min
    ) {
      issues.push("budgetMax");
    }
    return issues;
  }
  return [];
}

export function GetMatchedDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<readonly string[]>(fallbackCategoryOptions);
  const [mapped, setMapped] = useState<MappedMatchQuery | null>(null);
  const [results, setResults] = useState<MarketplaceListing[] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [hiddenOverBudget, setHiddenOverBudget] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/v1/public/categories", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceCategorySummary[];
        } | null;
        if (response.ok && body?.data?.length) {
          setCategoryOptions(body.data.map((item) => item.name));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open ]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  function executeSearch(query: MappedMatchQuery) {
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setLoading(true);
    setSearchError(null);
    setResults(null);
    void fetch(`/api/v1/public/marketplace?${toMarketplaceSearchParams(query)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: MarketplaceSearchResult;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Matches could not be loaded.");
        }
        const filtered = filterListingsByBudget(body.data.items, query.budgetMaxMinor);
        if (controller.signal.aborted) return;
        setResults(filtered.visible);
        setTotalItems(body.data.totalItems);
        setHiddenOverBudget(filtered.hiddenOverBudget);
        recordMarketplaceEvent({
          eventType: "marketplace.search_performed",
          activeFilters: ["category"],
          page: 1,
          resultCount: body.data.totalItems,
          sort: query.serverQuery.sort,
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setResults(null);
        setSearchError(cause instanceof Error ? cause.message : "Matches could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setInvalid((current) => current.filter((item) => item !== key));
    setFormError(null);
  }

  function goNext() {
    const issues = stepIssues(step, draft);
    if (issues.length > 0) {
      setInvalid(issues);
      setFormError(
        step === 1
          ? "Choose a service category to continue."
          : "Check the highlighted budget fields.",
      );
      return;
    }
    if (step === 3) {
      try {
        const next = mapGetMatchedAnswersToQuery({
          q: draft.q || undefined,
          category: draft.category,
          location: draft.location || undefined,
          fulfilmentModel: draft.fulfilmentModel || undefined,
          pricingModel: draft.pricingModel || undefined,
          budgetMin: draft.budgetMin.trim() ? draft.budgetMin : undefined,
          budgetMax: draft.budgetMax.trim() ? draft.budgetMax : undefined,
          urgency: draft.urgency,
          verifiedOnly: draft.verifiedOnly,
          topRatedOnly: draft.topRatedOnly,
        });
        setMapped(next);
        setResults(null);
        setSearchError(null);
        executeSearch(next);
      } catch (cause) {
        setFormError(cause instanceof Error ? cause.message : "Check your answers and try again.");
        return;
      }
    }
    setFormError(null);
    setInvalid([]);
    setStep((current) => Math.min(current + 1, 4));
  }

  function goBack() {
    setFormError(null);
    setInvalid([]);
    setStep((current) => Math.max(current - 1, 1));
  }

  const minBudgetLabel = formatBudget(draft.budgetMin);
  const maxBudgetLabel = formatBudget(draft.budgetMax);
  const budgetSummary =
    minBudgetLabel || maxBudgetLabel
      ? `${minBudgetLabel ?? "Any"} – ${maxBudgetLabel ? `${maxBudgetLabel} max` : "open"}`
      : "No budget set";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby="get-matched-description"
        className="flex w-[min(31rem,94vw)] flex-col overflow-hidden p-0"
      >
        <div className="border-b border-black/8 px-6 py-5 pr-16">
          <p className="text-xs font-semibold text-[#5f8d11]">Get matched</p>
          <SheetTitle className="mt-1 text-xl font-semibold">Tell us what you need</SheetTitle>
          <SheetDescription id="get-matched-description" className="mt-1 text-sm text-[#68717b]">
            Answer three quick questions and we&apos;ll find services that fit.
          </SheetDescription>
          <div className="mt-3" aria-label={`Step ${step} of 4: ${STEPS[step - 1]}`}>
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#68717b]">
              <span>
                Step {step} of 4 · {STEPS[step - 1]}
              </span>
              <span aria-hidden="true">{Math.round((step / 4) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/8" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <h3 ref={headingRef} tabIndex={-1} className="sr-only">
            {STEPS[step - 1]}
          </h3>
          {formError ? (
            <InlineAlert
              className="mb-4"
              variant="error"
              title="Check your answers"
              description={formError}
            />
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <Label htmlFor="matched-category">Service category *</Label>
                <select
                  id="matched-category"
                  value={draft.category}
                  onChange={(event) => update("category", event.target.value)}
                  aria-invalid={invalid.includes("category")}
                  aria-describedby={invalid.includes("category") ? "matched-category-error" : undefined}
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#5f8d11]"
                >
                  <option value="">Choose a category</option>
                  {draft.category && !categoryOptions.includes(draft.category) ? (
                    <option value={draft.category}>{draft.category}</option>
                  ) : null}
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {invalid.includes("category") ? (
                  <p id="matched-category-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
                    Choose a service category.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="matched-keywords">Describe it in a few words</Label>
                <Input
                  id="matched-keywords"
                  value={draft.q}
                  onChange={(event) => update("q", event.target.value)}
                  placeholder="e.g. leaking kitchen tap"
                  maxLength={100}
                  className="mt-2"
                />
                <p className="mt-1.5 text-xs text-[#7a838c]">
                  Optional. Used as keyword search across service names and descriptions.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <span className="type-card-label text-foreground">Location</span>
                <LocationPicker value={draft.location} onSelect={(value) => update("location", value)} field />
              </div>
              <div>
                <Label htmlFor="matched-fulfilment">How should it be done?</Label>
                <select
                  id="matched-fulfilment"
                  value={draft.fulfilmentModel}
                  onChange={(event) => update("fulfilmentModel", event.target.value as Draft["fulfilmentModel"])}
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#5f8d11]"
                >
                  <option value="">No preference</option>
                  <option value="on_site">At my home or site</option>
                  <option value="remote">Remotely</option>
                  <option value="hybrid">Either works</option>
                </select>
              </div>
              <div>
                <Label htmlFor="matched-pricing">Pricing preference</Label>
                <select
                  id="matched-pricing"
                  value={draft.pricingModel}
                  onChange={(event) => update("pricingModel", event.target.value as Draft["pricingModel"])}
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#5f8d11]"
                >
                  <option value="">No preference</option>
                  <option value="fixed">Fixed price</option>
                  <option value="starting_from">Starting-from price</option>
                  <option value="custom_quote">Custom quote is fine</option>
                </select>
              </div>
              <fieldset>
                <legend className="type-card-label text-foreground">Trust signals</legend>
                <div className="mt-2 space-y-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.verifiedOnly}
                      onChange={(event) => update("verifiedOnly", event.target.checked)}
                      className="size-5 accent-[#5f8d11]"
                    />
                    Verified professionals only
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.topRatedOnly}
                      onChange={(event) => update("topRatedOnly", event.target.checked)}
                      className="size-5 accent-[#5f8d11]"
                    />
                    Top rated only
                  </label>
                </div>
              </fieldset>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="matched-budget-min">Minimum budget (KSh)</Label>
                  <Input
                    id="matched-budget-min"
                    inputMode="numeric"
                    value={draft.budgetMin}
                    onChange={(event) => update("budgetMin", event.target.value)}
                    placeholder="Optional"
                    aria-invalid={invalid.includes("budgetMin")}
                    aria-describedby={invalid.includes("budgetMin") ? "matched-budget-min-error" : undefined}
                    className="mt-2"
                  />
                  {invalid.includes("budgetMin") ? (
                    <p id="matched-budget-min-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
                      Enter a valid amount of 0 or more.
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="matched-budget-max">Maximum budget (KSh)</Label>
                  <Input
                    id="matched-budget-max"
                    inputMode="numeric"
                    value={draft.budgetMax}
                    onChange={(event) => update("budgetMax", event.target.value)}
                    placeholder="Optional"
                    aria-invalid={invalid.includes("budgetMax")}
                    aria-describedby={
                      invalid.includes("budgetMax") ? "matched-budget-max-error" : "matched-budget-max-hint"
                    }
                    className="mt-2"
                  />
                  {invalid.includes("budgetMax") ? (
                    <p id="matched-budget-max-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
                      Maximum must be a valid amount, at least the minimum.
                    </p>
                  ) : (
                    <p id="matched-budget-max-hint" className="mt-1.5 text-xs text-[#7a838c]">
                      Services priced above this are hidden; custom quotes always stay.
                    </p>
                  )}
                </div>
              </div>
              <fieldset>
                <legend className="type-card-label text-foreground">How urgent is it?</legend>
                <div className="mt-2 grid gap-2">
                  {(
                    [
                      { value: "FLEXIBLE", title: "Flexible", hint: "Any time works" },
                      { value: "SOON", title: "Soon", hint: "Within the next few days" },
                      { value: "URGENT", title: "Urgent", hint: "Prioritise working today" },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3",
                        draft.urgency === option.value
                          ? "border-[#5f8d11] bg-[#f4f8e8]"
                          : "border-black/10 bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="matched-urgency"
                        value={option.value}
                        checked={draft.urgency === option.value}
                        onChange={() => update("urgency", option.value)}
                        className="size-5 accent-[#5f8d11]"
                      />
                      <span className="text-sm font-semibold">{option.title}</span>
                      <span className="text-xs text-[#68717b]">{option.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="rounded-xl bg-[#f7f9fa] px-4 py-3 text-xs leading-5 text-[#68717b]">
                Budget: {budgetSummary}. Urgency only changes availability filtering — urgent
                prioritises professionals working today.
              </p>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              {loading ? (
                <div className="space-y-3" role="status" aria-label="Loading matches" aria-busy="true">
                  <ServiceCardSkeleton />
                  <ServiceCardSkeleton />
                  <ServiceCardSkeleton />
                </div>
              ) : searchError ? (
                <StatePanel
                  variant="error"
                  title="Matches unavailable"
                  description={searchError}
                  actionLabel="Try again"
                  onAction={() => {
                    if (mapped) executeSearch(mapped);
                  }}
                />
              ) : results && results.length > 0 ? (
                <div>
                  <p className="text-sm text-[#68717b]" aria-live="polite">
                    {results.length} match{results.length === 1 ? "" : "es"}
                    {mapped ? ` for ${mapped.serverQuery.category}` : ""}
                    {totalItems > results.length + hiddenOverBudget
                      ? ` · ${totalItems} in total`
                      : ""}
                  </p>
                  {hiddenOverBudget > 0 ? (
                    <p className="mt-1 text-xs text-[#68717b]">
                      {hiddenOverBudget} over-budget service{hiddenOverBudget === 1 ? "" : "s"} hidden.
                    </p>
                  ) : null}
                  <ul className="mt-4 space-y-3">
                    {results.map((service) => (
                      <li key={service.slug}>
                        <MatchResultCard service={service} mapped={mapped} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : results ? (
                <StatePanel
                  variant="filtered"
                  title="No services match those answers"
                  description="Try widening the budget, clearing a preference, or choosing a nearby location."
                  actionLabel="Edit answers"
                  onAction={goBack}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-black/7 bg-white px-6 py-4" aria-label="Get matched actions">
          {step < 4 ? (
            <>
              {step > 1 ? (
                <Button type="button" variant="outline" className="flex-1" onClick={goBack}>
                  Back
                </Button>
              ) : null}
              <Button type="button" className={step === 1 ? "flex-1" : "flex-[2]"} onClick={goNext}>
                {step === 3 ? "Show matches" : "Continue"} <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" className="flex-1" onClick={goBack}>
                Edit answers
              </Button>
              {mapped ? (
                <Button type="button" className="flex-[2]" asChild>
                  <Link
                    href={`/marketplace?${toMarketplaceSearchParams(mapped).toString()}`}
                    prefetch={false}
                  >
                    View all in marketplace <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function MatchResultCard({
  service,
  mapped,
}: {
  service: MarketplaceListing;
  mapped: MappedMatchQuery | null;
}) {
  const location =
    service.provider.operatingLocation ?? service.serviceAreas[0] ?? "Location confirmed with provider";
  const reasons = mapped ? buildMatchReasons(service, mapped).slice(0, 4) : [];
  return (
    <ServiceCard
      image={
        <Link
          href={`/services/${service.slug}`}
          prefetch={false}
          className="relative block min-h-[120px] bg-[#edf5d5] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Open ${service.name}`}
        >
          <Image
            src={service.imageUrl ?? fallbackImage(service.category)}
            alt={service.name}
            fill
            unoptimized={Boolean(service.imageUrl?.includes("res.cloudinary.com"))}
            loading="lazy"
            className="object-cover"
            sizes="(max-width: 960px) 90vw, 400px"
          />
        </Link>
      }
      title={
        <Link href={`/services/${service.slug}`} prefetch={false} className="hover:underline">
          {service.name}
        </Link>
      }
      footer={
        <>
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
            prefetch={false}
            aria-label={`View ${service.name}`}
            className="grid size-8 place-items-center rounded-full bg-primary"
          >
            <ArrowRight className="size-4" />
          </Link>
        </>
      }
    >
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
        <span className="truncate">
          <MapPin className="mr-1 inline size-3" />
          {location}
        </span>
      </p>
      {reasons.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this matches">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="rounded-lg bg-[#eef8c8] px-2 py-1 text-[0.65rem] font-medium text-[#486d09]"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </ServiceCard>
  );
}
