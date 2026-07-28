import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import type { DomainEventEnvelope } from "../../platform/events/contracts";
import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { bookings } from "../../platform/database/schema/commercial";
import { processedEvents } from "../../platform/database/schema/consumer-events";
import { jobs } from "../../platform/database/schema/fulfilment";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  professionalReputation,
  reviewReports,
  reviewResponses,
  reviews,
} from "../../platform/database/schema/reviews";
import {
  warranties,
  warrantyClaims,
} from "../../platform/database/schema/warranties";
import type {
  PublicReview,
  ReputationProjection,
  ReviewEligibility,
  ReviewItem,
} from "./types";

const REVIEW_WINDOW_DAYS = 30;
export const REPUTATION_CONSUMER = "professional-reputation-consumer";

export class ReviewsRepository {
  constructor(private readonly db: Database) {}

  async eligibility(
    jobId: string,
    clientAccountId: string,
  ): Promise<ReviewEligibility> {
    const [row] = await this.db
      .select({
        job: getTableColumns(jobs),
        providerName: organisations.name,
        clientName: accountProfiles.displayName,
      })
      .from(jobs)
      .innerJoin(organisations, eq(organisations.id, jobs.organisationId))
      .innerJoin(accountProfiles, eq(accountProfiles.id, jobs.clientAccountId))
      .where(and(eq(jobs.id, jobId), eq(jobs.clientAccountId, clientAccountId)))
      .limit(1);
    if (!row)
      return {
        eligible: false,
        deadline: null,
        reason: "Job not found.",
        review: null,
      };
    const existing = await this.findByJob(jobId);
    const deadline = row.job.completedAt
      ? new Date(
          row.job.completedAt.getTime() + REVIEW_WINDOW_DAYS * 86_400_000,
        )
      : null;
    const eligible =
      row.job.status === "COMPLETED" &&
      !!deadline &&
      deadline >= new Date() &&
      !existing;
    return {
      eligible,
      deadline: deadline?.toISOString() ?? null,
      reason: existing
        ? "A review has already been submitted."
        : row.job.status !== "COMPLETED"
          ? "The job is not complete."
          : !deadline || deadline < new Date()
            ? "The review period has ended."
            : null,
      review: existing
        ? toReview(existing, row.providerName, row.clientName)
        : null,
    };
  }

