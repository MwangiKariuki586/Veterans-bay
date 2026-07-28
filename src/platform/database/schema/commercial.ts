import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { organisations } from "./organisations";
import { professionalServices } from "./professional-services";
import { organisationMemberships } from "./roles";
import { serviceRequests } from "./service-requests";

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    acceptedByAccountId: uuid("accepted_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    status: text("status").notNull().default("DRAFT"),
    currentVersionNumber: integer("current_version_number").notNull().default(1),
    acceptedVersionNumber: integer("accepted_version_number"),
    lockVersion: integer("lock_version").notNull().default(1),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("quotations_request_unique").on(table.requestId),
    check(
      "quotations_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'REPLACED', 'EXPIRED', 'CANCELLED')`,
    ),
    check(
      "quotations_current_version_check",
      sql`${table.currentVersionNumber} > 0`,
    ),
    check(
      "quotations_accepted_version_check",
      sql`${table.acceptedVersionNumber} is null or ${table.acceptedVersionNumber} > 0`,
    ),
    check("quotations_lock_version_check", sql`${table.lockVersion} > 0`),
    check(
      "quotations_acceptance_fields_check",
      sql`(${table.status} = 'ACCEPTED' and ${table.acceptedVersionNumber} is not null and ${table.acceptedByAccountId} is not null and ${table.acceptedAt} is not null)
        or (${table.status} <> 'ACCEPTED' and ${table.acceptedVersionNumber} is null and ${table.acceptedByAccountId} is null and ${table.acceptedAt} is null)`,
    ),
    index("quotations_org_status_idx").on(
      table.organisationId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("quotations_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("quotations_created_by_idx").on(table.createdByAccountId),
    index("quotations_accepted_by_idx").on(table.acceptedByAccountId),
  ],
);

export const quotationVersions = pgTable(
  "quotation_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    currency: text("currency").notNull().default("KES"),
    labourMinor: bigint("labour_minor", { mode: "number" }).notNull().default(0),
    materialsMinor: bigint("materials_minor", { mode: "number" })
      .notNull()
      .default(0),
    transportMinor: bigint("transport_minor", { mode: "number" })
      .notNull()
      .default(0),
    additionalChargesMinor: bigint("additional_charges_minor", {
      mode: "number",
    })
      .notNull()
      .default(0),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" })
      .notNull()
      .default(0),
    discountMinor: bigint("discount_minor", { mode: "number" })
      .notNull()
      .default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    depositMinor: bigint("deposit_minor", { mode: "number" })
      .notNull()
      .default(0),
    expectedDurationMinutes: integer("expected_duration_minutes").notNull(),
    proposedStartAt: timestamp("proposed_start_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    scope: text("scope").notNull(),
    exclusions: text("exclusions").notNull(),
    warrantyTerms: text("warranty_terms").notNull(),
    paymentTerms: text("payment_terms").notNull(),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("quotation_versions_number_unique").on(
      table.quotationId,
      table.versionNumber,
    ),
    check("quotation_versions_number_check", sql`${table.versionNumber} > 0`),
    check(
      "quotation_versions_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'REPLACED', 'EXPIRED', 'CANCELLED')`,
    ),
    check(
      "quotation_versions_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
    check(
      "quotation_versions_money_check",
      sql`${table.labourMinor} >= 0
        and ${table.materialsMinor} >= 0
        and ${table.transportMinor} >= 0
        and ${table.additionalChargesMinor} >= 0
        and ${table.subtotalMinor} >= 0
        and ${table.discountMinor} >= 0
        and ${table.taxMinor} >= 0
        and ${table.totalMinor} >= 0
        and ${table.depositMinor} >= 0
        and ${table.discountMinor} <= ${table.subtotalMinor}
        and ${table.depositMinor} <= ${table.totalMinor}`,
    ),
    check(
      "quotation_versions_total_check",
      sql`${table.subtotalMinor} = ${table.labourMinor} + ${table.materialsMinor} + ${table.transportMinor} + ${table.additionalChargesMinor}
        and ${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor} + ${table.taxMinor}`,
    ),
    check(
      "quotation_versions_duration_check",
      sql`${table.expectedDurationMinutes} > 0`,
    ),
    check(
      "quotation_versions_submission_check",
      sql`${table.status} = 'DRAFT' or ${table.submittedAt} is not null`,
    ),
    index("quotation_versions_quotation_idx").on(
      table.quotationId,
      table.versionNumber,
    ),
    index("quotation_versions_created_by_idx").on(table.createdByAccountId),
    index("quotation_versions_expiry_idx").on(
      table.status,
      table.validUntil,
      table.id,
    ),
  ],
);

export const quotationLineItems = pgTable(
  "quotation_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationVersionId: uuid("quotation_version_id")
      .notNull()
      .references(() => quotationVersions.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "quotation_line_items_category_check",
      sql`${table.category} in ('LABOUR', 'MATERIAL', 'TRANSPORT', 'ADDITIONAL')`,
    ),
    check("quotation_line_items_quantity_check", sql`${table.quantity} > 0`),
    check(
      "quotation_line_items_money_check",
      sql`${table.unitPriceMinor} >= 0 and ${table.totalMinor} = ${table.quantity} * ${table.unitPriceMinor}`,
    ),
    unique("quotation_line_items_position_unique").on(
      table.quotationVersionId,
      table.position,
    ),
    index("quotation_line_items_version_idx").on(
      table.quotationVersionId,
      table.position,
    ),
  ],
);

export const quotationHistory = pgTable(
  "quotation_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "restrict" }),
    quotationVersionId: uuid("quotation_version_id").references(
      () => quotationVersions.id,
      { onDelete: "restrict" },
    ),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("quotation_history_quotation_idx").on(
      table.quotationId,
      table.createdAt,
      table.id,
    ),
    index("quotation_history_version_idx").on(table.quotationVersionId),
    index("quotation_history_actor_idx").on(table.actorAccountId),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "restrict",
    }),
    quotationId: uuid("quotation_id").references(() => quotations.id, {
      onDelete: "restrict",
    }),
    acceptedQuotationVersionId: uuid("accepted_quotation_version_id").references(
      () => quotationVersions.id,
      { onDelete: "restrict" },
    ),
    professionalServiceId: uuid("professional_service_id").references(
      () => professionalServices.id,
      { onDelete: "restrict" },
    ),
    sourceBookingId: uuid("source_booking_id").references(
      (): AnyPgColumn => bookings.id,
      { onDelete: "restrict" },
    ),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    assignedMembershipId: uuid("assigned_membership_id").references(
      () => organisationMemberships.id,
      { onDelete: "restrict" },
    ),
    requestedMembershipId: uuid("requested_membership_id").references(
      () => organisationMemberships.id,
      { onDelete: "restrict" },
    ),
    origin: text("origin").notNull().default("ACCEPTED_QUOTATION"),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    depositMinor: bigint("deposit_minor", { mode: "number" }).notNull(),
    expectedDurationMinutes: integer("expected_duration_minutes").notNull(),
    proposedStartAt: timestamp("proposed_start_at", { withTimezone: true }),
    requestedStartAt: timestamp("requested_start_at", { withTimezone: true }),
    requestedEndAt: timestamp("requested_end_at", { withTimezone: true }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    cancellationPolicy: text("cancellation_policy")
      .notNull()
      .default(
        "Cancel or request a reschedule at least 24 hours before the scheduled start. Later changes may affect the deposit record.",
      ),
    cancellationAcknowledgedAt: timestamp("cancellation_acknowledged_at", {
      withTimezone: true,
    }),
    cancellationReason: text("cancellation_reason"),
    scope: text("scope").notNull(),
    exclusions: text("exclusions").notNull(),
    warrantyTerms: text("warranty_terms").notNull(),
    paymentTerms: text("payment_terms").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
    lockVersion: integer("lock_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("bookings_request_unique").on(table.requestId),
    unique("bookings_quotation_unique").on(table.quotationId),
    unique("bookings_accepted_version_unique").on(
      table.acceptedQuotationVersionId,
    ),
    check(
      "bookings_origin_check",
      sql`${table.origin} in ('ACCEPTED_QUOTATION', 'DIRECT_SERVICE', 'APPROVED_ASSESSMENT', 'REPEAT_BOOKING', 'PROFESSIONAL_CUSTOMER')`,
    ),
    check(
      "bookings_status_check",
      sql`${table.status} in ('PENDING_CONFIRMATION', 'PENDING_DEPOSIT', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')`,
    ),
    check(
      "bookings_origin_fields_check",
      sql`(${table.origin} = 'ACCEPTED_QUOTATION'
          and ${table.requestId} is not null
          and ${table.quotationId} is not null
          and ${table.acceptedQuotationVersionId} is not null
          and ${table.acceptedAt} is not null)
        or (${table.origin} = 'DIRECT_SERVICE' and ${table.professionalServiceId} is not null)
        or (${table.origin} = 'APPROVED_ASSESSMENT'
          and ${table.requestId} is not null
          and ${table.professionalServiceId} is not null)
        or (${table.origin} = 'REPEAT_BOOKING' and ${table.sourceBookingId} is not null)
        or (${table.origin} = 'PROFESSIONAL_CUSTOMER' and ${table.professionalServiceId} is not null)`,
    ),
    check(
      "bookings_money_check",
      sql`${table.totalMinor} >= 0 and ${table.depositMinor} >= 0 and ${table.depositMinor} <= ${table.totalMinor}`,
    ),
    check(
      "bookings_duration_check",
      sql`${table.expectedDurationMinutes} > 0`,
    ),
    check(
      "bookings_requested_schedule_check",
      sql`(${table.requestedStartAt} is null and ${table.requestedEndAt} is null)
        or (${table.requestedStartAt} is not null
          and ${table.requestedEndAt} is not null
          and ${table.requestedEndAt} > ${table.requestedStartAt})`,
    ),
    check(
      "bookings_schedule_check",
      sql`(${table.startsAt} is null and ${table.endsAt} is null)
        or (${table.startsAt} is not null
          and ${table.endsAt} is not null
          and ${table.endsAt} > ${table.startsAt})`,
    ),
    check(
      "bookings_scheduled_status_check",
      sql`${table.status} not in ('CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW')
        or (${table.startsAt} is not null
          and ${table.endsAt} is not null
          and ${table.assignedMembershipId} is not null
          and ${table.cancellationAcknowledgedAt} is not null)`,
    ),
    check("bookings_lock_version_check", sql`${table.lockVersion} > 0`),
    index("bookings_org_status_idx").on(
      table.organisationId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("bookings_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("bookings_service_idx").on(table.professionalServiceId),
    index("bookings_source_booking_idx").on(table.sourceBookingId),
    index("bookings_created_by_idx").on(table.createdByAccountId),
    index("bookings_requested_membership_idx").on(table.requestedMembershipId),
    index("bookings_assignment_schedule_idx").on(
      table.assignedMembershipId,
      table.startsAt,
      table.endsAt,
    ),
    index("bookings_org_schedule_idx").on(
      table.organisationId,
      table.startsAt,
      table.endsAt,
    ),
  ],
);

export const paymentRequirements = pgTable(
  "payment_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    quotationVersionId: uuid("quotation_version_id").references(
      () => quotationVersions.id,
      { onDelete: "restrict" },
    ),
    requirementType: text("requirement_type").notNull(),
    status: text("status").notNull().default("PENDING"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("payment_requirements_booking_type_unique").on(
      table.bookingId,
      table.requirementType,
    ),
    check(
      "payment_requirements_type_check",
      sql`${table.requirementType} in ('DEPOSIT', 'BALANCE')`,
    ),
    check(
      "payment_requirements_status_check",
      sql`${table.status} in ('PENDING', 'SATISFIED', 'WAIVED', 'CANCELLED')`,
    ),
    check(
      "payment_requirements_amount_check",
      sql`${table.amountMinor} >= 0`,
    ),
    index("payment_requirements_booking_idx").on(
      table.bookingId,
      table.status,
    ),
    index("payment_requirements_version_idx").on(table.quotationVersionId),
  ],
);
