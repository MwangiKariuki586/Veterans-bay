import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { JobsRepository } from "../../modules/jobs/repository";
import { NotificationsRepository } from "../../modules/notifications/repository";
import type { DomainEventEnvelope } from "../events/contracts";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { bookings } from "./schema/commercial";
import { fileAssets } from "./schema/file-assets";
import {
  jobAssignments,
  jobCommercialHistory,
  jobCompletionResponses,
  jobHistory,
  jobs,
  jobVariations,
} from "./schema/fulfilment";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import { organisationMemberships, roles } from "./schema/roles";
import { bookingHistory, bookingReservations } from "./schema/scheduling";
import { warranties } from "./schema/warranties";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("job fulfilment persistence", () => {
  it("creates one snapshot-safe job and enforces assignment-derived tenant access", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedJobFixture(testDb, crypto.randomUUID());
        const repository = new JobsRepository(testDb);

        const firstId = await repository.ensureFromBooking({
          bookingId: fixture.bookingId,
          actorAccountId: fixture.ownerId,
          organisationId: fixture.organisationId,
          correlationId: "job-create-first",
        });
        const secondId = await repository.ensureFromBooking({
          bookingId: fixture.bookingId,
          actorAccountId: fixture.ownerId,
          organisationId: fixture.organisationId,
          correlationId: "job-create-repeat",
        });
        expect(secondId).toBe(firstId);
        expect(
          await testDb
            .select()
            .from(jobs)
            .where(eq(jobs.bookingId, fixture.bookingId)),
        ).toHaveLength(1);

        await testDb
          .update(professionalServices)
          .set({ name: "Changed service", priceMinor: 999_999 })
          .where(eq(professionalServices.id, fixture.serviceId));
        await testDb
          .update(bookings)
          .set({ scope: "Changed booking scope", totalMinor: 999_999 })
          .where(eq(bookings.id, fixture.bookingId));

        const ownerScope = {
          organisationId: fixture.organisationId,
          membershipId: fixture.ownerMembershipId,
          assignedJobsOnly: false,
        };
        const detail = await repository.getProfessional(firstId!, ownerScope);
        expect(detail).toMatchObject({
          serviceName: "Electrical safety inspection",
          scopeSnapshot: "Inspect and certify the agreed circuits.",
          baseTotalMinor: 25_000,
          totalMinor: 25_000,
          status: "TEAM_ASSIGNED",
        });
        expect(detail?.checklist).toHaveLength(3);

        await expect(
          repository.getProfessional(firstId!, {
            organisationId: fixture.organisationId,
            membershipId: fixture.technicianMembershipId,
            assignedJobsOnly: true,
          }),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessional(firstId!, {
            organisationId: fixture.otherOrganisationId,
            membershipId: fixture.otherMembershipId,
            assignedJobsOnly: false,
          }),
        ).resolves.toBeNull();
        await expect(
          repository.getClient(firstId!, fixture.otherClientId),
        ).resolves.toBeNull();

        await expect(
          repository.assign({
            jobId: firstId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            membershipId: fixture.technicianMembershipId,
            expectedLockVersion: 1,
            reason: "Technician selected for field work.",
          }),
        ).resolves.toBe("updated");
        const assignedView = await repository.getProfessional(firstId!, {
          organisationId: fixture.organisationId,
          membershipId: fixture.technicianMembershipId,
          assignedJobsOnly: true,
        });
        expect(assignedView?.assignmentNames).toContain("Field Technician");

        const technicianAssignment = assignedView?.assignments.find(
          (item) => item.membershipId === fixture.technicianMembershipId,
        );
        await expect(
          repository.unassign({
            jobId: firstId!,
            assignmentId: technicianAssignment!.id,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 2,
            reason: "Reassigned after a dispatch change.",
          }),
        ).resolves.toBe("updated");
        const assignmentHistory = await testDb
          .select()
          .from(jobAssignments)
          .where(
            and(
              eq(jobAssignments.jobId, firstId!),
              eq(
                jobAssignments.membershipId,
                fixture.technicianMembershipId,
              ),
            ),
          );
        expect(assignmentHistory[0]).toMatchObject({
          active: false,
          reason: "Reassigned after a dispatch change.",
        });
        expect(assignmentHistory[0]?.unassignedAt).toBeInstanceOf(Date);
      });
    });
  });

  it("enforces checklist, evidence, variation, and completion gates with idempotent effects", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedJobFixture(testDb, crypto.randomUUID());
        const repository = new JobsRepository(testDb);
        const jobId = await repository.ensureFromBooking({
          bookingId: fixture.bookingId,
          actorAccountId: fixture.ownerId,
          organisationId: fixture.organisationId,
          correlationId: "job-execution-created",
        });
        const scope = {
          organisationId: fixture.organisationId,
          membershipId: fixture.ownerMembershipId,
          assignedJobsOnly: true,
        };
        const clientMessageKey = crypto.randomUUID();
        await expect(
          repository.sendConversationMessage({
            jobId: jobId!,
            actorAccountId: fixture.clientId,
            role: "CLIENT",
            idempotencyKey: clientMessageKey,
            body: "Please call when you arrive.",
          }),
        ).resolves.toMatchObject({ contextType: "JOB" });
        const duplicateMessage = await repository.sendConversationMessage({
          jobId: jobId!,
          actorAccountId: fixture.clientId,
          role: "CLIENT",
          idempotencyKey: clientMessageKey,
          body: "Please call when you arrive.",
        });
        expect(
          duplicateMessage?.items.filter((item) => item.kind === "MESSAGE"),
        ).toEqual([
          expect.objectContaining({
            kind: "MESSAGE",
            body: "Please call when you arrive.",
          }),
        ]);
        await repository.sendConversationMessage({
          jobId: jobId!,
          actorAccountId: fixture.ownerId,
          role: "PROFESSIONAL",
          scope,
          idempotencyKey: crypto.randomUUID(),
          body: "We will call before check-in.",
        });
        const unread = await repository.loadConversation({
          jobId: jobId!,
          actorAccountId: fixture.clientId,
          role: "CLIENT",
        });
        expect(unread?.unreadCount).toBe(1);
        const read = await repository.markConversationRead({
          jobId: jobId!,
          actorAccountId: fixture.clientId,
          role: "CLIENT",
        });
        expect(read?.unreadCount).toBe(0);

        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            action: "START",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 2,
            action: "READY",
          }),
        ).resolves.toBe("checklist");

        const detail = await repository.getProfessional(jobId!, scope);
        for (const item of detail!.checklist) {
          await expect(
            repository.setChecklist({
              jobId: jobId!,
              checklistItemId: item.id,
              scope,
              actorAccountId: fixture.ownerId,
              completed: true,
            }),
          ).resolves.toBe(true);
        }
        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 2,
            action: "READY",
          }),
        ).resolves.toBe("evidence");

        const [asset] = await testDb
          .insert(fileAssets)
          .values({
            cloudinaryPublicId: `jobs/${crypto.randomUUID()}`,
            purpose: "JOB_EVIDENCE",
            mimeType: "image/jpeg",
            sizeBytes: 1024,
            visibility: "private",
            ownerAccountId: fixture.ownerId,
            organisationId: fixture.organisationId,
            status: "ready",
          })
          .returning();
        await expect(
          repository.addEvidence({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            assetId: asset.id,
            evidenceType: "AFTER",
            visibility: "CLIENT",
            caption: "Completed and tested installation.",
          }),
        ).resolves.toBe(true);

        const variationId = await repository.createVariation({
          jobId: jobId!,
          scope,
          actorAccountId: fixture.ownerId,
          description: "Replace a damaged isolation switch.",
          reason: "Damage was concealed before work began.",
          additionalAmountMinor: 5_000,
          scheduleImpactMinutes: 30,
        });
        expect(variationId).toBeTypeOf("string");
        await expect(
          repository.submitVariation({
            jobId: jobId!,
            variationId: variationId!,
            scope,
            actorAccountId: fixture.ownerId,
            correlationId: "variation-submitted",
          }),
        ).resolves.toBe(true);
        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 2,
            action: "READY",
          }),
        ).resolves.toBe("variation");

        await expect(
          repository.respondVariation({
            jobId: jobId!,
            variationId: variationId!,
            clientAccountId: fixture.clientId,
            decision: "ACCEPT",
            comment: "Approved.",
            correlationId: "variation-approved",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.respondVariation({
            jobId: jobId!,
            variationId: variationId!,
            clientAccountId: fixture.clientId,
            decision: "ACCEPT",
          }),
        ).resolves.toBe("stale");
        const [acceptedVariation] = await testDb
          .select()
          .from(jobVariations)
          .where(eq(jobVariations.id, variationId!));
        expect(acceptedVariation.status).toBe("ACCEPTED");
        expect(
          await testDb
            .select()
            .from(jobCommercialHistory)
            .where(eq(jobCommercialHistory.variationId, variationId!)),
        ).toHaveLength(1);

        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 3,
            action: "READY",
            correlationId: "job-ready",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.respondCompletion({
            jobId: jobId!,
            clientAccountId: fixture.otherClientId,
            response: "CONFIRM",
          }),
        ).resolves.toBe("not_found");
        await expect(
          repository.respondCompletion({
            jobId: jobId!,
            clientAccountId: fixture.clientId,
            response: "UNRESOLVED",
            comments: "The isolation switch still trips.",
            correlationId: "job-unresolved",
          }),
        ).resolves.toBe("updated");

        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 5,
            action: "START",
            correlationId: "return-visit-started",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.transition({
            jobId: jobId!,
            scope,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 6,
            action: "READY",
            correlationId: "return-visit-ready",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.respondCompletion({
            jobId: jobId!,
            clientAccountId: fixture.clientId,
            response: "CONFIRM_WITH_COMMENTS",
            comments: "Retested and confirmed.",
            correlationId: "job-completed",
          }),
        ).resolves.toBe("updated");
        await expect(
          repository.respondCompletion({
            jobId: jobId!,
            clientAccountId: fixture.clientId,
            response: "CONFIRM",
          }),
        ).resolves.toBe("updated");

        const final = await repository.getClient(jobId!, fixture.clientId);
        expect(final).toMatchObject({
          status: "COMPLETED",
          baseTotalMinor: 25_000,
          approvedVariationTotalMinor: 5_000,
          totalMinor: 30_000,
        });
        expect(final?.completionResponses).toHaveLength(2);
        const [completedBooking] = await testDb
          .select({ status: bookings.status, completedAt: bookings.completedAt })
          .from(bookings)
          .where(eq(bookings.id, fixture.bookingId));
        expect(completedBooking.status).toBe("COMPLETED");
        expect(completedBooking.completedAt?.toISOString()).toBe(final?.completedAt);
        const [reservation] = await testDb
          .select({ status: bookingReservations.status })
          .from(bookingReservations)
          .where(eq(bookingReservations.bookingId, fixture.bookingId));
        expect(reservation.status).toBe("RELEASED");
        expect(
          await testDb
            .select()
            .from(bookingHistory)
            .where(
              and(
                eq(bookingHistory.bookingId, fixture.bookingId),
                eq(bookingHistory.action, "COMPLETED"),
              ),
            ),
        ).toHaveLength(1);
        expect(
          await testDb
            .select()
            .from(warranties)
            .where(eq(warranties.jobId, jobId!)),
        ).toHaveLength(1);
        expect(
          await testDb
            .select()
            .from(jobCompletionResponses)
            .where(eq(jobCompletionResponses.jobId, jobId!)),
        ).toHaveLength(2);
        const events = await testDb
          .select({ eventType: outboxEvents.eventType })
          .from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, jobId!));
        expect(events.map((item) => item.eventType)).toEqual(
          expect.arrayContaining([
            "job.created",
            "job.started",
            "attachment.added",
            "job.variation_requested",
            "job.variation_approved",
            "job.awaiting_confirmation",
            "job.completed",
          ]),
        );
        const history = await testDb
          .select({ action: jobHistory.action })
          .from(jobHistory)
          .where(eq(jobHistory.jobId, jobId!));
        expect(history.map((item) => item.action)).toEqual(
          expect.arrayContaining([
            "CREATED",
            "START",
            "VARIATION_REQUESTED",
            "VARIATION_APPROVED",
            "READY",
            "UNRESOLVED_REPORTED",
            "COMPLETION_CONFIRMED",
          ]),
        );

        const notificationEvent: DomainEventEnvelope = {
          eventId: crypto.randomUUID(),
          eventType: "job.awaiting_confirmation",
          eventVersion: 1,
          aggregateType: "job",
          aggregateId: jobId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          occurredAt: new Date().toISOString(),
          payload: { action: "READY" },
        };
        const notificationsRepository = new NotificationsRepository(testDb);
        const deliveries = await Promise.all([
          notificationsRepository.consume(notificationEvent),
          notificationsRepository.consume(notificationEvent),
        ]);
        expect(deliveries).toEqual(
          expect.arrayContaining([
            { created: 1, duplicate: false },
            { created: 0, duplicate: true },
          ]),
        );
        const clientNotifications = await notificationsRepository.list({
          recipientAccountId: fixture.clientId,
          unreadOnly: false,
          page: 1,
          pageSize: 20,
        });
        expect(clientNotifications.items[0]).toMatchObject({
          sourceEventType: "job.awaiting_confirmation",
          actionTarget: `/client/bookings/${fixture.bookingId}#service-progress`,
        });
      });
    });
  }, 120_000);
});

