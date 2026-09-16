import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { BookingsRepository } from "../../modules/bookings/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { bookings, paymentRequirements } from "./schema/commercial";
import { customerRecords } from "./schema/customers";
import { jobs } from "./schema/fulfilment";
import { organisations } from "./schema/organisations";
import { notifications } from "./schema/notifications";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import { organisationMemberships, roles } from "./schema/roles";
import {
  bookingHistory,
  bookingReservations,
} from "./schema/scheduling";
import { serviceRequests } from "./schema/service-requests";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("booking persistence", () => {
  it("scopes participants, preserves lifecycle history, and releases cancelled reservations", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedSchedulingFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new BookingsRepository(testDb);
        const requestedStart = futureHalfHour(48);
        const requestedEnd = addMinutes(requestedStart, 60);

        await expect(
          repository.replaceAvailability({
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            membershipId: fixture.membershipId,
            timezone: "UTC",
            rules: allDayRules(),
          }),
        ).resolves.toBe(true);

        const bookingId = await repository.createClient({
          clientAccountId: fixture.clientId,
          actorAccountId: fixture.clientId,
          values: {
            origin: "DIRECT_SERVICE",
            professionalSlug: fixture.professionalSlug,
            serviceSlug: fixture.serviceSlug,
            membershipId: fixture.membershipId,
            requestedStartAt: requestedStart.toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
          correlationId: `booking-created-${fixture.marker}`,
        });
        expect(bookingId).toBeTypeOf("string");
        await expect(
          repository.getClient(fixture.otherClientId, bookingId!),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessional(fixture.otherOrganisationId, bookingId!),
        ).resolves.toBeNull();

        await expect(
          repository.schedule({
            bookingId: bookingId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            membershipId: fixture.membershipId,
            startsAt: requestedStart,
            endsAt: requestedEnd,
            reschedule: false,
            correlationId: `booking-confirmed-${fixture.marker}`,
          }),
        ).resolves.toEqual({ kind: "scheduled" });

        const rescheduledStart = addMinutes(requestedStart, 180);
        const rescheduledEnd = addMinutes(rescheduledStart, 60);
        await expect(
          repository.requestReschedule({
            bookingId: bookingId!,
            clientAccountId: fixture.clientId,
            expectedLockVersion: 2,
            membershipId: fixture.membershipId,
            startsAt: rescheduledStart,
            endsAt: rescheduledEnd,
            reason: "A later appointment is needed.",
            correlationId: `booking-reschedule-requested-${fixture.marker}`,
          }),
        ).resolves.toBe(true);
        await expect(
          repository.schedule({
            bookingId: bookingId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 3,
            membershipId: fixture.membershipId,
            startsAt: rescheduledStart,
            endsAt: rescheduledEnd,
            reschedule: true,
            correlationId: `booking-rescheduled-${fixture.marker}`,
          }),
        ).resolves.toEqual({ kind: "scheduled" });

        const beforeCancellation = await repository.getClient(
          fixture.clientId,
          bookingId!,
        );
        expect(beforeCancellation).toMatchObject({
          status: "RESCHEDULED",
          startsAt: rescheduledStart.toISOString(),
          assignmentName: "Scheduling Owner",
          lockVersion: 4,
        });
        expect(
          beforeCancellation?.history.map((entry) => entry.action),
        ).toEqual(
          expect.arrayContaining([
            "CREATED",
            "CONFIRMED",
            "RESCHEDULE_REQUESTED",
            "RESCHEDULED",
          ]),
        );

        await expect(
          repository.cancel({
            bookingId: bookingId!,
            clientAccountId: fixture.clientId,
            actorAccountId: fixture.clientId,
            expectedLockVersion: 4,
            reason: "The service is no longer required.",
            correlationId: `booking-cancelled-${fixture.marker}`,
          }),
        ).resolves.toBe(true);
        const [reservation] = await testDb
          .select()
          .from(bookingReservations)
          .where(eq(bookingReservations.bookingId, bookingId!));
        expect(reservation).toMatchObject({
          status: "RELEASED",
        });
        expect(reservation.releasedAt).toBeInstanceOf(Date);

        const events = await testDb
          .select({ eventType: outboxEvents.eventType })
          .from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, bookingId!));
        expect(events.map((event) => event.eventType)).toEqual(
          expect.arrayContaining([
            "booking.created",
            "booking.confirmed",
            "booking.reschedule_requested",
            "booking.rescheduled",
            "booking.cancelled",
          ]),
        );
      });
    });
  });

  it("gates confirmation on a pending deposit requirement", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedSchedulingFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new BookingsRepository(testDb);
        const startsAt = futureHalfHour(72);
        const endsAt = addMinutes(startsAt, 60);
        await repository.replaceAvailability({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          membershipId: fixture.membershipId,
          timezone: "UTC",
          rules: allDayRules(),
        });
        const bookingId = await repository.createClient({
          clientAccountId: fixture.clientId,
          actorAccountId: fixture.clientId,
          values: {
            origin: "DIRECT_SERVICE",
            professionalSlug: fixture.professionalSlug,
            serviceSlug: fixture.serviceSlug,
            membershipId: fixture.membershipId,
            requestedStartAt: startsAt.toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });
        await testDb
          .update(bookings)
          .set({ status: "PENDING_DEPOSIT", depositMinor: 2_000 })
          .where(eq(bookings.id, bookingId!));
        await testDb.insert(paymentRequirements).values({
          bookingId: bookingId!,
          requirementType: "DEPOSIT",
          status: "PENDING",
          amountMinor: 2_000,
          currency: "KES",
        });

        await expect(
          repository.schedule({
            bookingId: bookingId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            membershipId: fixture.membershipId,
            startsAt,
            endsAt,
            reschedule: false,
          }),
        ).resolves.toEqual({ kind: "deposit_required" });
        const [persisted] = await testDb
          .select({ status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, bookingId!));
        expect(persisted.status).toBe("PENDING_DEPOSIT");
      });
    });
  });

  it("records no-show only while the linked job is still pre-start", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedSchedulingFixture(testDb, crypto.randomUUID());
        const repository = new BookingsRepository(testDb);
        await repository.replaceAvailability({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          membershipId: fixture.membershipId,
          timezone: "UTC",
          rules: allDayRules(),
        });
        const startsAt = futureUtcTime(5, 8);
        const bookingId = await repository.createClient({
          clientAccountId: fixture.clientId,
          actorAccountId: fixture.clientId,
          values: {
            origin: "DIRECT_SERVICE",
            professionalSlug: fixture.professionalSlug,
            serviceSlug: fixture.serviceSlug,
            membershipId: fixture.membershipId,
            requestedStartAt: startsAt.toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });
        await repository.schedule({
          bookingId: bookingId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 1,
          membershipId: fixture.membershipId,
          startsAt,
          endsAt: addMinutes(startsAt, 60),
          reschedule: false,
        });

        await expect(
          repository.terminalTransition({
            bookingId: bookingId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 1,
            action: "NO_SHOW",
            now: addMinutes(startsAt, 61),
          }),
        ).resolves.toBe(false);
        const [beforeNoShowBooking, beforeNoShowJob] = await Promise.all([
          testDb
            .select({ status: bookings.status })
            .from(bookings)
            .where(eq(bookings.id, bookingId!))
            .then((rows) => rows[0]),
          testDb
            .select({ status: jobs.status })
            .from(jobs)
            .where(eq(jobs.bookingId, bookingId!))
            .then((rows) => rows[0]),
        ]);
        expect(beforeNoShowBooking.status).toBe("CONFIRMED");
        expect(beforeNoShowJob.status).not.toBe("CANCELLED");

        await expect(
          repository.terminalTransition({
            bookingId: bookingId!,
            organisationId: fixture.organisationId,
            actorAccountId: fixture.ownerId,
            expectedLockVersion: 2,
            action: "NO_SHOW",
            note: "Client did not attend.",
            now: addMinutes(startsAt, 61),
          }),
        ).resolves.toBe(true);

        const [booking, job, reservation] = await Promise.all([
          testDb.select().from(bookings).where(eq(bookings.id, bookingId!)).then((rows) => rows[0]),
          testDb.select().from(jobs).where(eq(jobs.bookingId, bookingId!)).then((rows) => rows[0]),
          testDb.select().from(bookingReservations).where(eq(bookingReservations.bookingId, bookingId!)).then((rows) => rows[0]),
        ]);
        expect(booking.status).toBe("NO_SHOW");
        expect(job.status).toBe("CANCELLED");
        expect(reservation.status).toBe("RELEASED");
      });
    });
  });

  it("creates repeat, approved-assessment, and professional-customer origins from eligible records", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedSchedulingFixture(
          testDb,
          crypto.randomUUID(),
        );
        const repository = new BookingsRepository(testDb);
        await repository.replaceAvailability({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          membershipId: fixture.membershipId,
          timezone: "UTC",
          rules: allDayRules(),
        });
        const initialStart = futureUtcTime(5, 6);
        const sourceBookingId = await repository.createClient({
          clientAccountId: fixture.clientId,
          actorAccountId: fixture.clientId,
          values: {
            origin: "DIRECT_SERVICE",
            professionalSlug: fixture.professionalSlug,
            serviceSlug: fixture.serviceSlug,
            membershipId: fixture.membershipId,
            requestedStartAt: initialStart.toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });
        await repository.schedule({
          bookingId: sourceBookingId!,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          expectedLockVersion: 1,
          membershipId: fixture.membershipId,
          startsAt: initialStart,
          endsAt: addMinutes(initialStart, 60),
          reschedule: false,
        });
        const completedAt = addMinutes(initialStart, 61);
        await testDb
          .update(jobs)
          .set({ status: "COMPLETED", completedAt })
          .where(eq(jobs.bookingId, sourceBookingId!));
        await testDb
          .update(bookings)
          .set({ status: "COMPLETED", completedAt })
          .where(eq(bookings.id, sourceBookingId!));
        await testDb
          .update(professionalServices)
          .set({ priceMinor: 275000, estimatedDurationMinutes: 90 })
          .where(eq(professionalServices.id, fixture.serviceId));

        const repeatId = await repository.createClient({
          clientAccountId: fixture.clientId,
          actorAccountId: fixture.clientId,
          values: {
            origin: "REPEAT_BOOKING",
            sourceBookingId: sourceBookingId!,
            membershipId: fixture.membershipId,
            requestedStartAt: addMinutes(initialStart, 240).toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });
        const professionalCustomerId = await repository.createProfessional({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          values: {
            origin: "PROFESSIONAL_CUSTOMER",
            clientAccountId: fixture.otherClientId,
            serviceId: fixture.serviceId,
            membershipId: fixture.membershipId,
            requestedStartAt: addMinutes(initialStart, 480).toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });
        const [assessmentRequest] = await testDb
          .insert(serviceRequests)
          .values({
            clientAccountId: fixture.clientId,
            organisationId: fixture.organisationId,
            idempotencyKey: crypto.randomUUID(),
            source: "PROFESSIONAL_BOOKING_LINK",
            category: "Assessment follow-up",
            status: "ASSESSMENT_REQUIRED",
            currency: "KES",
          })
          .returning();
        const assessmentId = await repository.createProfessional({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          values: {
            origin: "APPROVED_ASSESSMENT",
            requestId: assessmentRequest.id,
            serviceId: fixture.serviceId,
            membershipId: fixture.membershipId,
            requestedStartAt: addMinutes(initialStart, 720).toISOString(),
            timezone: "UTC",
            cancellationPolicyAcknowledged: true,
          },
        });

        const created = await testDb
          .select({
            id: bookings.id,
            origin: bookings.origin,
            sourceBookingId: bookings.sourceBookingId,
            requestId: bookings.requestId,
            totalMinor: bookings.totalMinor,
            expectedDurationMinutes: bookings.expectedDurationMinutes,
          })
          .from(bookings)
          .where(
            sql`${bookings.id} in (${repeatId}, ${professionalCustomerId}, ${assessmentId})`,
          );
        expect(created).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: repeatId,
              origin: "REPEAT_BOOKING",
              sourceBookingId,
              totalMinor: 275000,
              expectedDurationMinutes: 90,
            }),
            expect.objectContaining({
              id: professionalCustomerId,
              origin: "PROFESSIONAL_CUSTOMER",
            }),
            expect.objectContaining({
              id: assessmentId,
              origin: "APPROVED_ASSESSMENT",
              requestId: assessmentRequest.id,
            }),
          ]),
        );
        const [convertedRequest] = await testDb
          .select({ status: serviceRequests.status })
          .from(serviceRequests)
          .where(eq(serviceRequests.id, assessmentRequest.id));
        expect(convertedRequest.status).toBe("CONVERTED");
      });
    });
  });

  it("allows only one concurrent confirmation for the same team member and time", async () => {
    await withTestDatabase(async ({ db }) => {
      const fixture = await seedSchedulingFixture(db, crypto.randomUUID());
      const repository = new BookingsRepository(db);
      const startsAt = futureHalfHour(96);
      const endsAt = addMinutes(startsAt, 60);
      const bookingIds: string[] = [];
      try {
        await repository.replaceAvailability({
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          membershipId: fixture.membershipId,
          timezone: "UTC",
          rules: allDayRules(),
        });
        for (const clientAccountId of [
          fixture.clientId,
          fixture.otherClientId,
        ]) {
          const bookingId = await repository.createClient({
            clientAccountId,
            actorAccountId: clientAccountId,
            values: {
              origin: "DIRECT_SERVICE",
              professionalSlug: fixture.professionalSlug,
              serviceSlug: fixture.serviceSlug,
              membershipId: fixture.membershipId,
              requestedStartAt: startsAt.toISOString(),
              timezone: "UTC",
              cancellationPolicyAcknowledged: true,
            },
          });
          bookingIds.push(bookingId!);
        }

        const attempts = await Promise.allSettled(
          bookingIds.map((bookingId) =>
            repository.schedule({
              bookingId,
              organisationId: fixture.organisationId,
              actorAccountId: fixture.ownerId,
              expectedLockVersion: 1,
              membershipId: fixture.membershipId,
              startsAt,
              endsAt,
              reschedule: false,
            }),
          ),
        );
        const scheduled = attempts.filter(
          (result) =>
            result.status === "fulfilled" &&
            result.value.kind === "scheduled",
        );
        expect(scheduled).toHaveLength(1);

        const activeReservations = await db
          .select()
          .from(bookingReservations)
          .where(eq(bookingReservations.organisationId, fixture.organisationId));
        expect(activeReservations).toHaveLength(1);
      } finally {
        await cleanupSchedulingFixture(db, fixture, bookingIds);
      }
    });
  });
});

