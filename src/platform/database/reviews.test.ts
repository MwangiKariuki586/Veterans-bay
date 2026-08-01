import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ReviewsRepository } from "../../modules/reviews/repository";
import { AdministrationRepository } from "../../modules/administration/repository";
import { NotificationsRepository } from "../../modules/notifications/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { moderationReports } from "./schema/administration";
import { bookings } from "./schema/commercial";
import { processedEvents } from "./schema/consumer-events";
import { jobs } from "./schema/fulfilment";
import { organisations } from "./schema/organisations";
import { notifications } from "./schema/notifications";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import { organisationMemberships, roles } from "./schema/roles";
import {
  professionalReputation,
  reviewReports,
  reviewResponses,
  reviews,
} from "./schema/reviews";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("review and reputation persistence", () => {
  it("enforces completed-job eligibility, one review, one response, and reporting", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedReviewFixture(testDb);
        const repository = new ReviewsRepository(testDb);

        await expect(
          repository.eligibility(fixture.jobId, fixture.clientId),
        ).resolves.toMatchObject({ eligible: true, review: null });
        const reviewId = await repository.submit({
          jobId: fixture.jobId,
          clientAccountId: fixture.clientId,
          overallRating: 4,
          serviceQualityRating: 5,
          communicationRating: 4,
          timelinessRating: 3,
          professionalismRating: 5,
          valueRating: 4,
          feedback: "Clear communication and a solid repair.",
        });
        expect(reviewId).toBeTruthy();
        const [submittedEvent] = await testDb
          .select()
          .from(outboxEvents)
          .where(eq(outboxEvents.eventType, "review.submitted"));
        const notificationEvent = {
          eventId: submittedEvent.id,
          eventType: submittedEvent.eventType,
          eventVersion: submittedEvent.eventVersion,
          aggregateType: submittedEvent.aggregateType,
          aggregateId: submittedEvent.aggregateId,
          organisationId: submittedEvent.organisationId,
          actorAccountId: submittedEvent.actorAccountId,
          correlationId: submittedEvent.correlationId,
          occurredAt: submittedEvent.createdAt.toISOString(),
          payload: submittedEvent.payload,
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
              .where(eq(notifications.sourceEventId, submittedEvent.id))
          )[0],
        ).toMatchObject({
          recipientAccountId: fixture.ownerId,
          actionTarget: "/professional/reviews",
        });
        await expect(
          repository.submit({
            jobId: fixture.jobId,
            clientAccountId: fixture.clientId,
            overallRating: 5,
            serviceQualityRating: 5,
            communicationRating: 5,
            timelinessRating: 5,
            professionalismRating: 5,
            valueRating: 5,
            feedback: "Duplicate review attempt.",
          }),
        ).resolves.toBeNull();
        await expect(
          repository.respond(
            reviewId!,
            fixture.organisationId,
            fixture.ownerId,
            "Thank you for trusting our team.",
          ),
        ).resolves.toBe(true);
        await expect(
          repository.respond(
            reviewId!,
            fixture.organisationId,
            fixture.ownerId,
            "A second response.",
          ),
        ).resolves.toBe(false);
        await expect(
          repository.report(
            reviewId!,
            fixture.clientId,
            "OTHER",
            "Please review the personal detail.",
          ),
        ).resolves.toBe(true);
        await expect(
          repository.reportProfessional(
            reviewId!,
            fixture.organisationId,
            fixture.ownerId,
            "OTHER",
            "Professional requested moderation review.",
          ),
        ).resolves.toBe(true);
        await expect(
          repository.reportProfessional(
            reviewId!,
            fixture.organisationId,
            fixture.ownerId,
            "OTHER",
            "Duplicate professional report.",
          ),
        ).resolves.toBe(false);
        expect(
          await testDb
            .select()
            .from(reviewResponses)
            .where(eq(reviewResponses.reviewId, reviewId!)),
        ).toHaveLength(1);
        expect(
          await testDb
            .select()
            .from(reviewReports)
            .where(eq(reviewReports.reviewId, reviewId!)),
        ).toHaveLength(2);
        expect(
          await testDb
            .select()
            .from(moderationReports)
            .where(eq(moderationReports.subjectId, reviewId!)),
        ).toHaveLength(2);
        expect(
          (
            await testDb
              .select()
              .from(outboxEvents)
              .where(eq(outboxEvents.aggregateType, "moderation_report"))
          ).filter((item) => item.eventType === "report.submitted"),
        ).toHaveLength(2);
        expect(
          (
            await testDb
              .select()
              .from(reviews)
              .where(eq(reviews.id, reviewId!))
          )[0],
        ).toMatchObject({ status: "REPORTED" });
        await expect(
          repository.listPublic(fixture.organisationId),
        ).resolves.toHaveLength(0);

        const [reportedReview] = await testDb
          .select()
          .from(moderationReports)
          .where(eq(moderationReports.subjectId, reviewId!))
          .limit(1);
        const administration = new AdministrationRepository(testDb);
        const moderationCase = await administration.openCase({
          reportId: reportedReview!.id,
          actorAccountId: fixture.ownerId,
          priority: "NORMAL",
          reason: "The reported review requires an administrator decision.",
        });
        await administration.transitionCase({
          caseId: moderationCase.id,
          actorAccountId: fixture.ownerId,
          action: "DISMISS",
          reason: "The review report is unsupported by the verified record.",
          evidenceSummary:
            "The completed job and verified review record were checked.",
        });
        expect(
          (
            await testDb
              .select()
              .from(reviews)
              .where(eq(reviews.id, reviewId!))
          )[0],
        ).toMatchObject({ status: "PUBLISHED", reportedAt: null });
        expect(
          await testDb
            .select()
            .from(reviewReports)
            .where(eq(reviewReports.reviewId, reviewId!)),
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ status: "DISMISSED" }),
            expect.objectContaining({ status: "DISMISSED" }),
          ]),
        );
        expect(
          await testDb
            .select()
            .from(moderationReports)
            .where(eq(moderationReports.subjectId, reviewId!)),
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ status: "DISMISSED" }),
            expect.objectContaining({ status: "DISMISSED" }),
          ]),
        );
        await expect(
          repository.listPublic(fixture.organisationId),
        ).resolves.toHaveLength(1);
      });
    });
  });

  it("rebuilds derived reputation once for duplicate queue delivery", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seedReviewFixture(testDb);
        const repository = new ReviewsRepository(testDb);
        await repository.submit({
          jobId: fixture.jobId,
          clientAccountId: fixture.clientId,
          overallRating: 4,
          serviceQualityRating: 4,
          communicationRating: 4,
          timelinessRating: 4,
          professionalismRating: 4,
          valueRating: 4,
          feedback: "Verified completed-job feedback.",
        });
        const event = {
          eventId: crypto.randomUUID(),
          eventType: "reputation.recalculation_requested",
          eventVersion: 1,
          aggregateType: "professional_reputation",
          aggregateId: fixture.organisationId,
          organisationId: fixture.organisationId,
          actorAccountId: fixture.ownerId,
          correlationId: "reputation-test",
          occurredAt: new Date().toISOString(),
          payload: { organisationId: fixture.organisationId },
        };
        await expect(repository.consumeRecalculation(event)).resolves.toEqual({
          duplicate: false,
        });
        await expect(repository.consumeRecalculation(event)).resolves.toEqual({
          duplicate: true,
        });
        expect(
          (
            await testDb
              .select()
              .from(professionalReputation)
              .where(
                eq(
                  professionalReputation.organisationId,
                  fixture.organisationId,
                ),
              )
          )[0],
        ).toMatchObject({
          verifiedJobs: 1,
          reviewCount: 1,
          averageRatingHundredths: 400,
          completionRateBasisPoints: 10000,
        });
        expect(
          await testDb
            .select()
            .from(processedEvents)
            .where(eq(processedEvents.eventId, event.eventId)),
        ).toHaveLength(1);
      });
    });
  });
});

