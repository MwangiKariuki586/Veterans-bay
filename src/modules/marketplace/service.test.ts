import { describe, expect, it, vi } from "vitest";

import type { MarketplaceStore } from "./repository";
import { MarketplaceService } from "./service";
import type { MarketplaceSearchQuery } from "./types";

const query: MarketplaceSearchQuery = {
  q: "plumbing",
  category: "Plumbing",
  availability: "today",
  sort: "relevance",
  page: 1,
  pageSize: 9,
};

describe("marketplace service", () => {
  it("maps bounded public listings and removes custom-quote totals", async () => {
    const store: MarketplaceStore = {
      recordAnalytics: vi.fn(),
      search: vi.fn().mockResolvedValue({
        totalItems: 1,
        items: [
          {
            organisationId: "organisation-1",
            slug: "plumbing-inspection",
            name: "Plumbing inspection",
            category: "Plumbing",
            description: "A complete plumbing inspection.",
            fulfilmentModel: "on_site",
            pricingModel: "custom_quote",
            priceMinor: 99_999,
            currency: "KES",
            serviceAreas: ["Nairobi"],
            imagePublicId: "veterans-bay/services/inspection",
            estimatedDurationMinutes: 60,
            directBookingEnabled: true,
            providerSlug: "trusted-plumbing",
            providerName: "Trusted Plumbing",
            providerLocation: "Nairobi",
            providerVerified: true,
            providerExperienceStartedYear: 2018,
            providerAverageRatingHundredths: 480,
            providerReviewCount: 12,
            providerVerifiedJobs: 9,
          },
        ],
      }),
    };

    const availabilityStore = {
      slotInputsByOrganisation: vi.fn().mockResolvedValue(
        new Map([
          [
            "organisation-1",
            {
              rules: [
                {
                  membershipId: "membership-1",
                  memberName: "Jane Technician",
                  weekday: 0,
                  startMinute: 8 * 60,
                  endMinute: 17 * 60,
                  timezone: "Africa/Nairobi",
                },
              ],
              blocks: [],
              reservations: [],
            },
          ],
        ]),
      ),
    };
    const result = await new MarketplaceService(
      store,
      "demo-cloud",
      availabilityStore,
      () => new Date("2026-08-23T05:00:00.000Z"),
    ).search(query);

    expect(store.search).toHaveBeenCalledWith(query);
    expect(result).toEqual({
      page: 1,
      pageSize: 9,
      totalItems: 1,
      totalPages: 1,
      items: [
        expect.objectContaining({
          slug: "plumbing-inspection",
          priceMinor: null,
          imageUrl:
            "https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,c_fill,w_1200,h_800/veterans-bay/services/inspection",
          provider: expect.objectContaining({
            businessName: "Trusted Plumbing",
            verified: true,
            availableToday: true,
            experienceYears: 8,
            nextAvailableSlot: {
              startsAt: "2026-08-23T05:30:00.000Z",
              timezone: "Africa/Nairobi",
            },
            rating: 4.8,
            reviewCount: 12,
            verifiedJobs: 9,
          }),
        }),
      ],
    });
  });

  it("keeps empty result pagination stable", async () => {
    const store: MarketplaceStore = {
      recordAnalytics: vi.fn(),
      search: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    };

    await expect(
      new MarketplaceService(store).search({ ...query, page: 3 }),
    ).resolves.toMatchObject({
      items: [],
      page: 3,
      totalItems: 0,
      totalPages: 1,
    });
  });

  it("calculates multi-page totals from the bounded page size", async () => {
    const store: MarketplaceStore = {
      recordAnalytics: vi.fn(),
      search: vi.fn().mockResolvedValue({ items: [], totalItems: 29 }),
    };

    await expect(
      new MarketplaceService(store).search({ ...query, page: 2 }),
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 9,
      totalItems: 29,
      totalPages: 4,
    });
  });

  it("delegates bounded analytics without coupling it to search results", async () => {
    const store: MarketplaceStore = {
      recordAnalytics: vi.fn().mockResolvedValue(undefined),
      search: vi.fn(),
    };
    const event = {
      eventType: "marketplace.search_performed" as const,
      activeFilters: ["category" as const],
      page: 1,
      resultCount: 4,
      sort: "relevance" as const,
    };

    await new MarketplaceService(store).recordAnalytics(event);

    expect(store.recordAnalytics).toHaveBeenCalledWith(event);
    expect(store.search).not.toHaveBeenCalled();
  });
});
