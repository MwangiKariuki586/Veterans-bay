import { z } from "zod";

import type { MarketplaceListing } from "@/modules/marketplace/types";

/**
 * Guided "Get matched" answers.
 *
 * Budget and urgency are captured in the wizard but are NOT marketplace
 * server filters (the public search API has no price-range or urgency
 * parameters). Urgency maps to the existing `availability=today` filter and
 * budget applies as a truthful client-side ceiling over `priceMinor`, always
 * keeping `custom_quote` services visible since their price is confirmed
 * through a quotation.
 */
export const getMatchedAnswersSchema = z
  .object({
    q: z.string().trim().min(2).max(100).optional().or(z.literal("")),
    category: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(120).optional().or(z.literal("")),
    fulfilmentModel: z.enum(["on_site", "remote", "hybrid"]).optional().or(z.literal("")),
    pricingModel: z.enum(["fixed", "starting_from", "custom_quote"]).optional().or(z.literal("")),
    budgetMin: z.coerce.number().nonnegative().max(100_000_000).optional(),
    budgetMax: z.coerce.number().nonnegative().max(100_000_000).optional(),
    urgency: z.enum(["FLEXIBLE", "SOON", "URGENT"]).default("FLEXIBLE"),
    verifiedOnly: z.boolean().default(false),
    topRatedOnly: z.boolean().default(false),
  })
  .refine((value) => value.budgetMax == null || value.budgetMin == null || value.budgetMax >= value.budgetMin, {
    message: "Maximum budget must be at least the minimum budget.",
    path: ["budgetMax"],
  });

export type GetMatchedAnswers = z.infer<typeof getMatchedAnswersSchema>;

export interface GetMatchedServerQuery {
  q?: string;
  category: string;
  location?: string;
  fulfilmentModel?: "on_site" | "remote" | "hybrid";
  pricingModel?: "fixed" | "starting_from" | "custom_quote";
  availability?: "today";
  verified?: "true";
  topRated?: "true";
  sort: "relevance" | "newest";
  pageSize: number;
}

export interface MappedMatchQuery {
  serverQuery: GetMatchedServerQuery;
  budgetMaxMinor: number | null;
  urgency: "FLEXIBLE" | "SOON" | "URGENT";
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Maps wizard answers onto the existing public marketplace query contract. */
export function mapGetMatchedAnswersToQuery(input: unknown): MappedMatchQuery {
  const answers = getMatchedAnswersSchema.parse(input);
  const serverQuery: GetMatchedServerQuery = {
    category: answers.category.trim(),
    sort: answers.q?.trim() ? "relevance" : "newest",
    pageSize: 6,
  };

  const q = emptyToUndefined(answers.q);
  if (q) serverQuery.q = q;
  const location = emptyToUndefined(answers.location);
  if (location) serverQuery.location = location;
  if (answers.fulfilmentModel) serverQuery.fulfilmentModel = answers.fulfilmentModel;
  if (answers.pricingModel) serverQuery.pricingModel = answers.pricingModel;
  // Urgency is the only wizard field that changes a server filter: an urgent
  // need prioritises professionals working today via the existing indexed
  // working-hours filter. SOON/FLEXIBLE leave availability unconstrained.
  if (answers.urgency === "URGENT") serverQuery.availability = "today";
  if (answers.verifiedOnly) serverQuery.verified = "true";
  if (answers.topRatedOnly) serverQuery.topRated = "true";

  return {
    serverQuery,
    budgetMaxMinor:
      answers.budgetMax == null || Number.isNaN(answers.budgetMax)
        ? null
        : Math.round(answers.budgetMax * 100),
    urgency: answers.urgency,
  };
}

/** Serialises a mapped query for `GET /api/v1/public/marketplace`. */
export function toMarketplaceSearchParams(mapped: MappedMatchQuery): URLSearchParams {
  const params = new URLSearchParams();
  const query = mapped.serverQuery;
  if (query.q) params.set("q", query.q);
  params.set("category", query.category);
  if (query.location) params.set("location", query.location);
  if (query.fulfilmentModel) params.set("fulfilmentModel", query.fulfilmentModel);
  if (query.pricingModel) params.set("pricingModel", query.pricingModel);
  if (query.availability) params.set("availability", query.availability);
  if (query.verified) params.set("verified", query.verified);
  if (query.topRated) params.set("topRated", query.topRated);
  params.set("sort", query.sort);
  params.set("pageSize", String(query.pageSize));
  return params;
}

export interface BudgetFilterResult {
  visible: MarketplaceListing[];
  hiddenOverBudget: number;
}

/**
 * Applies the wizard budget as a client-side ceiling. Fixed and
 * starting-from services priced above the ceiling are hidden; custom-quote
 * services are always kept because their price is confirmed by quotation.
 */
export function filterListingsByBudget(
  listings: MarketplaceListing[],
  budgetMaxMinor: number | null,
): BudgetFilterResult {
  if (budgetMaxMinor == null) return { visible: listings, hiddenOverBudget: 0 };
  const visible: MarketplaceListing[] = [];
  let hiddenOverBudget = 0;
  for (const listing of listings) {
    if (
      listing.pricingModel !== "custom_quote" &&
      listing.priceMinor != null &&
      listing.priceMinor > budgetMaxMinor
    ) {
      hiddenOverBudget += 1;
      continue;
    }
    visible.push(listing);
  }
  return { visible, hiddenOverBudget };
}

/** Truthful, data-derived "why this matches" bullets for a result card. */
export function buildMatchReasons(
  listing: MarketplaceListing,
  mapped: MappedMatchQuery,
): string[] {
  const reasons: string[] = [];
  const query = mapped.serverQuery;
  reasons.push(`${listing.category} specialist`);
  if (query.location) {
    const location = listing.provider.operatingLocation ?? listing.serviceAreas[0];
    reasons.push(location ? `Serves ${location}` : "Location confirmed with provider");
  }
  if (query.fulfilmentModel === "on_site") reasons.push("On-site service");
  else if (query.fulfilmentModel === "remote") reasons.push("Remote service");
  else if (query.fulfilmentModel === "hybrid") reasons.push("On-site or remote");
  if (listing.provider.verified) reasons.push("Verified professional");
  if (
    listing.provider.rating != null &&
    listing.provider.rating >= 4.7 &&
    listing.provider.reviewCount > 0
  ) {
    reasons.push(`${listing.provider.rating.toFixed(1)} rating (${listing.provider.reviewCount} reviews)`);
  }
  if (listing.pricingModel === "custom_quote") {
    reasons.push("Custom quote — price confirmed before you commit");
  } else if (mapped.budgetMaxMinor != null && listing.priceMinor != null) {
    reasons.push("Within your budget");
  }
  if (mapped.urgency === "URGENT") reasons.push("Prioritised for urgent needs");
  return reasons;
}