async function seedSchedulingFixture(db: Database, marker: string) {
  const [client, otherClient, owner] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `booking-client-${marker}`,
        displayName: "Booking Client",
        primaryEmail: `booking-client-${marker}@example.com`,
      },
      {
        authUserId: `booking-other-client-${marker}`,
        displayName: "Other Booking Client",
        primaryEmail: `booking-other-client-${marker}@example.com`,
      },
      {
        authUserId: `booking-owner-${marker}`,
        displayName: "Scheduling Owner",
        primaryEmail: `booking-owner-${marker}@example.com`,
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Scheduling Provider",
        slug: `scheduling-provider-${marker}`,
        status: "active",
      },
      {
        name: "Other Scheduling Provider",
        slug: `other-scheduling-provider-${marker}`,
        status: "active",
      },
    ])
    .returning();
  const [ownerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, "owner"))
    .limit(1);
  const [membership] = await db
    .insert(organisationMemberships)
    .values({
      organisationId: organisation.id,
      accountProfileId: owner.id,
      roleId: ownerRole.id,
      status: "active",
    })
    .returning();
  const [service] = await db
    .insert(professionalServices)
    .values({
      organisationId: organisation.id,
      slug: `scheduled-service-${marker}`,
      name: "Scheduled Service",
      description: "A duration-aware service used to verify booking behavior.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 10_000,
      currency: "KES",
      estimatedDurationMinutes: 60,
      directBookingEnabled: true,
      status: "published",
      moderationStatus: "clear",
      publishedAt: new Date(),
    })
    .returning();
  return {
    marker,
    clientId: client.id,
    otherClientId: otherClient.id,
    ownerId: owner.id,
    organisationId: organisation.id,
    otherOrganisationId: otherOrganisation.id,
    membershipId: membership.id,
    serviceId: service.id,
    professionalSlug: `scheduling-provider-${marker}`,
    serviceSlug: `scheduled-service-${marker}`,
  };
}

