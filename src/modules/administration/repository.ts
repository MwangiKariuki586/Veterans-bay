import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import {
  disputes,
  moderationCaseEvidence,
  moderationCaseHistory,
  moderationCases,
  moderationReports,
  platformRules,
} from "../../platform/database/schema/administration";
import { accountRestrictions } from "../../platform/database/schema/account-restrictions";
import { auditEvents } from "../../platform/database/schema/audit-events";
import { fileAssets } from "../../platform/database/schema/file-assets";
import {
  jobHistory,
  jobs,
} from "../../platform/database/schema/fulfilment";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  reviewModerationHistory,
  reviewReports,
  reviews,
} from "../../platform/database/schema/reviews";
import {
  warranties,
  warrantyClaimHistory,
  warrantyClaims,
} from "../../platform/database/schema/warranties";
import { AppError } from "../../platform/errors/app-error";

type PageInput = { page: number; pageSize: number };

export class AdministrationRepository {
  constructor(private readonly db: Database) {}

  async submitReport(input: {
    submittedByAccountId: string;
    organisationId?: string | null;
    category: string;
    subjectType: string;
    subjectId: string;
    summary: string;
    details: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [report] = await tx
        .insert(moderationReports)
        .values(input)
        .returning();
      await tx.insert(outboxEvents).values({
        eventType: "report.submitted",
        eventVersion: 1,
        aggregateType: "moderation_report",
        aggregateId: report.id,
        organisationId: report.organisationId,
        actorAccountId: input.submittedByAccountId,
        correlationId: input.correlationId,
        payload: {
          category: report.category,
          subjectType: report.subjectType,
          subjectId: report.subjectId,
        },
      });
      return report;
    });
  }

  async listReports(input: PageInput & { status: string }) {
    const filter =
      input.status === "all"
        ? undefined
        : eq(moderationReports.status, input.status);
    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(moderationReports)
        .where(filter)
        .orderBy(asc(moderationReports.createdAt), asc(moderationReports.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db.select({ value: count() }).from(moderationReports).where(filter),
    ]);
    return { items, totalItems: totals[0]?.value ?? 0 };
  }

  async openCase(input: {
    reportId: string;
    actorAccountId: string;
    subjectAccountId?: string | null;
    priority: string;
    reason: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [report] = await tx
        .update(moderationReports)
        .set({ status: "IN_REVIEW", updatedAt: new Date() })
        .where(
          and(
            eq(moderationReports.id, input.reportId),
            eq(moderationReports.status, "OPEN"),
          ),
        )
        .returning();
      if (!report) {
        throw new AppError({
          code: "INVALID_REPORT_TRANSITION",
          message: "The report is not available to open.",
          status: 409,
        });
      }
      const [moderationCase] = await tx
        .insert(moderationCases)
        .values({
          reportId: report.id,
          organisationId: report.organisationId,
          subjectAccountId: input.subjectAccountId,
          caseType: report.category,
          subjectType: report.subjectType,
          subjectId: report.subjectId,
          priority: input.priority,
          openedByAccountId: input.actorAccountId,
          assignedToAccountId: input.actorAccountId,
        })
        .returning();
      await tx.insert(moderationCaseHistory).values({
        caseId: moderationCase.id,
        actorAccountId: input.actorAccountId,
        action: "OPEN",
        toStatus: "OPEN",
        reason: input.reason,
      });
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: report.organisationId,
        action: "moderation.case_opened",
        entityType: "moderation_case",
        entityId: moderationCase.id,
        correlationId: input.correlationId,
        metadata: { reportId: report.id, reason: input.reason },
      });
      await tx.insert(outboxEvents).values({
        eventType: "moderation.case_opened",
        eventVersion: 1,
        aggregateType: "moderation_case",
        aggregateId: moderationCase.id,
        organisationId: report.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { reportId: report.id },
      });
      return moderationCase;
    });
  }

  async listCases(input: PageInput & { status: string }) {
    const filter =
      input.status === "all"
        ? undefined
        : eq(moderationCases.status, input.status);
    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(moderationCases)
        .where(filter)
        .orderBy(
          desc(moderationCases.priority),
          asc(moderationCases.openedAt),
          asc(moderationCases.id),
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db.select({ value: count() }).from(moderationCases).where(filter),
    ]);
    return { items, totalItems: totals[0]?.value ?? 0 };
  }

  async getCase(caseId: string) {
    const [moderationCase] = await this.db
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, caseId))
      .limit(1);
    if (!moderationCase) return null;
    const [history, evidence] = await Promise.all([
      this.db
        .select()
        .from(moderationCaseHistory)
        .where(eq(moderationCaseHistory.caseId, caseId))
        .orderBy(
          asc(moderationCaseHistory.createdAt),
          asc(moderationCaseHistory.id),
        ),
      this.db
        .select({
          assetId: moderationCaseEvidence.assetId,
          purpose: moderationCaseEvidence.purpose,
          mimeType: fileAssets.mimeType,
          status: fileAssets.status,
          createdAt: moderationCaseEvidence.createdAt,
        })
        .from(moderationCaseEvidence)
        .innerJoin(fileAssets, eq(fileAssets.id, moderationCaseEvidence.assetId))
        .where(eq(moderationCaseEvidence.caseId, caseId))
        .orderBy(asc(moderationCaseEvidence.createdAt)),
    ]);
    return { case: moderationCase, history, evidence };
  }

  async transitionCase(input: {
    caseId: string;
    actorAccountId: string;
    action: string;
    reason: string;
    evidenceSummary?: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(moderationCases)
        .where(eq(moderationCases.id, input.caseId))
        .limit(1);
      if (!current || ["RESOLVED", "DISMISSED"].includes(current.status)) {
        throw new AppError({
          code: "INVALID_MODERATION_CASE_TRANSITION",
          message: "The moderation case cannot take this action.",
          status: 409,
        });
      }
      const transition = caseTransition(input.action);
      if (transition.final && !input.evidenceSummary) {
        throw new AppError({
          code: "EVIDENCE_REQUIRED",
          message: "An evidence summary is required for a final decision.",
          status: 422,
        });
      }
      const now = new Date();
      const [updated] = await tx
        .update(moderationCases)
        .set({
          status: transition.status,
          resolution: transition.final ? transition.resolution : null,
          decisionReason: transition.final ? input.reason : null,
          evidenceSummary: transition.final ? input.evidenceSummary : null,
          resolvedAt: transition.final ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(moderationCases.id, input.caseId),
            eq(moderationCases.status, current.status),
          ),
        )
        .returning();
      if (!updated) throw conflict();

      let eventType = transition.final ? "moderation.case_resolved" : "moderation.case_updated";
      if (input.action === "HIDE_REVIEW") {
        const [review] = await tx
          .update(reviews)
          .set({
            status: "HIDDEN",
            moderationReason: input.reason,
            moderatedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(reviews.id, current.subjectId),
              or(eq(reviews.status, "REPORTED"), eq(reviews.status, "PUBLISHED")),
            ),
          )
          .returning();
        if (!review) throw linkedRecordConflict("review");
        await tx.insert(reviewModerationHistory).values({
          reviewId: review.id,
          actorAccountId: input.actorAccountId,
          action: "HIDDEN",
          fromStatus: current.status,
          toStatus: "HIDDEN",
          reason: input.reason,
        });
        await tx
          .update(reviewReports)
          .set({ status: "RESOLVED", resolvedAt: now })
          .where(eq(reviewReports.reviewId, review.id));
        eventType = "review.moderated";
      } else if (
        input.action === "DISMISS" &&
        current.subjectType === "REVIEW"
      ) {
        const [review] = await tx
          .update(reviews)
          .set({
            status: "PUBLISHED",
            reportedAt: null,
            moderationReason: input.reason,
            moderatedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(reviews.id, current.subjectId),
              eq(reviews.status, "REPORTED"),
            ),
          )
          .returning();
        if (!review) throw linkedRecordConflict("review");
        await tx.insert(reviewModerationHistory).values({
          reviewId: review.id,
          actorAccountId: input.actorAccountId,
          action: "REPORT_DISMISSED",
          fromStatus: "REPORTED",
          toStatus: "PUBLISHED",
          reason: input.reason,
        });
        await tx
          .update(reviewReports)
          .set({ status: "DISMISSED", resolvedAt: now })
          .where(eq(reviewReports.reviewId, review.id));
        eventType = "review.report_dismissed";
      } else if (input.action === "SUSPEND_ACCOUNT") {
        if (!current.subjectAccountId) throw linkedRecordConflict("account");
        await tx.insert(accountRestrictions).values({
          accountProfileId: current.subjectAccountId,
          type: "suspended",
          reason: input.reason,
          createdByAccountId: input.actorAccountId,
        });
        eventType = "account.suspended";
      } else if (input.action === "RESTORE_ACCOUNT") {
        if (!current.subjectAccountId) throw linkedRecordConflict("account");
        const restored = await tx
          .update(accountRestrictions)
          .set({ endsAt: now, updatedAt: now })
          .where(
            and(
              eq(accountRestrictions.accountProfileId, current.subjectAccountId),
              eq(accountRestrictions.type, "suspended"),
              isNull(accountRestrictions.endsAt),
            ),
          )
          .returning({ id: accountRestrictions.id });
        if (restored.length === 0) throw linkedRecordConflict("restriction");
        eventType = "account.restored";
      }
      await tx.insert(moderationCaseHistory).values({
        caseId: current.id,
        actorAccountId: input.actorAccountId,
        action: input.action,
        fromStatus: current.status,
        toStatus: transition.status,
        reason: input.reason,
        metadata: { evidenceSummary: input.evidenceSummary ?? null },
      });
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: current.organisationId,
        action: eventType,
        entityType: "moderation_case",
        entityId: current.id,
        correlationId: input.correlationId,
        metadata: {
          fromStatus: current.status,
          toStatus: transition.status,
          reason: input.reason,
          evidenceSummary: input.evidenceSummary ?? null,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType,
        eventVersion: 1,
        aggregateType:
          input.action === "HIDE_REVIEW" ? "review" : "moderation_case",
        aggregateId:
          input.action === "HIDE_REVIEW" ? current.subjectId : current.id,
        organisationId: current.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          subjectAccountId: current.subjectAccountId,
          subjectType: current.subjectType,
          subjectId: current.subjectId,
          resolution: transition.resolution,
        },
      });
      if (current.reportId && transition.final) {
        await tx
          .update(moderationReports)
          .set({
            status: transition.status === "DISMISSED" ? "DISMISSED" : "RESOLVED",
            updatedAt: now,
          })
          .where(
            current.subjectType === "REVIEW"
              ? and(
                  eq(moderationReports.subjectType, "REVIEW"),
                  eq(moderationReports.subjectId, current.subjectId),
                )
              : eq(moderationReports.id, current.reportId),
          );
      }
      return updated;
    });
  }

  async listDisputes(input: PageInput & { status: string }) {
    const filter =
      input.status === "all" ? undefined : eq(disputes.status, input.status);
    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(disputes)
        .where(filter)
        .orderBy(asc(disputes.openedAt), asc(disputes.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db.select({ value: count() }).from(disputes).where(filter),
    ]);
    return { items, totalItems: totals[0]?.value ?? 0 };
  }

  async openDispute(input: {
    jobId: string;
    clientAccountId: string;
    reason: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.clientAccountId, input.clientAccountId),
          ),
        )
        .limit(1);
      if (
        !job ||
        ![
          "AWAITING_CLIENT_CONFIRMATION",
          "COMPLETED",
          "RETURN_VISIT_REQUIRED",
        ].includes(job.status)
      ) {
        throw conflict("This job is not eligible for a dispute.");
      }
      const [created] = await tx
        .insert(disputes)
        .values({
          jobId: job.id,
          organisationId: job.organisationId,
          clientAccountId: job.clientAccountId,
          openedByAccountId: input.clientAccountId,
          reason: input.reason,
        })
        .onConflictDoNothing({ target: disputes.jobId })
        .returning();
      if (!created) throw conflict("A dispute already exists for this job.");
      await tx
        .update(jobs)
        .set({
          status: "DISPUTED",
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, job.id), eq(jobs.status, job.status)));
      await tx.insert(jobHistory).values({
        jobId: job.id,
        actorAccountId: input.clientAccountId,
        action: "DISPUTE_OPENED",
        fromStatus: job.status,
        toStatus: "DISPUTED",
        reason: input.reason,
      });
      await tx.insert(auditEvents).values({
        actorAccountId: input.clientAccountId,
        organisationId: job.organisationId,
        action: "dispute.opened",
        entityType: "dispute",
        entityId: created.id,
        correlationId: input.correlationId,
        metadata: { jobId: job.id, reason: input.reason },
      });
      await tx.insert(outboxEvents).values({
        eventType: "dispute.opened",
        eventVersion: 1,
        aggregateType: "dispute",
        aggregateId: created.id,
        organisationId: job.organisationId,
        actorAccountId: input.clientAccountId,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: job.clientAccountId,
          jobId: job.id,
        },
      });
      return created;
    });
  }

  async transitionDispute(input: {
    disputeId: string;
    actorAccountId: string;
    action: string;
    reason: string;
    evidenceSummary?: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(disputes)
        .where(eq(disputes.id, input.disputeId))
        .limit(1);
      if (!current || ["RESOLVED", "DISMISSED"].includes(current.status)) {
        throw conflict("The dispute cannot take this action.");
      }
      const transition = disputeTransition(input.action);
      if (transition.final && !input.evidenceSummary) {
        throw new AppError({
          code: "EVIDENCE_REQUIRED",
          message: "An evidence summary is required for a final decision.",
          status: 422,
        });
      }
      const now = new Date();
      const [updated] = await tx
        .update(disputes)
        .set({
          status: transition.status,
          assignedToAccountId: input.actorAccountId,
          resolution: transition.final ? transition.resolution : null,
          decisionReason: transition.final ? input.reason : null,
          evidenceSummary: transition.final ? input.evidenceSummary : null,
          resolvedAt: transition.final ? now : null,
          updatedAt: now,
        })
        .where(and(eq(disputes.id, current.id), eq(disputes.status, current.status)))
        .returning();
      if (!updated) throw conflict();
      if (transition.final) {
        await tx
          .update(jobs)
          .set({ status: "COMPLETED", updatedAt: now })
          .where(and(eq(jobs.id, current.jobId), eq(jobs.status, "DISPUTED")));
      }
      const eventType = transition.final ? "dispute.resolved" : "dispute.updated";
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: current.organisationId,
        action: eventType,
        entityType: "dispute",
        entityId: current.id,
        correlationId: input.correlationId,
        metadata: {
          fromStatus: current.status,
          toStatus: transition.status,
          reason: input.reason,
          evidenceSummary: input.evidenceSummary ?? null,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType,
        eventVersion: 1,
        aggregateType: "dispute",
        aggregateId: current.id,
        organisationId: current.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: current.clientAccountId,
          jobId: current.jobId,
          resolution: transition.resolution,
        },
      });
      return updated;
    });
  }

  async listEscalatedWarranties(input: PageInput) {
    const [items, totals] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(warrantyClaims),
          organisationId: warranties.organisationId,
          clientAccountId: warranties.clientAccountId,
          jobId: warranties.jobId,
          serviceName: warranties.serviceNameSnapshot,
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .where(eq(warrantyClaims.status, "ESCALATED"))
        .orderBy(asc(warrantyClaims.escalatedAt), asc(warrantyClaims.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db
        .select({ value: count() })
        .from(warrantyClaims)
        .where(eq(warrantyClaims.status, "ESCALATED")),
    ]);
    return { items, totalItems: totals[0]?.value ?? 0 };
  }

  async decideEscalatedWarranty(input: {
    claimId: string;
    actorAccountId: string;
    action: "RESOLVE" | "REJECT";
    reason: string;
    evidenceSummary: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [claim] = await tx
        .select({
          claim: warrantyClaims,
          organisationId: warranties.organisationId,
          clientAccountId: warranties.clientAccountId,
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warrantyClaims.status, "ESCALATED"),
          ),
        )
        .limit(1);
      if (!claim) throw conflict("The warranty claim is not escalated.");
      const now = new Date();
      const toStatus = input.action === "RESOLVE" ? "RESOLVED" : "REJECTED";
      const [updated] = await tx
        .update(warrantyClaims)
        .set({
          status: toStatus,
          decisionReason: input.reason,
          reviewedByAccountId: input.actorAccountId,
          reviewedAt: now,
          resolvedAt: toStatus === "RESOLVED" ? now : null,
          rejectedAt: toStatus === "REJECTED" ? now : null,
          lockVersion: claim.claim.lockVersion + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warrantyClaims.status, "ESCALATED"),
            eq(warrantyClaims.lockVersion, claim.claim.lockVersion),
          ),
        )
        .returning();
      if (!updated) throw conflict();
      await tx.insert(warrantyClaimHistory).values({
        claimId: input.claimId,
        actorAccountId: input.actorAccountId,
        action: `ADMIN_${input.action}`,
        fromStatus: "ESCALATED",
        toStatus,
        reason: input.reason,
      });
      const eventType =
        toStatus === "RESOLVED" ? "warranty.resolved" : "warranty.claim_rejected";
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: claim.organisationId,
        action: eventType,
        entityType: "warranty_claim",
        entityId: input.claimId,
        correlationId: input.correlationId,
        metadata: {
          reason: input.reason,
          evidenceSummary: input.evidenceSummary,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType,
        eventVersion: 1,
        aggregateType: "warranty_claim",
        aggregateId: input.claimId,
        organisationId: claim.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { decision: toStatus },
      });
      return updated;
    });
  }

  async listAudit(input: PageInput & { action?: string; entityType?: string }) {
    const filters: SQL[] = [];
    if (input.action) filters.push(eq(auditEvents.action, input.action));
    if (input.entityType) {
      filters.push(eq(auditEvents.entityType, input.entityType));
    }
    const filter = filters.length > 0 ? and(...filters) : undefined;
    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(auditEvents)
        .where(filter)
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      this.db.select({ value: count() }).from(auditEvents).where(filter),
    ]);
    return { items, totalItems: totals[0]?.value ?? 0 };
  }

  listRules() {
    return this.db
      .select()
      .from(platformRules)
      .orderBy(asc(platformRules.key));
  }

  async upsertRule(input: {
    key: string;
    name: string;
    description: string;
    value: Record<string, unknown>;
    status: string;
    reason: string;
    actorAccountId: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [rule] = await tx
        .insert(platformRules)
        .values({
          key: input.key,
          name: input.name,
          description: input.description,
          value: input.value,
          status: input.status,
          reason: input.reason,
          updatedByAccountId: input.actorAccountId,
        })
        .onConflictDoUpdate({
          target: platformRules.key,
          set: {
            name: input.name,
            description: input.description,
            value: input.value,
            status: input.status,
            reason: input.reason,
            updatedByAccountId: input.actorAccountId,
            updatedAt: new Date(),
          },
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        action: "platform.rule_changed",
        entityType: "platform_rule",
        entityId: rule.id,
        correlationId: input.correlationId,
        metadata: { key: input.key, status: input.status, reason: input.reason },
      });
      return rule;
    });
  }
}

