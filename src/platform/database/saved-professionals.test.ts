import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { SavedProfessionalsRepository } from "../../modules/saved-professionals/repository";
import { accountProfiles } from "./schema/account-profiles";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { professionalProfiles } from "./schema/professional-onboarding";
import { professionalServices } from "./schema/professional-services";
import { savedProfessionals } from "./schema/saved-professionals";
import { withTestDatabase } from "./testing/helpers";

describe("saved professional persistence", () => {
  it("isolates accounts, rejects non-public targets, and emits one event per new save", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const accounts = await db
        .insert(accountProfiles)
        .values([
          {
            authUserId: `saved-client-a-${marker}`,
            displayName: "Saved Client A",
            primaryEmail: `saved-client-a-${marker}@example.com`,
          },
          {
            authUserId: `saved-client-b-${marker}`,
            displayName: "Saved Client B",
            primaryEmail: `saved-client-b-${marker}@example.com`,
          },
        ])
        .returning();
      const providers = await db
        .insert(organisations)
        .values([
          {
            name: "Public Saved Provider",
            slug: `public-saved-${marker}`,
            status: "active",
          },
          {
            name: "Suspended Saved Provider",
            slug: `suspended-saved-${marker}`,
            status: "suspended",
          },
        ])
        .returning();
      const [accountA, accountB] = accounts;
      const [publicProvider, suspendedProvider] = providers;

      try {
        await db.insert(professionalProfiles).values([
          {
            organisationId: publicProvider.id,
            primaryCategory: "Plumbing",
            operatingLocation: "Nairobi",
            verificationStatus: "verified",
          },
          {
            organisationId: suspendedProvider.id,
            primaryCategory: "Electrical",
            verificationStatus: "verified",
          },
        ]);
        await db.insert(professionalServices).values([
          {
            organisationId: publicProvider.id,
            slug: `public-service-${marker}`,
            name: "Public service",
            category: "Plumbing",
            description: "A complete published service.",
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 5_000,
            status: "published",
            publishedAt: new Date(),
          },
          {
            organisationId: suspendedProvider.id,
            slug: `suspended-service-${marker}`,
            name: "Suspended service",
            category: "Electrical",
            description: "A hidden published service.",
            fulfilmentModel: "on_site",
            pricingModel: "fixed",
            priceMinor: 7_000,
            status: "published",
            publishedAt: new Date(),
          },
        ]);

        const repository = new SavedProfessionalsRepository(db);
        await expect(
          repository.save({
            accountProfileId: accountA.id,
            providerSlug: publicProvider.slug,
            correlationId: `request-a-${marker}`,
          }),
        ).resolves.toEqual({ created: true });
        await expect(
          repository.save({
            accountProfileId: accountA.id,
            providerSlug: publicProvider.slug,
          }),
        ).resolves.toEqual({ created: false });
        await expect(
          repository.save({
            accountProfileId: accountB.id,
            providerSlug: publicProvider.slug,
          }),
        ).resolves.toEqual({ created: true });
        await expect(
          repository.save({
            accountProfileId: accountA.id,
            providerSlug: suspendedProvider.slug,
          }),
        ).resolves.toBeNull();

        expect(await repository.list(accountA.id)).toEqual([
          expect.objectContaining({
            slug: publicProvider.slug,
            businessName: "Public Saved Provider",
            serviceCount: 1,
          }),
        ]);
        expect(await repository.list(accountB.id)).toHaveLength(1);

        const events = await db
          .select()
          .from(outboxEvents)
          .where(
            and(
              eq(outboxEvents.eventType, "professional.saved"),
              eq(outboxEvents.organisationId, publicProvider.id),
            ),
          );
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.actorAccountId).sort()).toEqual(
          [accountA.id, accountB.id].sort(),
        );

        await repository.remove(accountA.id, publicProvider.slug);
        expect(await repository.list(accountA.id)).toEqual([]);
        expect(await repository.list(accountB.id)).toHaveLength(1);

        await db
          .update(organisations)
          .set({ status: "suspended" })
          .where(eq(organisations.id, publicProvider.id));
        expect(await repository.list(accountB.id)).toEqual([]);
      } finally {
        await db
          .delete(outboxEvents)
          .where(inArray(outboxEvents.organisationId, providers.map((item) => item.id)));
        await db
          .delete(savedProfessionals)
          .where(
            inArray(
              savedProfessionals.accountProfileId,
              accounts.map((item) => item.id),
            ),
          );
        await db
          .delete(professionalServices)
          .where(
            inArray(
              professionalServices.organisationId,
              providers.map((item) => item.id),
            ),
          );
        await db
          .delete(professionalProfiles)
          .where(
            inArray(
              professionalProfiles.organisationId,
              providers.map((item) => item.id),
            ),
          );
        await db
          .delete(organisations)
          .where(inArray(organisations.id, providers.map((item) => item.id)));
        await db
          .delete(accountProfiles)
          .where(inArray(accountProfiles.id, accounts.map((item) => item.id)));
      }
    });
  });
});
