import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { bookings } from "./commercial";
import { fileAssets } from "./file-assets";
import { organisations } from "./organisations";
import { organisationMemberships } from "./roles";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("CREATED"),
    lockVersion: integer("lock_version").notNull().default(1),
    serviceName: text("service_name").notNull(),
    scopeSnapshot: text("scope_snapshot").notNull(),
    exclusionsSnapshot: text("exclusions_snapshot").notNull(),
    warrantyTermsSnapshot: text("warranty_terms_snapshot").notNull(),
    paymentTermsSnapshot: text("payment_terms_snapshot").notNull(),
    currency: text("currency").notNull(),
    baseTotalMinor: bigint("base_total_minor", { mode: "number" }).notNull(),
    approvedVariationTotalMinor: bigint("approved_variation_total_minor", {
      mode: "number",
    })
      .notNull()
      .default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    scheduledStartsAt: timestamp("scheduled_starts_at", {
      withTimezone: true,
    }),
    scheduledEndsAt: timestamp("scheduled_ends_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    awaitingConfirmationAt: timestamp("awaiting_confirmation_at", {
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("jobs_booking_unique").on(table.bookingId),
    check(
      "jobs_status_check",
      sql`${table.status} in ('CREATED', 'SCHEDULED', 'TEAM_ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_CLIENT_CONFIRMATION', 'COMPLETED', 'RETURN_VISIT_REQUIRED', 'CANCELLED', 'DISPUTED')`,
    ),
    check("jobs_lock_version_check", sql`${table.lockVersion} > 0`),
    check(
      "jobs_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
    check(
      "jobs_totals_check",
      sql`${table.baseTotalMinor} >= 0
        and ${table.approvedVariationTotalMinor} >= 0
        and ${table.totalMinor} = ${table.baseTotalMinor} + ${table.approvedVariationTotalMinor}`,
    ),
    check(
      "jobs_schedule_check",
      sql`(${table.scheduledStartsAt} is null and ${table.scheduledEndsAt} is null)
        or (${table.scheduledStartsAt} is not null and ${table.scheduledEndsAt} is not null and ${table.scheduledEndsAt} > ${table.scheduledStartsAt})`,
    ),
    index("jobs_org_status_idx").on(
      table.organisationId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("jobs_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.updatedAt,
      table.id,
    ),
  ],
);

export const jobAssignments = pgTable(
  "job_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    assignedByAccountId: uuid("assigned_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    unassignedByAccountId: uuid("unassigned_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    active: boolean("active").notNull().default(true),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
    reason: text("reason"),
  },
  (table) => [
    uniqueIndex("job_assignments_active_member_unique")
      .on(table.jobId, table.membershipId)
      .where(sql`${table.active} = true`),
    check(
      "job_assignments_lifecycle_check",
      sql`(${table.active} = true and ${table.unassignedAt} is null and ${table.unassignedByAccountId} is null)
        or (${table.active} = false and ${table.unassignedAt} is not null and ${table.unassignedByAccountId} is not null)`,
    ),
    index("job_assignments_job_idx").on(
      table.jobId,
      table.active,
      table.assignedAt,
    ),
    index("job_assignments_member_idx").on(
      table.membershipId,
      table.active,
      table.assignedAt,
    ),
  ],
);

export const jobHistory = pgTable(
  "job_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    clientVisible: boolean("client_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_history_job_idx").on(table.jobId, table.createdAt, table.id),
    index("job_history_actor_idx").on(table.actorAccountId),
  ],
);

export const jobChecklistItems = pgTable(
  "job_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    required: boolean("required").notNull().default(true),
    position: integer("position").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedByAccountId: uuid("completed_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resultNote: text("result_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("job_checklist_position_unique").on(table.jobId, table.position),
    check("job_checklist_position_check", sql`${table.position} >= 0`),
    check(
      "job_checklist_completion_check",
      sql`(${table.completed} = false and ${table.completedAt} is null and ${table.completedByAccountId} is null)
        or (${table.completed} = true and ${table.completedAt} is not null and ${table.completedByAccountId} is not null)`,
    ),
    index("job_checklist_job_idx").on(table.jobId, table.position),
  ],
);

