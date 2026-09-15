import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ProfessionalServicesRepository } from "../../modules/professional-services/repository";
import { PublicCatalogueRepository } from "../../modules/professional-services/public-repository";
import { accountProfiles } from "./schema/account-profiles";
import { fileAssets } from "./schema/file-assets";
import { organisations } from "./schema/organisations";
import { professionalProfiles } from "./schema/professional-onboarding";
import { outboxEvents } from "./schema/outbox-events";
import {
  professionalPortfolioItems,
  professionalServiceImages,
  professionalServiceSnapshots,
  professionalServices,
} from "./schema/professional-services";
import { withTestDatabase } from "./testing/helpers";

describe("professional service persistence", () => {
  it("creates an organisation-scoped draft and service.created event atomically", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [actor] = await db.insert(accountProfiles).values({
        authUserId: `service-owner-${marker}`,
        displayName: "Service Owner",
        primaryEmail: `service-owner-${marker}@example.com`,
      }).returning();
      const [organisation] = await db.insert(organisations).values({
        name: "Service Test",
        slug: `service-test-${marker}`,
        status: "active",
      }).returning();
      const [otherOrganisation] = await db.insert(organisations).values({
        name: "Other Service Test",
        slug: `other-service-test-${marker}`,
        status: "active",
      }).returning();
      const repository = new ProfessionalServicesRepository(db);

      try {
        const created = await repository.createDraft({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          slug: `inspection-${marker}`,
          values: { name: "Home inspection", currency: "KES" },
          correlationId: `request-${marker}`,
        });
        expect(created).toMatchObject({
          organisationId: organisation.id,
          name: "Home inspection",
          status: "draft",
          version: 1,
        });
        expect(await repository.list(organisation.id)).toHaveLength(1);
        expect(await repository.get(otherOrganisation.id, created.id)).toBeNull();
        expect(await repository.update({
          organisationId: otherOrganisation.id,
          serviceId: created.id,
          actorAccountId: actor.id,
          expectedVersion: 1,
          values: { name: "Cross-organisation edit" },
        })).toBeNull();
        expect((await repository.get(organisation.id, created.id))?.name).toBe("Home inspection");
        expect(
          await db.select().from(outboxEvents).where(and(
            eq(outboxEvents.aggregateId, created.id),
            eq(outboxEvents.eventType, "service.created"),
          )),
        ).toHaveLength(1);
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(professionalServices).where(eq(professionalServices.organisationId, organisation.id));
        await db.delete(organisations).where(inArray(organisations.id, [organisation.id, otherOrganisation.id]));
        await db.delete(accountProfiles).where(inArray(accountProfiles.id, [actor.id]));
      }
    });
  });

  it("preserves immutable publication snapshots across edits and republication", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [actor] = await db.insert(accountProfiles).values({
        authUserId: `snapshot-owner-${marker}`,
        displayName: "Snapshot Owner",
        primaryEmail: `snapshot-owner-${marker}@example.com`,
      }).returning();
      const [organisation] = await db.insert(organisations).values({
        name: "Snapshot Test",
        slug: `snapshot-test-${marker}`,
        status: "active",
      }).returning();
      const repository = new ProfessionalServicesRepository(db);

      try {
        const created = await repository.createDraft({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          slug: `repair-${marker}`,
          values: {
            name: "Home repair",
            category: "Repairs",
            description: "Original published service description.",
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 10_000,
            currency: "KES",
          },
        });
        const firstPublication = await repository.publish({
          organisationId: organisation.id,
          serviceId: created.id,
          actorAccountId: actor.id,
          expectedVersion: 1,
        });
        const unpublished = await repository.unpublish({
          organisationId: organisation.id,
          serviceId: created.id,
          actorAccountId: actor.id,
          expectedVersion: firstPublication!.version,
        });
        const edited = await repository.update({
          organisationId: organisation.id,
          serviceId: created.id,
          actorAccountId: actor.id,
          expectedVersion: unpublished!.version,
          values: { description: "Revised published service description." },
        });
        const secondPublication = await repository.publish({
          organisationId: organisation.id,
          serviceId: created.id,
          actorAccountId: actor.id,
          expectedVersion: edited!.version,
        });

        const snapshots = await db.select().from(professionalServiceSnapshots)
          .where(eq(professionalServiceSnapshots.serviceId, created.id));
        expect(firstPublication).toMatchObject({ status: "published", version: 2 });
        expect(secondPublication).toMatchObject({ status: "published", version: 5 });
        expect(snapshots).toHaveLength(2);
        expect(snapshots.map((item) => item.version).sort()).toEqual([2, 5]);
        expect(snapshots.find((item) => item.version === 2)?.snapshot).toMatchObject({
          description: "Original published service description.",
          priceMinor: 10_000,
        });
        expect(snapshots.find((item) => item.version === 5)?.snapshot).toMatchObject({
          description: "Revised published service description.",
        });
        const events = await db.select({ eventType: outboxEvents.eventType }).from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, created.id));
        expect(events.map((item) => item.eventType)).toEqual([
          "service.created",
          "service.published",
          "service.unpublished",
          "service.updated",
          "service.published",
        ]);
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(professionalServiceSnapshots).where(eq(professionalServiceSnapshots.serviceId, (await repository.list(organisation.id))[0]?.id ?? crypto.randomUUID()));
        await db.delete(professionalServices).where(eq(professionalServices.organisationId, organisation.id));
        await db.delete(organisations).where(eq(organisations.id, organisation.id));
        await db.delete(accountProfiles).where(eq(accountProfiles.id, actor.id));
      }
    });
  });

  it("exposes only published services belonging to active organisations", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [actor] = await db.insert(accountProfiles).values({
        authUserId: `public-owner-${marker}`,
        displayName: "Public Owner",
        primaryEmail: `public-owner-${marker}@example.com`,
      }).returning();
      const [organisation] = await db.insert(organisations).values({
        name: "Public Catalogue Test",
        slug: `public-catalogue-${marker}`,
        status: "active",
      }).returning();
      await db.insert(professionalProfiles).values({
        organisationId: organisation.id,
        description: "Public description",
        primaryCategory: "Plumbing",
        verificationStatus: "verified",
      });
      const services = new ProfessionalServicesRepository(db);
      const catalogue = new PublicCatalogueRepository(db);

      try {
        const draft = await services.createDraft({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          slug: `public-service-${marker}`,
          values: {
            name: "Public plumbing service",
            category: "Plumbing",
            description: "A complete published plumbing service description.",
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 7_500,
            currency: "KES",
          },
        });
        expect(await catalogue.findServiceBySlug(draft.slug)).toBeNull();

        const published = await services.publish({
          organisationId: organisation.id,
          serviceId: draft.id,
          actorAccountId: actor.id,
          expectedVersion: draft.version,
        });
        expect(await catalogue.findServiceBySlug(draft.slug)).toMatchObject({
          service: { id: draft.id, status: "published" },
          professional: { slug: organisation.slug },
        });
        expect(await catalogue.findProfessionalBySlug(organisation.slug)).toMatchObject({
          businessName: organisation.name,
        });

        await services.unpublish({
          organisationId: organisation.id,
          serviceId: draft.id,
          actorAccountId: actor.id,
          expectedVersion: published!.version,
        });
        expect(await catalogue.findServiceBySlug(draft.slug)).toBeNull();

        const republished = await services.publish({
          organisationId: organisation.id,
          serviceId: draft.id,
          actorAccountId: actor.id,
          expectedVersion: published!.version + 1,
        });
        expect(republished?.status).toBe("published");
        await db.update(organisations).set({ status: "suspended" })
          .where(eq(organisations.id, organisation.id));
        expect(await catalogue.findServiceBySlug(draft.slug)).toBeNull();
        expect(await catalogue.findProfessionalBySlug(organisation.slug)).toBeNull();
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(professionalServiceSnapshots).where(eq(professionalServiceSnapshots.serviceId, (await services.list(organisation.id))[0]?.id ?? crypto.randomUUID()));
        await db.delete(professionalServices).where(eq(professionalServices.organisationId, organisation.id));
        await db.delete(organisations).where(eq(organisations.id, organisation.id));
        await db.delete(accountProfiles).where(eq(accountProfiles.id, actor.id));
      }
    });
  });

  it("links only ready purpose-safe catalogue images within the organisation", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [actor] = await db.insert(accountProfiles).values({
        authUserId: `asset-owner-${marker}`,
        displayName: "Asset Owner",
        primaryEmail: `asset-owner-${marker}@example.com`,
      }).returning();
      const [organisation] = await db.insert(organisations).values({
        name: "Asset Test",
        slug: `asset-test-${marker}`,
        status: "active",
      }).returning();
      const [otherOrganisation] = await db.insert(organisations).values({
        name: "Other Asset Test",
        slug: `other-asset-test-${marker}`,
        status: "active",
      }).returning();
      await db.insert(professionalProfiles).values({
        organisationId: organisation.id,
      });
      const assets = await db.insert(fileAssets).values([
        {
          cloudinaryPublicId: `veterans-bay/portfolio/${marker}`,
          purpose: "PORTFOLIO_IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          visibility: "public",
          ownerAccountId: actor.id,
          organisationId: organisation.id,
          status: "ready",
        },
        {
          cloudinaryPublicId: `veterans-bay/services/${marker}`,
          purpose: "SERVICE_IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          visibility: "public",
          ownerAccountId: actor.id,
          organisationId: organisation.id,
          status: "ready",
        },
        {
          cloudinaryPublicId: `veterans-bay/portfolio/other-${marker}`,
          purpose: "PORTFOLIO_IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          visibility: "public",
          ownerAccountId: actor.id,
          organisationId: otherOrganisation.id,
          status: "ready",
        },
      ]).returning();
      const repository = new ProfessionalServicesRepository(db);

      try {
        const service = await repository.createDraft({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          slug: `image-service-${marker}`,
          values: { name: "Image service", currency: "KES" },
        });
        const portfolio = await repository.addPortfolioItem({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          assetId: assets[0].id,
          title: "Completed repair",
          description: null,
        });
        const serviceImage = await repository.addServiceImage({
          organisationId: organisation.id,
          serviceId: service.id,
          actorAccountId: actor.id,
          assetId: assets[1].id,
        });

        expect(await repository.listPortfolio(organisation.id)).toMatchObject([
          { id: portfolio.id, assetId: assets[0].id },
        ]);
        expect(await repository.listServiceImages(organisation.id, service.id))
          .toMatchObject([{ id: serviceImage.id, assetId: assets[1].id }]);
        await expect(repository.addPortfolioItem({
          organisationId: organisation.id,
          actorAccountId: actor.id,
          assetId: assets[2].id,
          title: "Cross-tenant image",
          description: null,
        })).rejects.toMatchObject({ code: "INVALID_CATALOGUE_ASSET" });
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(professionalServiceImages).where(eq(professionalServiceImages.assetId, assets[1].id));
        await db.delete(professionalPortfolioItems).where(eq(professionalPortfolioItems.assetId, assets[0].id));
        await db.delete(professionalServices).where(eq(professionalServices.organisationId, organisation.id));
        await db.delete(professionalProfiles).where(eq(professionalProfiles.organisationId, organisation.id));
        await db.delete(fileAssets).where(inArray(fileAssets.id, assets.map((asset) => asset.id)));
        await db.delete(organisations).where(inArray(organisations.id, [organisation.id, otherOrganisation.id]));
        await db.delete(accountProfiles).where(eq(accountProfiles.id, actor.id));
      }
    });
  });
});
