import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { StorageRepository } from "../../modules/storage/repository";
import { NotificationsRepository } from "../../modules/notifications/repository";
import { WarrantiesRepository } from "../../modules/warranties/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { bookings } from "./schema/commercial";
import { fileAssets } from "./schema/file-assets";
import { jobHistory, jobs } from "./schema/fulfilment";
import { organisations } from "./schema/organisations";
import { notifications } from "./schema/notifications";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import { organisationMemberships, roles } from "./schema/roles";
import {
  warranties,
  warrantyClaimHistory,
  warrantyClaims,
} from "./schema/warranties";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("warranty and follow-up persistence", () => {
  it("creates eligible coverage and isolates participant projections", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedWarrantyFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new WarrantiesRepository(testDb);
        const warrantyId = await repository.ensureFromJob({
          jobId: fixture.jobId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          correlationId: "warranty-created",
        });
        await expect(
          repository.ensureFromJob({
            jobId: fixture.jobId,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
          }),
        ).resolves.toBe(warrantyId);
        const scope = {
          organisationId: fixture.organisationId,
          membershipId: fixture.ownerMembershipId,
          assignedJobsOnly: false,
        };
        expect(
          await repository.getProfessional(warrantyId!, scope),
        ).toMatchObject({
          status: "ACTIVE",
          serviceName: "Electrical safety inspection",
          termsSnapshot: "Workmanship is covered for 30 days.",
        });
        await expect(
          repository.getClient(warrantyId!, fixture.clientId),
        ).resolves.toMatchObject({ status: "ACTIVE" });
        await expect(
          repository.getClient(warrantyId!, fixture.otherClientId),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessional(warrantyId!, {
            organisationId: fixture.otherOrganisationId,
            membershipId: fixture.otherMembershipId,
            assignedJobsOnly: false,
          }),
        ).resolves.toBeNull();
        expect(
          await testDb
            .select()
            .from(outboxEvents)
            .where(eq(outboxEvents.eventType, "warranty.created")),
        ).toHaveLength(1);
      });
    });
  });

  it("preserves evidence, decisions, return visits, resolution, and expiry gates", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedWarrantyFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new WarrantiesRepository(testDb);
        const warrantyId = await repository.ensureFromJob({
          jobId: fixture.jobId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
        });
        const [evidence] = await testDb
          .insert(fileAssets)
          .values({
            cloudinaryPublicId: `veterans-bay/warranties/${crypto.randomUUID()}`,
            purpose: "WARRANTY_EVIDENCE",
            mimeType: "image/jpeg",
            sizeBytes: 512,
            visibility: "private",
            ownerAccountId: fixture.clientId,
            organisationId: fixture.organisationId,
            status: "ready",
          })
          .returning();
        const claimId = await repository.submitClaim({
          warrantyId: warrantyId!,
          clientAccountId: fixture.clientId,
          subject: "Outlet is loose again",
          description:
            "The repaired outlet became loose again after normal household use.",
          preferredResolution: "Please inspect and secure the outlet.",
          evidenceAssetIds: [evidence.id],
          correlationId: "claim-submitted",
        });
        expect(claimId).toBeTruthy();
        const notificationRepository = new NotificationsRepository(testDb);
        const notificationEvent = {
          eventId: crypto.randomUUID(),
          eventType: "warranty.claim_submitted",
          eventVersion: 1,
          aggregateType: "warranty_claim",
          aggregateId: claimId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.clientId,
          correlationId: "claim-notification",
          occurredAt: new Date().toISOString(),
          payload: { warrantyId },
        };
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
              .where(
                eq(notifications.sourceEventId, notificationEvent.eventId),
              )
          )[0],
        ).toMatchObject({
          recipientAccountId: fixture.ownerId,
          actionTarget: `/professional/warranties/${warrantyId}`,
        });
        await expect(
          repository.submitClaim({
            warrantyId: warrantyId!,
            clientAccountId: fixture.clientId,
            subject: "Duplicate issue",
            description: "This should be rejected while the first claim is open.",
            evidenceAssetIds: [],
          }),
        ).resolves.toBeNull();
        const storage = new StorageRepository(testDb);
        await expect(
          storage.canAccessWarrantyEvidence(fixture.clientId, claimId!),
        ).resolves.toBe(true);
        await expect(
          storage.canAccessWarrantyEvidence(fixture.otherClientId, claimId!),
        ).resolves.toBe(false);

        const scope = {
          organisationId: fixture.organisationId,
          membershipId: fixture.ownerMembershipId,
          assignedJobsOnly: false,
        };
        await expect(
          repository.actOnClaim({
            claimId: claimId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            action: "REJECT",
          }),
        ).resolves.toBeNull();
        await repository.actOnClaim({
          claimId: claimId!,
          scope,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 1,
          action: "START_REVIEW",
        });
        await repository.actOnClaim({
          claimId: claimId!,
          scope,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 2,
          action: "ACCEPT",
        });
        const startsAt = new Date(Date.now() + 86_400_000);
        const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
        await repository.scheduleReturnVisit({
          claimId: claimId!,
          scope,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 3,
          startsAt,
          endsAt,
          reason: "Inspect the recurring outlet movement.",
        });
        expect(
          (
            await testDb.select().from(jobs).where(eq(jobs.id, fixture.jobId))
          )[0]
        ).toMatchObject({
          status: "RETURN_VISIT_REQUIRED",
          completedAt: null,
        });
        expect(
          await testDb
            .select()
            .from(jobHistory)
            .where(
              and(
                eq(jobHistory.jobId, fixture.jobId),
                eq(jobHistory.action, "WARRANTY_RETURN_VISIT_SCHEDULED"),
              ),
            ),
        ).toHaveLength(1);
        await repository.resolveClaim({
          claimId: claimId!,
          scope,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 4,
          resolutionNotes: "Outlet was resecured and tested with the client.",
          evidenceAssetIds: [],
          correlationId: "claim-resolved",
        });
        expect(
          (
            await testDb
              .select()
              .from(warrantyClaims)
              .where(eq(warrantyClaims.id, claimId!))
          )[0]
        ).toMatchObject({
          status: "RESOLVED",
          resolutionNotes: "Outlet was resecured and tested with the client.",
        });
        expect(
          await testDb
            .select()
            .from(warrantyClaimHistory)
            .where(eq(warrantyClaimHistory.claimId, claimId!)),
        ).toHaveLength(5);

        await testDb
          .update(warranties)
          .set({
            startsAt: new Date("2019-01-01T00:00:00.000Z"),
            endsAt: new Date("2020-01-01T00:00:00.000Z"),
          })
          .where(eq(warranties.id, warrantyId!));
        await expect(
          repository.submitClaim({
            warrantyId: warrantyId!,
            clientAccountId: fixture.clientId,
            subject: "Expired claim",
            description: "This claim is outside the recorded coverage window.",
            evidenceAssetIds: [],
          }),
        ).resolves.toBeNull();
      });
    });
  });
});

