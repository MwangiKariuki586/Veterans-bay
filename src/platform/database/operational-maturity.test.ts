import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { AdministrationRepository } from "../../modules/administration/repository";
import {
  ANALYTICS_CONSUMER,
  AnalyticsConsumer,
} from "../../modules/analytics/consumer";
import { DashboardsRepository } from "../../modules/dashboards/repository";
import { IdentityRepository } from "../../modules/identity/repository";
import { OutboxRepository } from "../../modules/outbox/repository";
import { accountProfiles } from "./schema/account-profiles";
import {
  moderationCaseHistory,
  moderationCases,
  moderationReports,
} from "./schema/administration";
import { auditEvents } from "./schema/audit-events";
import {
  analyticsDailyCounts,
  processedEvents,
} from "./schema/consumer-events";
import { outboxEvents } from "./schema/outbox-events";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

describe("operational maturity persistence", () => {
  it("opens and resolves a reasoned moderation case with enforcement atomically", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const [administrator, reporter, subject] = await testDb
          .insert(accountProfiles)
          .values([
            account("administrator"),
            account("reporter"),
            account("subject"),
          ])
          .returning();
        const repository = new AdministrationRepository(testDb);
        const report = await repository.submitReport({
          submittedByAccountId: reporter.id,
          category: "IDENTITY_CONCERN",
          subjectType: "ACCOUNT",
          subjectId: subject.id,
          summary: "Identity details do not match",
          details: "The supplied identity details conflict with the public profile.",
        });
        const moderationCase = await repository.openCase({
          reportId: report.id,
          actorAccountId: administrator.id,
          subjectAccountId: subject.id,
          priority: "HIGH",
          reason: "The identity concern requires evidence review.",
        });
        await repository.transitionCase({
          caseId: moderationCase.id,
          actorAccountId: administrator.id,
          action: "SUSPEND_ACCOUNT",
          reason: "Verification evidence confirms a material identity mismatch.",
          evidenceSummary:
            "The verification record and submitted account details were compared.",
        });

        const [storedCase, storedReport, history, audit, events] =
          await Promise.all([
            testDb
              .select()
              .from(moderationCases)
              .where(eq(moderationCases.id, moderationCase.id)),
            testDb
              .select()
              .from(moderationReports)
              .where(eq(moderationReports.id, report.id)),
            testDb
              .select()
              .from(moderationCaseHistory)
              .where(eq(moderationCaseHistory.caseId, moderationCase.id)),
            testDb
              .select()
              .from(auditEvents)
              .where(eq(auditEvents.entityId, moderationCase.id)),
            testDb
              .select()
              .from(outboxEvents)
              .where(eq(outboxEvents.aggregateId, moderationCase.id)),
          ]);
        expect(storedCase[0]).toMatchObject({
          status: "RESOLVED",
          resolution: "ACCOUNT_SUSPENDED",
        });
        expect(storedReport[0]?.status).toBe("RESOLVED");
        expect(history.map((item) => item.action)).toEqual([
          "OPEN",
          "SUSPEND_ACCOUNT",
        ]);
        expect(audit.map((item) => item.action)).toEqual([
          "moderation.case_opened",
          "account.suspended",
        ]);
        expect(events.map((item) => item.eventType)).toContain(
          "moderation.case_opened",
        );
      });
    });
  });

  it("anonymises editable profile data while preserving audit and event history", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const [profile] = await testDb
          .insert(accountProfiles)
          .values(account("deactivation"))
          .returning();
        const repository = new IdentityRepository(testDb);
        const result = await repository.deactivateProfile(
          profile.id,
          "privacy-test",
        );
        const [audit, event] = await Promise.all([
          testDb
            .select()
            .from(auditEvents)
            .where(
              and(
                eq(auditEvents.entityId, profile.id),
                eq(auditEvents.action, "user.deactivated"),
              ),
            ),
          testDb
            .select()
            .from(outboxEvents)
            .where(
              and(
                eq(outboxEvents.aggregateId, profile.id),
                eq(outboxEvents.eventType, "user.deactivated"),
              ),
            ),
        ]);
        expect(result).toMatchObject({
          displayName: "Deactivated account",
          phone: null,
          status: "deactivated",
        });
        expect(result.primaryEmail).toContain("@deleted.veteransbay.invalid");
        expect(result.personalDataRemovedAt).toBeInstanceOf(Date);
        expect(audit).toHaveLength(1);
        expect(event).toHaveLength(1);
      });
    });
  });

  it("projects analytics idempotently and exposes bounded dashboard and async diagnostics", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const [profile] = await testDb
          .insert(accountProfiles)
          .values(account("dashboard"))
          .returning();
        const outbox = new OutboxRepository(testDb);
        const consumer = new AnalyticsConsumer(testDb, outbox);
        const event = {
          eventId: crypto.randomUUID(),
          eventType: "service_request.submitted",
          eventVersion: 1,
          aggregateType: "service_request",
          aggregateId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
          payload: {},
        };
        await expect(consumer.handleMessage(event)).resolves.toBe("ack");
        await expect(consumer.handleMessage(event)).resolves.toBe("duplicate");
        const [projection, processed, dashboard] = await Promise.all([
          testDb
            .select()
            .from(analyticsDailyCounts)
            .where(
              and(
                eq(analyticsDailyCounts.day, event.occurredAt.slice(0, 10)),
                eq(analyticsDailyCounts.eventType, event.eventType),
                eq(analyticsDailyCounts.scopeKey, "platform"),
              ),
            ),
          testDb
            .select()
            .from(processedEvents)
            .where(
              and(
                eq(processedEvents.eventId, event.eventId),
                eq(processedEvents.consumerName, ANALYTICS_CONSUMER),
              ),
            ),
          new DashboardsRepository(testDb).client(profile.id),
        ]);
        await outbox.recordProcessingAttempt({
          eventId: event.eventId,
          consumerName: ANALYTICS_CONSUMER,
          eventType: event.eventType,
          attemptNumber: 1,
          outcome: "ack",
          durationMs: 4,
        });
        const diagnostics = await outbox.diagnostics();
        expect(projection).toHaveLength(1);
        expect(projection[0]?.eventCount).toBe(1);
        expect(processed).toHaveLength(1);
        expect(dashboard.metrics.active_requests).toBe(0);
        expect(diagnostics.consumers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ consumerName: ANALYTICS_CONSUMER }),
          ]),
        );
      });
    });
  });
});

function account(suffix: string) {
  const id = crypto.randomUUID();
  return {
    authUserId: `operational-${suffix}-${id}`,
    displayName: `Operational ${suffix}`,
    primaryEmail: `operational-${suffix}-${id}@example.com`,
    phone: "+254700000000",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  };
}
