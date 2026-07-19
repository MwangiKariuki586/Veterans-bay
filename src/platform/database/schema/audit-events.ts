import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorAccountId: uuid("actor_account_id").references(() => accountProfiles.id, {
      onDelete: "set null",
    }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    correlationId: text("correlation_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_actor_idx").on(table.actorAccountId, table.createdAt),
    index("audit_events_organisation_idx").on(table.organisationId, table.createdAt),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);
