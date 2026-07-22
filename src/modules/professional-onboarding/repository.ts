import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { organisations } from "../../platform/database/schema/organisations";
import {
  professionalOnboardingHistory,
  professionalProfiles,
  professionalVerificationDocuments,
  type WorkingHours,
} from "../../platform/database/schema/professional-onboarding";
import {
  organisationMembershipHistory,
  organisationMembershipRoleHistory,
  organisationMemberships,
  roles,
} from "../../platform/database/schema/roles";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { auditEvents } from "../../platform/database/schema/audit-events";
import { AppError } from "../../platform/errors/app-error";

export interface OnboardingRecord {
  organisationId: string;
  professionalProfileId: string;
  name: string;
  slug: string;
  status: string;
  businessType: string | null;
  primaryCategory: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  operatingLocation: string | null;
  serviceAreas: string[];
  workingHours: WorkingHours;
  logoAssetId: string | null;
  verificationType: string | null;
  verificationReference: string | null;
  verificationStatus: string;
  termsAccepted: boolean;
  submittedAt: Date | null;
  updatedAt: Date;
}

export interface OnboardingAssetRecord {
  id: string;
  assetId: string;
  documentType: string;
  fileName: string;
}

export interface OnboardingHistoryRecord {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
}

export interface ProfessionalOnboardingStore {
  findOwned(accountProfileId: string): Promise<OnboardingRecord | null>;
  findByOrganisationId(organisationId: string): Promise<OnboardingRecord | null>;
  isActiveOrganisationMember(
    accountProfileId: string,
    organisationId: string,
  ): Promise<boolean>;
  listDocuments(profileId: string): Promise<OnboardingAssetRecord[]>;
  listHistory(organisationId: string): Promise<OnboardingHistoryRecord[]>;
  createDraft(input: {
    accountProfileId: string;
    name: string;
    slug: string;
    correlationId?: string;
  }): Promise<OnboardingRecord>;
  updateDraft(input: {
    accountProfileId: string;
    organisationId: string;
    values: Partial<{
      name: string;
      businessType: "independent" | "business" | null;
      primaryCategory: string | null;
      description: string | null;
      phone: string | null;
      email: string | null;
      operatingLocation: string | null;
      serviceAreas: string[];
      workingHours: WorkingHours;
      verificationType: string | null;
      verificationReference: string | null;
      termsAccepted: boolean;
      termsAcceptedAt: Date | null;
    }>;
  }): Promise<void>;
  attachAsset(input: {
    accountProfileId: string;
    organisationId: string;
    profileId: string;
    assetId: string;
    kind: "logo" | "verification_document";
    documentType?: string;
  }): Promise<void>;
  submit(input: {
    accountProfileId: string;
    organisationId: string;
    fromStatus: "draft" | "requires_changes";
    correlationId?: string;
  }): Promise<void>;
  recordReviewDecision(input: {
    organisationId: string;
    actorAccountId: string;
    fromStatus: "pending_review" | "active";
    toStatus: "active" | "requires_changes" | "deactivated" | "suspended";
    verificationStatus?: "verified" | "rejected";
    decision: "approve" | "request_changes" | "reject" | "suspend";
    reason: string;
    eventType:
      | "professional.profile_approved"
      | "professional.profile_changes_requested"
      | "professional.profile_rejected"
      | "professional.profile_suspended";
    correlationId?: string;
  }): Promise<void>;
}

