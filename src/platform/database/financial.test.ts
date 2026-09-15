import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { InvoicesRepository } from "../../modules/invoices/repository";
import { NotificationsRepository } from "../../modules/notifications/repository";
import { StorageRepository } from "../../modules/storage/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { bookings } from "./schema/commercial";
import { fileAssets } from "./schema/file-assets";
import {
  invoiceItems,
  paymentAdjustments,
  paymentAllocations,
  payments,
} from "./schema/financial";
import { jobs } from "./schema/fulfilment";
import { organisations } from "./schema/organisations";
import { notifications } from "./schema/notifications";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("invoice and manual payment persistence", () => {
  it("preserves completed-job totals, tenant projections, and issue state", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedFinancialFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new InvoicesRepository(testDb);
        const first = await repository.createFromJob({
          jobId: fixture.jobId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          correlationId: "invoice-create",
        });
        const duplicate = await repository.createFromJob({
          jobId: fixture.jobId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
        });
        expect(duplicate).toBe(first);

        const draft = await repository.getProfessional(
          first!,
          fixture.organisationId,
        );
        expect(draft).toMatchObject({
          status: "DRAFT",
          totalMinor: 25_000,
          balanceMinor: 25_000,
          serviceName: "Electrical safety inspection",
        });
        expect(draft?.items).toHaveLength(1);
        await expect(
          repository.listProfessional({
            scope: { organisationId: fixture.organisationId },
            bucket: "drafts",
            search: "safety",
            sort: "balance_desc",
            page: 1,
            pageSize: 10,
          }),
        ).resolves.toMatchObject({
          totalItems: 1,
          summary: {
            total: 1,
            drafts: 1,
            outstanding: 0,
            amounts: [{
              currency: "KES",
              totalMinor: 25_000,
              paidMinor: 0,
              outstandingMinor: 0,
            }],
          },
          items: [{ id: first, status: "DRAFT" }],
        });
        await expect(
          repository.getClient(first!, fixture.clientId),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessional(first!, fixture.otherOrganisationId),
        ).resolves.toBeNull();

        await expect(
          repository.issue({
            invoiceId: first!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            dueAt: new Date(Date.now() + 14 * 86_400_000),
            correlationId: "invoice-issue",
          }),
        ).resolves.toBe(true);
        const clientInvoice = await repository.getClient(
          first!,
          fixture.clientId,
        );
        expect(clientInvoice).toMatchObject({
          status: "ISSUED",
          paidMinor: 0,
          balanceMinor: 25_000,
        });
        await expect(
          repository.listClient({
            clientAccountId: fixture.clientId,
            bucket: "outstanding",
            search: "Electrical safety",
            sort: "due_asc",
            page: 1,
            pageSize: 10,
          }),
        ).resolves.toMatchObject({
          totalItems: 1,
          summary: {
            total: 1,
            outstanding: 1,
            drafts: 0,
            amounts: [{
              currency: "KES",
              totalMinor: 25_000,
              paidMinor: 0,
              outstandingMinor: 25_000,
            }],
          },
          items: [{ id: first, status: "ISSUED", balanceMinor: 25_000 }],
        });
        const [issuedEvent] = await testDb
            .select()
            .from(outboxEvents)
            .where(
              and(
                eq(outboxEvents.aggregateId, first!),
                eq(outboxEvents.eventType, "invoice.issued"),
              ),
            );
        expect(issuedEvent).toBeTruthy();
        const notificationEvent = {
          eventId: issuedEvent.id,
          eventType: issuedEvent.eventType,
          eventVersion: issuedEvent.eventVersion,
          aggregateType: issuedEvent.aggregateType,
          aggregateId: issuedEvent.aggregateId,
          organisationId: issuedEvent.organisationId,
          actorAccountId: issuedEvent.actorAccountId,
          correlationId: issuedEvent.correlationId,
          occurredAt: issuedEvent.createdAt.toISOString(),
          payload: issuedEvent.payload,
        };
        const notificationRepository = new NotificationsRepository(testDb);
        await expect(
          notificationRepository.consume(notificationEvent),
        ).resolves.toEqual({ created: 1, duplicate: false });
        await expect(
          notificationRepository.consume(notificationEvent),
        ).resolves.toEqual({ created: 0, duplicate: true });
        expect(
          (
            await testDb
              .select()
              .from(notifications)
              .where(eq(notifications.sourceEventId, issuedEvent.id))
          )[0],
        ).toMatchObject({
          recipientAccountId: fixture.clientId,
          title: "Invoice issued",
          body: "A new invoice is ready to review.",
          actionTarget: `/client/invoices/${first}`,
        });
      });
    });
  });

  it("allocates idempotently, rejects overpayment atomically, and preserves reversal history", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedFinancialFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new InvoicesRepository(testDb);
        const invoiceId = await repository.createFromJob({
          jobId: fixture.jobId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
        });
        await repository.issue({
          invoiceId: invoiceId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 1,
          dueAt: new Date(Date.now() + 14 * 86_400_000),
        });
        const item = (
          await testDb
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.invoiceId, invoiceId!))
        )[0]!;
        const idempotencyKey = crypto.randomUUID();
        const [evidence] = await testDb
          .insert(fileAssets)
          .values({
            cloudinaryPublicId: `veterans-bay/payments/${crypto.randomUUID()}`,
            purpose: "PAYMENT_EVIDENCE",
            mimeType: "image/jpeg",
            sizeBytes: 512,
            visibility: "private",
            ownerAccountId: fixture.ownerId,
            organisationId: fixture.organisationId,
            status: "ready",
          })
          .returning();
        const paymentInput = {
          invoiceId: invoiceId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          idempotencyKey,
          amountMinor: 15_000,
          currency: "KES",
          method: "BANK_TRANSFER" as const,
          transactionReference: "BANK-001",
          evidenceAssetId: evidence.id,
          paidAt: new Date(),
          allocations: [{ invoiceItemId: item.id, amountMinor: 15_000 }],
        };
        const first = await repository.recordPayment(paymentInput);
        const duplicate = await repository.recordPayment(paymentInput);
        expect(duplicate?.paymentId).toBe(first?.paymentId);
        expect(
          await testDb
            .select()
            .from(payments)
            .where(eq(payments.idempotencyKey, idempotencyKey)),
        ).toHaveLength(1);
        const storage = new StorageRepository(testDb);
        await expect(
          storage.canAccessPaymentEvidence(
            fixture.clientId,
            "payment",
            first!.paymentId,
          ),
        ).resolves.toBe(true);
        await expect(
          storage.canAccessPaymentEvidence(
            fixture.otherClientId,
            "payment",
            first!.paymentId,
          ),
        ).resolves.toBe(false);
        expect(
          await repository.getProfessional(
            invoiceId!,
            fixture.organisationId,
          ),
        ).toMatchObject({
          status: "PARTIALLY_PAID",
          paidMinor: 15_000,
          balanceMinor: 10_000,
        });

        const paymentCountBefore = await testDb.select().from(payments);
        const outboxCountBefore = await testDb.select().from(outboxEvents);
        await expect(
          repository.recordPayment({
            ...paymentInput,
            idempotencyKey: crypto.randomUUID(),
            amountMinor: 10_001,
            allocations: [
              { invoiceItemId: item.id, amountMinor: 10_001 },
            ],
          }),
        ).resolves.toBeNull();
        expect(await testDb.select().from(payments)).toHaveLength(
          paymentCountBefore.length,
        );
        expect(await testDb.select().from(outboxEvents)).toHaveLength(
          outboxCountBefore.length,
        );

        const adjustmentKey = crypto.randomUUID();
        await expect(
          repository.adjustPayment({
            paymentId: first!.paymentId,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            idempotencyKey: adjustmentKey,
            adjustmentType: "REVERSAL",
            amountMinor: 15_000,
            reason: "Bank transfer was entered against the wrong customer.",
            recordedAt: new Date(),
          }),
        ).resolves.toMatchObject({ invoiceId });
        await repository.adjustPayment({
          paymentId: first!.paymentId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          idempotencyKey: adjustmentKey,
          adjustmentType: "REVERSAL",
          amountMinor: 15_000,
          reason: "Bank transfer was entered against the wrong customer.",
          recordedAt: new Date(),
        });
        expect(
          await testDb
            .select()
            .from(paymentAdjustments)
            .where(eq(paymentAdjustments.idempotencyKey, adjustmentKey)),
        ).toHaveLength(1);
        expect(
          await testDb
            .select()
            .from(paymentAllocations)
            .where(eq(paymentAllocations.paymentId, first!.paymentId)),
        ).toHaveLength(1);
        expect(
          await repository.getProfessional(
            invoiceId!,
            fixture.organisationId,
          ),
        ).toMatchObject({
          status: "REFUNDED",
          paidMinor: 0,
          balanceMinor: 25_000,
        });
        expect(
          await testDb
            .select()
            .from(outboxEvents)
            .where(eq(outboxEvents.eventType, "payment.reversed")),
        ).toHaveLength(1);
      });
    });
  });
});

