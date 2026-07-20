import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import type {
  OnboardingAssetRecord,
  OnboardingRecord,
  ProfessionalOnboardingStore,
} from "./repository";
import type { OnboardingSummary, OrganisationStatus } from "./types";

const editableStatuses = new Set(["draft", "requires_changes", "active"]);

function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "professional"}-${crypto.randomUUID().slice(0, 8)}`;
}

function readiness(record: OnboardingRecord, documents: OnboardingAssetRecord[]) {
  const required: Array<[string, boolean]> = [
    ["Business or professional name", record.name.trim().length >= 2],
    ["Business type", record.businessType !== null],
    ["Primary category", Boolean(record.primaryCategory)],
    ["Description (at least 80 characters)", (record.description?.length ?? 0) >= 80],
    ["Phone", Boolean(record.phone)],
    ["Email", Boolean(record.email)],
    ["Operating location", Boolean(record.operatingLocation)],
    ["At least one service area", record.serviceAreas.length > 0],
    [
      "Working hours",
      Object.values(record.workingHours).some(
        (day) => day.enabled && day.opensAt < day.closesAt,
      ),
    ],
    ["Professional logo", Boolean(record.logoAssetId)],
    ["Verification type", Boolean(record.verificationType)],
    ["Verification reference", Boolean(record.verificationReference)],
    ["Verification evidence", documents.length > 0],
    ["Professional terms acceptance", record.termsAccepted],
  ];
  const missingFields = required.filter(([, complete]) => !complete).map(([name]) => name);
  return {
    complete: missingFields.length === 0,
    completedCount: required.length - missingFields.length,
    totalCount: required.length,
    missingFields,
  };
}

export class ProfessionalOnboardingService {
  constructor(
    private readonly store: ProfessionalOnboardingStore,
    private readonly identityStore: IdentityStore,
  ) {}

  async get(authUserId: string): Promise<OnboardingSummary | null> {
    const account = await this.requireActiveAccount(authUserId);
    const record = await this.store.findOwned(account.id);
    if (!record) {
      return null;
    }
    return this.toSummary(record);
  }

  async create(input: {
    authUserId: string;
    name: string;
    correlationId?: string;
  }): Promise<OnboardingSummary> {
    const account = await this.requireActiveAccount(input.authUserId);
    const existing = await this.store.findOwned(account.id);
    if (existing) {
      throw new AppError({
        code: "ONBOARDING_ALREADY_EXISTS",
        message: "A professional onboarding record already exists for this owner.",
        status: 409,
      });
    }
    const record = await this.store.createDraft({
      accountProfileId: account.id,
      name: input.name,
      slug: slugify(input.name),
      correlationId: input.correlationId,
    });
    return this.toSummary(record);
  }

  async update(input: {
    authUserId: string;
    values: Parameters<ProfessionalOnboardingStore["updateDraft"]>[0]["values"];
  }): Promise<OnboardingSummary> {
    const account = await this.requireActiveAccount(input.authUserId);
    const record = await this.requireOwned(account.id);
    if (!editableStatuses.has(record.status)) {
      throw new AppError({
        code: "ONBOARDING_READ_ONLY",
        message: "This onboarding record is read-only in its current state.",
        status: 409,
      });
    }

    const values = {
      ...input.values,
      ...(input.values.termsAccepted !== undefined
        ? {
            termsAcceptedAt: input.values.termsAccepted
              ? record.termsAccepted
                ? undefined
                : new Date()
              : null,
          }
        : {}),
    };
    await this.store.updateDraft({
      accountProfileId: account.id,
      organisationId: record.organisationId,
      values,
    });
    return (await this.get(input.authUserId)) as OnboardingSummary;
  }

  async attachAsset(input: {
    authUserId: string;
    assetId: string;
    kind: "logo" | "verification_document";
    documentType?: string;
  }): Promise<OnboardingSummary> {
    const account = await this.requireActiveAccount(input.authUserId);
    const record = await this.requireOwned(account.id);
    if (!editableStatuses.has(record.status)) {
      throw new AppError({
        code: "ONBOARDING_READ_ONLY",
        message: "Evidence cannot be changed in the current state.",
        status: 409,
      });
    }
    if (input.kind === "verification_document" && !input.documentType) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "A document type is required for verification evidence.",
        status: 422,
      });
    }
    await this.store.attachAsset({
      accountProfileId: account.id,
      organisationId: record.organisationId,
      profileId: record.professionalProfileId,
      assetId: input.assetId,
      kind: input.kind,
      documentType: input.documentType,
    });
    return (await this.get(input.authUserId)) as OnboardingSummary;
  }

  async submit(input: {
    authUserId: string;
    correlationId?: string;
  }): Promise<OnboardingSummary> {
    const account = await this.requireActiveAccount(input.authUserId);
    const record = await this.requireOwned(account.id);
    if (record.status !== "draft" && record.status !== "requires_changes") {
      throw new AppError({
        code: "INVALID_ONBOARDING_STATE",
        message: "This onboarding record cannot be submitted in its current state.",
        status: 409,
      });
    }
    const documents = await this.store.listDocuments(record.professionalProfileId);
    const summary = await this.toSummary(record, documents);

    if (!summary.readiness.complete) {
      throw new AppError({
        code: "ONBOARDING_INCOMPLETE",
        message: "Complete all required onboarding fields before submission.",
        status: 422,
        issues: summary.readiness.missingFields.map(() => ({
          code: "required",
          path: "onboarding",
        })),
      });
    }

    await this.store.submit({
      accountProfileId: account.id,
      organisationId: record.organisationId,
      fromStatus: record.status,
      correlationId: input.correlationId,
    });
    return (await this.get(input.authUserId)) as OnboardingSummary;
  }

  private async toSummary(
    record: OnboardingRecord,
    suppliedDocuments?: OnboardingAssetRecord[],
  ): Promise<OnboardingSummary> {
    const [documents, history] = await Promise.all([
      suppliedDocuments ?? this.store.listDocuments(record.professionalProfileId),
      this.store.listHistory(record.organisationId),
    ]);
    return {
      ...record,
      status: record.status as OrganisationStatus,
      businessType: record.businessType as "independent" | "business" | null,
      submittedAt: record.submittedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
      documents,
      history: history.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      readiness: readiness(record, documents),
    };
  }

  private async requireOwned(accountProfileId: string) {
    const record = await this.store.findOwned(accountProfileId);
    if (!record) {
      throw new AppError({
        code: "ONBOARDING_NOT_FOUND",
        message: "Professional onboarding has not been started.",
        status: 404,
      });
    }
    return record;
  }

  private async requireActiveAccount(authUserId: string) {
    const account = await this.identityStore.findProfileByAuthUserId(authUserId);
    if (!account) {
      throw new AppError({
        code: "ACCOUNT_PROFILE_MISSING",
        message: "Account profile was not found.",
        status: 404,
      });
    }
    if (account.status === "deactivated") {
      throw new AppError({
        code: "ACCOUNT_DEACTIVATED",
        message: "This account has been deactivated.",
        status: 403,
      });
    }
    const restrictions = await this.identityStore.findActiveRestrictions(account.id);
    if (restrictions.length > 0) {
      throw new AppError({
        code: "ACCOUNT_RESTRICTED",
        message: "This account cannot perform protected actions.",
        status: 403,
      });
    }
    return account;
  }
}
