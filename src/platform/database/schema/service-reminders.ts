import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accountProfiles } from "./account-profiles";
import { customerRecords } from "./customers";
import { organisations } from "./organisations";

export const serviceReminders = pgTable(
  "service_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").notNull().references(() => customerRecords.id, { onDelete: "restrict" }),
    recipientAccountId: uuid("recipient_account_id").references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountProfiles.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("SCHEDULED"),
    cancelledByAccountId: uuid("cancelled_by_account_id").references(() => accountProfiles.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    check("service_reminders_reason_check", sql`char_length(trim(${table.reason})) between 3 and 500`),
    check("service_reminders_status_check", sql`${table.status} in ('SCHEDULED', 'CANCELLED', 'SENT')`),
    check("service_reminders_lifecycle_check", sql`(${table.status} = 'SCHEDULED' and ${table.cancelledAt} is null and ${table.sentAt} is null) or (${table.status} = 'CANCELLED' and ${table.cancelledAt} is not null and ${table.cancelledByAccountId} is not null and ${table.sentAt} is null) or (${table.status} = 'SENT' and ${table.sentAt} is not null and ${table.cancelledAt} is null)`),
    index("service_reminders_due_idx").on(table.status, table.dueAt, table.id),
    index("service_reminders_customer_idx").on(table.customerId, table.dueAt, table.id),
  ],
);
