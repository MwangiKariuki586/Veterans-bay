import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type {
  OnboardingRecord,
  ProfessionalOnboardingStore,
} from "./repository";
import { ProfessionalOnboardingService } from "./service";

function account() {
  return {
    id: "profile-1",
    authUserId: "user-1",
    displayName: "Alex Veteran",
    primaryEmail: "alex@example.com",
    phone: null,
    timezone: "Africa/Nairobi",
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function identity(overrides: Partial<IdentityStore> = {}): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue(account()),
    findActiveRestrictions: vi.fn().mockResolvedValue([]),
    updateProfile: vi.fn(),
    deactivateProfile: vi.fn(),
    recordAuditEvent: vi.fn(),
    insertDomainEvent: vi.fn(),
    ...overrides,
  };
}

function onboarding(overrides: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return {
    organisationId: "organisation-1",
    professionalProfileId: "professional-profile-1",
    name: "ProLine Plumbing",
    slug: "proline-plumbing-1234",
    status: "draft",
    businessType: "business",
    primaryCategory: "Plumbing",
    description:
      "Experienced residential plumbing professionals serving planned maintenance and urgent repair needs.",
    phone: "+254700000000",
    email: "hello@proline.example",
    operatingLocation: "Nairobi, Kenya",
    serviceAreas: ["Westlands"],
    workingHours: {
      monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
    },
    logoAssetId: "logo-1",
    verificationType: "business_registration",
    verificationReference: "CPR-12345",
    verificationStatus: "not_started",
    termsAccepted: true,
    submittedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function store(record: OnboardingRecord | null): ProfessionalOnboardingStore {
  return {
    findOwned: vi.fn().mockResolvedValue(record),
    listDocuments: vi.fn().mockResolvedValue(
      record
        ? [
            {
              id: "document-1",
              assetId: "asset-1",
              documentType: "business registration",
              fileName: "private/document-1",
            },
          ]
        : [],
    ),
    listHistory: vi.fn().mockResolvedValue([]),
    createDraft: vi.fn().mockResolvedValue(record),
    updateDraft: vi.fn().mockResolvedValue(undefined),
    attachAsset: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ProfessionalOnboardingService", () => {
  it("creates one organisation draft and rejects a duplicate owner onboarding", async () => {
    const created = onboarding();
    const emptyStore = store(null);
    emptyStore.createDraft = vi.fn().mockResolvedValue(created);
    emptyStore.listDocuments = vi.fn().mockResolvedValue([]);
    const service = new ProfessionalOnboardingService(emptyStore, identity());

    const result = await service.create({
      authUserId: "user-1",
      name: "ProLine Plumbing",
    });

    expect(result.organisationId).toBe("organisation-1");
    expect(emptyStore.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ accountProfileId: "profile-1" }),
    );

    await expect(
      new ProfessionalOnboardingService(store(created), identity()).create({
        authUserId: "user-1",
        name: "Another business",
      }),
    ).rejects.toMatchObject({ code: "ONBOARDING_ALREADY_EXISTS" });
  });

  it("preserves a draft but blocks incomplete submission", async () => {
    const draft = onboarding({
      description: "Too short",
      logoAssetId: null,
      termsAccepted: false,
    });
    const repository = store(draft);
    repository.listDocuments = vi.fn().mockResolvedValue([]);
    const service = new ProfessionalOnboardingService(repository, identity());

    const summary = await service.get("user-1");
    expect(summary?.readiness.complete).toBe(false);
    expect(summary?.readiness.missingFields).toEqual(
      expect.arrayContaining([
        "Description (at least 80 characters)",
        "Professional logo",
        "Verification evidence",
        "Professional terms acceptance",
      ]),
    );
    await expect(service.submit({ authUserId: "user-1" })).rejects.toMatchObject({
      code: "ONBOARDING_INCOMPLETE",
    });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("submits a complete requires-changes application with its real prior status", async () => {
    const record = onboarding({ status: "requires_changes" });
    const repository = store(record);
    const service = new ProfessionalOnboardingService(repository, identity());

    await service.submit({ authUserId: "user-1", correlationId: "request-1" });

    expect(repository.submit).toHaveBeenCalledWith({
      accountProfileId: "profile-1",
      organisationId: "organisation-1",
      fromStatus: "requires_changes",
      correlationId: "request-1",
    });
  });

  it("does not expose another tenant's onboarding and blocks restricted accounts", async () => {
    await expect(
      new ProfessionalOnboardingService(store(null), identity()).submit({
        authUserId: "user-1",
      }),
    ).rejects.toMatchObject({ code: "ONBOARDING_NOT_FOUND" });

    const restrictedIdentity = identity({
      findActiveRestrictions: vi.fn().mockResolvedValue([
        {
          id: "restriction-1",
          type: "suspended",
          reason: "Policy review",
          startsAt: new Date(),
          endsAt: null,
        },
      ]),
    });
    await expect(
      new ProfessionalOnboardingService(store(onboarding()), restrictedIdentity).get(
        "user-1",
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_RESTRICTED" });
  });
});

