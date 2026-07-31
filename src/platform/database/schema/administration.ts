import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { fileAssets } from "./file-assets";
import { jobs } from "./fulfilment";
import { organisations } from "./organisations";

export const moderationReports = pgTable(
  "moderation_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submittedByAccountId: uuid("submitted_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    category: text("category").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
    details: text("details").notNull(),
    status: text("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "moderation_reports_category_check",
      sql`${table.category} in ('MISLEADING_LISTING', 'ABUSIVE_COMMUNICATION', 'FRAUD_CONCERN', 'POOR_SERVICE_CONDUCT', 'PAYMENT_DISAGREEMENT', 'REVIEW_MANIPULATION', 'OFF_PLATFORM_PAYMENT_REQUEST', 'IDENTITY_CONCERN')`,
    ),
    check(
      "moderation_reports_status_check",
      sql`${table.status} in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')`,
    ),
    check(
      "moderation_reports_summary_check",
      sql`char_length(trim(${table.summary})) between 3 and 200`,
    ),
    check(
      "moderation_reports_details_check",
      sql`char_length(trim(${table.details})) between 10 and 4000`,
    ),
    index("moderation_reports_queue_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("moderation_reports_subject_idx").on(
      table.subjectType,
      table.subjectId,
    ),
  ],
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .references(() => moderationReports.id, { onDelete: "restrict" })
      .unique(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    subjectAccountId: uuid("subject_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    caseType: text("case_type").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    status: text("status").notNull().default("OPEN"),
    priority: text("priority").notNull().default("NORMAL"),
    openedByAccountId: uuid("opened_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    assignedToAccountId: uuid("assigned_to_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    resolution: text("resolution"),
    decisionReason: text("decision_reason"),
    evidenceSummary: text("evidence_summary"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "moderation_cases_status_check",
      sql`${table.status} in ('OPEN', 'INVESTIGATING', 'AWAITING_DECISION', 'RESOLVED', 'DISMISSED')`,
    ),
    check(
      "moderation_cases_priority_check",
      sql`${table.priority} in ('LOW', 'NORMAL', 'HIGH', 'URGENT')`,
    ),
    check(
      "moderation_cases_resolution_check",
      sql`(${table.status} not in ('RESOLVED', 'DISMISSED')) or (${table.resolution} is not null and ${table.decisionReason} is not null and ${table.evidenceSummary} is not null and ${table.resolvedAt} is not null)`,
    ),
    index("moderation_cases_queue_idx").on(
      table.status,
      table.priority,
      table.openedAt,
      table.id,
    ),
    index("moderation_cases_subject_idx").on(
      table.subjectType,
      table.subjectId,
    ),
  ],
);

export const moderationCaseEvidence = pgTable(
  "moderation_case_evidence",
  {
    caseId: uuid("case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "restrict" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    addedByAccountId: uuid("added_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("moderation_case_evidence_asset_unique").on(table.assetId),
    index("moderation_case_evidence_case_idx").on(
      table.caseId,
      table.createdAt,
      table.assetId,
    ),
  ],
);

export const moderationCaseHistory = pgTable(
  "moderation_case_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moderation_case_history_case_idx").on(
      table.caseId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    openedByAccountId: uuid("opened_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    assignedToAccountId: uuid("assigned_to_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("OPEN"),
    resolution: text("resolution"),
    decisionReason: text("decision_reason"),
    evidenceSummary: text("evidence_summary"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "disputes_status_check",
      sql`${table.status} in ('OPEN', 'INVESTIGATING', 'AWAITING_DECISION', 'RESOLVED', 'DISMISSED')`,
    ),
    check(
      "disputes_resolution_check",
      sql`(${table.status} not in ('RESOLVED', 'DISMISSED')) or (${table.resolution} is not null and ${table.decisionReason} is not null and ${table.evidenceSummary} is not null and ${table.resolvedAt} is not null)`,
    ),
    index("disputes_queue_idx").on(
      table.status,
      table.openedAt,
      table.id,
    ),
    index("disputes_job_idx").on(table.jobId, table.openedAt),
    unique("disputes_job_unique").on(table.jobId),
  ],
);

export const platformRules = pgTable(
  "platform_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("ACTIVE"),
    reason: text("reason").notNull(),
    updatedByAccountId: uuid("updated_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "platform_rules_status_check",
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    index("platform_rules_status_idx").on(table.status, table.key),
  ],
);
