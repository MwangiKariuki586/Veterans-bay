import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
    assignedJobsOnly: boolean("assigned_jobs_only").notNull().default(false),
    financialDataAccess: boolean("financial_data_access").notNull().default(false),
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

export const organisationInvitations = pgTable(
  "organisation_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("pending"),
    assignedJobsOnly: boolean("assigned_jobs_only").notNull().default(false),
    financialDataAccess: boolean("financial_data_access").notNull().default(false),
    invitedByAccountId: uuid("invited_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    acceptedByAccountId: uuid("accepted_by_account_id").references(
      () => accountProfiles.id,
      { onDelete: "restrict" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
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
      "organisation_invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'revoked')`,
    ),
    uniqueIndex("organisation_invitations_pending_email_unique")
      .on(table.organisationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index("organisation_invitations_org_status_idx").on(
      table.organisationId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const organisationMembershipHistory = pgTable(
  "organisation_membership_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "organisation_membership_history_from_status_check",
      sql`${table.fromStatus} is null or ${table.fromStatus} in ('active', 'suspended', 'removed')`,
    ),
    check(
      "organisation_membership_history_to_status_check",
      sql`${table.toStatus} in ('active', 'suspended', 'removed')`,
    ),
    index("organisation_membership_history_member_idx").on(
      table.membershipId,
      table.createdAt,
    ),
    index("organisation_membership_history_org_idx").on(
      table.organisationId,
      table.createdAt,
    ),
  ],
);

export const organisationMembershipRoleHistory = pgTable(
  "organisation_membership_role_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    fromRoleId: uuid("from_role_id").references(() => roles.id, {
      onDelete: "restrict",
    }),
    toRoleId: uuid("to_role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("organisation_membership_role_history_member_idx").on(
      table.membershipId,
      table.createdAt,
    ),
    index("organisation_membership_role_history_org_idx").on(
      table.organisationId,
      table.createdAt,
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
