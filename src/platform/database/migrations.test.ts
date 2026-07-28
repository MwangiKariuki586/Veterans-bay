import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";

import { calculateQuotationTotals } from "../../modules/quotations/calculations";
import { QuotationsRepository } from "../../modules/quotations/repository";
import type { QuotationDraftValues } from "../../modules/quotations/types";
import { createDatabaseClient } from "./client";
import { configureNodeDatabaseRuntime } from "./node-runtime";
import { accountProfiles } from "./schema/account-profiles";
import { bookings } from "./schema/commercial";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { serviceRequests } from "./schema/service-requests";
import { requireTestDatabaseUrl } from "./testing/helpers";

config();

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationDirectory = path.join(repositoryRoot, "drizzle");
const migrationJournalPath = path.join(migrationDirectory, "meta", "_journal.json");

async function migrationSqlPaths() {
  const journal = JSON.parse(await readFile(migrationJournalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map((entry) =>
    path.join(migrationDirectory, `${entry.tag}.sql`),
  );
}

async function applySqlFile(connectionString: string, sqlFilePath: string) {
  configureNodeDatabaseRuntime();
  const pool = new Pool({ connectionString });
  const sql = await readFile(sqlFilePath, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }
  } finally {
    await pool.end();
  }
}

function toMigrationDatabaseUrl(baseUrl: string, databaseName: string) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

describe("database migrations", () => {
  it("creates a clean database from committed migrations and upgrades idempotently", async () => {
    const baseUrl = requireTestDatabaseUrl();
    const databaseName = `vb_migrate_${Date.now()}`;
    const migrationUrl = toMigrationDatabaseUrl(baseUrl, databaseName);

    configureNodeDatabaseRuntime();
    const adminPool = new Pool({ connectionString: baseUrl });

    try {
      await adminPool.query(`create database "${databaseName}"`);

      const migrationPaths = await migrationSqlPaths();
      for (const migrationPath of migrationPaths) {
        await applySqlFile(migrationUrl, migrationPath);
      }

      const verifyPool = new Pool({ connectionString: migrationUrl });
      try {
        const tables = await verifyPool.query<{ table_name: string }>(
          `select table_name
           from information_schema.tables
           where table_schema = 'public'
           order by table_name`,
        );

        expect(tables.rows.map((row) => row.table_name)).toEqual(
          expect.arrayContaining([
            "account_profiles",
            "outbox_events",
            "professional_profiles",
            "professional_onboarding_history",
            "professional_verification_documents",
            "organisation_invitations",
            "organisation_membership_history",
            "organisation_membership_role_history",
            "quotations",
            "quotation_versions",
            "quotation_line_items",
            "quotation_history",
            "bookings",
            "payment_requirements",
            "availability_rules",
            "availability_blocks",
            "booking_reservations",
            "booking_history",
            "notifications",
            "roles",
            "permissions",
          ]),
        );

        const reservationConstraint = await verifyPool.query<{
          constraint_name: string;
        }>(
          `select conname as constraint_name
           from pg_constraint
           where conname = 'booking_reservations_member_overlap_excl'
             and contype = 'x'`,
        );
        expect(reservationConstraint.rows).toEqual([
          {
            constraint_name:
              "booking_reservations_member_overlap_excl",
          },
        ]);

        const roleCount = await verifyPool.query<{ count: string }>(
          `select count(*)::text as count from roles`,
        );
        expect(Number(roleCount.rows[0]?.count)).toBe(7);

        const organisationRoleKeys = await verifyPool.query<{ key: string }>(
          `select key from roles where scope = 'organisation' order by key`,
        );
        expect(organisationRoleKeys.rows.map((row) => row.key)).toEqual([
          "accountant",
          "dispatcher",
          "manager",
          "owner",
          "receptionist",
          "technician",
        ]);

        const financialReportRoles = await verifyPool.query<{ key: string }>(
          `select r.key
           from roles r
           join role_permissions rp on rp.role_id = r.id
           join permissions p on p.id = rp.permission_id
           where r.scope = 'organisation' and p.key = 'reports.financial.view'
           order by r.key`,
        );
        expect(financialReportRoles.rows.map((row) => row.key)).toEqual([
          "accountant",
          "owner",
        ]);

        const permissionMatrix = await verifyPool.query<{
          role_key: string;
          permission_key: string;
        }>(
          `select r.key as role_key, p.key as permission_key
           from roles r
           join role_permissions rp on rp.role_id = r.id
           join permissions p on p.id = rp.permission_id
           where r.scope = 'organisation'
           order by r.key, p.key`,
        );
        const permissionsFor = (roleKey: string) =>
          permissionMatrix.rows
            .filter((row) => row.role_key === roleKey)
            .map((row) => row.permission_key);
        expect(permissionsFor("owner")).toHaveLength(20);
        expect(permissionsFor("manager")).toEqual(
          expect.arrayContaining([
            "organisation.members.manage",
            "assignments.manage",
            "jobs.manage",
          ]),
        );
        expect(permissionsFor("manager")).not.toContain("reports.financial.view");
        expect(permissionsFor("dispatcher")).toEqual(
          expect.arrayContaining(["bookings.manage", "assignments.manage"]),
        );
        expect(permissionsFor("technician")).toEqual([
          "customers.view",
          "jobs.manage",
          "jobs.view",
          "organisation.view",
        ]);
        expect(permissionsFor("receptionist")).toEqual(
          expect.arrayContaining(["enquiries.manage", "customers.manage"]),
        );
        expect(permissionsFor("accountant")).toEqual(
          expect.arrayContaining([
            "payments.manage",
            "reports.financial.view",
          ]),
        );

        const applicationClient = createDatabaseClient(migrationUrl);
        try {
          const marker = crypto.randomUUID();
          const [clientAccount, professionalAccount] =
            await applicationClient.db
              .insert(accountProfiles)
              .values([
                {
                  authUserId: `migration-quote-client-${marker}`,
                  displayName: "Migration Quote Client",
                  primaryEmail: `migration-quote-client-${marker}@example.com`,
                },
                {
                  authUserId: `migration-quote-pro-${marker}`,
                  displayName: "Migration Quote Professional",
                  primaryEmail: `migration-quote-pro-${marker}@example.com`,
                },
              ])
              .returning();
          const [organisation] = await applicationClient.db
            .insert(organisations)
            .values({
              name: "Migration Quote Provider",
              slug: `migration-quote-provider-${marker}`,
              status: "active",
            })
            .returning();
          const [request] = await applicationClient.db
            .insert(serviceRequests)
            .values({
              clientAccountId: clientAccount.id,
              organisationId: organisation.id,
              idempotencyKey: crypto.randomUUID(),
              source: "PROFESSIONAL_BOOKING_LINK",
              category: "Plumbing",
              status: "UNDER_REVIEW",
              currency: "KES",
            })
            .returning();
          const values: QuotationDraftValues = {
            currency: "KES",
            lineItems: [
              {
                category: "LABOUR",
                description: "Concurrency-tested labour",
                quantity: 1,
                unitPriceMinor: 10_000,
              },
            ],
            discountMinor: 0,
            taxMinor: 0,
            depositMinor: 2_000,
            expectedDurationMinutes: 60,
            proposedStartAt: null,
            validUntil: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1_000,
            ).toISOString(),
            scope: "Complete the concurrency-tested quotation scope.",
            exclusions: "No unrelated work.",
            warrantyTerms: "Thirty-day workmanship warranty.",
            paymentTerms: "Deposit then balance.",
          };
          const repository = new QuotationsRepository(applicationClient.db);
          const draft = await repository.createDraft({
            organisationId: organisation.id,
            actorAccountId: professionalAccount.id,
            requestId: request.id,
            mutation: {
              values,
              totals: calculateQuotationTotals(values),
            },
          });
          const submitted = await repository.submit({
            organisationId: organisation.id,
            actorAccountId: professionalAccount.id,
            quotationId: draft!.id,
            expectedLockVersion: draft!.lockVersion,
          });
          const viewed = await repository.markViewed({
            clientAccountId: clientAccount.id,
            quotationId: draft!.id,
          });
          expect(submitted).not.toBeNull();

          const concurrent = await Promise.all([
            repository.accept({
              clientAccountId: clientAccount.id,
              quotationId: draft!.id,
              expectedLockVersion: viewed!.lockVersion,
              correlationId: "concurrent-accept-a",
            }),
            repository.accept({
              clientAccountId: clientAccount.id,
              quotationId: draft!.id,
              expectedLockVersion: viewed!.lockVersion,
              correlationId: "concurrent-accept-b",
            }),
          ]);
          expect(concurrent.filter(Boolean)).toHaveLength(1);
          const persistedBookings = await applicationClient.db
            .select()
            .from(bookings);
          expect(persistedBookings).toHaveLength(1);
          const acceptanceEvents = await applicationClient.db
            .select()
            .from(outboxEvents);
          expect(
            acceptanceEvents.filter(
              (event) => event.eventType === "quotation.accepted",
            ),
          ).toHaveLength(1);
        } finally {
          await applicationClient.close();
        }

        // Upgrade path from the current repository state: re-running schema
        // creation is rejected, proving applied migrations are not rewritten
        // and a second clean apply is detectable.
        await expect(applySqlFile(migrationUrl, migrationPaths[0]!)).rejects.toThrow(
          /already exists/i,
        );
      } finally {
        await verifyPool.end();
      }
    } finally {
      await adminPool.query(`drop database "${databaseName}" with (force)`);
      await adminPool.end();
    }
  }, 300_000);

  it("keeps the committed migration SQL readable for review", async () => {
    const [migrationSqlPath] = await migrationSqlPaths();
    const sql = await readFile(migrationSqlPath!, "utf8");
    const scratch = await mkdtemp(path.join(tmpdir(), "vb-migration-"));

    try {
      const copyPath = path.join(scratch, "0000_deep_vector.sql");
      await writeFile(copyPath, sql, "utf8");
      const copied = await readFile(copyPath, "utf8");

      expect(copied).toContain('CREATE TABLE "account_profiles"');
      expect(copied).toContain('CREATE TABLE "outbox_events"');
      expect(copied).toContain("INSERT INTO \"roles\"");
    } finally {
      await rm(scratch, { force: true, recursive: true });
    }
  });
});