async function seedFinancialFixture(db: Database, marker: string) {
  const [client, otherClient, owner] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `invoice-client-${marker}`,
        displayName: "Invoice Client",
        primaryEmail: `invoice-client-${marker}@example.com`,
      },
      {
        authUserId: `invoice-other-client-${marker}`,
        displayName: "Other Invoice Client",
        primaryEmail: `invoice-other-client-${marker}@example.com`,
      },
      {
        authUserId: `invoice-owner-${marker}`,
        displayName: "Financial Owner",
        primaryEmail: `invoice-owner-${marker}@example.com`,
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Financial Provider",
        slug: `financial-provider-${marker}`,
        status: "active",
      },
      {
        name: "Other Financial Provider",
        slug: `other-financial-provider-${marker}`,
        status: "active",
      },
    ])
    .returning();
  const [service] = await db
    .insert(professionalServices)
    .values({
      organisationId: organisation.id,
      slug: `financial-inspection-${marker}`,
      name: "Electrical safety inspection",
      description: "Inspect and certify household electrical circuits.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 25_000,
      currency: "KES",
      estimatedDurationMinutes: 90,
      directBookingEnabled: true,
      status: "published",
      moderationStatus: "clear",
      publishedAt: new Date(),
    })
    .returning();
  const startsAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const [booking] = await db
    .insert(bookings)
    .values({
      professionalServiceId: service.id,
      organisationId: organisation.id,
      clientAccountId: client.id,
      createdByAccountId: owner.id,
      origin: "PROFESSIONAL_CUSTOMER",
      status: "PENDING_CONFIRMATION",
      currency: "KES",
      totalMinor: 25_000,
      depositMinor: 0,
      expectedDurationMinutes: 90,
      startsAt,
      endsAt,
      timezone: "Africa/Nairobi",
      cancellationAcknowledgedAt: startsAt,
      scope: "Inspect and certify the agreed circuits.",
      exclusions: "Repairs are excluded.",
      warrantyTerms: "Thirty day workmanship cover.",
      paymentTerms: "Payment after confirmation.",
    })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      bookingId: booking.id,
      organisationId: organisation.id,
      clientAccountId: client.id,
      createdByAccountId: owner.id,
      status: "COMPLETED",
      serviceName: service.name,
      scopeSnapshot: booking.scope,
      exclusionsSnapshot: booking.exclusions,
      warrantyTermsSnapshot: booking.warrantyTerms,
      paymentTermsSnapshot: booking.paymentTerms,
      currency: "KES",
      baseTotalMinor: 25_000,
      approvedVariationTotalMinor: 0,
      totalMinor: 25_000,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
      completedAt: endsAt,
    })
    .returning();
  return {
    clientId: client.id,
    otherClientId: otherClient.id,
    ownerId: owner.id,
    organisationId: organisation.id,
    otherOrganisationId: otherOrganisation.id,
    jobId: job.id,
  };
}