function caseTransition(action: string) {
  if (action === "START_INVESTIGATION") {
    return { status: "INVESTIGATING", final: false, resolution: null };
  }
  if (action === "AWAIT_DECISION") {
    return { status: "AWAITING_DECISION", final: false, resolution: null };
  }
  if (action === "DISMISS") {
    return { status: "DISMISSED", final: true, resolution: "NO_BREACH" };
  }
  const resolution =
    action === "HIDE_REVIEW"
      ? "REVIEW_HIDDEN"
      : action === "SUSPEND_ACCOUNT"
        ? "ACCOUNT_SUSPENDED"
        : action === "RESTORE_ACCOUNT"
          ? "ACCOUNT_RESTORED"
          : "NO_ACTION";
  return { status: "RESOLVED", final: true, resolution };
}

function disputeTransition(action: string) {
  if (action === "START_INVESTIGATION") {
    return { status: "INVESTIGATING", final: false, resolution: null };
  }
  if (action === "AWAIT_DECISION") {
    return { status: "AWAITING_DECISION", final: false, resolution: null };
  }
  if (action === "DISMISS") {
    return { status: "DISMISSED", final: true, resolution: "DISMISSED" };
  }
  return { status: "RESOLVED", final: true, resolution: "ADMIN_RESOLVED" };
}

function conflict(message = "The record changed before the action completed.") {
  return new AppError({
    code: "STALE_OPERATION",
    message,
    status: 409,
  });
}

function linkedRecordConflict(record: string) {
  return new AppError({
    code: "LINKED_RECORD_UNAVAILABLE",
    message: `The linked ${record} is not available for this decision.`,
    status: 409,
  });
}