async function seedJobFixture(db: Database, marker: string) {
  const [client, otherClient, owner, technician, otherMember] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `job-client-${marker}`,
        displayName: "Job Client",
        primaryEmail: `job-client-${marker}@example.com`,
      },
      {
        authUserId: `job-other-client-${marker}`,
        displayName: "Other Client",
        primaryEmail: `job-other-client-${marker}@example.com`,
      },
      {
        authUserId: `job-owner-${marker}`,
        displayName: "Dispatch Owner",
        primaryEmail: `job-owner-${marker}@example.com`,
      },
      {
        authUserId: `job-tech-${marker}`,
        displayName: "Field Technician",
        primaryEmail: `job-tech-${marker}@example.com`,
      },
      {
        authUserId: `job-other-member-${marker}`,
        displayName: "Other Organisation Member",
        primaryEmail: `job-other-member-${marker}@example.com`,
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Fulfilment Provider",
        slug: `fulfilment-provider-${marker}`,
        status: "active",
      },
      {
        name: "Other Fulfilment Provider",
        slug: `other-fulfilment-provider-${marker}`,
        status: "active",
      },
    ])
    .returning();
  const roleRows = await db
    .select({ id: roles.id, key: roles.key })
    .from(roles);
  const ownerRoleId = roleRows.find((role) => role.key === "owner")!.id;
  const technicianRoleId =
    roleRows.find((role) => role.key === "technician")?.id ?? ownerRoleId;
  const [ownerMembership, technicianMembership, otherMembership] = await db
    .insert(organisationMemberships)
    .values([
      {
        organisationId: organisation.id,
        accountProfileId: owner.id,
        roleId: ownerRoleId,
        status: "active",
      },
      {
        organisationId: organisation.id,
        accountProfileId: technician.id,
        roleId: technicianRoleId,
        status: "active",
        assignedJobsOnly: true,
      },
      {
        organisationId: otherOrganisation.id,
        accountProfileId: otherMember.id,
        roleId: ownerRoleId,
        status: "active",
      },
    ])
    .returning();
  const [service] = await db
    .insert(professionalServices)
    .values({
      organisationId: organisation.id,
      slug: `electrical-inspection-${marker}`,
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
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const [booking] = await db
    .insert(bookings)
    .values({
      professionalServiceId: service.id,
      organisationId: organisation.id,
      clientAccountId: client.id,
      createdByAccountId: owner.id,
      assignedMembershipId: ownerMembership.id,
      origin: "PROFESSIONAL_CUSTOMER",
      status: "CONFIRMED",
      currency: "KES",
      totalMinor: 25_000,
      depositMinor: 0,
      expectedDurationMinutes: 90,
      startsAt,
      endsAt,
      timezone: "Africa/Nairobi",
      cancellationAcknowledgedAt: new Date(),
      scope: "Inspect and certify the agreed circuits.",
      exclusions: "Repairs outside the accepted inspection are excluded.",
      warrantyTerms: "Inspection workmanship is covered for 30 days.",
      paymentTerms: "Payment is recorded after client confirmation.",
    })
    .returning();
  await db.insert(bookingReservations).values({
    bookingId: booking.id,
    organisationId: organisation.id,
    membershipId: ownerMembership.id,
    startsAt,
    endsAt,
  });
  return {
    clientId: client.id,
    otherClientId: otherClient.id,
    ownerId: owner.id,
    organisationId: organisation.id,
    otherOrganisationId: otherOrganisation.id,
    ownerMembershipId: ownerMembership.id,
    technicianMembershipId: technicianMembership.id,
    otherMembershipId: otherMembership.id,
    serviceId: service.id,
    bookingId: booking.id,
  };
}
