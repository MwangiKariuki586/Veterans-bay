import { AppError } from "../../platform/errors/app-error";
import type {
  AccountProfileRecord,
  ActiveRestriction,
  AuthUserInput,
  IdentityStore,
} from "./repository";

export class AccountRestrictedError extends AppError {
  constructor() {
    super({
      code: "ACCOUNT_RESTRICTED",
      message: "This account cannot perform protected actions.",
      status: 403,
    });
    this.name = "AccountRestrictedError";
  }
}

export class AccountDeactivatedError extends AppError {
  constructor() {
    super({
      code: "ACCOUNT_DEACTIVATED",
      message: "This account has been deactivated.",
      status: 403,
    });
    this.name = "AccountDeactivatedError";
  }
}

export class IdentityService {
  constructor(private readonly repository: IdentityStore) {}

  async reconcileRegisteredUser(
    user: AuthUserInput,
    options: { acceptTerms: boolean; acceptPrivacy: boolean; correlationId?: string },
  ): Promise<AccountProfileRecord> {
    const profile = await this.repository.reconcileProfile(user, {
      acceptTerms: options.acceptTerms,
      acceptPrivacy: options.acceptPrivacy,
    });

    await this.repository.recordAuditEvent({
      actorAccountId: profile.id,
      action: "user.registered",
      entityType: "account_profile",
      entityId: profile.id,
      correlationId: options.correlationId,
    });

    await this.repository.insertDomainEvent({
      eventType: "user.registered",
      eventVersion: 1,
      aggregateType: "account_profile",
      aggregateId: profile.id,
      actorAccountId: profile.id,
      correlationId: options.correlationId,
      payload: {
        authUserId: profile.authUserId,
        primaryEmail: profile.primaryEmail,
      },
    });

    return profile;
  }

  async requireActiveAccount(authUserId: string): Promise<{
    profile: AccountProfileRecord;
    restrictions: ActiveRestriction[];
  }> {
    const profile = await this.repository.findProfileByAuthUserId(authUserId);

    if (!profile) {
      throw new AppError({
        code: "ACCOUNT_PROFILE_MISSING",
        message: "Account profile was not found.",
        status: 404,
      });
    }

    if (profile.status === "deactivated") {
      throw new AccountDeactivatedError();
    }

    const restrictions = await this.repository.findActiveRestrictions(profile.id);

    if (restrictions.length > 0) {
      throw new AccountRestrictedError();
    }

    return { profile, restrictions };
  }

  async getProfile(authUserId: string): Promise<AccountProfileRecord> {
    const { profile } = await this.requireActiveAccount(authUserId);
    return profile;
  }

  async updateProfile(
    authUserId: string,
    input: {
      displayName?: string;
      phone?: string | null;
      timezone?: string;
    },
    correlationId?: string,
  ): Promise<AccountProfileRecord> {
    const { profile } = await this.requireActiveAccount(authUserId);
    const updated = await this.repository.updateProfile(profile.id, input);

    await this.repository.recordAuditEvent({
      actorAccountId: updated.id,
      action: "user.profile_updated",
      entityType: "account_profile",
      entityId: updated.id,
      correlationId,
      metadata: input,
    });

    await this.repository.insertDomainEvent({
      eventType: "user.profile_updated",
      eventVersion: 1,
      aggregateType: "account_profile",
      aggregateId: updated.id,
      actorAccountId: updated.id,
      correlationId,
      payload: input,
    });

    return updated;
  }

  async deactivateAccount(
    authUserId: string,
    correlationId?: string,
  ): Promise<AccountProfileRecord> {
    const { profile } = await this.requireActiveAccount(authUserId);
    return this.repository.deactivateProfile(profile.id, correlationId);
  }
}
