import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientAccountId: uuid("recipient_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").references(
      () => organisations.id,
      { onDelete: "set null" },
    ),
    sourceEventId: uuid("source_event_id").notNull(),
    sourceEventType: text("source_event_type").notNull(),
    sourceAggregateType: text("source_aggregate_type").notNull(),
    sourceAggregateId: text("source_aggregate_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionTarget: text("action_target"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("notifications_source_recipient_unique").on(
      table.sourceEventId,
      table.recipientAccountId,
    ),
    check(
      "notifications_event_type_check",
      sql`char_length(${table.sourceEventType}) between 1 and 120`,
    ),
    check(
      "notifications_title_check",
      sql`char_length(trim(${table.title})) between 1 and 160`,
    ),
    check(
      "notifications_body_check",
      sql`char_length(trim(${table.body})) between 1 and 500`,
    ),
    check(
      "notifications_action_target_check",
      sql`${table.actionTarget} is null
        or (${table.actionTarget} ~ '^/[a-z0-9/_?=&.%:-]+$'
          and ${table.actionTarget} not like '//%'
          and char_length(${table.actionTarget}) <= 500)`,
    ),
    index("notifications_recipient_created_idx").on(
      table.recipientAccountId,
      table.createdAt,
      table.id,
    ),
    index("notifications_recipient_unread_idx")
      .on(table.recipientAccountId, table.createdAt, table.id)
      .where(sql`${table.readAt} is null`),
    index("notifications_organisation_idx").on(
      table.organisationId,
      table.createdAt,
    ),
  ],
);