async function cleanupSchedulingFixture(
  db: Database,
  fixture: Awaited<ReturnType<typeof seedSchedulingFixture>>,
  bookingIds: string[],
) {
  if (bookingIds.length > 0) {
    const bookingIdList = sql.join(
      bookingIds.map((id) => sql`${id}`),
      sql`, `,
    );
    await db.execute(
      sql`delete from outbox_events
          where aggregate_type = 'job'
            and aggregate_id in (
              select id::text from jobs where booking_id in (${bookingIdList})
            )`,
    );
    await db.execute(
      sql`delete from engagement_activities
          where conversation_id in (
            select ec.id from engagement_conversations ec
            join jobs j on j.id::text = ec.context_id
            where ec.context_type = 'JOB'
              and j.booking_id in (${bookingIdList})
          )`,
    );
    await db.execute(
      sql`delete from engagement_conversation_reads
          where conversation_id in (
            select ec.id from engagement_conversations ec
            join jobs j on j.id::text = ec.context_id
            where ec.context_type = 'JOB'
              and j.booking_id in (${bookingIdList})
          )`,
    );
    await db.execute(
      sql`delete from engagement_message_attachments
          where message_id in (
            select em.id from engagement_messages em
            join engagement_conversations ec on ec.id = em.conversation_id
            join jobs j on j.id::text = ec.context_id
            where ec.context_type = 'JOB'
              and j.booking_id in (${bookingIdList})
          )`,
    );
    await db.execute(
      sql`delete from engagement_messages
          where conversation_id in (
            select ec.id from engagement_conversations ec
            join jobs j on j.id::text = ec.context_id
            where ec.context_type = 'JOB'
              and j.booking_id in (${bookingIdList})
          )`,
    );
    await db.execute(
      sql`delete from engagement_conversations
          where context_type = 'JOB'
            and context_id in (
              select id::text from jobs where booking_id in (${bookingIdList})
            )`,
    );
    await db.execute(
      sql`delete from job_completion_responses
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_commercial_history
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_variations
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_evidence
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_updates
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_checklist_items
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_assignments
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from job_history
          where job_id in (select id from jobs where booking_id in (${bookingIdList}))`,
    );
    await db.execute(
      sql`delete from jobs where booking_id in (${bookingIdList})`,
    );
    await db.execute(
      sql`delete from outbox_events where aggregate_id in (${sql.join(
        bookingIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    await db.execute(
      sql`delete from engagement_activities
          where conversation_id in (
            select id from engagement_conversations
            where context_type = 'BOOKING'
              and context_id in (${sql.join(
                bookingIds.map((id) => sql`${id}`),
                sql`, `,
              )})
          )`,
    );
    await db.execute(
      sql`delete from engagement_conversations
          where context_type = 'BOOKING'
            and context_id in (${sql.join(
              bookingIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
    );
    await db
      .delete(bookingHistory)
      .where(sql`${bookingHistory.bookingId} in (${sql.join(
        bookingIds.map((id) => sql`${id}`),
        sql`, `,
      )})`);
    await db
      .delete(bookingReservations)
      .where(sql`${bookingReservations.bookingId} in (${sql.join(
        bookingIds.map((id) => sql`${id}`),
        sql`, `,
      )})`);
    await db
      .delete(bookings)
      .where(sql`${bookings.id} in (${sql.join(
        bookingIds.map((id) => sql`${id}`),
        sql`, `,
      )})`);
  }
  await db.execute(
    sql`delete from availability_rules where organisation_id = ${fixture.organisationId}`,
  );
  await db
    .delete(customerRecords)
    .where(eq(customerRecords.organisationId, fixture.organisationId));
  await db
    .delete(professionalServices)
    .where(eq(professionalServices.id, fixture.serviceId));
  await db
    .delete(organisationMemberships)
    .where(eq(organisationMemberships.id, fixture.membershipId));
  await db.execute(
    sql`delete from ${notifications}
        where ${notifications.recipientAccountId} in (
          ${fixture.clientId},
          ${fixture.otherClientId},
          ${fixture.ownerId}
        )`,
  );
  await db.execute(
    sql`delete from organisations
        where id in (${fixture.organisationId}, ${fixture.otherOrganisationId})`,
  );
  await db.execute(
    sql`delete from account_profiles
        where id in (${fixture.clientId}, ${fixture.otherClientId}, ${fixture.ownerId})`,
  );
}

function allDayRules() {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    startMinute: 0,
    endMinute: 1440,
  }));
}

function futureHalfHour(hoursAhead: number) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1_000);
  date.setUTCMinutes(date.getUTCMinutes() < 30 ? 30 : 0, 0, 0);
  if (date.getUTCMinutes() === 0) {
    date.setUTCHours(date.getUTCHours() + 1);
  }
  return date;
}

function futureUtcTime(daysAhead: number, hour: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
