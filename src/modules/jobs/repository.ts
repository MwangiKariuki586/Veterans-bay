import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { bookings } from "../../platform/database/schema/commercial";
import {
  engagementActivities,
  engagementConversationReads,
  engagementConversations,
  engagementMessages,
} from "../../platform/database/schema/engagement-conversations";
import { fileAssets } from "../../platform/database/schema/file-assets";
import {
  jobAssignments,
  jobChecklistItems,
  jobCommercialHistory,
  jobCompletionResponses,
  jobEvidence,
  jobHistory,
  jobs,
  jobUpdates,
  jobVariations,
} from "../../platform/database/schema/fulfilment";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { warranties } from "../../platform/database/schema/warranties";
import { deriveWarrantyCoverage } from "../../platform/warranties/coverage";
import { professionalServices } from "../../platform/database/schema/professional-services";
import { organisationMemberships } from "../../platform/database/schema/roles";
import {
  bookingHistory,
  bookingReservations,
} from "../../platform/database/schema/scheduling";
import { serviceRequests } from "../../platform/database/schema/service-requests";
import {
  buildPageResult,
  paginationOffset,
} from "../../platform/http/pagination";
import type {
  ConversationActivityItem,
  ConversationMessageItem,
  EngagementConversation,
} from "../conversations/types";
import type {
  JobCompletionResponse,
  JobDetail,
  JobEvidenceItem,
  JobPage,
  JobStatus,
  JobUpdate,
  JobVariation,
} from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;

const clientProfile = accountProfiles;
const assignedProfile = accountProfiles;

export interface ProfessionalJobScope {
  organisationId: string;
  membershipId: string;
  assignedJobsOnly: boolean;
}

export class JobsRepository {
  constructor(private readonly db: Database) {}

