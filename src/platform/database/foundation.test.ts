import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accountProfiles } from "./schema/account-profiles";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { organisationMemberships, roles } from "./schema/roles";
import {
  assertDatabaseConnected,
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("database foundation", () => {
  it("connects with the Cloudflare-compatible Neon client", async () => {
    await withTestDatabase(async ({ db }) => {
      await assertDatabaseConnected(db);
    });
  });

  it("enforces foundational unique and check constraints", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (tx) => {
        await tx.insert(accountProfiles).values({
          authUserId: "auth-user-constraint-1",
          displayName: "Constraint User",
          primaryEmail: "constraint-user@example.com",
        });

        await expect(
          tx.insert(accountProfiles).values({
            authUserId: "auth-user-constraint-1",
            displayName: "Duplicate Auth User",
            primaryEmail: "other@example.com",
          }),
        ).rejects.toThrow(/unique|duplicate|Failed query/i);

        await expect(
          tx.insert(organisations).values({
            name: "Invalid Org",
            slug: "invalid-org",
            status: "not-a-status",
          }),
        ).rejects.toThrow(/check|violates|Failed query/i);
      });
    });
  });

  it("rolls back dependent writes atomically", async () => {
    const markerEmail = `rollback-${crypto.randomUUID()}@example.com`;

    await withTestDatabase(async ({ db }) => {
      await expect(
        db.transaction(async (tx) => {
          const [profile] = await tx
            .insert(accountProfiles)
            .values({
              authUserId: `auth-${crypto.randomUUID()}`,
              displayName: "Rollback User",
              primaryEmail: markerEmail,
            })
            .returning();

          const [organisation] = await tx
            .insert(organisations)
            .values({
              name: "Rollback Org",
              slug: `rollback-org-${crypto.randomUUID()}`,
              status: "draft",
            })
            .returning();

          const [ownerRole] = await tx
            .select()
            .from(roles)
            .where(eq(roles.key, "owner"))
            .limit(1);

          expect(ownerRole).toBeDefined();

          await tx.insert(organisationMemberships).values({
            organisationId: organisation.id,
            accountProfileId: profile.id,
            roleId: ownerRole!.id,
            status: "active",
          });

          await tx.insert(outboxEvents).values({
            eventType: "system.database_proof",
            eventVersion: 1,
            aggregateType: "organisation",
            aggregateId: organisation.id,
            organisationId: organisation.id,
            actorAccountId: profile.id,
            payload: { proof: true },
          });

          throw new Error("forced-rollback");
        }),
      ).rejects.toThrow("forced-rollback");

      const remaining = await db
        .select({ id: accountProfiles.id })
        .from(accountProfiles)
        .where(eq(accountProfiles.primaryEmail, markerEmail));

      expect(remaining).toEqual([]);
    });
  });

  it("exposes foundational Phase 00 tables and role seeds", async () => {
    await withTestDatabase(async ({ db }) => {
      const tables = await db.execute<{ table_name: string }>(sql`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'account_profiles',
            'account_restrictions',
            'organisations',
            'organisation_memberships',
            'roles',
            'permissions',
            'role_permissions',
            'platform_role_assignments',
            'audit_events',
            'file_assets',
            'outbox_events'
          )
        order by table_name
      `);

      const tableNames = tables.rows.map((row) => row.table_name);

      expect(tableNames).toEqual([
        "account_profiles",
        "account_restrictions",
        "audit_events",
        "file_assets",
        "organisation_memberships",
        "organisations",
        "outbox_events",
        "permissions",
        "platform_role_assignments",
        "role_permissions",
        "roles",
      ]);

      const seededRoles = await db.select({ key: roles.key, scope: roles.scope }).from(roles);

      expect(seededRoles).toEqual(
        expect.arrayContaining([
          { key: "owner", scope: "organisation" },
          { key: "manager", scope: "organisation" },
          { key: "dispatcher", scope: "organisation" },
          { key: "receptionist", scope: "organisation" },
          { key: "accountant", scope: "organisation" },
          { key: "technician", scope: "organisation" },
          { key: "platform_admin", scope: "platform" },
        ]),
      );
    });
  });
});