async function seedReviewFixture(db: Database) {
  const marker = crypto.randomUUID();
  const [client, owner] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `review-client-${marker}`,
        displayName: "Verified Client",
        primaryEmail: `review-client-${marker}@example.test`,
      },
      {
        authUserId: `review-owner-${marker}`,
        displayName: "Professional Owner",
        primaryEmail: `review-owner-${marker}@example.test`,
      },
    ])
    .returning();
  const [organisation] = await db
    .insert(organisations)
    .values({
      name: "Review Test Professional",
      slug: `review-professional-${marker}`,
      status: "active",
    })
    .returning();
  const [ownerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, "owner"))
    .limit(1);
  await db.insert(organisationMemberships).values({
    organisationId: organisation.id,
    accountProfileId: owner.id,
    roleId: ownerRole.id,
    status: "active",
  });
  const [service] = await db
    .insert(professionalServices)
    .values({
      organisationId: organisation.id,
      slug: `review-service-${marker}`,
      name: "Verified repair",
      category: "Repairs",
      description: "A complete repair service.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 500000,
      estimatedDurationMinutes: 60,
      directBookingEnabled: true,
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const [booking] = await db
    .insert(bookings)
    .values({
      professionalServiceId: service.id,
      organisationId: organisation.id,
      clientAccountId: client.id,
      createdByAccountId: client.id,
      origin: "DIRECT_SERVICE",
      status: "PENDING_CONFIRMATION",
      currency: "KES",
      totalMinor: 500000,
      depositMinor: 0,
      expectedDurationMinutes: 60,
      scope: "Repair the fixture.",
      exclusions: "Wall finishing.",
      warrantyTerms: "Thirty days.",
      paymentTerms: "Due on completion.",
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
      scopeSnapshot: "Repair the fixture.",
      exclusionsSnapshot: "Wall finishing.",
      warrantyTermsSnapshot: "Thirty days.",
      paymentTermsSnapshot: "Due on completion.",
      currency: "KES",
      baseTotalMinor: 500000,
      totalMinor: 500000,
      completedAt: new Date(),
    })
    .returning();
  return {
    clientId: client.id,
    ownerId: owner.id,
    organisationId: organisation.id,
    jobId: job.id,
  };
}