export const jobUpdates = pgTable(
  "job_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    updateType: text("update_type").notNull(),
    visibility: text("visibility").notNull().default("CLIENT"),
    content: text("content").notNull(),
    quantity: integer("quantity"),
    amountMinor: bigint("amount_minor", { mode: "number" }),
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "job_updates_type_check",
      sql`${table.updateType} in ('PROGRESS', 'NOTE', 'MATERIAL', 'EXPENSE', 'CLARIFICATION')`,
    ),
    check(
      "job_updates_visibility_check",
      sql`${table.visibility} in ('CLIENT', 'PROFESSIONAL')`,
    ),
    check(
      "job_updates_content_check",
      sql`char_length(trim(${table.content})) between 1 and 4000`,
    ),
    check(
      "job_updates_quantity_check",
      sql`${table.quantity} is null or ${table.quantity} > 0`,
    ),
    check(
      "job_updates_amount_check",
      sql`${table.amountMinor} is null or ${table.amountMinor} >= 0`,
    ),
    index("job_updates_job_idx").on(table.jobId, table.createdAt, table.id),
  ],
);

export const jobEvidence = pgTable(
  "job_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    addedByAccountId: uuid("added_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    evidenceType: text("evidence_type").notNull(),
    visibility: text("visibility").notNull().default("CLIENT"),
    caption: text("caption"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("job_evidence_asset_unique").on(table.assetId),
    check(
      "job_evidence_type_check",
      sql`${table.evidenceType} in ('BEFORE', 'PROGRESS', 'AFTER', 'VARIATION', 'COMPLETION')`,
    ),
    check(
      "job_evidence_visibility_check",
      sql`${table.visibility} in ('CLIENT', 'PROFESSIONAL')`,
    ),
    index("job_evidence_job_idx").on(table.jobId, table.createdAt, table.id),
  ],
);

export const jobVariations = pgTable(
  "job_variations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    status: text("status").notNull().default("DRAFT"),
    description: text("description").notNull(),
    reason: text("reason").notNull(),
    additionalAmountMinor: bigint("additional_amount_minor", {
      mode: "number",
    }).notNull(),
    currency: text("currency").notNull(),
    scheduleImpactMinutes: integer("schedule_impact_minutes")
      .notNull()
      .default(0),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedByAccountId: uuid("responded_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    responseComment: text("response_comment"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("job_variations_sequence_unique").on(table.jobId, table.sequence),
    check("job_variations_sequence_check", sql`${table.sequence} > 0`),
    check(
      "job_variations_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')`,
    ),
    check(
      "job_variations_amount_check",
      sql`${table.additionalAmountMinor} >= 0`,
    ),
    check(
      "job_variations_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
    index("job_variations_job_idx").on(
      table.jobId,
      table.status,
      table.sequence,
    ),
    index("job_variations_expiry_idx").on(
      table.status,
      table.expiresAt,
      table.id,
    ),
  ],
);

export const jobCommercialHistory = pgTable(
  "job_commercial_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    variationId: uuid("variation_id").references(() => jobVariations.id, {
      onDelete: "restrict",
    }),
    entryType: text("entry_type").notNull(),
    descriptionSnapshot: text("description_snapshot").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    totalAfterMinor: bigint("total_after_minor", { mode: "number" }).notNull(),
    approvedByAccountId: uuid("approved_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("job_commercial_variation_unique").on(table.variationId),
    check(
      "job_commercial_entry_type_check",
      sql`${table.entryType} in ('BOOKING_SNAPSHOT', 'APPROVED_VARIATION')`,
    ),
    check(
      "job_commercial_amount_check",
      sql`${table.amountMinor} >= 0 and ${table.totalAfterMinor} >= 0`,
    ),
    index("job_commercial_job_idx").on(table.jobId, table.createdAt, table.id),
  ],
);

export const jobCompletionResponses = pgTable(
  "job_completion_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    attempt: integer("attempt").notNull(),
    responseType: text("response_type").notNull(),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    comments: text("comments"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("job_completion_attempt_unique").on(table.jobId, table.attempt),
    check("job_completion_attempt_check", sql`${table.attempt} > 0`),
    check(
      "job_completion_response_check",
      sql`${table.responseType} in ('CONFIRMED', 'CONFIRMED_WITH_COMMENTS', 'UNRESOLVED', 'CLARIFICATION_REQUESTED', 'AUTO_CONFIRMED')`,
    ),
    index("job_completion_job_idx").on(table.jobId, table.createdAt, table.id),
  ],
);
