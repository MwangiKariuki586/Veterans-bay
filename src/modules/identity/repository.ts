import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { accountRestrictions } from "../../platform/database/schema/account-restrictions";
import { auditEvents } from "../../platform/database/schema/audit-events";
import { fileAssets } from "../../platform/database/schema/file-assets";
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
  location: string | null;
  bio: string | null;
  avatarAssetId: string | null;
  avatarPublicId: string | null;
  avatarUrl: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  deactivatedAt: Date | null;
  personalDataRemovedAt: Date | null;
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
      location?: string | null;
      bio?: string | null;
      timezone?: string;
    },
  ): Promise<AccountProfileRecord>;
  findProfileById?(accountProfileId: string): Promise<AccountProfileRecord | null>;
  attachAvatar?(accountProfileId: string, assetId: string): Promise<AccountProfileRecord>;
  removeAvatar?(accountProfileId: string): Promise<AccountProfileRecord>;
  deactivateProfile(
    accountProfileId: string,
    correlationId?: string,
  ): Promise<AccountProfileRecord>;
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
          displayName: sql`case when ${accountProfiles.status} = 'active' then ${user.name} else ${accountProfiles.displayName} end`,
          primaryEmail: sql`case when ${accountProfiles.status} = 'active' then ${user.email.toLowerCase()} else ${accountProfiles.primaryEmail} end`,
          updatedAt: now,
          ...(options.acceptTerms ? { termsAcceptedAt: now } : {}),
          ...(options.acceptPrivacy ? { privacyAcceptedAt: now } : {}),
        },
      })
      .returning();

    if (!profile) throw new Error("Failed to reconcile account profile.");
    return this.mapRow(profile, null);
  }

  async findProfileByAuthUserId(
    authUserId: string,
  ): Promise<AccountProfileRecord | null> {
    const [row] = await this.db
      .select({
        profile: accountProfiles,
        avatarPublicId: fileAssets.cloudinaryPublicId,
      })
      .from(accountProfiles)
      .leftJoin(fileAssets, eq(fileAssets.id, accountProfiles.avatarAssetId))
      .where(eq(accountProfiles.authUserId, authUserId))
      .limit(1);

    if (!row) return null;
    return this.mapRow(row.profile, row.avatarPublicId);
  }

  async findProfileById(accountProfileId: string): Promise<AccountProfileRecord | null> {
    const [row] = await this.db
      .select({
        profile: accountProfiles,
        avatarPublicId: fileAssets.cloudinaryPublicId,
      })
      .from(accountProfiles)
      .leftJoin(fileAssets, eq(fileAssets.id, accountProfiles.avatarAssetId))
      .where(eq(accountProfiles.id, accountProfileId))
      .limit(1);

    if (!row) return null;
    return this.mapRow(row.profile, row.avatarPublicId);
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
      location?: string | null;
      bio?: string | null;
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
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(accountProfiles.id, accountProfileId))
      .returning();

    if (!profile) throw new Error("Account profile not found.");
    const resolved = await this.findProfileById!(profile.id);
    if (!resolved) throw new Error("Account profile not found after update.");
    return resolved;
  }

  async attachAvatar(accountProfileId: string, assetId: string): Promise<AccountProfileRecord> {
    const [asset] = await this.db.select().from(fileAssets).where(eq(fileAssets.id, assetId)).limit(1);
    if (!asset || asset.status !== "ready") {
      throw new Error("Avatar asset is not ready.");
    }
    if (asset.purpose !== "AVATAR") {
      throw new Error("Asset purpose must be AVATAR.");
    }
    if (asset.ownerAccountId !== accountProfileId) {
      throw new Error("You do not own this asset.");
    }
    if (asset.visibility !== "public") {
      throw new Error("Avatar asset must be public.");
    }
    const [updated] = await this.db
      .update(accountProfiles)
      .set({ avatarAssetId: asset.id, updatedAt: new Date() })
      .where(eq(accountProfiles.id, accountProfileId))
      .returning();
    if (!updated) throw new Error("Account profile not found.");
    const resolved = await this.findProfileById!(updated.id);
    if (!resolved) throw new Error("Account profile not found after avatar update.");
    return resolved;
  }

  async removeAvatar(accountProfileId: string): Promise<AccountProfileRecord> {
    const [updated] = await this.db
      .update(accountProfiles)
      .set({ avatarAssetId: null, updatedAt: new Date() })
      .where(eq(accountProfiles.id, accountProfileId))
      .returning();
    if (!updated) throw new Error("Account profile not found.");
    const resolved = await this.findProfileById!(updated.id);
    if (!resolved) throw new Error("Account profile not found after avatar removal.");
    return resolved;
  }

  async deactivateProfile(
    accountProfileId: string,
    correlationId?: string,
  ): Promise<AccountProfileRecord> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [profile] = await tx
        .update(accountProfiles)
        .set({
          displayName: "Deactivated account",
          primaryEmail: `deactivated+${accountProfileId}@deleted.veteransbay.invalid`,
          phone: null,
          location: null,
          bio: null,
          avatarAssetId: null,
          timezone: "UTC",
          status: "deactivated",
          deactivatedAt: now,
          personalDataRemovedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(accountProfiles.id, accountProfileId),
            eq(accountProfiles.status, "active"),
          ),
        )
        .returning();
      if (!profile) {
        throw new Error("The account is not active.");
      }
      await tx.insert(auditEvents).values({
        actorAccountId: profile.id,
        action: "user.deactivated",
        entityType: "account_profile",
        entityId: profile.id,
        correlationId,
        metadata: {
          personalDataRemoved: true,
          transactionalHistoryRetained: true,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType: "user.deactivated",
        eventVersion: 1,
        aggregateType: "account_profile",
        aggregateId: profile.id,
        actorAccountId: profile.id,
        correlationId,
        payload: {
          accountProfileId: profile.id,
          personalDataRemoved: true,
          transactionalHistoryRetained: true,
        },
      });
      return this.mapRow(profile, null);
    });
  }

  private mapRow(
    profile: typeof accountProfiles.$inferSelect,
    avatarPublicId: string | null,
  ): AccountProfileRecord {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const avatarUrl =
      avatarPublicId && cloudName
        ? `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${avatarPublicId.split("/").map(encodeURIComponent).join("/")}`
        : avatarPublicId
          ? `https://res.cloudinary.com/image/upload/${avatarPublicId}`
          : null;
    return {
      id: profile.id,
      authUserId: profile.authUserId,
      displayName: profile.displayName,
      primaryEmail: profile.primaryEmail,
      phone: profile.phone,
      location: profile.location,
      bio: profile.bio,
      avatarAssetId: profile.avatarAssetId,
      avatarPublicId,
      avatarUrl,
      timezone: profile.timezone,
      status: profile.status,
      termsAcceptedAt: profile.termsAcceptedAt,
      privacyAcceptedAt: profile.privacyAcceptedAt,
      deactivatedAt: profile.deactivatedAt,
      personalDataRemovedAt: profile.personalDataRemovedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
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
