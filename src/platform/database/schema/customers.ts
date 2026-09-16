import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const customerRecords = pgTable(
  "customer_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    accountProfileId: uuid("account_profile_id").references(() => accountProfiles.id, { onDelete: "restrict" }),
    duplicateOfCustomerId: uuid("duplicate_of_customer_id").references(
      (): AnyPgColumn => customerRecords.id,
      { onDelete: "restrict" },
    ),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    acquisitionSource: text("acquisition_source").notNull(),
    status: text("status").notNull().default("IMPORTED"),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("customer_records_org_account_unique").on(table.organisationId, table.accountProfileId).where(sql`${table.accountProfileId} is not null`),
    check("customer_records_source_check", sql`${table.acquisitionSource} in ('MARKETPLACE_ACQUIRED', 'PROFESSIONAL_INVITED', 'PROFESSIONAL_IMPORTED', 'CLIENT_REFERRAL', 'REPEAT_CLIENT')`),
    check("customer_records_status_check", sql`${table.status} in ('IMPORTED', 'INVITATION_PENDING', 'REGISTERED', 'DUPLICATE_CANDIDATE', 'ARCHIVED')`),
    check("customer_records_contact_check", sql`${table.email} is not null or ${table.phone} is not null or ${table.accountProfileId} is not null`),
    index("customer_records_org_status_idx").on(table.organisationId, table.status, table.updatedAt, table.id),
    index("customer_records_org_email_idx").on(table.organisationId, table.email),
    index("customer_records_org_phone_idx").on(table.organisationId, table.phone),
  ],
);

export const customerTags = pgTable(
  "customer_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("customer_tags_org_name_unique").on(table.organisationId, table.name),
    check("customer_tags_name_check", sql`char_length(trim(${table.name})) between 1 and 40`),
  ],
);

export const customerRecordTags = pgTable(
  "customer_record_tags",
  {
    customerId: uuid("customer_id").notNull().references(() => customerRecords.id, { onDelete: "restrict" }),
    tagId: uuid("tag_id").notNull().references(() => customerTags.id, { onDelete: "restrict" }),
    addedByAccountId: uuid("added_by_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("customer_record_tags_unique").on(table.customerId, table.tagId)],
);

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull().references(() => customerRecords.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    authorAccountId: uuid("author_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("customer_notes_body_check", sql`char_length(trim(${table.body})) between 1 and 4000`),
    index("customer_notes_customer_idx").on(table.customerId, table.createdAt, table.id),
    index("customer_notes_org_idx").on(table.organisationId, table.createdAt, table.id),
  ],
);