function selectOwned(db: Database, accountProfileId: string) {
  return db
    .select({
      organisationId: organisations.id,
      professionalProfileId: professionalProfiles.id,
      name: organisations.name,
      slug: organisations.slug,
      status: organisations.status,
      businessType: professionalProfiles.businessType,
      primaryCategory: professionalProfiles.primaryCategory,
      description: professionalProfiles.description,
      phone: professionalProfiles.phone,
      email: professionalProfiles.email,
      operatingLocation: professionalProfiles.operatingLocation,
      serviceAreas: professionalProfiles.serviceAreas,
      workingHours: professionalProfiles.workingHours,
      logoAssetId: professionalProfiles.logoAssetId,
      verificationType: professionalProfiles.verificationType,
      verificationReference: professionalProfiles.verificationReference,
      verificationStatus: professionalProfiles.verificationStatus,
      termsAccepted: professionalProfiles.termsAccepted,
      submittedAt: professionalProfiles.submittedAt,
      updatedAt: professionalProfiles.updatedAt,
    })
    .from(professionalProfiles)
    .innerJoin(
      organisations,
      eq(professionalProfiles.organisationId, organisations.id),
    )
    .innerJoin(
      organisationMemberships,
      eq(organisationMemberships.organisationId, organisations.id),
    )
    .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
    .where(
      and(
        eq(organisationMemberships.accountProfileId, accountProfileId),
        eq(organisationMemberships.status, "active"),
        eq(roles.scope, "organisation"),
        eq(roles.key, "owner"),
      ),
    )
    .limit(1);
}

