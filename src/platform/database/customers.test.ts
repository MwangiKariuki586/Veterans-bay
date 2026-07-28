import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { CustomersRepository } from "../../modules/customers/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import {
  customerNotes,
  customerRecords,
  customerRecordTags,
} from "./schema/customers";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("professional customer persistence", () => {
  it("preserves origins, duplicate candidates, invitation, and safe identity reconciliation", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seed(testDb);
        const repository = new CustomersRepository(testDb);
        const first = await repository.create({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          displayName: "Amina Imported",
          email: " AMINA@EXAMPLE.TEST ",
          acquisitionSource: "PROFESSIONAL_IMPORTED",
        });
        expect(first.duplicateOfCustomerId).toBeNull();
        const duplicate = await repository.create({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          displayName: "Amina duplicate",
          email: "amina@example.test",
          acquisitionSource: "CLIENT_REFERRAL",
        });
        expect(duplicate.duplicateOfCustomerId).toBe(first.id);
        await expect(
          repository.invite({
            customerId: first.id,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
          }),
        ).resolves.toBe(true);
        await expect(
          repository.reconcile({
            customerId: first.id,
            organisationId: fixture.organisationId,
          }),
        ).resolves.toBe(true);
        expect(
          (
            await testDb
              .select()
              .from(customerRecords)
              .where(eq(customerRecords.id, first.id))
          )[0],
        ).toMatchObject({
          accountProfileId: fixture.clientId,
          status: "REGISTERED",
          acquisitionSource: "PROFESSIONAL_INVITED",
          email: "amina@example.test",
        });
        expect(
          (
            await testDb
              .select()
              .from(customerRecords)
              .where(eq(customerRecords.id, duplicate.id))
          )[0],
        ).toMatchObject({
          status: "DUPLICATE_CANDIDATE",
          duplicateOfCustomerId: first.id,
        });
        expect(
          await testDb
            .select()
            .from(outboxEvents)
            .where(eq(outboxEvents.aggregateId, first.id)),
        ).toHaveLength(2);
      });
    });
  });

  it("isolates private notes and tags while keeping search paginated", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seed(testDb);
        const repository = new CustomersRepository(testDb);
        const customer = await repository.create({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          displayName: "Searchable Customer",
          phone: "+254 700 000 001",
          acquisitionSource: "PROFESSIONAL_IMPORTED",
        });
        await repository.addNote({
          customerId: customer.id,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          body: "Prefers morning appointments.",
        });
        await repository.addTag({
          customerId: customer.id,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          name: "Annual service",
        });
        await expect(
          repository.get(customer.id, fixture.organisationId),
        ).resolves.toMatchObject({
          displayName: "Searchable Customer",
          notes: [{ body: "Prefers morning appointments." }],
          tags: ["Annual service"],
        });
        await expect(
          repository.get(customer.id, fixture.otherOrganisationId),
        ).resolves.toBeNull();
        await expect(
          repository.addNote({
            customerId: customer.id,
            organisationId: fixture.otherOrganisationId,
            actorAccountId: fixture.otherOwnerId,
            body: "Cross-tenant note.",
          }),
        ).resolves.toBe(false);
        await expect(
          repository.list({
            organisationId: fixture.organisationId,
            search: "Searchable",
            page: 1,
            pageSize: 1,
          }),
        ).resolves.toMatchObject({
          totalItems: 1,
          totalPages: 1,
          items: [{ id: customer.id }],
        });
        expect(await testDb.select().from(customerNotes)).toHaveLength(1);
        expect(await testDb.select().from(customerRecordTags)).toHaveLength(1);
      });
    });
  });
});

async function seed(db: Database) {
  const marker = crypto.randomUUID();
  const [owner, otherOwner, client] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `customer-owner-${marker}`,
        displayName: "Customer Owner",
        primaryEmail: `owner-${marker}@example.test`,
      },
      {
        authUserId: `customer-other-${marker}`,
        displayName: "Other Owner",
        primaryEmail: `other-${marker}@example.test`,
      },
      {
        authUserId: `customer-client-${marker}`,
        displayName: "Amina Registered",
        primaryEmail: "amina@example.test",
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Customer Organisation",
        slug: `customer-org-${marker}`,
        status: "active",
      },
      {
        name: "Other Customer Organisation",
        slug: `other-customer-org-${marker}`,
        status: "active",
      },
    ])
    .returning();
  return {
    ownerId: owner.id,
    otherOwnerId: otherOwner.id,
    clientId: client.id,
    organisationId: organisation.id,
    otherOrganisationId: otherOrganisation.id,
  };
}
