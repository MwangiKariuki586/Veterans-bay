import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { calculateQuotationTotals } from "../../modules/quotations/calculations";
import { QuotationsRepository } from "../../modules/quotations/repository";
import type { QuotationDraftValues } from "../../modules/quotations/types";
import { accountProfiles } from "./schema/account-profiles";
import {
  bookings,
  paymentRequirements,
  quotationLineItems,
  quotations,
  quotationVersions,
} from "./schema/commercial";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { serviceRequests } from "./schema/service-requests";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("quotation persistence", () => {
  it("preserves submitted terms and accepts one current version transactionally", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const marker = crypto.randomUUID();
        const [client, professional] = await testDb
          .insert(accountProfiles)
          .values([
            {
              authUserId: `quotation-client-${marker}`,
              displayName: "Quotation Client",
              primaryEmail: `quotation-client-${marker}@example.com`,
            },
            {
              authUserId: `quotation-pro-${marker}`,
              displayName: "Quotation Professional",
              primaryEmail: `quotation-pro-${marker}@example.com`,
            },
          ])
          .returning();
        const [organisation] = await testDb
          .insert(organisations)
          .values({
            name: "Quotation Provider",
            slug: `quotation-provider-${marker}`,
            status: "active",
          })
          .returning();
        const [request] = await testDb
          .insert(serviceRequests)
          .values({
            clientAccountId: client.id,
            organisationId: organisation.id,
            idempotencyKey: crypto.randomUUID(),
            source: "PROFESSIONAL_BOOKING_LINK",
            category: "Plumbing",
            status: "UNDER_REVIEW",
            currency: "KES",
          })
          .returning();
        const values: QuotationDraftValues = {
          currency: "KES",
          lineItems: [
            {
              category: "LABOUR",
              description: "Replace the leaking valve",
              quantity: 2,
              unitPriceMinor: 5_000,
            },
            {
              category: "MATERIAL",
              description: "Replacement valve",
              quantity: 1,
              unitPriceMinor: 3_000,
            },
          ],
          discountMinor: 500,
          taxMinor: 1_400,
          depositMinor: 5_000,
          expectedDurationMinutes: 180,
          proposedStartAt: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1_000,
          ).toISOString(),
          validUntil: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1_000,
          ).toISOString(),
          scope: "Replace the failed valve and test the repaired connection.",
          exclusions: "Wall finishes and unrelated pipework are excluded.",
          warrantyTerms: "A 90-day workmanship warranty applies.",
          paymentTerms: "Deposit on acceptance and balance after completion.",
        };
        const repository = new QuotationsRepository(testDb);
        const draft = await repository.createDraft({
          organisationId: organisation.id,
          actorAccountId: professional.id,
          requestId: request.id,
          mutation: {
            values,
            totals: calculateQuotationTotals(values),
          },
        });
        expect(draft).toMatchObject({
          status: "DRAFT",
          currentVersionNumber: 1,
          currentTotalMinor: 13_900,
        });
        await expect(
          repository.getProfessional(crypto.randomUUID(), draft!.id),
        ).resolves.toBeNull();
        await expect(
          repository.getClient(professional.id, draft!.id),
        ).resolves.toBeNull();

        const submitted = await repository.submit({
          organisationId: organisation.id,
          actorAccountId: professional.id,
          quotationId: draft!.id,
          expectedLockVersion: draft!.lockVersion,
          correlationId: `quotation-submit-${marker}`,
        });
        expect(submitted).toMatchObject({
          status: "SUBMITTED",
          lockVersion: 2,
        });
        const clientList = await repository.listClient({
          clientAccountId: client.id,
          bucket: "awaiting-decision",
          category: "Plumbing",
          search: "Quotation Provider",
          validity: "valid",
          sort: "total_desc",
          page: 1,
          pageSize: 10,
        });
        expect(clientList).toMatchObject({
          page: 1,
          pageSize: 10,
          totalItems: 1,
          summary: {
            total: 1,
            awaitingDecision: 1,
            accepted: 0,
            expiringSoon: 0,
            inRevision: 0,
            closed: 0,
          },
          categories: ["Plumbing"],
        });
        expect(clientList.items).toHaveLength(1);
        await expect(
          testDb.transaction((tx) =>
            tx
              .update(quotationVersions)
              .set({ totalMinor: 1 })
              .where(
                and(
                  eq(quotationVersions.quotationId, draft!.id),
                  eq(quotationVersions.versionNumber, 1),
                ),
              ),
          ),
        ).rejects.toThrow();
        const [submittedVersion] = await testDb
          .select()
          .from(quotationVersions)
          .where(eq(quotationVersions.quotationId, draft!.id));
        await expect(
          testDb.transaction((tx) =>
            tx
              .update(quotationLineItems)
              .set({ description: "Changed after submission" })
              .where(
                eq(
                  quotationLineItems.quotationVersionId,
                  submittedVersion.id,
                ),
              ),
          ),
        ).rejects.toThrow();

        const viewed = await repository.markViewed({
          clientAccountId: client.id,
          quotationId: draft!.id,
          correlationId: `quotation-viewed-${marker}`,
        });
        const accepted = await repository.accept({
          clientAccountId: client.id,
          quotationId: draft!.id,
          expectedLockVersion: viewed!.lockVersion,
          correlationId: `quotation-accepted-${marker}`,
        });
        const retry = await repository.accept({
          clientAccountId: client.id,
          quotationId: draft!.id,
          expectedLockVersion: viewed!.lockVersion,
          correlationId: `quotation-accepted-retry-${marker}`,
        });
        expect(accepted).toMatchObject({
          status: "ACCEPTED",
          acceptedVersionNumber: 1,
        });
        expect(retry?.bookingId).toBe(accepted?.bookingId);

        const [bookingRows, requirementRows, acceptanceEvents, persistedRequest] =
          await Promise.all([
            testDb
              .select()
              .from(bookings)
              .where(eq(bookings.quotationId, draft!.id)),
            testDb
              .select()
              .from(paymentRequirements)
              .innerJoin(bookings, eq(bookings.id, paymentRequirements.bookingId))
              .where(eq(bookings.quotationId, draft!.id)),
            testDb
              .select()
              .from(outboxEvents)
              .where(
                and(
                  eq(outboxEvents.aggregateId, draft!.id),
                  eq(outboxEvents.eventType, "quotation.accepted"),
                ),
              ),
            testDb
              .select({ status: serviceRequests.status })
              .from(serviceRequests)
              .where(eq(serviceRequests.id, request.id)),
          ]);
        expect(bookingRows).toHaveLength(1);
        expect(bookingRows[0]).toMatchObject({
          origin: "ACCEPTED_QUOTATION",
          status: "PENDING_DEPOSIT",
          totalMinor: 13_900,
          depositMinor: 5_000,
          scope: values.scope,
        });
        expect(requirementRows).toHaveLength(2);
        expect(
          requirementRows.map((row) => ({
            type: row.payment_requirements.requirementType,
            amount: row.payment_requirements.amountMinor,
          })),
        ).toEqual(
          expect.arrayContaining([
            { type: "DEPOSIT", amount: 5_000 },
            { type: "BALANCE", amount: 8_900 },
          ]),
        );
        expect(acceptanceEvents).toHaveLength(1);
        expect(persistedRequest).toEqual([{ status: "CONVERTED" }]);

        const [persistedQuotation] = await testDb
          .select()
          .from(quotations)
          .where(eq(quotations.id, draft!.id));
        expect(persistedQuotation.acceptedByAccountId).toBe(client.id);

        const [expiringRequest] = await testDb
          .insert(serviceRequests)
          .values({
            clientAccountId: client.id,
            organisationId: organisation.id,
            idempotencyKey: crypto.randomUUID(),
            source: "PROFESSIONAL_BOOKING_LINK",
            category: "Plumbing",
            status: "UNDER_REVIEW",
            currency: "KES",
          })
          .returning();
        const expiringDraft = await repository.createDraft({
          organisationId: organisation.id,
          actorAccountId: professional.id,
          requestId: expiringRequest.id,
          mutation: {
            values,
            totals: calculateQuotationTotals(values),
          },
        });
        await repository.submit({
          organisationId: organisation.id,
          actorAccountId: professional.id,
          quotationId: expiringDraft!.id,
          expectedLockVersion: expiringDraft!.lockVersion,
        });
        const expiry = await repository.expireDue({
          now: new Date(
            new Date(values.validUntil).getTime() + 1_000,
          ),
          limit: 50,
        });
        expect(expiry.expired).toBeGreaterThanOrEqual(1);
        expect(expiry.quotationIds).toContain(expiringDraft!.id);
        expect(
          await repository.getProfessional(
            organisation.id,
            expiringDraft!.id,
          ),
        ).toMatchObject({ status: "EXPIRED" });
        const expiryEvents = await testDb
          .select()
          .from(outboxEvents)
          .where(
            and(
              eq(outboxEvents.aggregateId, expiringDraft!.id),
              eq(outboxEvents.eventType, "quotation.expired"),
            ),
          );
        expect(expiryEvents).toHaveLength(1);
      });
    });
  }, 180_000);
});
