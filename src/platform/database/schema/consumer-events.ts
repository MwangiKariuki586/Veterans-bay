import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { organisations } from "./organisations";

export const processedEvents = pgTable(
  "processed_events",
  {
    eventId: uuid("event_id").notNull(),
    consumerName: text("consumer_name").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.consumerName] }),
    index("processed_events_consumer_idx").on(
      table.consumerName,
      table.processedAt,
    ),
  ],
);

export const deadLetterEvents = pgTable(
  "dead_letter_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull(),
    consumerName: text("consumer_name").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    failureCategory: text("failure_category").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    resolutionState: text("resolution_state").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "dead_letter_events_resolution_check",
      sql`${table.resolutionState} in ('open', 'retried', 'discarded')`,
    ),
    check(
      "dead_letter_events_attempt_count_check",
      sql`${table.attemptCount} >= 0`,
    ),
    index("dead_letter_events_open_idx").on(
      table.resolutionState,
      table.createdAt,
    ),
    unique("dead_letter_events_event_consumer_unique").on(
      table.eventId,
      table.consumerName,
    ),
  ],
);

/** Side-effect table proving duplicate queue delivery creates one effect. */
export const outboxProofEffects = pgTable(
  "outbox_proof_effects",
  {
    eventId: uuid("event_id").primaryKey(),
    marker: text("marker").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const eventProcessingAttempts = pgTable(
  "event_processing_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull(),
    consumerName: text("consumer_name").notNull(),
    eventType: text("event_type").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: text("outcome").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "event_processing_attempts_outcome_check",
      sql`${table.outcome} in ('ack','duplicate','retry','dead_letter')`,
    ),
    check(
      "event_processing_attempts_values_check",
      sql`${table.attemptNumber} > 0 and ${table.durationMs} >= 0`,
    ),
    index("event_processing_attempts_consumer_idx").on(
      table.consumerName,
      table.createdAt,
    ),
    index("event_processing_attempts_event_idx").on(
      table.eventId,
      table.createdAt,
    ),
  ],
);

export const analyticsDailyCounts = pgTable(
  "analytics_daily_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    day: date("day").notNull(),
    eventType: text("event_type").notNull(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    scopeKey: text("scope_key").notNull(),
    eventCount: integer("event_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("analytics_daily_counts_scope_unique").on(
      table.day,
      table.eventType,
      table.scopeKey,
    ),
    check(
      "analytics_daily_counts_value_check",
      sql`${table.eventCount} >= 0`,
    ),
    index("analytics_daily_counts_range_idx").on(
      table.day,
      table.eventType,
    ),
    index("analytics_daily_counts_org_idx").on(
      table.organisationId,
      table.day,
    ),
  ],
);
