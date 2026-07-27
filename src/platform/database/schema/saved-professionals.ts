import {
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const savedProfessionals = pgTable(
  "saved_professionals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountProfileId: uuid("account_profile_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("saved_professionals_account_org_unique").on(
      table.accountProfileId,
      table.organisationId,
    ),
    index("saved_professionals_account_created_idx").on(
      table.accountProfileId,
      table.createdAt,
    ),
    index("saved_professionals_organisation_idx").on(table.organisationId),
  ],
);
