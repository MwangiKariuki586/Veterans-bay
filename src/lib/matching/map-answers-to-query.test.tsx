import { describe, expect, it } from "vitest";

import type { MarketplaceListing } from "@/modules/marketplace/types";

import {
  buildMatchReasons,
  filterListingsByBudget,
  mapGetMatchedAnswersToQuery,
  toMarketplaceSearchParams,
} from "./map-answers-to-query";

function listing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    slug: "tap-repair",
    name: "Tap Repair",
    category: "Plumbing",
    description: "Fix leaking taps.",
    fulfilmentModel: "on_site",
    pricingModel: "fixed",
    priceMinor: 250_000,
    currency: "KES",
    serviceAreas: ["Nairobi"],
    imageUrl: null,
    provider: {
      slug: "fix-it",
      businessName: "Fix It",
      operatingLocation: "Nairobi",
      verified: true,
      availableToday: false,
      experienceYears: 4,
      nextAvailableSlot: null,
      rating: 4.8,
      reviewCount: 12,
      verifiedJobs: 30,
    },
    ...overrides,
  };
}

describe("get matched answer mapping", () => {
  it("requires a category", () => {
    expect(() => mapGetMatchedAnswersToQuery({ category: "" })).toThrow();
  });

  it("maps need and preferences onto the marketplace query contract", () => {
    const mapped = mapGetMatchedAnswersToQuery({
      q: "leaking tap",
      category: "Plumbing",
      location: "Nairobi",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      urgency: "SOON",
    });
    expect(mapped.serverQuery).toMatchObject({
      q: "leaking tap",
      category: "Plumbing",
      location: "Nairobi",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      sort: "relevance",
      pageSize: 6,
    });
    expect(mapped.serverQuery.availability).toBeUndefined();
    expect(mapped.budgetMaxMinor).toBeNull();
    expect(toMarketplaceSearchParams(mapped).get("category")).toBe("Plumbing");
  });

  it("maps urgent needs to the existing today filter", () => {
    const mapped = mapGetMatchedAnswersToQuery({ category: "Electrical", urgency: "URGENT" });
    expect(mapped.serverQuery.availability).toBe("today");
  });

  it("rejects a maximum budget below the minimum", () => {
    expect(() =>
      mapGetMatchedAnswersToQuery({ category: "Cleaning", budgetMin: 5000, budgetMax: 1000 }),
    ).toThrow();
  });

  it("hides only over-budget fixed prices and keeps custom quotes", () => {
    const listings = [
      listing(),
      listing({ slug: "expensive", priceMinor: 2_000_000 }),
      listing({ slug: "quote", pricingModel: "custom_quote", priceMinor: null }),
    ];
    const result = filterListingsByBudget(listings, 500_000);
    expect(result.visible.map((item) => item.slug)).toEqual(["tap-repair", "quote"]);
    expect(result.hiddenOverBudget).toBe(1);
  });

  it("builds truthful match reasons from listing data", () => {
    const mapped = mapGetMatchedAnswersToQuery({
      category: "Plumbing",
      location: "Nairobi",
      fulfilmentModel: "on_site",
      budgetMax: 5000,
      urgency: "URGENT",
    });
    const reasons = buildMatchReasons(listing(), mapped);
    expect(reasons.join(" ")).toContain("Plumbing");
    expect(reasons.join(" ")).toContain("Verified");
    expect(reasons.join(" ")).toContain("Within your budget");
  });
});
