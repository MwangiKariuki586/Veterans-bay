import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import {
  JobsRepository,
  type ProfessionalJobScope,
} from "./repository";
import type {
  EngagementConversation,
} from "../conversations/types";
import type {
  JobDetail,
  JobEvidenceItem,
  JobPage,
  JobStatus,
} from "./types";

export class JobsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: JobsRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  listProfessional(input: {
    scope: ProfessionalJobScope;
    status?: JobStatus;
    page: number;
    pageSize: number;
  }): Promise<JobPage> {
    return this.store.listProfessional(input);
  }

  async listClient(input: {
    authUserId: string;
    status?: JobStatus;
    page: number;
    pageSize: number;
  }): Promise<JobPage> {
    const account = await this.activeAccount(input.authUserId);
    return this.store.listClient({
      clientAccountId: account.id,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async getProfessional(
    jobId: string,
    scope: ProfessionalJobScope,
  ): Promise<JobDetail> {
    return requireJob(await this.store.getProfessional(jobId, scope));
  }

  async getClient(authUserId: string, jobId: string): Promise<JobDetail> {
    const account = await this.activeAccount(authUserId);
    return requireJob(await this.store.getClient(jobId, account.id));
  }

  async createFromBooking(input: {
    bookingId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    correlationId?: string;
  }) {
    const jobId = await this.store.ensureFromBooking({
      bookingId: input.bookingId,
      actorAccountId: input.actorAccountId,
      organisationId: input.scope.organisationId,
      correlationId: input.correlationId,
    });
    if (!jobId) throw invalidJob("The booking is not eligible for job creation.");
    return this.getProfessional(jobId, input.scope);
  }

  async assign(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    membershipId: string;
    lockVersion: number;
    reason?: string;
    correlationId?: string;
  }) {
    const result = await this.store.assign({
      jobId: input.jobId,
      organisationId: input.scope.organisationId,
      actorAccountId: input.actorAccountId,
      membershipId: input.membershipId,
      expectedLockVersion: input.lockVersion,
      reason: input.reason,
      correlationId: input.correlationId,
    });
    requireMutation(result);
    return this.getProfessional(input.jobId, {
      ...input.scope,
      assignedJobsOnly: false,
    });
  }

  async unassign(input: {
    jobId: string;
    assignmentId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    lockVersion: number;
    reason?: string;
    correlationId?: string;
  }) {
    const result = await this.store.unassign({
      jobId: input.jobId,
      assignmentId: input.assignmentId,
      organisationId: input.scope.organisationId,
      actorAccountId: input.actorAccountId,
      expectedLockVersion: input.lockVersion,
      reason: input.reason,
      correlationId: input.correlationId,
    });
    requireMutation(result);
    return this.getProfessional(input.jobId, {
      ...input.scope,
      assignedJobsOnly: false,
    });
  }

  async transition(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    lockVersion: number;
    action: "CHECK_IN" | "START" | "HOLD" | "RESUME" | "READY" | "CANCEL";
    reason?: string;
    correlationId?: string;
  }) {
    const result = await this.store.transition({
      ...input,
      expectedLockVersion: input.lockVersion,
    });
    if (result === "checklist") {
      throw invalidJob("Complete all required checklist items first.");
    }
    if (result === "evidence") {
      throw invalidJob(
        "Add client-visible after-work or completion evidence first.",
      );
    }
    if (result === "variation") {
      throw invalidJob(
        "Resolve or withdraw every open variation before requesting completion.",
      );
    }
    requireMutation(result);
    return this.getProfessional(input.jobId, input.scope);
  }

  async setChecklist(input: {
    jobId: string;
    checklistItemId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    completed: boolean;
    resultNote?: string;
    correlationId?: string;
  }) {
    if (!(await this.store.setChecklist(input))) {
      throw jobNotFound();
    }
    return this.getProfessional(input.jobId, input.scope);
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
  }) {
    if (!(await this.store.addUpdate(input))) throw jobNotFound();
    return this.getProfessional(input.jobId, input.scope);
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
  }) {
    if (!(await this.store.addEvidence(input))) {
      throw invalidJob(
        "The job or evidence is unavailable, or the evidence is not owned by this member.",
      );
    }
    return this.getProfessional(input.jobId, input.scope);
  }

  async createVariation(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    description: string;
    reason: string;
    additionalAmountMinor: number;
    scheduleImpactMinutes: number;
    expiresAt?: string;
  }) {
    const id = await this.store.createVariation({
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    if (!id) throw invalidJob("A variation cannot be created in this job state.");
    return this.getProfessional(input.jobId, input.scope);
  }

  async submitVariation(input: {
    jobId: string;
    variationId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    expiresAt?: string;
    correlationId?: string;
  }) {
    const validExpiry = input.expiresAt
      ? futureDate(input.expiresAt, "expiresAt")
      : undefined;
    if (
      !(await this.store.submitVariation({
        ...input,
        expiresAt: validExpiry,
      }))
    ) {
      throw staleJob();
    }
    return this.getProfessional(input.jobId, input.scope);
  }

  async withdrawVariation(input: {
    jobId: string;
    variationId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    correlationId?: string;
  }) {
    if (!(await this.store.withdrawVariation(input))) throw staleJob();
    return this.getProfessional(input.jobId, input.scope);
  }

  async respondVariation(input: {
    authUserId: string;
    jobId: string;
    variationId: string;
    decision: "ACCEPT" | "REJECT";
    comment?: string;
    correlationId?: string;
  }) {
    const account = await this.activeAccount(input.authUserId);
    const result = await this.store.respondVariation({
      ...input,
      clientAccountId: account.id,
    });
    requireMutation(result);
    return requireJob(await this.store.getClient(input.jobId, account.id));
  }

  async respondCompletion(input: {
    authUserId: string;
    jobId: string;
    response:
      | "CONFIRM"
      | "CONFIRM_WITH_COMMENTS"
      | "UNRESOLVED"
      | "CLARIFICATION";
    comments?: string;
    correlationId?: string;
  }) {
    const account = await this.activeAccount(input.authUserId);
    const result = await this.store.respondCompletion({
      ...input,
      clientAccountId: account.id,
    });
    requireMutation(result);
    return requireJob(await this.store.getClient(input.jobId, account.id));
  }

  async getProfessionalConversation(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
  }): Promise<EngagementConversation> {
    return requireConversation(
      await this.store.loadConversation({
        ...input,
        role: "PROFESSIONAL",
      }),
    );
  }

  async sendProfessionalMessage(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    idempotencyKey: string;
    body: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    return requireConversation(
      await this.store.sendConversationMessage({
        ...input,
        role: "PROFESSIONAL",
      }),
    );
  }

  async markProfessionalConversationRead(input: {
    jobId: string;
    scope: ProfessionalJobScope;
    actorAccountId: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    return requireConversation(
      await this.store.markConversationRead({
        ...input,
        role: "PROFESSIONAL",
      }),
    );
  }

  async getClientConversation(
    authUserId: string,
    jobId: string,
  ): Promise<EngagementConversation> {
    const account = await this.activeAccount(authUserId);
    return requireConversation(
      await this.store.loadConversation({
        jobId,
        actorAccountId: account.id,
        role: "CLIENT",
      }),
    );
  }

  async sendClientMessage(input: {
    authUserId: string;
    jobId: string;
    idempotencyKey: string;
    body: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const account = await this.activeAccount(input.authUserId);
    return requireConversation(
      await this.store.sendConversationMessage({
        jobId: input.jobId,
        actorAccountId: account.id,
        role: "CLIENT",
        idempotencyKey: input.idempotencyKey,
        body: input.body,
        correlationId: input.correlationId,
      }),
    );
  }

  async markClientConversationRead(input: {
    authUserId: string;
    jobId: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const account = await this.activeAccount(input.authUserId);
    return requireConversation(
      await this.store.markConversationRead({
        jobId: input.jobId,
        actorAccountId: account.id,
        role: "CLIENT",
        correlationId: input.correlationId,
      }),
    );
  }

  private async activeAccount(authUserId: string) {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    return profile;
  }
}

function requireConversation(
  value: EngagementConversation | null,
): EngagementConversation {
  if (!value) {
    throw new AppError({
      code: "CONVERSATION_NOT_AVAILABLE",
      message: "This job conversation is unavailable.",
      status: 404,
    });
  }
  return value;
}

function requireJob(value: JobDetail | null): JobDetail {
  if (!value) throw jobNotFound();
  return value;
}

function requireMutation(
  result:
    | "updated"
    | "not_found"
    | "stale"
    | "invalid"
    | "conflict"
    | "checklist"
    | "evidence"
    | "variation",
) {
  if (result === "updated") return;
  if (result === "not_found") throw jobNotFound();
  if (result === "stale") throw staleJob();
  if (result === "conflict") {
    throw new AppError({
      code: "JOB_ASSIGNMENT_CONFLICT",
      message:
        "The selected member is unavailable for this job schedule or the job can no longer be assigned.",
      status: 409,
    });
  }
  throw invalidJob("This action is not available in the current job state.");
}

function jobNotFound() {
  return new AppError({
    code: "JOB_NOT_FOUND",
    message: "The requested job was not found.",
    status: 404,
  });
}

function staleJob() {
  return new AppError({
    code: "JOB_STALE",
    message: "This job changed. Refresh it before continuing.",
    status: 409,
  });
}

function invalidJob(message: string) {
  return new AppError({ code: "JOB_ACTION_INVALID", message, status: 409 });
}

function futureDate(value: string, path: string) {
  const date = new Date(value);
  if (date <= new Date()) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Choose a future expiry time.",
      status: 422,
      issues: [{ code: "invalid", path }],
    });
  }
  return date;
}
