import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { accountRestrictions } from "../../platform/database/schema/account-restrictions";
import { auditEvents } from "../../platform/database/schema/audit-events";
import { outboxEvents } from "../../platform/database/schema/outbox-events";

export interface AuthUserInput {
  id: string;
  name: string;
  email: string;
}

export interface AccountProfileRecord {
  id: string;
  authUserId: string;
  displayName: string;
  primaryEmail: string;
  phone: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveRestriction {
  id: string;
  type: string;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface IdentityStore {
  reconcileProfile(
    user: AuthUserInput,
    options?: { acceptTerms: boolean; acceptPrivacy: boolean },
  ): Promise<AccountProfileRecord>;
  findProfileByAuthUserId(
    authUserId: string,
  ): Promise<AccountProfileRecord | null>;
  findActiveRestrictions(
    accountProfileId: string,
  ): Promise<ActiveRestriction[]>;
  updateProfile(
    accountProfileId: string,
    input: {
      displayName?: string;
      phone?: string | null;
      timezone?: string;
    },
  ): Promise<AccountProfileRecord>;
  deactivateProfile(accountProfileId: string): Promise<AccountProfileRecord>;
  recordAuditEvent(input: {
    actorAccountId: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  insertDomainEvent(input: {
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregateId: string;
    actorAccountId: string;
    correlationId?: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export class IdentityRepository implements IdentityStore {
  constructor(private readonly db: Database) {}

  async reconcileProfile(
    user: AuthUserInput,
    options: { acceptTerms: boolean; acceptPrivacy: boolean } = {
      acceptTerms: false,
      acceptPrivacy: false,
    },
  ): Promise<AccountProfileRecord> {
    const now = new Date();
    const [profile] = await this.db
      .insert(accountProfiles)
      .values({
        authUserId: user.id,
        displayName: user.name,
        primaryEmail: user.email.toLowerCase(),
        termsAcceptedAt: options.acceptTerms ? now : null,
        privacyAcceptedAt: options.acceptPrivacy ? now : null,
      })
      .onConflictDoUpdate({
        target: accountProfiles.authUserId,
        set: {
          displayName: user.name,
          primaryEmail: user.email.toLowerCase(),
          updatedAt: now,
          ...(options.acceptTerms ? { termsAcceptedAt: now } : {}),
          ...(options.acceptPrivacy ? { privacyAcceptedAt: now } : {}),
        },
      })
      .returning();

    return profile;
  }

  async findProfileByAuthUserId(
    authUserId: string,
  ): Promise<AccountProfileRecord | null> {
    const [profile] = await this.db
      .select()
      .from(accountProfiles)
      .where(eq(accountProfiles.authUserId, authUserId))
      .limit(1);

    return profile ?? null;
  }

  async findActiveRestrictions(
    accountProfileId: string,
  ): Promise<ActiveRestriction[]> {
    const now = new Date();

    return this.db
      .select({
        id: accountRestrictions.id,
        type: accountRestrictions.type,
        reason: accountRestrictions.reason,
        startsAt: accountRestrictions.startsAt,
        endsAt: accountRestrictions.endsAt,
      })
      .from(accountRestrictions)
      .where(
        and(
          eq(accountRestrictions.accountProfileId, accountProfileId),
          sql`${accountRestrictions.startsAt} <= ${now}`,
          or(
            isNull(accountRestrictions.endsAt),
            gt(accountRestrictions.endsAt, now),
          ),
        ),
      );
  }

  async updateProfile(
    accountProfileId: string,
    input: {
      displayName?: string;
      phone?: string | null;
      timezone?: string;
    },
  ): Promise<AccountProfileRecord> {
    const [profile] = await this.db
      .update(accountProfiles)
      .set({
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(accountProfiles.id, accountProfileId))
      .returning();

    return profile;
  }

  async deactivateProfile(accountProfileId: string): Promise<AccountProfileRecord> {
    const [profile] = await this.db
      .update(accountProfiles)
      .set({
        status: "deactivated",
        updatedAt: new Date(),
      })
      .where(eq(accountProfiles.id, accountProfileId))
      .returning();

    return profile;
  }

  async recordAuditEvent(input: {
    actorAccountId: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditEvents).values({
      actorAccountId: input.actorAccountId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
    });
  }

  async insertDomainEvent(input: {
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregateId: string;
    actorAccountId: string;
    correlationId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(outboxEvents).values({
      eventType: input.eventType,
      eventVersion: input.eventVersion,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorAccountId: input.actorAccountId,
      correlationId: input.correlationId,
      payload: input.payload,
    });
  }
}
