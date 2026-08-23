import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
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
    experienceStartedYear: 2018,
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
    findByOrganisationId: vi.fn().mockResolvedValue(record),
    isActiveOrganisationMember: vi.fn().mockResolvedValue(false),
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
    listForReview: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    createDraft: vi.fn().mockResolvedValue(record),
    updateDraft: vi.fn().mockResolvedValue(undefined),
    attachAsset: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    recordReviewDecision: vi.fn().mockResolvedValue(undefined),
  };
}

function platformAuthorization(
  permissions: string[] = ["platform.admin"],
): Pick<
  WorkspaceRepository,
  "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
> {
  return {
    listActivePlatformAssignments: vi.fn().mockResolvedValue([
      {
        assignmentId: "assignment-1",
        roleId: "platform-role-1",
        roleKey: "platform_admin",
        status: "active",
      },
    ]),
    listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(
      new Map([["platform-role-1", permissions]]),
    ),
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

  it("authorizes, paginates, and serializes the administrator review queue", async () => {
    const repository = store(onboarding());
    repository.listForReview = vi.fn().mockResolvedValue({
      items: [
        {
          organisationId: "organisation-1",
          name: "ProLine Plumbing",
          status: "pending_review",
          primaryCategory: "Plumbing",
          operatingLocation: "Nairobi, Kenya",
          verificationStatus: "pending",
          submittedAt: new Date("2026-07-22T08:00:00.000Z"),
          updatedAt: new Date("2026-07-22T09:00:00.000Z"),
          evidenceCount: 1,
        },
      ],
      totalItems: 11,
    });
    const service = new ProfessionalOnboardingService(
      repository,
      identity(),
      platformAuthorization(),
    );

    await expect(
      service.listForReview("user-1", {
        status: "pending_review",
        q: "plumbing",
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      page: 2,
      totalItems: 11,
      totalPages: 2,
      items: [
        {
          organisationId: "organisation-1",
          submittedAt: "2026-07-22T08:00:00.000Z",
          updatedAt: "2026-07-22T09:00:00.000Z",
          evidenceCount: 1,
        },
      ],
    });
    expect(repository.listForReview).toHaveBeenCalledWith({
      status: "pending_review",
      q: "plumbing",
      page: 2,
      pageSize: 10,
    });
  });

  it("protects administrator review reads and returns the full evidence summary", async () => {
    const pending = onboarding({
      status: "pending_review",
      submittedAt: new Date("2026-07-22T08:00:00.000Z"),
    });
    const repository = store(pending);

    await expect(
      new ProfessionalOnboardingService(
        repository,
        identity(),
        platformAuthorization([]),
      ).getForReview("user-1", "organisation-1"),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    const service = new ProfessionalOnboardingService(
      repository,
      identity(),
      platformAuthorization(),
    );
    await expect(
      service.getForReview("user-1", "organisation-1"),
    ).resolves.toMatchObject({
      organisationId: "organisation-1",
      status: "pending_review",
      documents: [{ assetId: "asset-1" }],
      readiness: { complete: true },
    });
  });

  it("authorizes and records an approval from the pending-review state", async () => {
    const pending = onboarding({
      status: "pending_review",
      verificationStatus: "pending",
    });
    const approved = onboarding({
      status: "active",
      verificationStatus: "verified",
    });
    const repository = store(pending);
    repository.findByOrganisationId = vi
      .fn()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(approved);
    const service = new ProfessionalOnboardingService(
      repository,
      identity(),
      platformAuthorization(),
    );

    await expect(
      service.recordReviewDecision({
        authUserId: "user-1",
        organisationId: "organisation-1",
        decision: "approve",
        reason: "Evidence reviewed and accepted.",
        correlationId: "request-1",
      }),
    ).resolves.toEqual({
      organisationId: "organisation-1",
      status: "active",
      verificationStatus: "verified",
    });
    expect(repository.recordReviewDecision).toHaveBeenCalledWith({
      organisationId: "organisation-1",
      actorAccountId: "profile-1",
      decision: "approve",
      reason: "Evidence reviewed and accepted.",
      fromStatus: "pending_review",
      toStatus: "active",
      verificationStatus: "verified",
      eventType: "professional.profile_approved",
      correlationId: "request-1",
    });
  });

  it.each([
    {
      decision: "request_changes" as const,
      fromStatus: "pending_review",
      toStatus: "requires_changes",
      verificationStatus: "rejected",
      eventType: "professional.profile_changes_requested",
    },
    {
      decision: "reject" as const,
      fromStatus: "pending_review",
      toStatus: "deactivated",
      verificationStatus: "rejected",
      eventType: "professional.profile_rejected",
    },
    {
      decision: "suspend" as const,
      fromStatus: "active",
      toStatus: "suspended",
      verificationStatus: undefined,
      eventType: "professional.profile_suspended",
    },
    {
      decision: "restore" as const,
      fromStatus: "suspended",
      toStatus: "active",
      verificationStatus: undefined,
      eventType: "professional.profile_restored",
    },
  ])(
    "maps the $decision decision to its authoritative transition",
    async ({
      decision,
      fromStatus,
      toStatus,
      verificationStatus,
      eventType,
    }) => {
      const current = onboarding({
        status: fromStatus,
        verificationStatus: verificationStatus ?? "verified",
      });
      const updated = onboarding({
        status: toStatus,
        verificationStatus: verificationStatus ?? "verified",
      });
      const repository = store(current);
      repository.findByOrganisationId = vi
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(updated);
      const service = new ProfessionalOnboardingService(
        repository,
        identity(),
        platformAuthorization(),
      );

      await service.recordReviewDecision({
        authUserId: "user-1",
        organisationId: "organisation-1",
        decision,
        reason: "Recorded after an authorised review.",
      });

      expect(repository.recordReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decision,
          fromStatus,
          toStatus,
          eventType,
          ...(verificationStatus ? { verificationStatus } : {}),
        }),
      );
    },
  );

  it("blocks missing permission, self-review, and invalid transitions", async () => {
    const pending = onboarding({ status: "pending_review" });
    await expect(
      new ProfessionalOnboardingService(
        store(pending),
        identity(),
        platformAuthorization([]),
      ).recordReviewDecision({
        authUserId: "user-1",
        organisationId: "organisation-1",
        decision: "approve",
        reason: "Evidence reviewed and accepted.",
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    const selfReviewStore = store(pending);
    selfReviewStore.isActiveOrganisationMember = vi.fn().mockResolvedValue(true);
    await expect(
      new ProfessionalOnboardingService(
        selfReviewStore,
        identity(),
        platformAuthorization(),
      ).recordReviewDecision({
        authUserId: "user-1",
        organisationId: "organisation-1",
        decision: "approve",
        reason: "Evidence reviewed and accepted.",
      }),
    ).rejects.toMatchObject({ code: "SELF_REVIEW_FORBIDDEN" });

    await expect(
      new ProfessionalOnboardingService(
        store(onboarding({ status: "draft" })),
        identity(),
        platformAuthorization(),
      ).recordReviewDecision({
        authUserId: "user-1",
        organisationId: "organisation-1",
        decision: "approve",
        reason: "Evidence reviewed and accepted.",
      }),
    ).rejects.toMatchObject({ code: "INVALID_REVIEW_TRANSITION" });
  });
});
