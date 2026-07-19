import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cloudinaryPublicId: text("cloudinary_public_id").notNull().unique(),
    purpose: text("purpose").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    visibility: text("visibility").notNull().default("private"),
    ownerAccountId: uuid("owner_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    linkedEntityType: text("linked_entity_type"),
    linkedEntityId: text("linked_entity_id"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "file_assets_visibility_check",
      sql`${table.visibility} in ('public', 'private')`,
    ),
    check(
      "file_assets_status_check",
      sql`${table.status} in ('pending', 'ready', 'replaced', 'deleted')`,
    ),
    check("file_assets_size_bytes_check", sql`${table.sizeBytes} >= 0`),
    index("file_assets_owner_idx").on(table.ownerAccountId),
    index("file_assets_organisation_idx").on(table.organisationId),
    index("file_assets_linked_entity_idx").on(
      table.linkedEntityType,
      table.linkedEntityId,
    ),
  ],
);
