import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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

export const warranties = pgTable(
  "warranties",
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
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ACTIVE"),
    serviceNameSnapshot: text("service_name_snapshot").notNull(),
    termsSnapshot: text("terms_snapshot").notNull(),
    exclusionsSnapshot: text("exclusions_snapshot").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("warranties_job_unique").on(table.jobId),
    check(
      "warranties_status_check",
      sql`${table.status} in ('ACTIVE', 'EXPIRED', 'VOID')`,
    ),
    check("warranties_window_check", sql`${table.endsAt} > ${table.startsAt}`),
    index("warranties_org_status_idx").on(
      table.organisationId,
      table.status,
      table.endsAt,
      table.id,
    ),
    index("warranties_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.endsAt,
      table.id,
    ),
  ],
);

export const warrantyClaims = pgTable(
  "warranty_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warrantyId: uuid("warranty_id")
      .notNull()
      .references(() => warranties.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    status: text("status").notNull().default("SUBMITTED"),
    submittedByAccountId: uuid("submitted_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    preferredResolution: text("preferred_resolution"),
    decisionReason: text("decision_reason"),
    reviewedByAccountId: uuid("reviewed_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    returnVisitStartsAt: timestamp("return_visit_starts_at", {
      withTimezone: true,
    }),
    returnVisitEndsAt: timestamp("return_visit_ends_at", {
      withTimezone: true,
    }),
    resolutionNotes: text("resolution_notes"),
    lockVersion: integer("lock_version").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("warranty_claims_sequence_unique").on(
      table.warrantyId,
      table.sequence,
    ),
    check("warranty_claims_sequence_check", sql`${table.sequence} > 0`),
    check(
      "warranty_claims_status_check",
      sql`${table.status} in ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'RETURN_VISIT_SCHEDULED', 'RESOLVED', 'REJECTED', 'ESCALATED')`,
    ),
    check("warranty_claims_lock_check", sql`${table.lockVersion} > 0`),
    check(
      "warranty_claims_schedule_check",
      sql`(${table.returnVisitStartsAt} is null and ${table.returnVisitEndsAt} is null)
        or (${table.returnVisitStartsAt} is not null and ${table.returnVisitEndsAt} is not null and ${table.returnVisitEndsAt} > ${table.returnVisitStartsAt})`,
    ),
    check(
      "warranty_claims_rejection_check",
      sql`${table.status} <> 'REJECTED' or (${table.decisionReason} is not null and ${table.rejectedAt} is not null)`,
    ),
    index("warranty_claims_warranty_idx").on(
      table.warrantyId,
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export const warrantyClaimEvidence = pgTable(
  "warranty_claim_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "restrict" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    addedByAccountId: uuid("added_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    evidenceType: text("evidence_type").notNull().default("SUBMISSION"),
    caption: text("caption"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("warranty_claim_evidence_asset_unique").on(table.assetId),
    check(
      "warranty_claim_evidence_type_check",
      sql`${table.evidenceType} in ('SUBMISSION', 'REVIEW', 'RESOLUTION')`,
    ),
    index("warranty_claim_evidence_claim_idx").on(
      table.claimId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const warrantyClaimHistory = pgTable(
  "warranty_claim_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("warranty_claim_history_claim_idx").on(
      table.claimId,
      table.createdAt,
      table.id,
    ),
  ],
);
