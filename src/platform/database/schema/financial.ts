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
import { jobs } from "./fulfilment";
import { organisations } from "./organisations";

export const invoices = pgTable(
  "invoices",
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
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    currency: text("currency").notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    notes: text("notes"),
    paymentTermsSnapshot: text("payment_terms_snapshot").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
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
    unique("invoices_job_unique").on(table.jobId),
    unique("invoices_org_number_unique").on(
      table.organisationId,
      table.invoiceNumber,
    ),
    check(
      "invoices_status_check",
      sql`${table.status} in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED')`,
    ),
    check(
      "invoices_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
    check(
      "invoices_money_check",
      sql`${table.subtotalMinor} >= 0 and ${table.taxMinor} >= 0 and ${table.totalMinor} = ${table.subtotalMinor} + ${table.taxMinor}`,
    ),
    check("invoices_lock_version_check", sql`${table.lockVersion} > 0`),
    check(
      "invoices_issue_fields_check",
      sql`${table.status} = 'DRAFT' or ${table.issuedAt} is not null`,
    ),
    index("invoices_org_status_idx").on(
      table.organisationId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("invoices_client_status_idx").on(
      table.clientAccountId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("invoices_due_idx").on(table.status, table.dueAt, table.id),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("invoice_items_position_unique").on(
      table.invoiceId,
      table.position,
    ),
    check(
      "invoice_items_source_check",
      sql`${table.sourceType} in ('JOB_BASE', 'JOB_VARIATION', 'CUSTOM')`,
    ),
    check("invoice_items_quantity_check", sql`${table.quantity} > 0`),
    check(
      "invoice_items_money_check",
      sql`${table.unitPriceMinor} >= 0 and ${table.totalMinor} = ${table.quantity} * ${table.unitPriceMinor}`,
    ),
    index("invoice_items_invoice_idx").on(table.invoiceId, table.position),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    recordedByAccountId: uuid("recorded_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    status: text("status").notNull().default("RECORDED"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    method: text("method").notNull(),
    transactionReference: text("transaction_reference"),
    notes: text("notes"),
    evidenceAssetId: uuid("evidence_asset_id").references(
      () => fileAssets.id,
      { onDelete: "restrict" },
    ),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("payments_org_idempotency_unique").on(
      table.organisationId,
      table.idempotencyKey,
    ),
    check(
      "payments_status_check",
      sql`${table.status} in ('RECORDED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'REVERSED')`,
    ),
    check("payments_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "payments_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
    check(
      "payments_method_check",
      sql`${table.method} in ('CASH', 'BANK_TRANSFER', 'M_PESA_MANUAL', 'CARD_MANUAL', 'CHEQUE', 'OTHER')`,
    ),
    index("payments_org_paid_idx").on(
      table.organisationId,
      table.paidAt,
      table.id,
    ),
    index("payments_client_paid_idx").on(
      table.clientAccountId,
      table.paidAt,
      table.id,
    ),
    index("payments_evidence_idx").on(table.evidenceAssetId),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    invoiceItemId: uuid("invoice_item_id")
      .notNull()
      .references(() => invoiceItems.id, { onDelete: "restrict" }),
    allocatedByAccountId: uuid("allocated_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("payment_allocations_payment_item_unique").on(
      table.paymentId,
      table.invoiceItemId,
    ),
    check(
      "payment_allocations_amount_check",
      sql`${table.amountMinor} > 0`,
    ),
    index("payment_allocations_payment_idx").on(table.paymentId),
    index("payment_allocations_item_idx").on(table.invoiceItemId),
  ],
);

export const paymentAdjustments = pgTable(
  "payment_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    recordedByAccountId: uuid("recorded_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    adjustmentType: text("adjustment_type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    transactionReference: text("transaction_reference"),
    evidenceAssetId: uuid("evidence_asset_id").references(
      () => fileAssets.id,
      { onDelete: "restrict" },
    ),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("payment_adjustments_payment_idempotency_unique").on(
      table.paymentId,
      table.idempotencyKey,
    ),
    check(
      "payment_adjustments_type_check",
      sql`${table.adjustmentType} in ('REVERSAL', 'REFUND')`,
    ),
    check("payment_adjustments_amount_check", sql`${table.amountMinor} > 0`),
    index("payment_adjustments_payment_idx").on(
      table.paymentId,
      table.createdAt,
      table.id,
    ),
    index("payment_adjustments_evidence_idx").on(table.evidenceAssetId),
  ],
);

export const paymentAdjustmentAllocations = pgTable(
  "payment_adjustment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adjustmentId: uuid("adjustment_id")
      .notNull()
      .references(() => paymentAdjustments.id, { onDelete: "restrict" }),
    paymentAllocationId: uuid("payment_allocation_id")
      .notNull()
      .references(() => paymentAllocations.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("payment_adjustment_allocations_unique").on(
      table.adjustmentId,
      table.paymentAllocationId,
    ),
    check(
      "payment_adjustment_allocations_amount_check",
      sql`${table.amountMinor} > 0`,
    ),
    index("payment_adjustment_allocations_adjustment_idx").on(
      table.adjustmentId,
    ),
    index("payment_adjustment_allocations_allocation_idx").on(
      table.paymentAllocationId,
    ),
  ],
);

export const platformFeeRecords = pgTable(
  "platform_fee_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    basis: text("basis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("platform_fee_records_invoice_unique").on(table.invoiceId),
    check("platform_fee_records_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "platform_fee_records_currency_check",
      sql`char_length(${table.currency}) = 3 and ${table.currency} = upper(${table.currency})`,
    ),
  ],
);
