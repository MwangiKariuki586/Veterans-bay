import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";

export const marketplaceCategories = pgTable(
  "marketplace_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status").notNull().default("active"),
    createdByAccountId: uuid("created_by_account_id")
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
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
      "marketplace_categories_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    index("marketplace_categories_status_name_idx").on(
      table.status,
      table.name,
    ),
  ],
);
