import { sql } from "drizzle-orm";
import {
  bigint,
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
import { organisations } from "./organisations";
import { professionalServices } from "./professional-services";

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    preferredServiceId: uuid("preferred_service_id").references(
      () => professionalServices.id,
      { onDelete: "restrict" },
    ),
    idempotencyKey: uuid("idempotency_key").notNull(),
    source: text("source").notNull(),
    category: text("category"),
    description: text("description"),
    location: text("location"),
    preferredTime: text("preferred_time"),
    budgetMinMinor: bigint("budget_min_minor", { mode: "number" }),
    budgetMaxMinor: bigint("budget_max_minor", { mode: "number" }),
    currency: text("currency").notNull().default("KES"),
    urgency: text("urgency"),
    contactPreference: text("contact_preference"),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("service_requests_client_idempotency_unique").on(
      table.clientAccountId,
      table.idempotencyKey,
    ),
    check(
      "service_requests_source_check",
      sql`${table.source} in ('MARKETPLACE_DISCOVERY', 'PROFESSIONAL_BOOKING_LINK', 'PROFESSIONAL_IMPORTED', 'REPEAT_CLIENT', 'DIRECT_SERVICE_PAGE')`,
    ),
    check(
      "service_requests_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ASSESSMENT_REQUIRED', 'QUOTED', 'CONVERTED', 'DECLINED', 'CANCELLED', 'EXPIRED')`,
    ),
    check(
      "service_requests_urgency_check",
      sql`${table.urgency} is null or ${table.urgency} in ('FLEXIBLE', 'SOON', 'URGENT')`,
    ),
    check(
      "service_requests_contact_preference_check",
      sql`${table.contactPreference} is null or ${table.contactPreference} in ('IN_APP', 'PHONE', 'EMAIL')`,
    ),
    check(
      "service_requests_budget_min_check",
      sql`${table.budgetMinMinor} is null or ${table.budgetMinMinor} >= 0`,
    ),
    check(
      "service_requests_budget_max_check",
      sql`${table.budgetMaxMinor} is null or ${table.budgetMaxMinor} >= 0`,
    ),
    check(
      "service_requests_budget_order_check",
      sql`${table.budgetMinMinor} is null or ${table.budgetMaxMinor} is null or ${table.budgetMinMinor} <= ${table.budgetMaxMinor}`,
    ),
    check("service_requests_version_check", sql`${table.version} > 0`),
    index("service_requests_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.updatedAt,
    ),
    index("service_requests_org_status_idx").on(
      table.organisationId,
      table.status,
      table.updatedAt,
    ),
    index("service_requests_expiry_idx").on(
      table.status,
      table.expiresAt,
      table.id,
    ),
    index("service_requests_submitted_idx").on(
      table.submittedAt,
      table.status,
      table.id,
    ),
  ],
);

export const serviceRequestHistory = pgTable(
  "service_request_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    clientVisibleNote: text("client_visible_note"),
    privateProfessionalNote: text("private_professional_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("service_request_history_request_idx").on(
      table.requestId,
      table.createdAt,
    ),
  ],
);

export const serviceRequestAttachments = pgTable(
  "service_request_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    addedByAccountId: uuid("added_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("service_request_attachments_asset_unique").on(table.assetId),
    index("service_request_attachments_request_idx").on(
      table.requestId,
      table.createdAt,
    ),
  ],
);
