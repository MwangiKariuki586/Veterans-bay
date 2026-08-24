import { describe, expect, it } from "vitest";

import {
  marketplaceAnalyticsEventSchema,
  marketplaceSearchQuerySchema,
} from "./schemas";

describe("marketplace schemas", () => {
  it("accepts the top-rated and instant-booking search filters", () => {
    expect(
      marketplaceSearchQuerySchema.parse({
        topRated: "true",
        instantBooking: "true",
      }),
    ).toMatchObject({
      topRated: "true",
      instantBooking: "true",
    });
  });

  it("accepts both filters in marketplace analytics", () => {
    expect(
      marketplaceAnalyticsEventSchema.parse({
        eventType: "marketplace.search_performed",
        activeFilters: ["topRated", "instantBooking"],
        page: 1,
        resultCount: 2,
        sort: "relevance",
      }),
    ).toMatchObject({ activeFilters: ["topRated", "instantBooking"] });
  });

  it("defaults to nine results and accepts later pages", () => {
    expect(marketplaceSearchQuerySchema.parse({ page: "3" })).toMatchObject({
      page: 3,
      pageSize: 9,
    });
  });

  it("rejects page sizes above the public result bound", () => {
    expect(() =>
      marketplaceSearchQuerySchema.parse({ pageSize: "10" }),
    ).toThrow();
  });
});
