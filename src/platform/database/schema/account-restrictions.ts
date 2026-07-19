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

export const accountRestrictions = pgTable(
  "account_restrictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountProfileId: uuid("account_profile_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdByAccountId: uuid("created_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
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
      "account_restrictions_type_check",
      sql`${table.type} in ('suspended', 'banned')`,
    ),
    index("account_restrictions_account_idx").on(table.accountProfileId),
    index("account_restrictions_active_idx").on(
      table.accountProfileId,
      table.startsAt,
      table.endsAt,
    ),
  ],
);
