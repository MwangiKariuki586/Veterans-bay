import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
import { requirePlatformAdministrator } from "./authorization";
import type { AdministrationRepository } from "./repository";

export class AdministrationService {
  constructor(
    private readonly repository: AdministrationRepository,
    private readonly identityStore: IdentityStore,
    private readonly workspaceStore: Pick<
      WorkspaceRepository,
      "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
    >,
  ) {}

  async submitReport(
    authUserId: string,
    input: {
      category: string;
      subjectType: string;
      subjectId: string;
      organisationId?: string | null;
      summary: string;
      details: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireActiveAccount(authUserId);
    return this.repository.submitReport({
      submittedByAccountId: account.id,
      ...input,
    });
  }

  async listReports(authUserId: string, input: QueueInput) {
    await this.requireAdmin(authUserId);
    return page(await this.repository.listReports(input), input);
  }

  async openCase(
    authUserId: string,
    reportId: string,
    input: {
      subjectAccountId?: string | null;
      priority: string;
      reason: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireAdmin(authUserId);
    return this.repository.openCase({
      reportId,
      actorAccountId: account.id,
      ...input,
    });
  }

  async listCases(authUserId: string, input: QueueInput) {
    await this.requireAdmin(authUserId);
    return page(await this.repository.listCases(input), input);
  }

  async getCase(authUserId: string, caseId: string) {
    await this.requireAdmin(authUserId);
    const result = await this.repository.getCase(caseId);
    if (!result) {
      throw new AppError({
        code: "MODERATION_CASE_NOT_FOUND",
        message: "The moderation case was not found.",
        status: 404,
      });
    }
    return result;
  }

  async transitionCase(
    authUserId: string,
    caseId: string,
    input: {
      action: string;
      reason: string;
      evidenceSummary?: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireAdmin(authUserId);
    return this.repository.transitionCase({
      caseId,
      actorAccountId: account.id,
      ...input,
    });
  }

  async listDisputes(authUserId: string, input: QueueInput) {
    await this.requireAdmin(authUserId);
    return page(await this.repository.listDisputes(input), input);
  }

  async openDispute(
    authUserId: string,
    input: { jobId: string; reason: string; correlationId?: string },
  ) {
    const account = await this.requireActiveAccount(authUserId);
    return this.repository.openDispute({
      ...input,
      clientAccountId: account.id,
    });
  }

  async transitionDispute(
    authUserId: string,
    disputeId: string,
    input: {
      action: string;
      reason: string;
      evidenceSummary?: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireAdmin(authUserId);
    return this.repository.transitionDispute({
      disputeId,
      actorAccountId: account.id,
      ...input,
    });
  }

  async listEscalatedWarranties(authUserId: string, input: PageInput) {
    await this.requireAdmin(authUserId);
    return page(
      await this.repository.listEscalatedWarranties(input),
      input,
    );
  }

  async decideEscalatedWarranty(
    authUserId: string,
    claimId: string,
    input: {
      action: "RESOLVE" | "REJECT";
      reason: string;
      evidenceSummary: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireAdmin(authUserId);
    return this.repository.decideEscalatedWarranty({
      claimId,
      actorAccountId: account.id,
      ...input,
    });
  }

  async listAudit(
    authUserId: string,
    input: PageInput & { action?: string; entityType?: string },
  ) {
    await this.requireAdmin(authUserId);
    return page(await this.repository.listAudit(input), input);
  }

  async listRules(authUserId: string) {
    await this.requireAdmin(authUserId);
    return this.repository.listRules();
  }

  async upsertRule(
    authUserId: string,
    key: string,
    input: {
      name: string;
      description: string;
      value: Record<string, unknown>;
      status: string;
      reason: string;
      correlationId?: string;
    },
  ) {
    const account = await this.requireAdmin(authUserId);
    return this.repository.upsertRule({
      key,
      actorAccountId: account.id,
      ...input,
    });
  }

  private requireAdmin(authUserId: string) {
    return requirePlatformAdministrator(
      authUserId,
      this.identityStore,
      this.workspaceStore,
    );
  }

  private async requireActiveAccount(authUserId: string) {
    const account =
      await this.identityStore.findProfileByAuthUserId(authUserId);
    if (!account || account.status === "deactivated") {
      throw new AppError({
        code: "ACCOUNT_DEACTIVATED",
        message: "An active account is required.",
        status: 403,
      });
    }
    if (
      (await this.identityStore.findActiveRestrictions(account.id)).length > 0
    ) {
      throw new AppError({
        code: "ACCOUNT_RESTRICTED",
        message: "This account cannot submit reports.",
        status: 403,
      });
    }
    return account;
  }
}

type PageInput = { page: number; pageSize: number };
type QueueInput = PageInput & { status: string };

function page<T>(
  result: { items: T[]; totalItems: number },
  input: PageInput,
) {
  return {
    ...result,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(result.totalItems / input.pageSize)),
  };
}