  async submit(input: {
    jobId: string;
    clientAccountId: string;
    correlationId?: string;
    overallRating: number;
    serviceQualityRating: number;
    communicationRating: number;
    timelinessRating: number;
    professionalismRating: number;
    valueRating: number;
    feedback: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.clientAccountId, input.clientAccountId),
            eq(jobs.status, "COMPLETED"),
            sql`${jobs.completedAt} >= now() - interval '${sql.raw(String(REVIEW_WINDOW_DAYS))} days'`,
          ),
        )
        .for("update")
        .limit(1);
      if (!job) return null;
      const [review] = await tx
        .insert(reviews)
        .values({
          jobId: job.id,
          organisationId: job.organisationId,
          clientAccountId: input.clientAccountId,
          overallRating: input.overallRating,
          serviceQualityRating: input.serviceQualityRating,
          communicationRating: input.communicationRating,
          timelinessRating: input.timelinessRating,
          professionalismRating: input.professionalismRating,
          valueRating: input.valueRating,
          feedback: input.feedback,
        })
        .onConflictDoNothing({ target: reviews.jobId })
        .returning({ id: reviews.id });
      if (!review) return null;
      await tx
        .insert(outboxEvents)
        .values([
          event(
            job,
            review.id,
            input.clientAccountId,
            "review.submitted",
            input.correlationId,
          ),
          event(
            job,
            review.id,
            input.clientAccountId,
            "reputation.recalculation_requested",
            input.correlationId,
          ),
        ]);
      return review.id;
    });
  }

  async listProfessional(organisationId: string): Promise<ReviewItem[]> {
    const rows = await this.db
      .select({
        review: getTableColumns(reviews),
        serviceName: jobs.serviceName,
        providerName: organisations.name,
        clientName: accountProfiles.displayName,
        responseBody: reviewResponses.body,
        responseCreatedAt: reviewResponses.createdAt,
      })
      .from(reviews)
      .innerJoin(jobs, eq(jobs.id, reviews.jobId))
      .innerJoin(organisations, eq(organisations.id, reviews.organisationId))
      .innerJoin(
        accountProfiles,
        eq(accountProfiles.id, reviews.clientAccountId),
      )
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(eq(reviews.organisationId, organisationId))
      .orderBy(desc(reviews.submittedAt), desc(reviews.id));
    return rows.map((r) =>
      toReview(
        {
          ...r.review,
          responseBody: r.responseBody,
          responseCreatedAt: r.responseCreatedAt,
        },
        r.providerName,
        r.clientName,
        r.serviceName,
      ),
    );
  }

  async respond(
    reviewId: string,
    organisationId: string,
    authorAccountId: string,
    body: string,
    correlationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.id, reviewId),
            eq(reviews.organisationId, organisationId),
          ),
        )
        .limit(1);
      if (!review) return false;
      const [created] = await tx
        .insert(reviewResponses)
        .values({ reviewId, organisationId, authorAccountId, body })
        .onConflictDoNothing({ target: reviewResponses.reviewId })
        .returning({ id: reviewResponses.id });
      if (!created) return false;
      const job = {
        id: review.jobId,
        organisationId,
        clientAccountId: review.clientAccountId,
      };
      await tx
        .insert(outboxEvents)
        .values([
          event(
            job,
            reviewId,
            authorAccountId,
            "review.responded",
            correlationId,
          ),
          event(
            job,
            reviewId,
            authorAccountId,
            "reputation.recalculation_requested",
            correlationId,
          ),
        ]);
      return true;
    });
  }

  async report(
    reviewId: string,
    clientAccountId: string,
    reason: string,
    details?: string,
    correlationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.id, reviewId),
            eq(reviews.clientAccountId, clientAccountId),
          ),
        )
        .limit(1);
      if (!review) return false;
      const [created] = await tx
        .insert(reviewReports)
        .values({
          reviewId,
          reportedByAccountId: clientAccountId,
          reason,
          details,
        })
        .onConflictDoNothing({
          target: [reviewReports.reviewId, reviewReports.reportedByAccountId],
        })
        .returning({ id: reviewReports.id });
      if (!created) return false;
      await tx
        .update(reviews)
        .set({ status: "REPORTED", reportedAt: new Date() })
        .where(eq(reviews.id, reviewId));
      await tx
        .insert(outboxEvents)
        .values([
          event(
            {
              id: review.jobId,
              organisationId: review.organisationId,
              clientAccountId,
            },
            reviewId,
            clientAccountId,
            "review.reported",
            correlationId,
          ),
          event(
            {
              id: review.jobId,
              organisationId: review.organisationId,
              clientAccountId,
            },
            reviewId,
            clientAccountId,
            "reputation.recalculation_requested",
            correlationId,
          ),
        ]);
      return true;
    });
  }

  async reportProfessional(
    reviewId: string,
    organisationId: string,
    reportingAccountId: string,
    reason: string,
    details?: string,
    correlationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.id, reviewId),
            eq(reviews.organisationId, organisationId),
          ),
        )
        .limit(1);
      if (!review) return false;
      const [created] = await tx
        .insert(reviewReports)
        .values({
          reviewId,
          reportedByAccountId: reportingAccountId,
          reason,
          details,
        })
        .onConflictDoNothing({
          target: [reviewReports.reviewId, reviewReports.reportedByAccountId],
        })
        .returning({ id: reviewReports.id });
      if (!created) return false;
      await tx
        .update(reviews)
        .set({ status: "REPORTED", reportedAt: new Date() })
        .where(eq(reviews.id, reviewId));
      await tx.insert(outboxEvents).values([
        event(
          {
            id: review.jobId,
            organisationId: review.organisationId,
            clientAccountId: review.clientAccountId,
          },
          reviewId,
          reportingAccountId,
          "review.reported",
          correlationId,
        ),
        event(
          {
            id: review.jobId,
            organisationId: review.organisationId,
            clientAccountId: review.clientAccountId,
          },
          reviewId,
          reportingAccountId,
          "reputation.recalculation_requested",
          correlationId,
        ),
      ]);
      return true;
    });
  }

  async listPublic(organisationId: string): Promise<PublicReview[]> {
    const rows = await this.db
      .select({
        id: reviews.id,
        clientName: accountProfiles.displayName,
        overallRating: reviews.overallRating,
        feedback: reviews.feedback,
        submittedAt: reviews.submittedAt,
        responseBody: reviewResponses.body,
        responseCreatedAt: reviewResponses.createdAt,
      })
      .from(reviews)
      .innerJoin(
        accountProfiles,
        eq(accountProfiles.id, reviews.clientAccountId),
      )
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.organisationId, organisationId),
          eq(reviews.status, "PUBLISHED"),
        ),
      )
      .orderBy(desc(reviews.submittedAt))
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      clientName: r.clientName,
      overallRating: r.overallRating,
      feedback: r.feedback,
      submittedAt: r.submittedAt.toISOString(),
      response:
        r.responseBody && r.responseCreatedAt
          ? {
              body: r.responseBody,
              createdAt: r.responseCreatedAt.toISOString(),
            }
          : null,
    }));
  }

  async getReputation(
    organisationId: string,
  ): Promise<ReputationProjection | null> {
    const [r] = await this.db
      .select()
      .from(professionalReputation)
      .where(eq(professionalReputation.organisationId, organisationId))
      .limit(1);
    return r
      ? {
          verifiedJobs: r.verifiedJobs,
          reviewCount: r.reviewCount,
          averageRating:
            r.averageRatingHundredths == null
              ? null
              : r.averageRatingHundredths / 100,
          responseRate: r.responseRateBasisPoints / 100,
          completionRate: r.completionRateBasisPoints / 100,
          repeatRate: r.repeatRateBasisPoints / 100,
          cancellationRate: r.cancellationRateBasisPoints / 100,
          warrantyResolutionRate: r.warrantyResolutionRateBasisPoints / 100,
          disputeRate: r.disputeRateBasisPoints / 100,
          recalculatedAt: r.recalculatedAt.toISOString(),
        }
      : null;
  }

  async consumeRecalculation(eventEnvelope: DomainEventEnvelope) {
    const organisationId = String(
      eventEnvelope.payload.organisationId ??
        eventEnvelope.organisationId ??
        "",
    );
    if (!organisationId) throw new Error("Missing organisationId");
    return this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .insert(processedEvents)
        .values({
          eventId: eventEnvelope.eventId,
          consumerName: REPUTATION_CONSUMER,
          eventType: eventEnvelope.eventType,
          eventVersion: eventEnvelope.eventVersion,
        })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });
      if (!claimed) return { duplicate: true };
      const countsResult = await tx.execute(sql`
        select
          count(*) filter (where j.status = 'COMPLETED')::int as verified_jobs,
          count(*) filter (where j.status in ('COMPLETED','CANCELLED','DISPUTED'))::int as terminal_jobs,
          count(*) filter (where j.status = 'DISPUTED')::int as disputed_jobs,
          count(*) filter (where b.status = 'CANCELLED')::int as cancelled_bookings,
          count(*)::int as total_bookings,
          count(*) filter (where b.origin = 'REPEAT_BOOKING')::int as repeat_bookings
        from ${bookings} b left join ${jobs} j on j.booking_id = b.id where b.organisation_id = ${organisationId}
      `);
      const reviewCountsResult = await tx.execute(
        sql`select count(*)::int as review_count, coalesce(round(avg(overall_rating) * 100),0)::int as avg_rating, count(rr.id)::int as response_count from ${reviews} r left join ${reviewResponses} rr on rr.review_id = r.id where r.organisation_id = ${organisationId} and r.status = 'PUBLISHED'`,
      );
      const warrantyCountsResult = await tx.execute(
        sql`select count(wc.id)::int as total_claims, count(wc.id) filter (where wc.status = 'RESOLVED')::int as resolved_claims from ${warranties} w left join ${warrantyClaims} wc on wc.warranty_id = w.id where w.organisation_id = ${organisationId}`,
      );
      const c = countsResult.rows[0] as unknown as Record<string, number>;
      const r = reviewCountsResult.rows[0] as unknown as Record<string, number>;
      const w = warrantyCountsResult.rows[0] as unknown as Record<string, number>;
      const rate = (n: number, d: number) =>
        d ? Math.round((n * 10000) / d) : 0;
      await tx
        .insert(professionalReputation)
        .values({
          organisationId,
          verifiedJobs: c.verified_jobs,
          reviewCount: r.review_count,
          averageRatingHundredths: r.review_count ? r.avg_rating : null,
          responseRateBasisPoints: rate(r.response_count, r.review_count),
          completionRateBasisPoints: rate(c.verified_jobs, c.terminal_jobs),
          repeatRateBasisPoints: rate(c.repeat_bookings, c.total_bookings),
          cancellationRateBasisPoints: rate(
            c.cancelled_bookings,
            c.total_bookings,
          ),
          warrantyResolutionRateBasisPoints: rate(
            w.resolved_claims,
            w.total_claims,
          ),
          disputeRateBasisPoints: rate(c.disputed_jobs, c.terminal_jobs),
          recalculatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: professionalReputation.organisationId,
          set: {
            verifiedJobs: c.verified_jobs,
            reviewCount: r.review_count,
            averageRatingHundredths: r.review_count ? r.avg_rating : null,
            responseRateBasisPoints: rate(r.response_count, r.review_count),
            completionRateBasisPoints: rate(c.verified_jobs, c.terminal_jobs),
            repeatRateBasisPoints: rate(c.repeat_bookings, c.total_bookings),
            cancellationRateBasisPoints: rate(
              c.cancelled_bookings,
              c.total_bookings,
            ),
            warrantyResolutionRateBasisPoints: rate(
              w.resolved_claims,
              w.total_claims,
            ),
            disputeRateBasisPoints: rate(c.disputed_jobs, c.terminal_jobs),
            recalculatedAt: new Date(),
          },
        });
      return { duplicate: false };
    });
  }

  private async findByJob(jobId: string) {
    const [r] = await this.db
      .select({
        review: getTableColumns(reviews),
        responseBody: reviewResponses.body,
        responseCreatedAt: reviewResponses.createdAt,
      })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(eq(reviews.jobId, jobId))
      .limit(1);
    return r
      ? {
          ...r.review,
          responseBody: r.responseBody,
          responseCreatedAt: r.responseCreatedAt,
        }
      : null;
  }
}

