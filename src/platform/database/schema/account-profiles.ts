import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accountProfiles = pgTable(
  "account_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    primaryEmail: text("primary_email").notNull().unique(),
    phone: text("phone"),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("active"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    personalDataRemovedAt: timestamp("personal_data_removed_at", {
      withTimezone: true,
    }),
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
      "account_profiles_status_check",
      sql`${table.status} in ('active', 'deactivated')`,
    ),
    index("account_profiles_status_idx").on(table.status),
  ],
);