  async ensureFromBooking(input: {
    bookingId: string;
    actorAccountId: string;
    organisationId?: string;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction((tx) => ensureJobForBooking(tx, input));
  }

  async listProfessional(input: {
    scope: ProfessionalJobScope;
    status?: JobStatus;
    page: number;
    pageSize: number;
  }): Promise<JobPage> {
    return this.list({
      scope: professionalScope(input.scope),
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async listClient(input: {
    clientAccountId: string;
    status?: JobStatus;
    page: number;
    pageSize: number;
  }): Promise<JobPage> {
    return this.list({
      scope: eq(jobs.clientAccountId, input.clientAccountId),
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  getProfessional(jobId: string, scope: ProfessionalJobScope) {
    return this.detail(jobId, professionalScope(scope), false);
  }

  getClient(jobId: string, clientAccountId: string) {
    return this.detail(
      jobId,
      eq(jobs.clientAccountId, clientAccountId),
      true,
    );
  }

  async assign(input: {
    jobId: string;
    organisationId: string;
    actorAccountId: string;
    membershipId: string;
    expectedLockVersion: number;
    reason?: string;
    correlationId?: string;
  }): Promise<"updated" | "not_found" | "stale" | "conflict"> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          id: jobs.id,
          bookingId: jobs.bookingId,
          status: jobs.status,
          startsAt: jobs.scheduledStartsAt,
          endsAt: jobs.scheduledEndsAt,
          lockVersion: jobs.lockVersion,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!job) return "not_found";
      if (job.lockVersion !== input.expectedLockVersion) return "stale";
      if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(job.status)) {
        return "conflict";
      }
      const [member] = await tx
        .select({ id: organisationMemberships.id })
        .from(organisationMemberships)
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .where(
          and(
            eq(organisationMemberships.id, input.membershipId),
            eq(
              organisationMemberships.organisationId,
              input.organisationId,
            ),
            eq(organisationMemberships.status, "active"),
            eq(accountProfiles.status, "active"),
          ),
        )
        .limit(1);
      if (!member) return "not_found";
      if (
        job.startsAt &&
        job.endsAt &&
        (await hasScheduleConflict(tx, {
          bookingId: job.bookingId,
          membershipId: input.membershipId,
          startsAt: job.startsAt,
          endsAt: job.endsAt,
        }))
      ) {
        return "conflict";
      }
      const [created] = await tx
        .insert(jobAssignments)
        .values({
          jobId: job.id,
          organisationId: input.organisationId,
          membershipId: input.membershipId,
          assignedByAccountId: input.actorAccountId,
          reason: input.reason,
        })
        .onConflictDoNothing()
        .returning({ id: jobAssignments.id });
      if (!created) return "updated";
      const nextStatus = ["CREATED", "SCHEDULED"].includes(job.status)
        ? "TEAM_ASSIGNED"
        : (job.status as JobStatus);
      await tx
        .update(jobs)
        .set({
          status: nextStatus,
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      await recordJobChange(tx, {
        jobId: job.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        action: "ASSIGNED",
        fromStatus: job.status,
        toStatus: nextStatus,
        reason: input.reason,
        correlationId: input.correlationId,
        payload: { membershipId: input.membershipId },
      });
      return "updated";
    });
  }

  async unassign(input: {
    jobId: string;
    assignmentId: string;
    organisationId: string;
    actorAccountId: string;
    expectedLockVersion: number;
    reason?: string;
    correlationId?: string;
  }): Promise<"updated" | "not_found" | "stale"> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          status: jobs.status,
          startsAt: jobs.scheduledStartsAt,
          lockVersion: jobs.lockVersion,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!job) return "not_found";
      if (job.lockVersion !== input.expectedLockVersion) return "stale";
      const [changed] = await tx
        .update(jobAssignments)
        .set({
          active: false,
          unassignedAt: new Date(),
          unassignedByAccountId: input.actorAccountId,
          reason: input.reason,
        })
        .where(
          and(
            eq(jobAssignments.id, input.assignmentId),
            eq(jobAssignments.jobId, input.jobId),
            eq(jobAssignments.active, true),
          ),
        )
        .returning({ membershipId: jobAssignments.membershipId });
      if (!changed) return "not_found";
      const [remaining] = await tx
        .select({ id: jobAssignments.id })
        .from(jobAssignments)
        .where(
          and(
            eq(jobAssignments.jobId, input.jobId),
            eq(jobAssignments.active, true),
          ),
        )
        .limit(1);
      const nextStatus =
        job.status === "TEAM_ASSIGNED" && !remaining
          ? job.startsAt
            ? "SCHEDULED"
            : "CREATED"
          : (job.status as JobStatus);
      await tx
        .update(jobs)
        .set({
          status: nextStatus,
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, input.jobId));
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        action: "UNASSIGNED",
        fromStatus: job.status,
        toStatus: nextStatus,
        reason: input.reason,
        correlationId: input.correlationId,
        payload: { membershipId: changed.membershipId },
      });
      return "updated";
    });
  }

  async transition(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    expectedLockVersion: number;
    action: "CHECK_IN" | "START" | "HOLD" | "RESUME" | "READY" | "CANCEL";
    reason?: string;
    correlationId?: string;
  }): Promise<
    "updated" | "not_found" | "stale" | "invalid" | "checklist" | "evidence"
    | "variation"
  > {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          status: jobs.status,
          lockVersion: jobs.lockVersion,
          organisationId: jobs.organisationId,
        })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job) return "not_found";
      if (job.lockVersion !== input.expectedLockVersion) return "stale";
      const transition = resolveJobTransition(
        job.status as JobStatus,
        input.action,
      );
      if (!transition) return "invalid";
      if (input.action === "READY") {
        const [incomplete] = await tx
          .select({ id: jobChecklistItems.id })
          .from(jobChecklistItems)
          .where(
            and(
              eq(jobChecklistItems.jobId, input.jobId),
              eq(jobChecklistItems.required, true),
              eq(jobChecklistItems.completed, false),
            ),
          )
          .limit(1);
        if (incomplete) return "checklist";
        const [evidence] = await tx
          .select({ id: jobEvidence.id })
          .from(jobEvidence)
          .where(
            and(
              eq(jobEvidence.jobId, input.jobId),
              inArray(jobEvidence.evidenceType, ["AFTER", "COMPLETION"]),
              eq(jobEvidence.visibility, "CLIENT"),
            ),
          )
          .limit(1);
        if (!evidence) return "evidence";
        const [pendingVariation] = await tx
          .select({ id: jobVariations.id })
          .from(jobVariations)
          .where(
            and(
              eq(jobVariations.jobId, input.jobId),
              inArray(jobVariations.status, ["DRAFT", "SUBMITTED"]),
            ),
          )
          .limit(1);
        if (pendingVariation) return "variation";
      }
      const now = new Date();
      const [changed] = await tx
        .update(jobs)
        .set({
          status: transition.status,
          lockVersion: sql`${jobs.lockVersion} + 1`,
          ...(input.action === "CHECK_IN" ? { checkedInAt: now } : {}),
          ...(input.action === "START" ? { startedAt: now } : {}),
          ...(input.action === "READY"
            ? { awaitingConfirmationAt: now }
            : {}),
          ...(input.action === "CANCEL" ? { cancelledAt: now } : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: jobs.id });
      if (!changed) return "stale";
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: input.action,
        fromStatus: job.status,
        toStatus: transition.status,
        reason: input.reason,
        correlationId: input.correlationId,
      });
      return "updated";
    });
  }

  async setChecklist(input: {
    jobId: string;
    checklistItemId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    completed: boolean;
    resultNote?: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({ organisationId: jobs.organisationId, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job || terminalJobStatuses.includes(job.status as JobStatus)) {
        return false;
      }
      const [changed] = await tx
        .update(jobChecklistItems)
        .set({
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
          completedByAccountId: input.completed
            ? input.actorAccountId
            : null,
          resultNote: input.resultNote,
        })
        .where(
          and(
            eq(jobChecklistItems.id, input.checklistItemId),
            eq(jobChecklistItems.jobId, input.jobId),
          ),
        )
        .returning({ id: jobChecklistItems.id });
      if (!changed) return false;
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: input.completed ? "CHECKLIST_COMPLETED" : "CHECKLIST_REOPENED",
        fromStatus: job.status,
        toStatus: job.status,
        reason: input.resultNote,
        clientVisible: false,
        correlationId: input.correlationId,
        payload: { checklistItemId: input.checklistItemId },
      });
      return true;
    });
  }

  async addUpdate(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    updateType: "PROGRESS" | "NOTE" | "MATERIAL" | "EXPENSE" | "CLARIFICATION";
    visibility: "CLIENT" | "PROFESSIONAL";
    content: string;
    quantity?: number;
    amountMinor?: number;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          organisationId: jobs.organisationId,
          status: jobs.status,
          currency: jobs.currency,
        })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job || terminalJobStatuses.includes(job.status as JobStatus)) {
        return false;
      }
      const [created] = await tx
        .insert(jobUpdates)
        .values({
          jobId: input.jobId,
          createdByAccountId: input.actorAccountId,
          updateType: input.updateType,
          visibility: input.visibility,
          content: input.content,
          quantity: input.quantity,
          amountMinor: input.amountMinor,
          currency:
            input.amountMinor === undefined ? undefined : job.currency,
        })
        .returning({ id: jobUpdates.id });
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: "PROGRESS_UPDATED",
        fromStatus: job.status,
        toStatus: job.status,
        reason: input.content,
        clientVisible: input.visibility === "CLIENT",
        correlationId: input.correlationId,
        payload: { updateId: created.id, updateType: input.updateType },
      });
      return true;
    });
  }

  async addEvidence(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    assetId: string;
    evidenceType: JobEvidenceItem["evidenceType"];
    visibility: JobEvidenceItem["visibility"];
    caption?: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          organisationId: jobs.organisationId,
          status: jobs.status,
        })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job || terminalJobStatuses.includes(job.status as JobStatus)) {
        return false;
      }
      const [asset] = await tx
        .select({ id: fileAssets.id })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.actorAccountId),
            eq(fileAssets.organisationId, input.scope.organisationId),
            eq(fileAssets.purpose, "JOB_EVIDENCE"),
            eq(fileAssets.status, "ready"),
          ),
        )
        .limit(1);
      if (!asset) return false;
      const [created] = await tx
        .insert(jobEvidence)
        .values({
          jobId: input.jobId,
          assetId: input.assetId,
          addedByAccountId: input.actorAccountId,
          evidenceType: input.evidenceType,
          visibility: input.visibility,
          caption: input.caption,
        })
        .onConflictDoNothing()
        .returning({ id: jobEvidence.id });
      if (!created) return true;
      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "job",
          linkedEntityId: input.jobId,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, input.assetId));
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: "EVIDENCE_ADDED",
        fromStatus: job.status,
        toStatus: job.status,
        reason: input.caption,
        clientVisible: input.visibility === "CLIENT",
        correlationId: input.correlationId,
        payload: {
          evidenceId: created.id,
          assetId: input.assetId,
          evidenceType: input.evidenceType,
        },
      });
      return true;
    });
  }

  async createVariation(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    description: string;
    reason: string;
    additionalAmountMinor: number;
    scheduleImpactMinutes: number;
    expiresAt?: Date;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({ currency: jobs.currency, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (
        !job ||
        !["EN_ROUTE", "IN_PROGRESS", "ON_HOLD", "RETURN_VISIT_REQUIRED"].includes(
          job.status,
        )
      ) {
        return null;
      }
      const [next] = await tx
        .select({
          value: sql<number>`coalesce(max(${jobVariations.sequence}), 0) + 1`,
        })
        .from(jobVariations)
        .where(eq(jobVariations.jobId, input.jobId));
      const [variation] = await tx
        .insert(jobVariations)
        .values({
          jobId: input.jobId,
          sequence: next?.value ?? 1,
          description: input.description,
          reason: input.reason,
          additionalAmountMinor: input.additionalAmountMinor,
          currency: job.currency,
          scheduleImpactMinutes: input.scheduleImpactMinutes,
          createdByAccountId: input.actorAccountId,
          expiresAt: input.expiresAt,
        })
        .returning({ id: jobVariations.id });
      return variation.id;
    });
  }

  async submitVariation(input: {
    jobId: string;
    variationId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    expiresAt?: Date;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({ organisationId: jobs.organisationId, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job) return false;
      const [variation] = await tx
        .update(jobVariations)
        .set({
          status: "SUBMITTED",
          submittedAt: new Date(),
          expiresAt: input.expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobVariations.id, input.variationId),
            eq(jobVariations.jobId, input.jobId),
            eq(jobVariations.status, "DRAFT"),
          ),
        )
        .returning({ id: jobVariations.id });
      if (!variation) return false;
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: "VARIATION_REQUESTED",
        fromStatus: job.status,
        toStatus: job.status,
        correlationId: input.correlationId,
        payload: { variationId: variation.id },
      });
      return true;
    });
  }

  async withdrawVariation(input: {
    jobId: string;
    variationId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({ organisationId: jobs.organisationId, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, input.jobId), professionalScope(input.scope)))
        .limit(1);
      if (!job) return false;
      const [variation] = await tx
        .update(jobVariations)
        .set({
          status: "WITHDRAWN",
          withdrawnAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobVariations.id, input.variationId),
            eq(jobVariations.jobId, input.jobId),
            inArray(jobVariations.status, ["DRAFT", "SUBMITTED"]),
          ),
        )
        .returning({ id: jobVariations.id });
      if (!variation) return false;
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        action: "VARIATION_WITHDRAWN",
        fromStatus: job.status,
        toStatus: job.status,
        correlationId: input.correlationId,
        payload: { variationId: variation.id },
      });
      return true;
    });
  }

  async respondVariation(input: {
    jobId: string;
    variationId: string;
    clientAccountId: string;
    decision: "ACCEPT" | "REJECT";
    comment?: string;
    correlationId?: string;
  }): Promise<"updated" | "not_found" | "stale"> {
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
      if (!job) return "not_found";
      const now = new Date();
      const [variation] = await tx
        .update(jobVariations)
        .set({
          status: input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
          respondedByAccountId: input.clientAccountId,
          respondedAt: now,
          responseComment: input.comment,
          updatedAt: now,
        })
        .where(
          and(
            eq(jobVariations.id, input.variationId),
            eq(jobVariations.jobId, input.jobId),
            eq(jobVariations.status, "SUBMITTED"),
            or(
              sql`${jobVariations.expiresAt} is null`,
              sql`${jobVariations.expiresAt} > ${now}`,
            ),
          ),
        )
        .returning();
      if (!variation) return "stale";
      if (input.decision === "ACCEPT") {
        const newVariationTotal =
          job.approvedVariationTotalMinor + variation.additionalAmountMinor;
        const newTotal = job.baseTotalMinor + newVariationTotal;
        await tx
          .update(jobs)
          .set({
            approvedVariationTotalMinor: newVariationTotal,
            totalMinor: newTotal,
            scheduledEndsAt:
              job.scheduledEndsAt && variation.scheduleImpactMinutes > 0
                ? new Date(
                    job.scheduledEndsAt.getTime() +
                      variation.scheduleImpactMinutes * 60_000,
                  )
                : job.scheduledEndsAt,
            lockVersion: sql`${jobs.lockVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(jobs.id, input.jobId));
        await tx.insert(jobCommercialHistory).values({
          jobId: input.jobId,
          variationId: variation.id,
          entryType: "APPROVED_VARIATION",
          descriptionSnapshot: variation.description,
          amountMinor: variation.additionalAmountMinor,
          currency: variation.currency,
          totalAfterMinor: newTotal,
          approvedByAccountId: input.clientAccountId,
        });
      }
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.clientAccountId,
        action:
          input.decision === "ACCEPT"
            ? "VARIATION_APPROVED"
            : "VARIATION_REJECTED",
        fromStatus: job.status,
        toStatus: job.status,
        reason: input.comment,
        correlationId: input.correlationId,
        payload: { variationId: variation.id },
      });
      return "updated";
    });
  }

  async respondCompletion(input: {
    jobId: string;
    clientAccountId: string;
    response:
      | "CONFIRM"
      | "CONFIRM_WITH_COMMENTS"
      | "UNRESOLVED"
      | "CLARIFICATION";
    comments?: string;
    correlationId?: string;
  }): Promise<"updated" | "not_found" | "invalid"> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          ...getTableColumns(jobs),
          bookingStatus: bookings.status,
        })
        .from(jobs)
        .innerJoin(bookings, eq(bookings.id, jobs.bookingId))
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.clientAccountId, input.clientAccountId),
          ),
        )
        .limit(1);
      if (!job) return "not_found";
      if (job.status !== "AWAITING_CLIENT_CONFIRMATION") {
        return job.status === "COMPLETED" && input.response.startsWith("CONFIRM")
          ? "updated"
          : "invalid";
      }
      const [pendingVariation] = await tx
        .select({ id: jobVariations.id })
        .from(jobVariations)
        .where(
          and(
            eq(jobVariations.jobId, input.jobId),
            inArray(jobVariations.status, ["DRAFT", "SUBMITTED"]),
          ),
        )
        .limit(1);
      if (pendingVariation) return "invalid";
      const confirmed = input.response.startsWith("CONFIRM");
      if (
        confirmed &&
        !["CONFIRMED", "RESCHEDULED"].includes(job.bookingStatus)
      ) {
        return "invalid";
      }
      const unresolved = input.response === "UNRESOLVED";
      const nextStatus: JobStatus = confirmed
        ? "COMPLETED"
        : unresolved
          ? "RETURN_VISIT_REQUIRED"
          : "AWAITING_CLIENT_CONFIRMATION";
      const [attempt] = await tx
        .select({
          value: sql<number>`coalesce(max(${jobCompletionResponses.attempt}), 0) + 1`,
        })
        .from(jobCompletionResponses)
        .where(eq(jobCompletionResponses.jobId, input.jobId));
      await tx.insert(jobCompletionResponses).values({
        jobId: input.jobId,
        attempt: attempt?.value ?? 1,
        responseType:
          input.response === "CONFIRM"
            ? "CONFIRMED"
            : input.response === "CONFIRM_WITH_COMMENTS"
              ? "CONFIRMED_WITH_COMMENTS"
              : input.response === "UNRESOLVED"
                ? "UNRESOLVED"
                : "CLARIFICATION_REQUESTED",
        actorAccountId: input.clientAccountId,
        comments: input.comments,
      });
      const transitionAt = new Date();
      const completedAt = confirmed ? transitionAt : null;
      await tx
        .update(jobs)
        .set({
          status: nextStatus,
          completedAt,
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: transitionAt,
        })
        .where(eq(jobs.id, input.jobId));
      if (confirmed) {
        const completionTime = completedAt!;
        const [completedBooking] = await tx
          .update(bookings)
          .set({
            status: "COMPLETED",
            completedAt: completionTime,
            lockVersion: sql`${bookings.lockVersion} + 1`,
            updatedAt: completionTime,
          })
          .where(
            and(
              eq(bookings.id, job.bookingId),
              inArray(bookings.status, ["CONFIRMED", "RESCHEDULED"]),
            ),
          )
          .returning({
            startsAt: bookings.startsAt,
            endsAt: bookings.endsAt,
            membershipId: bookings.assignedMembershipId,
          });
        if (!completedBooking) {
          throw new Error("The linked booking changed during job completion.");
        }
        await tx
          .update(bookingReservations)
          .set({
            status: "RELEASED",
            releasedAt: completionTime,
            updatedAt: completionTime,
          })
          .where(
            and(
              eq(bookingReservations.bookingId, job.bookingId),
              eq(bookingReservations.status, "ACTIVE"),
            ),
          );
        await tx.insert(bookingHistory).values({
          bookingId: job.bookingId,
          actorAccountId: input.clientAccountId,
          action: "COMPLETED",
          fromStatus: job.bookingStatus,
          toStatus: "COMPLETED",
          previousStartsAt: completedBooking.startsAt,
          previousEndsAt: completedBooking.endsAt,
          startsAt: completedBooking.startsAt,
          endsAt: completedBooking.endsAt,
          membershipId: completedBooking.membershipId,
          note: input.comments,
          createdAt: completionTime,
        });
        const coverage = deriveWarrantyCoverage(
          job.warrantyTermsSnapshot,
          completionTime,
        );
        if (coverage) {
          const [warranty] = await tx
            .insert(warranties)
            .values({
              jobId: job.id,
              organisationId: job.organisationId,
              clientAccountId: job.clientAccountId,
              createdByAccountId: input.clientAccountId,
              serviceNameSnapshot: job.serviceName,
              termsSnapshot: job.warrantyTermsSnapshot,
              exclusionsSnapshot: job.exclusionsSnapshot,
              startsAt: coverage.startsAt,
              endsAt: coverage.endsAt,
            })
            .onConflictDoNothing()
            .returning({ id: warranties.id });
          if (warranty) {
            await tx.insert(outboxEvents).values({
              eventType: "warranty.created",
              eventVersion: 1,
              aggregateType: "warranty",
              aggregateId: warranty.id,
              organisationId: job.organisationId,
              actorAccountId: null,
              correlationId: input.correlationId,
              payload: {
                jobId: job.id,
                clientAccountId: job.clientAccountId,
                startsAt: coverage.startsAt.toISOString(),
                endsAt: coverage.endsAt.toISOString(),
              },
            });
          }
        }
        await tx.insert(outboxEvents).values([
          {
            eventType: "review.requested",
            eventVersion: 1,
            aggregateType: "job",
            aggregateId: job.id,
            organisationId: job.organisationId,
            actorAccountId: null,
            correlationId: input.correlationId,
            payload: {
              jobId: job.id,
              organisationId: job.organisationId,
              clientAccountId: job.clientAccountId,
              reviewDeadline: new Date(
                completionTime.getTime() + 30 * 86_400_000,
              ).toISOString(),
            },
          },
          {
            eventType: "reputation.recalculation_requested",
            eventVersion: 1,
            aggregateType: "professional_reputation",
            aggregateId: job.organisationId,
            organisationId: job.organisationId,
            actorAccountId: null,
            correlationId: input.correlationId,
            payload: {
              organisationId: job.organisationId,
              reason: "job_completed",
            },
          },
        ]);
      }
      await recordJobChange(tx, {
        jobId: input.jobId,
        organisationId: job.organisationId,
        actorAccountId: input.clientAccountId,
        action: confirmed
          ? "COMPLETION_CONFIRMED"
          : unresolved
            ? "UNRESOLVED_REPORTED"
            : "CLARIFICATION_REQUESTED",
        fromStatus: job.status,
        toStatus: nextStatus,
        reason: input.comments,
        correlationId: input.correlationId,
      });
      return "updated";
    });
  }

  async expireVariations(now = new Date(), limit = 50): Promise<number> {
    const changed = await this.db
      .update(jobVariations)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(jobVariations.status, "SUBMITTED"),
          sql`${jobVariations.expiresAt} is not null`,
          sql`${jobVariations.expiresAt} <= ${now}`,
          sql`${jobVariations.id} in (
            select id from ${jobVariations}
            where status = 'SUBMITTED' and expires_at is not null and expires_at <= ${now}
            order by expires_at, id limit ${limit}
          )`,
        ),
      )
      .returning({ id: jobVariations.id });
    return changed.length;
  }

  async loadConversation(input: {
    jobId: string;
    actorAccountId: string;
    role: "CLIENT" | "PROFESSIONAL";
    scope?: ProfessionalJobScope;
  }): Promise<EngagementConversation | null> {
    if (!(await this.hasConversationAccess(input))) return null;
    return this.loadJobConversation(
      input.jobId,
      input.actorAccountId,
      input.role,
    );
  }

  async sendConversationMessage(input: {
    jobId: string;
    actorAccountId: string;
    role: "CLIENT" | "PROFESSIONAL";
    scope?: ProfessionalJobScope;
    idempotencyKey: string;
    body: string;
    correlationId?: string;
  }): Promise<EngagementConversation | null> {
    if (!(await this.hasConversationAccess(input))) return null;
    await this.db.transaction(async (tx) => {
      const conversationId = await ensureJobConversation(tx, input.jobId);
      const [existing] = await tx
        .select({ id: engagementMessages.id })
        .from(engagementMessages)
        .where(
          and(
            eq(engagementMessages.conversationId, conversationId),
            eq(engagementMessages.senderAccountId, input.actorAccountId),
            eq(engagementMessages.senderRole, input.role),
            eq(engagementMessages.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return;
      const [job] = await tx
        .select({ organisationId: jobs.organisationId })
        .from(jobs)
        .where(eq(jobs.id, input.jobId))
        .limit(1);
      const [message] = await tx
        .insert(engagementMessages)
        .values({
          conversationId,
          senderAccountId: input.actorAccountId,
          senderRole: input.role,
          idempotencyKey: input.idempotencyKey,
          body: input.body,
        })
        .onConflictDoNothing()
        .returning({
          id: engagementMessages.id,
          createdAt: engagementMessages.createdAt,
        });
      if (!message) return;
      await tx.insert(outboxEvents).values({
        eventType: "message.sent",
        eventVersion: 1,
        aggregateType: "engagement_conversation",
        aggregateId: conversationId,
        organisationId: job?.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          messageId: message.id,
          contextType: "JOB",
          contextId: input.jobId,
        },
      });
      await tx
        .update(engagementConversations)
        .set({ updatedAt: message.createdAt })
        .where(eq(engagementConversations.id, conversationId));
    });
    return this.loadJobConversation(
      input.jobId,
      input.actorAccountId,
      input.role,
    );
  }

  async markConversationRead(input: {
    jobId: string;
    actorAccountId: string;
    role: "CLIENT" | "PROFESSIONAL";
    scope?: ProfessionalJobScope;
    correlationId?: string;
  }): Promise<EngagementConversation | null> {
    if (!(await this.hasConversationAccess(input))) return null;
    const conversationId = await ensureJobConversation(this.db, input.jobId);
    const now = new Date();
    await this.db
      .insert(engagementConversationReads)
      .values({
        conversationId,
        accountId: input.actorAccountId,
        participantRole: input.role,
        lastReadAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          engagementConversationReads.conversationId,
          engagementConversationReads.accountId,
          engagementConversationReads.participantRole,
        ],
        set: { lastReadAt: now, updatedAt: now },
      });
    return this.loadJobConversation(
      input.jobId,
      input.actorAccountId,
      input.role,
    );
  }

  private async list(input: {
    scope: SQL<unknown>;
    status?: JobStatus;
    page: number;
    pageSize: number;
  }): Promise<JobPage> {
    const filter = and(
      input.scope,
      ...(input.status ? [eq(jobs.status, input.status)] : []),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: jobs.id,
          bookingId: jobs.bookingId,
          serviceName: jobs.serviceName,
          status: jobs.status,
          providerName: organisations.name,
          clientName: clientProfile.displayName,
          scheduledStartsAt: jobs.scheduledStartsAt,
          scheduledEndsAt: jobs.scheduledEndsAt,
          timezone: jobs.timezone,
          totalMinor: jobs.totalMinor,
          currency: jobs.currency,
          updatedAt: jobs.updatedAt,
        })
        .from(jobs)
        .innerJoin(
          organisations,
          eq(organisations.id, jobs.organisationId),
        )
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, jobs.clientAccountId),
        )
        .where(filter)
        .orderBy(desc(jobs.updatedAt), desc(jobs.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ value: count() }).from(jobs).where(filter),
    ]);
    const assignmentMap = await this.assignmentNames(rows.map((row) => row.id));
    return buildPageResult(
      rows.map((row) => ({
        ...row,
        status: row.status as JobStatus,
        scheduledStartsAt: iso(row.scheduledStartsAt),
        scheduledEndsAt: iso(row.scheduledEndsAt),
        assignmentNames: assignmentMap.get(row.id) ?? [],
        updatedAt: row.updatedAt.toISOString(),
      })),
      totals[0]?.value ?? 0,
      input,
    );
  }

  private async detail(
    jobId: string,
    scope: SQL<unknown>,
    clientSafe: boolean,
  ): Promise<JobDetail | null> {
    const [row] = await this.db
      .select({
        ...getTableColumns(jobs),
        providerName: organisations.name,
        clientName: clientProfile.displayName,
      })
      .from(jobs)
      .innerJoin(organisations, eq(organisations.id, jobs.organisationId))
      .innerJoin(
        clientProfile,
        eq(clientProfile.id, jobs.clientAccountId),
      )
      .where(and(eq(jobs.id, jobId), scope))
      .limit(1);
    if (!row) return null;
    const [
      assignments,
      checklist,
      updates,
      evidence,
      variations,
      history,
      completionResponses,
      conversation,
    ] = await Promise.all([
      this.db
        .select({
          id: jobAssignments.id,
          membershipId: jobAssignments.membershipId,
          displayName: assignedProfile.displayName,
          active: jobAssignments.active,
          assignedAt: jobAssignments.assignedAt,
          unassignedAt: jobAssignments.unassignedAt,
          reason: jobAssignments.reason,
        })
        .from(jobAssignments)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, jobAssignments.membershipId),
        )
        .innerJoin(
          assignedProfile,
          eq(assignedProfile.id, organisationMemberships.accountProfileId),
        )
        .where(eq(jobAssignments.jobId, jobId))
        .orderBy(desc(jobAssignments.assignedAt), desc(jobAssignments.id)),
      this.db
        .select()
        .from(jobChecklistItems)
        .where(eq(jobChecklistItems.jobId, jobId))
        .orderBy(asc(jobChecklistItems.position)),
      this.db
        .select()
        .from(jobUpdates)
        .where(
          and(
            eq(jobUpdates.jobId, jobId),
            ...(clientSafe
              ? [eq(jobUpdates.visibility, "CLIENT")]
              : []),
          ),
        )
        .orderBy(desc(jobUpdates.createdAt), desc(jobUpdates.id)),
      this.db
        .select()
        .from(jobEvidence)
        .where(
          and(
            eq(jobEvidence.jobId, jobId),
            ...(clientSafe
              ? [eq(jobEvidence.visibility, "CLIENT")]
              : []),
          ),
        )
        .orderBy(desc(jobEvidence.createdAt), desc(jobEvidence.id)),
      this.db
        .select()
        .from(jobVariations)
        .where(
          and(
            eq(jobVariations.jobId, jobId),
            ...(clientSafe
              ? [ne(jobVariations.status, "DRAFT")]
              : []),
          ),
        )
        .orderBy(desc(jobVariations.sequence)),
      this.db
        .select()
        .from(jobHistory)
        .where(
          and(
            eq(jobHistory.jobId, jobId),
            ...(clientSafe
              ? [eq(jobHistory.clientVisible, true)]
              : []),
          ),
        )
        .orderBy(desc(jobHistory.createdAt), desc(jobHistory.id)),
      this.db
        .select()
        .from(jobCompletionResponses)
        .where(eq(jobCompletionResponses.jobId, jobId))
        .orderBy(desc(jobCompletionResponses.attempt)),
      this.db
        .select({ id: engagementConversations.id })
        .from(engagementConversations)
        .where(
          and(
            eq(engagementConversations.contextType, "JOB"),
            eq(engagementConversations.contextId, jobId),
          ),
        )
        .limit(1),
    ]);
    return {
      id: row.id,
      bookingId: row.bookingId,
      organisationId: row.organisationId,
      clientAccountId: row.clientAccountId,
      serviceName: row.serviceName,
      status: row.status as JobStatus,
      providerName: row.providerName,
      clientName: row.clientName,
      scheduledStartsAt: iso(row.scheduledStartsAt),
      scheduledEndsAt: iso(row.scheduledEndsAt),
      timezone: row.timezone,
      totalMinor: row.totalMinor,
      currency: row.currency,
      assignmentNames: assignments
        .filter((item) => item.active)
        .map((item) => item.displayName),
      updatedAt: row.updatedAt.toISOString(),
      lockVersion: row.lockVersion,
      scopeSnapshot: row.scopeSnapshot,
      exclusionsSnapshot: row.exclusionsSnapshot,
      warrantyTermsSnapshot: row.warrantyTermsSnapshot,
      paymentTermsSnapshot: row.paymentTermsSnapshot,
      baseTotalMinor: row.baseTotalMinor,
      approvedVariationTotalMinor: row.approvedVariationTotalMinor,
      checkedInAt: iso(row.checkedInAt),
      startedAt: iso(row.startedAt),
      awaitingConfirmationAt: iso(row.awaitingConfirmationAt),
      completedAt: iso(row.completedAt),
      assignments: assignments.map((item) => ({
        ...item,
        assignedAt: item.assignedAt.toISOString(),
        unassignedAt: iso(item.unassignedAt),
      })),
      checklist: checklist.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        position: item.position,
        completed: item.completed,
        resultNote: item.resultNote,
        completedAt: iso(item.completedAt),
      })),
      updates: updates.map(mapUpdate),
      evidence: evidence.map(mapEvidence),
      variations: variations.map(mapVariation),
      history: history.map((item) => ({
        id: item.id,
        action: item.action,
        fromStatus: item.fromStatus as JobStatus | null,
        toStatus: item.toStatus as JobStatus,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
      completionResponses: completionResponses.map(mapCompletion),
      conversationId: conversation[0]?.id ?? null,
    };
  }

  private async assignmentNames(jobIds: string[]) {
    const result = new Map<string, string[]>();
    if (jobIds.length === 0) return result;
    const rows = await this.db
      .select({
        jobId: jobAssignments.jobId,
        displayName: assignedProfile.displayName,
      })
      .from(jobAssignments)
      .innerJoin(
        organisationMemberships,
        eq(organisationMemberships.id, jobAssignments.membershipId),
      )
      .innerJoin(
        assignedProfile,
        eq(assignedProfile.id, organisationMemberships.accountProfileId),
      )
      .where(
        and(
          inArray(jobAssignments.jobId, jobIds),
          eq(jobAssignments.active, true),
        ),
      );
    for (const row of rows) {
      result.set(row.jobId, [...(result.get(row.jobId) ?? []), row.displayName]);
    }
    return result;
  }

  private async hasConversationAccess(input: {
    jobId: string;
    actorAccountId: string;
    role: "CLIENT" | "PROFESSIONAL";
    scope?: ProfessionalJobScope;
  }) {
    const filter =
      input.role === "CLIENT"
        ? and(
            eq(jobs.id, input.jobId),
            eq(jobs.clientAccountId, input.actorAccountId),
          )
        : input.scope
          ? and(eq(jobs.id, input.jobId), professionalScope(input.scope))
          : undefined;
    if (!filter) return false;
    const [allowed] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(filter)
      .limit(1);
    return Boolean(allowed);
  }

  private async loadJobConversation(
    jobId: string,
    actorAccountId: string,
    role: "CLIENT" | "PROFESSIONAL",
  ): Promise<EngagementConversation> {
    const conversationId = await ensureJobConversation(this.db, jobId);
    const [messages, activities, reads] = await Promise.all([
      this.db
        .select({
          id: engagementMessages.id,
          senderAccountId: engagementMessages.senderAccountId,
          senderRole: engagementMessages.senderRole,
          body: engagementMessages.body,
          createdAt: engagementMessages.createdAt,
          authorDisplayName: accountProfiles.displayName,
        })
        .from(engagementMessages)
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, engagementMessages.senderAccountId),
        )
        .where(eq(engagementMessages.conversationId, conversationId))
        .orderBy(desc(engagementMessages.createdAt), desc(engagementMessages.id))
        .limit(100),
      this.db
        .select({
          id: engagementActivities.id,
          action: engagementActivities.activityType,
          summary: engagementActivities.summary,
          actorDisplayName: accountProfiles.displayName,
          occurredAt: engagementActivities.occurredAt,
        })
        .from(engagementActivities)
        .leftJoin(
          accountProfiles,
          eq(accountProfiles.id, engagementActivities.actorAccountId),
        )
        .where(eq(engagementActivities.conversationId, conversationId)),
      this.db
        .select({ lastReadAt: engagementConversationReads.lastReadAt })
        .from(engagementConversationReads)
        .where(
          and(
            eq(engagementConversationReads.conversationId, conversationId),
            eq(engagementConversationReads.accountId, actorAccountId),
            eq(engagementConversationReads.participantRole, role),
          ),
        )
        .limit(1),
    ]);
    const [unread] = await this.db
      .select({ value: count() })
      .from(engagementMessages)
      .where(
        and(
          eq(engagementMessages.conversationId, conversationId),
          or(
            ne(engagementMessages.senderAccountId, actorAccountId),
            ne(engagementMessages.senderRole, role),
          ),
          ...(reads[0]?.lastReadAt
            ? [gt(engagementMessages.createdAt, reads[0].lastReadAt)]
            : []),
        ),
      );
    const messageItems: ConversationMessageItem[] = messages.map((message) => ({
      kind: "MESSAGE",
      id: message.id,
      authorDisplayName: message.authorDisplayName,
      authorRole: message.senderRole as "CLIENT" | "PROFESSIONAL",
      isOwn:
        message.senderAccountId === actorAccountId &&
        message.senderRole === role,
      body: message.body,
      attachments: [],
      occurredAt: message.createdAt.toISOString(),
    }));
    const activityItems: ConversationActivityItem[] = activities.map(
      (activity) => ({
        kind: "ACTIVITY",
        id: activity.id,
        action: activity.action,
        summary: activity.summary,
        actorDisplayName: activity.actorDisplayName,
        occurredAt: activity.occurredAt.toISOString(),
      }),
    );
    return {
      conversationId,
      contextType: "JOB",
      contextId: jobId,
      unreadCount: unread?.value ?? 0,
      items: [...messageItems, ...activityItems].sort(
        (left, right) =>
          new Date(left.occurredAt).getTime() -
          new Date(right.occurredAt).getTime(),
      ),
      refreshedAt: new Date().toISOString(),
    };
  }
}

export async function ensureJobForBooking(
  tx: Tx,
  input: {
    bookingId: string;
    actorAccountId: string;
    organisationId?: string;
    correlationId?: string;
  },
): Promise<string | null> {
  const [booking] = await tx
    .select({
      id: bookings.id,
      organisationId: bookings.organisationId,
      clientAccountId: bookings.clientAccountId,
      assignedMembershipId: bookings.assignedMembershipId,
      status: bookings.status,
      currency: bookings.currency,
      totalMinor: bookings.totalMinor,
      scope: bookings.scope,
      exclusions: bookings.exclusions,
      warrantyTerms: bookings.warrantyTerms,
      paymentTerms: bookings.paymentTerms,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      timezone: bookings.timezone,
      serviceName: sql<string>`coalesce(${professionalServices.name}, ${serviceRequests.category}, 'Service job')`,
    })
    .from(bookings)
    .leftJoin(
      professionalServices,
      eq(professionalServices.id, bookings.professionalServiceId),
    )
    .leftJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
    .where(
      and(
        eq(bookings.id, input.bookingId),
        inArray(bookings.status, ["CONFIRMED", "RESCHEDULED"]),
        ...(input.organisationId
          ? [eq(bookings.organisationId, input.organisationId)]
          : []),
      ),
    )
    .limit(1);
  if (!booking) return null;
  const initialStatus: JobStatus = booking.assignedMembershipId
    ? "TEAM_ASSIGNED"
    : booking.startsAt
      ? "SCHEDULED"
      : "CREATED";
  const [created] = await tx
    .insert(jobs)
    .values({
      bookingId: booking.id,
      organisationId: booking.organisationId,
      clientAccountId: booking.clientAccountId,
      createdByAccountId: input.actorAccountId,
      status: initialStatus,
      serviceName: booking.serviceName,
      scopeSnapshot: booking.scope,
      exclusionsSnapshot: booking.exclusions,
      warrantyTermsSnapshot: booking.warrantyTerms,
      paymentTermsSnapshot: booking.paymentTerms,
      currency: booking.currency,
      baseTotalMinor: booking.totalMinor,
      totalMinor: booking.totalMinor,
      scheduledStartsAt: booking.startsAt,
      scheduledEndsAt: booking.endsAt,
      timezone: booking.timezone,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  if (!created) {
    const [existing] = await tx
      .select({
        id: jobs.id,
        status: jobs.status,
        scheduledStartsAt: jobs.scheduledStartsAt,
        scheduledEndsAt: jobs.scheduledEndsAt,
      })
      .from(jobs)
      .where(eq(jobs.bookingId, booking.id))
      .limit(1);
    if (
      existing &&
      ["CREATED", "SCHEDULED", "TEAM_ASSIGNED"].includes(existing.status) &&
      (existing.scheduledStartsAt?.getTime() !== booking.startsAt?.getTime() ||
        existing.scheduledEndsAt?.getTime() !== booking.endsAt?.getTime())
    ) {
      await tx
        .update(jobs)
        .set({
          scheduledStartsAt: booking.startsAt,
          scheduledEndsAt: booking.endsAt,
          status: booking.assignedMembershipId
            ? "TEAM_ASSIGNED"
            : booking.startsAt
              ? "SCHEDULED"
              : "CREATED",
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, existing.id));
      await recordJobChange(tx, {
        jobId: existing.id,
        organisationId: booking.organisationId,
        actorAccountId: input.actorAccountId,
        action: "RESCHEDULED",
        fromStatus: existing.status,
        toStatus: booking.assignedMembershipId
          ? "TEAM_ASSIGNED"
          : booking.startsAt
            ? "SCHEDULED"
            : "CREATED",
        correlationId: input.correlationId,
      });
    }
    if (existing && booking.assignedMembershipId) {
      const [assignment] = await tx
        .insert(jobAssignments)
        .values({
          jobId: existing.id,
          organisationId: booking.organisationId,
          membershipId: booking.assignedMembershipId,
          assignedByAccountId: input.actorAccountId,
          reason: "Copied from the confirmed booking assignment.",
        })
        .onConflictDoNothing()
        .returning({ id: jobAssignments.id });
      if (assignment) {
        await recordJobChange(tx, {
          jobId: existing.id,
          organisationId: booking.organisationId,
          actorAccountId: input.actorAccountId,
          action: "ASSIGNED",
          fromStatus: existing.status,
          toStatus: "TEAM_ASSIGNED",
          correlationId: input.correlationId,
          payload: { membershipId: booking.assignedMembershipId },
        });
      }
    }
    return existing?.id ?? null;
  }
  if (booking.assignedMembershipId) {
    await tx.insert(jobAssignments).values({
      jobId: created.id,
      organisationId: booking.organisationId,
      membershipId: booking.assignedMembershipId,
      assignedByAccountId: input.actorAccountId,
      reason: "Copied from the confirmed booking assignment.",
    });
  }
  await tx.insert(jobChecklistItems).values(
    [
      `Confirm ${booking.serviceName.toLowerCase()} requirements with the client`,
      "Complete the agreed service scope",
      "Review the work area, results, and safety",
    ].map((label, position) => ({
      jobId: created.id,
      label,
      required: true,
      position,
    })),
  );
  await tx.insert(jobCommercialHistory).values({
    jobId: created.id,
    entryType: "BOOKING_SNAPSHOT",
    descriptionSnapshot: booking.scope,
    amountMinor: booking.totalMinor,
    currency: booking.currency,
    totalAfterMinor: booking.totalMinor,
  });
  await tx
    .insert(engagementConversations)
    .values({ contextType: "JOB", contextId: created.id })
    .onConflictDoNothing();
  await recordJobChange(tx, {
    jobId: created.id,
    organisationId: booking.organisationId,
    actorAccountId: input.actorAccountId,
    action: "CREATED",
    fromStatus: null,
    toStatus: initialStatus,
    correlationId: input.correlationId,
    payload: { bookingId: booking.id },
  });
  if (booking.assignedMembershipId) {
    await recordJobChange(tx, {
      jobId: created.id,
      organisationId: booking.organisationId,
      actorAccountId: input.actorAccountId,
      action: "ASSIGNED",
      fromStatus: initialStatus,
      toStatus: initialStatus,
      correlationId: input.correlationId,
      payload: { membershipId: booking.assignedMembershipId },
    });
  }
  return created.id;
}

export async function cancelJobForBooking(
  tx: Tx,
  input: {
    bookingId: string;
    actorAccountId: string;
    reason: string;
    correlationId?: string;
  },
): Promise<boolean> {
  const [job] = await tx
    .select({
      id: jobs.id,
      organisationId: jobs.organisationId,
      status: jobs.status,
    })
    .from(jobs)
    .where(eq(jobs.bookingId, input.bookingId))
    .limit(1);
  if (!job || job.status === "CANCELLED") return true;
  if (
    !["CREATED", "SCHEDULED", "TEAM_ASSIGNED", "EN_ROUTE"].includes(
      job.status,
    )
  ) {
    return false;
  }
  await tx
    .update(jobs)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      lockVersion: sql`${jobs.lockVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
  await recordJobChange(tx, {
    jobId: job.id,
    organisationId: job.organisationId,
    actorAccountId: input.actorAccountId,
    action: "CANCEL",
    fromStatus: job.status,
    toStatus: "CANCELLED",
    reason: input.reason,
    correlationId: input.correlationId,
  });
  return true;
}

function professionalScope(scope: ProfessionalJobScope): SQL<unknown> {
  return and(
    eq(jobs.organisationId, scope.organisationId),
    ...(scope.assignedJobsOnly
      ? [
          sql`exists (
            select 1 from ${jobAssignments}
            where ${jobAssignments.jobId} = ${jobs.id}
              and ${jobAssignments.membershipId} = ${scope.membershipId}
              and ${jobAssignments.active} = true
          )`,
        ]
      : []),
  )!;
}

async function ensureJobConversation(db: Db, jobId: string) {
  const [created] = await db
    .insert(engagementConversations)
    .values({ contextType: "JOB", contextId: jobId })
    .onConflictDoNothing()
    .returning({ id: engagementConversations.id });
  if (created) return created.id;
  const [existing] = await db
    .select({ id: engagementConversations.id })
    .from(engagementConversations)
    .where(
      and(
        eq(engagementConversations.contextType, "JOB"),
        eq(engagementConversations.contextId, jobId),
      ),
    )
    .limit(1);
  return existing.id;
}

async function recordJobChange(
  tx: Tx,
  input: {
    jobId: string;
    organisationId: string;
    actorAccountId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    reason?: string;
    clientVisible?: boolean;
    correlationId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const [history] = await tx
    .insert(jobHistory)
    .values({
      jobId: input.jobId,
      actorAccountId: input.actorAccountId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      clientVisible: input.clientVisible ?? true,
    })
    .returning({ id: jobHistory.id });
  const [conversation] = await tx
    .select({ id: engagementConversations.id })
    .from(engagementConversations)
    .where(
      and(
        eq(engagementConversations.contextType, "JOB"),
        eq(engagementConversations.contextId, input.jobId),
      ),
    )
    .limit(1);
  if (conversation) {
    await tx.insert(engagementActivities).values({
      conversationId: conversation.id,
      sourceType: "JOB_HISTORY",
      sourceId: history.id,
      activityType: input.action,
      actorAccountId: input.actorAccountId,
      summary: jobActivitySummary(input.action),
      metadata: {
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        clientVisible: input.clientVisible ?? true,
        ...input.payload,
      },
    });
  }
  const eventType = jobEventType(input.action);
  await tx.insert(outboxEvents).values([
    {
      eventType,
      eventVersion: 1,
      aggregateType: "job",
      aggregateId: input.jobId,
      organisationId: input.organisationId,
      actorAccountId: input.actorAccountId,
      correlationId: input.correlationId,
      payload: {
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        historyId: history.id,
        ...input.payload,
      },
    },
    {
      eventType: "engagement.activity_recorded",
      eventVersion: 1,
      aggregateType: "job",
      aggregateId: input.jobId,
      organisationId: input.organisationId,
      actorAccountId: input.actorAccountId,
      correlationId: input.correlationId,
      payload: {
        contextType: "JOB",
        contextId: input.jobId,
        action: input.action,
        clientVisible: input.clientVisible ?? true,
      },
    },
  ]);
}

export function resolveJobTransition(
  status: JobStatus,
  action: "CHECK_IN" | "START" | "HOLD" | "RESUME" | "READY" | "CANCEL",
): { status: JobStatus } | null {
  if (
    action === "CANCEL" &&
    !["COMPLETED", "CANCELLED", "DISPUTED"].includes(status)
  ) {
    return { status: "CANCELLED" };
  }
  const transitions: Partial<Record<JobStatus, Partial<Record<string, JobStatus>>>> =
    {
      CREATED: { START: "IN_PROGRESS" },
      SCHEDULED: { CHECK_IN: "EN_ROUTE", START: "IN_PROGRESS" },
      TEAM_ASSIGNED: { CHECK_IN: "EN_ROUTE", START: "IN_PROGRESS" },
      EN_ROUTE: { START: "IN_PROGRESS" },
      IN_PROGRESS: { HOLD: "ON_HOLD", READY: "AWAITING_CLIENT_CONFIRMATION" },
      ON_HOLD: { RESUME: "IN_PROGRESS" },
      RETURN_VISIT_REQUIRED: {
        CHECK_IN: "EN_ROUTE",
        START: "IN_PROGRESS",
        READY: "AWAITING_CLIENT_CONFIRMATION",
      },
    };
  const next = transitions[status]?.[action];
  return next ? { status: next } : null;
}

async function hasScheduleConflict(
  tx: Tx,
  input: {
    bookingId: string;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
  },
) {
  const [conflict] = await tx
    .select({ id: bookingReservations.id })
    .from(bookingReservations)
    .where(
      and(
        eq(bookingReservations.membershipId, input.membershipId),
        eq(bookingReservations.status, "ACTIVE"),
        ne(bookingReservations.bookingId, input.bookingId),
        sql`${bookingReservations.startsAt} < ${input.endsAt}`,
        sql`${bookingReservations.endsAt} > ${input.startsAt}`,
      ),
    )
    .limit(1);
  return Boolean(conflict);
}

const terminalJobStatuses: JobStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];

function jobEventType(action: string) {
  const types: Record<string, string> = {
    CREATED: "job.created",
    ASSIGNED: "job.assigned",
    UNASSIGNED: "job.assigned",
    CHECK_IN: "job.progress_updated",
    START: "job.started",
    HOLD: "job.progress_updated",
    RESUME: "job.progress_updated",
    READY: "job.awaiting_confirmation",
    CANCEL: "job.progress_updated",
    CHECKLIST_COMPLETED: "job.progress_updated",
    CHECKLIST_REOPENED: "job.progress_updated",
    PROGRESS_UPDATED: "job.progress_updated",
    EVIDENCE_ADDED: "attachment.added",
    VARIATION_REQUESTED: "job.variation_requested",
    VARIATION_APPROVED: "job.variation_approved",
    VARIATION_REJECTED: "job.progress_updated",
    VARIATION_WITHDRAWN: "job.progress_updated",
    COMPLETION_CONFIRMED: "job.completed",
    UNRESOLVED_REPORTED: "job.progress_updated",
    CLARIFICATION_REQUESTED: "job.progress_updated",
  };
  return types[action] ?? "job.progress_updated";
}

function jobActivitySummary(action: string) {
  const summaries: Record<string, string> = {
    CREATED: "Job created from the confirmed booking.",
    ASSIGNED: "A team member was assigned.",
    UNASSIGNED: "A team assignment was removed.",
    CHECK_IN: "The team is en route.",
    START: "Work started.",
    HOLD: "Work was put on hold.",
    RESUME: "Work resumed.",
    READY: "Work is ready for client confirmation.",
    CHECKLIST_COMPLETED: "A checklist item was completed.",
    CHECKLIST_REOPENED: "A checklist item was reopened.",
    PROGRESS_UPDATED: "A job progress update was added.",
    EVIDENCE_ADDED: "New job evidence was added.",
    VARIATION_REQUESTED: "Additional work was submitted for approval.",
    VARIATION_APPROVED: "The client approved additional work.",
    VARIATION_REJECTED: "The client rejected additional work.",
    VARIATION_WITHDRAWN: "The additional work request was withdrawn.",
    COMPLETION_CONFIRMED: "The client confirmed completion.",
    UNRESOLVED_REPORTED: "The client reported unresolved work.",
    CLARIFICATION_REQUESTED: "The client requested clarification.",
  };
  return summaries[action] ?? "Job updated.";
}

function mapUpdate(row: typeof jobUpdates.$inferSelect): JobUpdate {
  return {
    id: row.id,
    updateType: row.updateType as JobUpdate["updateType"],
    visibility: row.visibility as JobUpdate["visibility"],
    content: row.content,
    quantity: row.quantity,
    amountMinor: row.amountMinor,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapEvidence(row: typeof jobEvidence.$inferSelect): JobEvidenceItem {
  return {
    id: row.id,
    assetId: row.assetId,
    evidenceType: row.evidenceType as JobEvidenceItem["evidenceType"],
    visibility: row.visibility as JobEvidenceItem["visibility"],
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapVariation(row: typeof jobVariations.$inferSelect): JobVariation {
  return {
    id: row.id,
    sequence: row.sequence,
    status: row.status as JobVariation["status"],
    description: row.description,
    reason: row.reason,
    additionalAmountMinor: row.additionalAmountMinor,
    currency: row.currency,
    scheduleImpactMinutes: row.scheduleImpactMinutes,
    submittedAt: iso(row.submittedAt),
    expiresAt: iso(row.expiresAt),
    respondedAt: iso(row.respondedAt),
    responseComment: row.responseComment,
  };
}

function mapCompletion(
  row: typeof jobCompletionResponses.$inferSelect,
): JobCompletionResponse {
  return {
    id: row.id,
    attempt: row.attempt,
    responseType: row.responseType as JobCompletionResponse["responseType"],
    comments: row.comments,
    createdAt: row.createdAt.toISOString(),
  };
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}
