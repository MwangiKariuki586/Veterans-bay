import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
