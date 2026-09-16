import { and, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { MarketplaceRepository } from "../../modules/marketplace/repository";
import type { MarketplaceSearchQuery } from "../../modules/marketplace/types";
import { organisations } from "./schema/organisations";
import { professionalProfiles } from "./schema/professional-onboarding";
import { professionalServices } from "./schema/professional-services";
import { outboxEvents } from "./schema/outbox-events";
import { withTestDatabase } from "./testing/helpers";

const baseQuery: MarketplaceSearchQuery = {
  sort: "relevance",
  page: 1,
  pageSize: 9,
};

describe("marketplace persistence", () => {
  it("searches and filters only complete published services from active organisations", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const insertedOrganisations = await db
        .insert(organisations)
        .values([
          {
            name: "Verified Plumbing",
            slug: `verified-plumbing-${marker}`,
            status: "active",
          },
          {
            name: "Unverified Electrical",
            slug: `unverified-electrical-${marker}`,
            status: "active",
          },
          {
            name: "Suspended Plumbing",
            slug: `suspended-plumbing-${marker}`,
            status: "suspended",
          },
        ])
        .returning();
      const [verified, unverified, suspended] = insertedOrganisations;
      const today = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Nairobi",
        weekday: "long",
      })
        .format(new Date())
        .toLowerCase();

      try {
        await db.insert(professionalProfiles).values([
          {
            organisationId: verified.id,
            operatingLocation: "Nairobi",
            serviceAreas: ["Nairobi"],
            workingHours: {
              [today]: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
            },
            verificationStatus: "verified",
          },
          {
            organisationId: unverified.id,
            operatingLocation: "Mombasa",
            serviceAreas: ["Mombasa"],
            verificationStatus: "pending",
          },
          {
            organisationId: suspended.id,
            operatingLocation: "Nairobi",
            serviceAreas: ["Nairobi"],
            verificationStatus: "verified",
          },
        ]);
        await db.insert(professionalServices).values([
          {
            organisationId: verified.id,
            slug: `pipe-inspection-${marker}`,
            name: "Pipe inspection",
            category: "Plumbing",
            description: `Inspect pipework and diagnose hidden leaks. ${marker}`,
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 5_000,
            serviceAreas: ["Nairobi"],
            status: "published",
            publishedAt: new Date(),
          },
          {
            organisationId: unverified.id,
            slug: `remote-electrical-${marker}`,
            name: "Remote electrical advice",
            category: "Electrical",
            description: `Remote electrical troubleshooting advice. ${marker}`,
            fulfilmentModel: "remote",
            pricingModel: "custom_quote",
            serviceAreas: ["Mombasa"],
            status: "published",
            publishedAt: new Date(),
          },
          {
            organisationId: suspended.id,
            slug: `hidden-plumbing-${marker}`,
            name: "Hidden plumbing",
            category: "Plumbing",
            description: "This listing belongs to a suspended organisation.",
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 8_000,
            serviceAreas: ["Nairobi"],
            status: "published",
            publishedAt: new Date(),
          },
          {
            organisationId: verified.id,
            slug: `incomplete-${marker}`,
            name: "Incomplete listing",
            status: "published",
            publishedAt: new Date(),
          },
        ]);

        const repository = new MarketplaceRepository(db);
        const plumbing = await repository.search({
          ...baseQuery,
          q: marker,
          category: "plumbing",
          location: "Nairobi",
          fulfilmentModel: "on_site",
          pricingModel: "fixed",
          availability: "today",
          verified: "true",
        });
        const unverifiedResults = await repository.search({
          ...baseQuery,
          q: marker,
          verified: "false",
        });

        expect(plumbing.totalItems).toBe(1);
        expect(plumbing.items).toEqual([
          expect.objectContaining({
            slug: `pipe-inspection-${marker}`,
            providerName: "Verified Plumbing",
            providerVerified: true,
          }),
        ]);
        expect(unverifiedResults.items).toEqual([
          expect.objectContaining({
            slug: `remote-electrical-${marker}`,
            providerVerified: false,
          }),
        ]);

        await db
          .update(professionalServices)
          .set({ moderationStatus: "hidden" })
          .where(eq(professionalServices.organisationId, verified.id));
        const moderated = await repository.search({
          ...baseQuery,
          q: marker,
          category: "Plumbing",
        });
        expect(moderated.items).toHaveLength(0);
      } finally {
        const organisationIds = insertedOrganisations.map((item) => item.id);
        await db
          .delete(professionalServices)
          .where(inArray(professionalServices.organisationId, organisationIds));
        await db
          .delete(professionalProfiles)
          .where(inArray(professionalProfiles.organisationId, organisationIds));
        await db
          .delete(organisations)
          .where(inArray(organisations.id, organisationIds));
      }
    });
  });

  it("keeps pagination bounded and stable", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [organisation] = await db
        .insert(organisations)
        .values({
          name: "Pagination Services",
          slug: `pagination-services-${marker}`,
          status: "active",
        })
        .returning();

      try {
        await db.insert(professionalProfiles).values({
          organisationId: organisation.id,
          verificationStatus: "verified",
        });
        await db.insert(professionalServices).values(
          Array.from({ length: 3 }, (_, index) => ({
            organisationId: organisation.id,
            slug: `pagination-${index}-${marker}`,
            name: `Pagination service ${index}`,
            category: "Cleaning",
            description: `A complete cleaning service for pagination. ${marker}`,
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 2_000 + index,
            status: "published",
            publishedAt: new Date(2026, 0, index + 1),
          })),
        );

        const result = await new MarketplaceRepository(db).search({
          ...baseQuery,
          q: marker,
          pageSize: 2,
        });

        expect(result.totalItems).toBe(3);
        expect(result.items).toHaveLength(2);
        expect(result.items.map((item) => item.name)).toEqual([
          "Pagination service 2",
          "Pagination service 1",
        ]);
      } finally {
        await db
          .delete(professionalServices)
          .where(eq(professionalServices.organisationId, organisation.id));
        await db
          .delete(professionalProfiles)
          .where(eq(professionalProfiles.organisationId, organisation.id));
        await db.delete(organisations).where(eq(organisations.id, organisation.id));
      }
    });
  });

  it("records only bounded analytics for eligible public targets", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const resultCount = Math.floor(Math.random() * 900_000) + 1;
      const [organisation] = await db
        .insert(organisations)
        .values({
          name: "Analytics Provider",
          slug: `analytics-provider-${marker}`,
          status: "active",
        })
        .returning();
      const [service] = await db
        .insert(professionalServices)
        .values({
          organisationId: organisation.id,
          slug: `analytics-service-${marker}`,
          name: "Analytics service",
          category: "Repairs",
          description: "A complete public analytics target.",
          fulfilmentModel: "on_site",
          pricingModel: "fixed",
          priceMinor: 5_000,
          status: "published",
          publishedAt: new Date(),
        })
        .returning();
      await db.insert(professionalProfiles).values({
        organisationId: organisation.id,
        verificationStatus: "verified",
      });
      const repository = new MarketplaceRepository(db);
      let eventIds: string[] = [];

      try {
        await repository.recordAnalytics({
          eventType: "marketplace.search_performed",
          activeFilters: ["category"],
          page: 1,
          resultCount,
          sort: "relevance",
        });
        await repository.recordAnalytics({
          eventType: "professional.profile_viewed",
          targetSlug: organisation.slug,
        });
        await repository.recordAnalytics({
          eventType: "service.viewed",
          targetSlug: service.slug,
        });
        await repository.recordAnalytics({
          eventType: "service.viewed",
          targetSlug: `private-${marker}`,
        });

        const targetEvents = await db
          .select()
          .from(outboxEvents)
          .where(eq(outboxEvents.organisationId, organisation.id));
        const [searchEvent] = await db
          .select()
          .from(outboxEvents)
          .where(
            and(
              eq(outboxEvents.eventType, "marketplace.search_performed"),
              sql`${outboxEvents.payload} @> ${JSON.stringify({ resultCount })}::jsonb`,
            ),
          );
        eventIds = [
          ...targetEvents.map((event) => event.id),
          ...(searchEvent ? [searchEvent.id] : []),
        ];

        expect(targetEvents.map((event) => event.eventType).sort()).toEqual([
          "professional.profile_viewed",
          "service.viewed",
        ]);
        expect(searchEvent?.payload).toEqual({
          activeFilters: ["category"],
          page: 1,
          resultCount,
          sort: "relevance",
        });
      } finally {
        if (eventIds.length > 0) {
          await db
            .delete(outboxEvents)
            .where(inArray(outboxEvents.id, eventIds));
        }
        await db
          .delete(professionalServices)
          .where(eq(professionalServices.organisationId, organisation.id));
        await db
          .delete(professionalProfiles)
          .where(eq(professionalProfiles.organisationId, organisation.id));
        await db
          .delete(organisations)
          .where(eq(organisations.id, organisation.id));
      }
    });
  });
});
