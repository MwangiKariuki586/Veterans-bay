import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import {
  WarrantiesRepository,
  type ProfessionalWarrantyScope,
} from "./repository";
import type {
  WarrantyDetail,
  WarrantyPage,
  WarrantyStatus,
} from "./types";

export class WarrantiesService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: WarrantiesRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  listProfessional(input: {
    scope: ProfessionalWarrantyScope;
    status?: WarrantyStatus;
    page: number;
    pageSize: number;
  }): Promise<WarrantyPage> {
    return this.store.listProfessional(input);
  }

  async listClient(input: {
    authUserId: string;
    status?: WarrantyStatus;
    page: number;
    pageSize: number;
  }): Promise<WarrantyPage> {
    const account = await this.activeAccount(input.authUserId);
    return this.store.listClient({
      clientAccountId: account.id,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async getProfessional(
    warrantyId: string,
    scope: ProfessionalWarrantyScope,
  ) {
    return requireWarranty(
      await this.store.getProfessional(warrantyId, scope),
    );
  }

  async getClient(authUserId: string, warrantyId: string) {
    const account = await this.activeAccount(authUserId);
    return requireWarranty(
      await this.store.getClient(warrantyId, account.id),
    );
  }

  async ensureFromJob(input: {
    jobId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    correlationId?: string;
  }) {
    const warrantyId = await this.store.ensureFromJob({
      jobId: input.jobId,
      organisationId: input.scope.organisationId,
      actorAccountId: input.actorAccountId,
      correlationId: input.correlationId,
    });
    if (!warrantyId) {
      throw invalidClaim(
        "This completed job does not have eligible warranty terms.",
      );
    }
    return this.getProfessional(warrantyId, input.scope);
  }

  async submitClaim(input: {
    authUserId: string;
    warrantyId: string;
    subject: string;
    description: string;
    preferredResolution?: string;
    evidenceAssetIds: string[];
    correlationId?: string;
  }) {
    const account = await this.activeAccount(input.authUserId);
    const claimId = await this.store.submitClaim({
      ...input,
      clientAccountId: account.id,
    });
    if (!claimId) {
      throw invalidClaim(
        "The warranty is expired, another claim is open, or the evidence is unavailable.",
      );
    }
    return this.getClient(input.authUserId, input.warrantyId);
  }

  async actOnClaim(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    lockVersion: number;
    action: "START_REVIEW" | "ACCEPT" | "REJECT" | "ESCALATE";
    reason?: string;
    correlationId?: string;
  }) {
    const warrantyId = await this.store.actOnClaim({
      ...input,
      expectedLockVersion: input.lockVersion,
    });
    if (!warrantyId) throw staleClaim();
    return this.getProfessional(warrantyId, input.scope);
  }

  async escalateClient(input: {
    authUserId: string;
    warrantyId: string;
    claimId: string;
    lockVersion: number;
    reason: string;
    correlationId?: string;
  }) {
    const account = await this.activeAccount(input.authUserId);
    const warrantyId = await this.store.escalateClient({
      ...input,
      clientAccountId: account.id,
      expectedLockVersion: input.lockVersion,
    });
    if (!warrantyId) throw staleClaim();
    return this.getClient(input.authUserId, warrantyId);
  }

  async scheduleReturnVisit(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    lockVersion: number;
    startsAt: string;
    endsAt: string;
    reason?: string;
    correlationId?: string;
  }) {
    const warrantyId = await this.store.scheduleReturnVisit({
      ...input,
      expectedLockVersion: input.lockVersion,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
    if (!warrantyId) {
      throw invalidClaim(
        "The accepted claim changed or the return-visit schedule is invalid.",
      );
    }
    return this.getProfessional(warrantyId, input.scope);
  }

  async resolveClaim(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    lockVersion: number;
    resolutionNotes: string;
    evidenceAssetIds: string[];
    correlationId?: string;
  }) {
    const warrantyId = await this.store.resolveClaim({
      ...input,
      expectedLockVersion: input.lockVersion,
    });
    if (!warrantyId) throw staleClaim();
    return this.getProfessional(warrantyId, input.scope);
  }

  private async activeAccount(authUserId: string) {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    return profile;
  }
}

function requireWarranty(warranty: WarrantyDetail | null) {
  if (!warranty) {
    throw new AppError({
      code: "WARRANTY_NOT_FOUND",
      message: "The warranty was not found.",
      status: 404,
    });
  }
  return warranty;
}

function invalidClaim(message: string) {
  return new AppError({
    code: "INVALID_WARRANTY_CLAIM",
    message,
    status: 422,
  });
}

function staleClaim() {
  return new AppError({
    code: "STALE_WARRANTY_CLAIM",
    message: "The warranty claim changed. Refresh it before trying again.",
    status: 409,
  });
}
