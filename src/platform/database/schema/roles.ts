import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { organisations } from "./organisations";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    scope: text("scope").notNull(),
    name: text("name").notNull(),
    description: text("description"),
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
      "roles_scope_check",
      sql`${table.scope} in ('organisation', 'platform')`,
    ),
    unique("roles_scope_key_unique").on(table.scope, table.key),
    index("roles_scope_idx").on(table.scope),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("permissions_key_idx").on(table.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
      name: "role_permissions_pk",
    }),
  ],
);

export const organisationMemberships = pgTable(
  "organisation_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    accountProfileId: uuid("account_profile_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
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
      "organisation_memberships_status_check",
      sql`${table.status} in ('active', 'suspended', 'removed')`,
    ),
    unique("organisation_memberships_org_account_unique").on(
      table.organisationId,
      table.accountProfileId,
    ),
    index("organisation_memberships_account_idx").on(table.accountProfileId),
    index("organisation_memberships_org_status_idx").on(
      table.organisationId,
      table.status,
    ),
  ],
);

export const platformRoleAssignments = pgTable(
  "platform_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountProfileId: uuid("account_profile_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
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
      "platform_role_assignments_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    unique("platform_role_assignments_account_role_unique").on(
      table.accountProfileId,
      table.roleId,
    ),
    index("platform_role_assignments_account_idx").on(table.accountProfileId),
  ],
);
