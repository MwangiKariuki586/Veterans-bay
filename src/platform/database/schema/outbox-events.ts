import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    actorAccountId: uuid("actor_account_id").references(() => accountProfiles.id, {
      onDelete: "set null",
    }),
    correlationId: text("correlation_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimedBy: text("claimed_by"),
    lastErrorCategory: text("last_error_category"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "outbox_events_status_check",
      sql`${table.status} in ('pending', 'claimed', 'published', 'failed', 'dead_lettered')`,
    ),
    check("outbox_events_version_check", sql`${table.eventVersion} > 0`),
    check("outbox_events_attempt_count_check", sql`${table.attemptCount} >= 0`),
    index("outbox_events_claim_idx").on(table.status, table.availableAt),
    index("outbox_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("outbox_events_organisation_idx").on(table.organisationId),
  ],
);