async function seedWarrantyFixture(db: Database, marker: string) {
  const [client, otherClient, owner, otherOwner] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `warranty-client-${marker}`,
        displayName: "Warranty Client",
        primaryEmail: `warranty-client-${marker}@example.com`,
      },
      {
        authUserId: `warranty-other-client-${marker}`,
        displayName: "Other Warranty Client",
        primaryEmail: `warranty-other-client-${marker}@example.com`,
      },
      {
        authUserId: `warranty-owner-${marker}`,
        displayName: "Warranty Owner",
        primaryEmail: `warranty-owner-${marker}@example.com`,
      },
      {
        authUserId: `warranty-other-owner-${marker}`,
        displayName: "Other Warranty Owner",
        primaryEmail: `warranty-other-owner-${marker}@example.com`,
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Warranty Provider",
        slug: `warranty-provider-${marker}`,
        status: "active",
      },
      {
        name: "Other Warranty Provider",
        slug: `other-warranty-provider-${marker}`,
        status: "active",
      },
    ])
    .returning();
  const ownerRole = (
    await db.select().from(roles).where(eq(roles.key, "owner")).limit(1)
  )[0]!;
  const [ownerMembership, otherMembership] = await db
    .insert(organisationMemberships)
    .values([
      {
        organisationId: organisation.id,
        accountProfileId: owner.id,
        roleId: ownerRole.id,
        status: "active",
      },
      {
        organisationId: otherOrganisation.id,
        accountProfileId: otherOwner.id,
        roleId: ownerRole.id,
        status: "active",
      },
    ])
    .returning();
  const [service] = await db
    .insert(professionalServices)
    .values({
      organisationId: organisation.id,
      slug: `warranty-inspection-${marker}`,
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
  const startsAt = new Date(Date.now() - 2 * 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
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
      exclusions: "Damage after the service is excluded.",
      warrantyTerms: "Workmanship is covered for 30 days.",
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
    ownerMembershipId: ownerMembership.id,
    otherMembershipId: otherMembership.id,
    jobId: job.id,
  };
}