function event(
  job: { id: string; organisationId: string; clientAccountId: string },
  reviewId: string,
  actorAccountId: string,
  eventType: string,
  correlationId?: string,
) {
  return {
    eventType,
    eventVersion: 1,
    aggregateType: "review",
    aggregateId: reviewId,
    organisationId: job.organisationId,
    actorAccountId,
    correlationId,
    payload: {
      reviewId,
      jobId: job.id,
      organisationId: job.organisationId,
      clientAccountId: job.clientAccountId,
    },
  };
}

function toReview(
  r: typeof reviews.$inferSelect & {
    responseBody?: string | null;
    responseCreatedAt?: Date | null;
  },
  providerName: string,
  clientName: string,
  serviceName = "",
): ReviewItem {
  return {
    id: r.id,
    jobId: r.jobId,
    serviceName,
    providerName,
    clientName,
    overallRating: r.overallRating,
    serviceQualityRating: r.serviceQualityRating,
    communicationRating: r.communicationRating,
    timelinessRating: r.timelinessRating,
    professionalismRating: r.professionalismRating,
    valueRating: r.valueRating,
    feedback: r.feedback,
    status: r.status as ReviewItem["status"],
    submittedAt: r.submittedAt.toISOString(),
    response:
      r.responseBody && r.responseCreatedAt
        ? { body: r.responseBody, createdAt: r.responseCreatedAt.toISOString() }
        : null,
  };
}
