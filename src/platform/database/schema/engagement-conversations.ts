import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { fileAssets } from "./file-assets";

export const engagementConversations = pgTable(
  "engagement_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contextType: text("context_type").notNull(),
    contextId: text("context_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("engagement_conversations_context_unique").on(
      table.contextType,
      table.contextId,
    ),
    check(
      "engagement_conversations_context_type_check",
      sql`${table.contextType} in ('SERVICE_REQUEST', 'QUOTATION', 'BOOKING', 'JOB', 'WARRANTY_CLAIM', 'DISPUTE')`,
    ),
    index("engagement_conversations_context_idx").on(
      table.contextType,
      table.contextId,
    ),
  ],
);

export const engagementMessages = pgTable(
  "engagement_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => engagementConversations.id, { onDelete: "restrict" }),
    senderAccountId: uuid("sender_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    senderRole: text("sender_role").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("engagement_messages_sender_idempotency_unique").on(
      table.conversationId,
      table.senderAccountId,
      table.senderRole,
      table.idempotencyKey,
    ),
    check(
      "engagement_messages_sender_role_check",
      sql`${table.senderRole} in ('CLIENT', 'PROFESSIONAL')`,
    ),
    check(
      "engagement_messages_body_check",
      sql`char_length(${table.body}) between 1 and 4000`,
    ),
    index("engagement_messages_timeline_idx").on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const engagementMessageAttachments = pgTable(
  "engagement_message_attachments",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => engagementMessages.id, { onDelete: "restrict" }),
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
    primaryKey({ columns: [table.messageId, table.assetId] }),
    unique("engagement_message_attachments_asset_unique").on(table.assetId),
    index("engagement_message_attachments_message_idx").on(table.messageId),
  ],
);

export const engagementConversationReads = pgTable(
  "engagement_conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => engagementConversations.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    participantRole: text("participant_role").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [
        table.conversationId,
        table.accountId,
        table.participantRole,
      ],
    }),
    check(
      "engagement_conversation_reads_participant_role_check",
      sql`${table.participantRole} in ('CLIENT', 'PROFESSIONAL')`,
    ),
    index("engagement_conversation_reads_account_idx").on(
      table.accountId,
      table.updatedAt,
    ),
  ],
);

export const engagementActivities = pgTable(
  "engagement_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => engagementConversations.id, { onDelete: "restrict" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    activityType: text("activity_type").notNull(),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("engagement_activities_source_unique").on(
      table.conversationId,
      table.sourceType,
      table.sourceId,
    ),
    index("engagement_activities_timeline_idx").on(
      table.conversationId,
      table.occurredAt,
      table.id,
    ),
  ],
);
