import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { jobs } from "./fulfilment";
import { organisations } from "./organisations";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    overallRating: numeric("overall_rating", {
      precision: 2,
      scale: 1,
      mode: "number",
    }).notNull(),
    serviceQualityRating: integer("service_quality_rating").notNull(),
    communicationRating: integer("communication_rating").notNull(),
    timelinessRating: integer("timeliness_rating").notNull(),
    professionalismRating: integer("professionalism_rating").notNull(),
    valueRating: integer("value_rating").notNull(),
    feedback: text("feedback").notNull(),
    status: text("status").notNull().default("PUBLISHED"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderationReason: text("moderation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    unique("reviews_job_unique").on(table.jobId),
    check("reviews_rating_check", sql`${table.overallRating} between 1 and 5 and ${table.serviceQualityRating} between 1 and 5 and ${table.communicationRating} between 1 and 5 and ${table.timelinessRating} between 1 and 5 and ${table.professionalismRating} between 1 and 5 and ${table.valueRating} between 1 and 5`),
    check("reviews_feedback_check", sql`char_length(trim(${table.feedback})) = 0 or char_length(trim(${table.feedback})) between 3 and 4000`),
    check("reviews_status_check", sql`${table.status} in ('PUBLISHED', 'REPORTED', 'HIDDEN')`),
    index("reviews_org_status_idx").on(table.organisationId, table.status, table.submittedAt, table.id),
    index("reviews_client_idx").on(table.clientAccountId, table.submittedAt, table.id),
  ],
);

export const reviewResponses = pgTable(
  "review_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    authorAccountId: uuid("author_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("review_responses_review_unique").on(table.reviewId),
    check("review_responses_body_check", sql`char_length(trim(${table.body})) between 2 and 2000`),
  ],
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "restrict" }),
    reportedByAccountId: uuid("reported_by_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    unique("review_reports_reporter_unique").on(table.reviewId, table.reportedByAccountId),
    check("review_reports_status_check", sql`${table.status} in ('PENDING', 'RESOLVED', 'DISMISSED')`),
    index("review_reports_status_idx").on(table.status, table.createdAt, table.id),
  ],
);

export const reviewModerationHistory = pgTable(
  "review_moderation_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").references(() => accountProfiles.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("review_moderation_history_review_idx").on(table.reviewId, table.createdAt, table.id)],
);

export const professionalReputation = pgTable(
  "professional_reputation",
  {
    organisationId: uuid("organisation_id").primaryKey().references(() => organisations.id, { onDelete: "restrict" }),
    verifiedJobs: integer("verified_jobs").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    averageRatingHundredths: integer("average_rating_hundredths"),
    responseRateBasisPoints: integer("response_rate_basis_points").notNull().default(0),
    completionRateBasisPoints: integer("completion_rate_basis_points").notNull().default(0),
    repeatRateBasisPoints: integer("repeat_rate_basis_points").notNull().default(0),
    cancellationRateBasisPoints: integer("cancellation_rate_basis_points").notNull().default(0),
    warrantyResolutionRateBasisPoints: integer("warranty_resolution_rate_basis_points").notNull().default(0),
    disputeRateBasisPoints: integer("dispute_rate_basis_points").notNull().default(0),
    recalculatedAt: timestamp("recalculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("professional_reputation_counts_check", sql`${table.verifiedJobs} >= 0 and ${table.reviewCount} >= 0`),
    check("professional_reputation_rating_check", sql`${table.averageRatingHundredths} is null or ${table.averageRatingHundredths} between 100 and 500`),
    check("professional_reputation_rates_check", sql`${table.responseRateBasisPoints} between 0 and 10000 and ${table.completionRateBasisPoints} between 0 and 10000 and ${table.repeatRateBasisPoints} between 0 and 10000 and ${table.cancellationRateBasisPoints} between 0 and 10000 and ${table.warrantyResolutionRateBasisPoints} between 0 and 10000 and ${table.disputeRateBasisPoints} between 0 and 10000`),
  ],
);