export class ProfessionalOnboardingRepository
  implements ProfessionalOnboardingStore
{
  constructor(private readonly db: Database) {}

  async findOwned(accountProfileId: string): Promise<OnboardingRecord | null> {
    const [record] = await selectOwned(this.db, accountProfileId);
    return record ?? null;
  }

  async findByOrganisationId(
    organisationId: string,
  ): Promise<OnboardingRecord | null> {
    const [record] = await this.db
      .select({
        organisationId: organisations.id,
        professionalProfileId: professionalProfiles.id,
        name: organisations.name,
        slug: organisations.slug,
        status: organisations.status,
        businessType: professionalProfiles.businessType,
        primaryCategory: professionalProfiles.primaryCategory,
        description: professionalProfiles.description,
        phone: professionalProfiles.phone,
        email: professionalProfiles.email,
        operatingLocation: professionalProfiles.operatingLocation,
        serviceAreas: professionalProfiles.serviceAreas,
        workingHours: professionalProfiles.workingHours,
        logoAssetId: professionalProfiles.logoAssetId,
        verificationType: professionalProfiles.verificationType,
        verificationReference: professionalProfiles.verificationReference,
        verificationStatus: professionalProfiles.verificationStatus,
        termsAccepted: professionalProfiles.termsAccepted,
        submittedAt: professionalProfiles.submittedAt,
        updatedAt: professionalProfiles.updatedAt,
      })
      .from(professionalProfiles)
      .innerJoin(
        organisations,
        eq(professionalProfiles.organisationId, organisations.id),
      )
      .where(eq(organisations.id, organisationId))
      .limit(1);
    return record ?? null;
  }

  async isActiveOrganisationMember(
    accountProfileId: string,
    organisationId: string,
  ): Promise<boolean> {
    const [membership] = await this.db
      .select({ id: organisationMemberships.id })
      .from(organisationMemberships)
      .where(
        and(
          eq(organisationMemberships.accountProfileId, accountProfileId),
          eq(organisationMemberships.organisationId, organisationId),
          eq(organisationMemberships.status, "active"),
        ),
      )
      .limit(1);
    return Boolean(membership);
  }

  async listDocuments(profileId: string): Promise<OnboardingAssetRecord[]> {
    return this.db
      .select({
        id: professionalVerificationDocuments.id,
        assetId: fileAssets.id,
        documentType: professionalVerificationDocuments.documentType,
        fileName: fileAssets.cloudinaryPublicId,
      })
      .from(professionalVerificationDocuments)
      .innerJoin(
        fileAssets,
        eq(professionalVerificationDocuments.assetId, fileAssets.id),
      )
      .where(
        eq(
          professionalVerificationDocuments.professionalProfileId,
          profileId,
        ),
      );
  }

  async listHistory(organisationId: string): Promise<OnboardingHistoryRecord[]> {
    return this.db
      .select({
        id: professionalOnboardingHistory.id,
        fromStatus: professionalOnboardingHistory.fromStatus,
        toStatus: professionalOnboardingHistory.toStatus,
        reason: professionalOnboardingHistory.reason,
        createdAt: professionalOnboardingHistory.createdAt,
      })
      .from(professionalOnboardingHistory)
      .where(eq(professionalOnboardingHistory.organisationId, organisationId))
      .orderBy(asc(professionalOnboardingHistory.createdAt));
  }

  async createDraft(input: {
    accountProfileId: string;
    name: string;
    slug: string;
    correlationId?: string;
  }): Promise<OnboardingRecord> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${input.accountProfileId}))`,
      );
      const [existing] = await selectOwned(
        tx as unknown as Database,
        input.accountProfileId,
      );
      if (existing) {
        throw new AppError({
          code: "ONBOARDING_ALREADY_EXISTS",
          message: "A professional onboarding record already exists for this owner.",
          status: 409,
        });
      }

      const [ownerRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.key, "owner"), eq(roles.scope, "organisation")))
        .limit(1);

      if (!ownerRole) {
        throw new AppError({
          code: "FOUNDATION_INCOMPLETE",
          message: "The organisation owner role is not configured.",
          status: 503,
        });
      }

      const [organisation] = await tx
        .insert(organisations)
        .values({ name: input.name, slug: input.slug, status: "draft" })
        .returning();
      const [profile] = await tx
        .insert(professionalProfiles)
        .values({ organisationId: organisation.id })
        .returning();

      const [membership] = await tx.insert(organisationMemberships).values({
        organisationId: organisation.id,
        accountProfileId: input.accountProfileId,
        roleId: ownerRole.id,
        status: "active",
        financialDataAccess: true,
      }).returning({ id: organisationMemberships.id });
      await tx.insert(organisationMembershipHistory).values({
        membershipId: membership.id,
        organisationId: organisation.id,
        fromStatus: null,
        toStatus: "active",
        actorAccountId: input.accountProfileId,
        reason: "Organisation created",
      });
      await tx.insert(organisationMembershipRoleHistory).values({
        membershipId: membership.id,
        organisationId: organisation.id,
        fromRoleId: null,
        toRoleId: ownerRole.id,
        actorAccountId: input.accountProfileId,
      });
      await tx.insert(professionalOnboardingHistory).values({
        organisationId: organisation.id,
        fromStatus: null,
        toStatus: "draft",
        actorAccountId: input.accountProfileId,
      });
      await tx.insert(outboxEvents).values({
        eventType: "professional.onboarding_started",
        eventVersion: 1,
        aggregateType: "professional_profile",
        aggregateId: profile.id,
        organisationId: organisation.id,
        actorAccountId: input.accountProfileId,
        correlationId: input.correlationId,
        payload: { organisationId: organisation.id },
      });
    });

    const created = await this.findOwned(input.accountProfileId);
    if (!created) {
      throw new Error("Created onboarding record could not be loaded.");
    }
    return created;
  }

  async updateDraft(input: {
    accountProfileId: string;
    organisationId: string;
    values: Parameters<ProfessionalOnboardingStore["updateDraft"]>[0]["values"];
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (input.values.name !== undefined) {
        await tx
          .update(organisations)
          .set({ name: input.values.name, updatedAt: new Date() })
          .where(eq(organisations.id, input.organisationId));
      }
      const profileValues = { ...input.values };
      delete profileValues.name;
      if (Object.keys(profileValues).length > 0) {
        await tx
          .update(professionalProfiles)
          .set({ ...profileValues, updatedAt: new Date() })
          .where(eq(professionalProfiles.organisationId, input.organisationId));
      }
    });
  }

  async attachAsset(input: {
    accountProfileId: string;
    organisationId: string;
    profileId: string;
    assetId: string;
    kind: "logo" | "verification_document";
    documentType?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [asset] = await tx
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.accountProfileId),
            eq(fileAssets.organisationId, input.organisationId),
            eq(fileAssets.status, "ready"),
          ),
        )
        .limit(1);

      const requiredPurpose =
        input.kind === "logo" ? "PROFESSIONAL_LOGO" : "VERIFICATION_DOCUMENT";
      if (!asset || asset.purpose !== requiredPurpose) {
        throw new AppError({
          code: "INVALID_ONBOARDING_ASSET",
          message: "The uploaded asset is not eligible for this onboarding record.",
          status: 422,
        });
      }

      if (input.kind === "logo") {
        await tx
          .update(professionalProfiles)
          .set({ logoAssetId: asset.id, updatedAt: new Date() })
          .where(eq(professionalProfiles.id, input.profileId));
      } else {
        await tx.insert(professionalVerificationDocuments).values({
          professionalProfileId: input.profileId,
          assetId: asset.id,
          documentType: input.documentType ?? "verification evidence",
        });
      }

      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "professional_profile",
          linkedEntityId: input.profileId,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, asset.id));
    });
  }

  async submit(input: {
    accountProfileId: string;
    organisationId: string;
    fromStatus: "draft" | "requires_changes";
    correlationId?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(organisations)
        .set({ status: "pending_review", updatedAt: new Date() })
        .where(
          and(
            eq(organisations.id, input.organisationId),
            inArray(organisations.status, ["draft", "requires_changes"]),
          ),
        )
        .returning({ id: organisations.id });

      if (!updated) {
        throw new AppError({
          code: "INVALID_ONBOARDING_STATE",
          message: "This onboarding record cannot be submitted in its current state.",
          status: 409,
        });
      }

      const [profile] = await tx
        .update(professionalProfiles)
        .set({
          verificationStatus: "pending",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(professionalProfiles.organisationId, input.organisationId))
        .returning({ id: professionalProfiles.id });

      await tx.insert(professionalOnboardingHistory).values({
        organisationId: input.organisationId,
        fromStatus: input.fromStatus,
        toStatus: "pending_review",
        actorAccountId: input.accountProfileId,
      });
      await tx.insert(outboxEvents).values({
        eventType: "professional.profile_submitted",
        eventVersion: 1,
        aggregateType: "professional_profile",
        aggregateId: profile.id,
        organisationId: input.organisationId,
        actorAccountId: input.accountProfileId,
        correlationId: input.correlationId,
        payload: { organisationId: input.organisationId },
      });
    });
  }

  async recordReviewDecision(input: {
    organisationId: string;
    actorAccountId: string;
    fromStatus: "pending_review" | "active";
    toStatus: "active" | "requires_changes" | "deactivated" | "suspended";
    verificationStatus?: "verified" | "rejected";
    decision: "approve" | "request_changes" | "reject" | "suspend";
    reason: string;
    eventType:
      | "professional.profile_approved"
      | "professional.profile_changes_requested"
      | "professional.profile_rejected"
      | "professional.profile_suspended";
    correlationId?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${input.organisationId}))`,
      );
      const [organisation] = await tx
        .update(organisations)
        .set({ status: input.toStatus, updatedAt: new Date() })
        .where(
          and(
            eq(organisations.id, input.organisationId),
            eq(organisations.status, input.fromStatus),
          ),
        )
        .returning({ id: organisations.id });

      if (!organisation) {
        throw new AppError({
          code: "INVALID_REVIEW_TRANSITION",
          message: "This review decision is not valid in the current state.",
          status: 409,
        });
      }

      const [profile] = await tx
        .update(professionalProfiles)
        .set({
          ...(input.verificationStatus
            ? { verificationStatus: input.verificationStatus }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(professionalProfiles.organisationId, input.organisationId))
        .returning({ id: professionalProfiles.id });

      if (!profile) {
        throw new AppError({
          code: "ONBOARDING_NOT_FOUND",
          message: "Professional onboarding was not found.",
          status: 404,
        });
      }

      await tx.insert(professionalOnboardingHistory).values({
        organisationId: input.organisationId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: input.reason,
        actorAccountId: input.actorAccountId,
      });
      await tx.insert(auditEvents).values({
        actorAccountId: input.actorAccountId,
        organisationId: input.organisationId,
        action: input.eventType,
        entityType: "professional_profile",
        entityId: profile.id,
        correlationId: input.correlationId,
        metadata: {
          decision: input.decision,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
        },
      });
      await tx.insert(outboxEvents).values({
        eventType: input.eventType,
        eventVersion: 1,
        aggregateType: "professional_profile",
        aggregateId: profile.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          organisationId: input.organisationId,
          decision: input.decision,
          reason: input.reason,
        },
      });
    });
  }
}
