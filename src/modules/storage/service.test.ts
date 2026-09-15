import { describe, expect, it, vi } from "vitest";

import type { StorageProvider } from "../../platform/storage/cloudinary";
import type { IdentityStore } from "../identity/repository";
import type { StorageRepository } from "./repository";
import { StorageService } from "./service";

function profile() {
  return {
    id: "profile-1",
    authUserId: "user-1",
    displayName: "Alex",
    primaryEmail: "alex@example.com",
    phone: null,
    timezone: "UTC",
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function pendingAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    cloudinaryPublicId: "veterans-bay/avatars/asset-1",
    purpose: "AVATAR",
    mimeType: "image/png",
    sizeBytes: 1024,
    visibility: "public",
    ownerAccountId: "profile-1",
    organisationId: null,
    linkedEntityType: null,
    linkedEntityId: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("StorageService", () => {
  it("rejects unsupported types and oversized files", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };
    const repository = {
      createPendingAsset: vi.fn(),
    } as unknown as StorageRepository;
    const provider = {
      createSignedUpload: vi.fn(),
    } as unknown as StorageProvider;
    const service = new StorageService(repository, identityStore, provider);

    await expect(
      service.createUploadIntent({
        authUserId: "user-1",
        purpose: "AVATAR",
        mimeType: "application/zip",
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });

    await expect(
      service.createUploadIntent({
        authUserId: "user-1",
        purpose: "AVATAR",
        mimeType: "image/png",
        sizeBytes: 10 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("includes the file extension in raw verification public IDs", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityStore;
    const repository = {
      createPendingAsset: vi.fn().mockImplementation((input) => pendingAsset(input)),
    } as unknown as StorageRepository;
    const provider = {
      createSignedUpload: vi.fn().mockImplementation(async (input) => ({
        ...input,
        cloudName: "demo",
        apiKey: "key",
        timestamp: 1_700_000_000,
        signature: "signature",
        uploadUrl: "https://api.cloudinary.test/raw/upload",
        expiresAt: "2026-07-22T17:00:00.000Z",
      })),
    } as unknown as StorageProvider;
    const workspaceStore = {
      findActiveMembership: vi.fn().mockResolvedValue({ id: "membership-1" }),
      listActivePlatformAssignments: vi.fn(),
      listPermissionKeysForRoleIds: vi.fn(),
    };
    const service = new StorageService(
      repository,
      identityStore,
      provider,
      workspaceStore,
    );

    await service.createUploadIntent({
      authUserId: "user-1",
      purpose: "VERIFICATION_DOCUMENT",
      mimeType: "application/pdf",
      sizeBytes: 5_352,
      organisationId: "organisation-1",
      workspaceOrganisationId: "organisation-1",
    });

    expect(provider.createSignedUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: expect.stringMatching(/^[0-9a-f-]+\.pdf$/),
        resourceType: "raw",
      }),
    );
    expect(repository.createPendingAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudinaryPublicId: expect.stringMatching(
          /^veterans-bay\/verification\/[0-9a-f-]+\.pdf$/,
        ),
      }),
    );
  });

  it("completes legacy raw uploads using their canonical extension", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityStore;
    const repository = {
      findById: vi.fn().mockResolvedValue(
        pendingAsset({
          cloudinaryPublicId: "veterans-bay/verification/asset-1",
          purpose: "VERIFICATION_DOCUMENT",
          mimeType: "application/pdf",
          visibility: "private",
          organisationId: "organisation-1",
        }),
      ),
      markReady: vi.fn().mockImplementation((id, bytes, publicId) =>
        pendingAsset({
          id,
          sizeBytes: bytes,
          cloudinaryPublicId: publicId,
          status: "ready",
        }),
      ),
    } as unknown as StorageRepository;
    const provider = {
      getResource: vi.fn().mockResolvedValue({
        publicId: "veterans-bay/verification/asset-1.pdf",
        bytes: 5_352,
        format: null,
        resourceType: "raw",
        type: "authenticated",
        secureUrl: "https://res.cloudinary.test/private.pdf",
        version: 1,
      }),
    } as unknown as StorageProvider;
    const service = new StorageService(repository, identityStore, provider);

    await service.completeUpload({
      authUserId: "user-1",
      assetId: "asset-1",
      publicId: "veterans-bay/verification/asset-1.pdf",
    });

    expect(provider.getResource).toHaveBeenCalledWith({
      publicId: "veterans-bay/verification/asset-1.pdf",
      resourceType: "raw",
      type: "authenticated",
    });
    expect(repository.markReady).toHaveBeenCalledWith(
      "asset-1",
      5_352,
      "veterans-bay/verification/asset-1.pdf",
    );
  });

  it("rejects tampered upload completion and cross-tenant private delivery", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue(pendingAsset()),
      markReady: vi.fn(),
    } as unknown as StorageRepository;
    const provider = {
      getResource: vi.fn(),
      createDeliveryUrl: vi.fn(),
    } as unknown as StorageProvider;
    const service = new StorageService(repository, identityStore, provider);

    await expect(
      service.completeUpload({
        authUserId: "user-1",
        assetId: "asset-1",
        publicId: "tampered/public-id",
      }),
    ).rejects.toMatchObject({ code: "TAMPERED_UPLOAD" });

    repository.findById = vi.fn().mockResolvedValue(
      pendingAsset({
        status: "ready",
        visibility: "private",
        ownerAccountId: "other-profile",
      }),
    );

    await expect(
      service.getDeliveryUrl({
        authUserId: "user-1",
        assetId: "asset-1",
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("rejects expired upload completion and non-admin cleanup", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue(
        pendingAsset({
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
      ),
      listOrphanPending: vi.fn(),
      markDeleted: vi.fn(),
    } as unknown as StorageRepository;
    const provider = {
      getResource: vi.fn(),
      destroyResource: vi.fn(),
    } as unknown as StorageProvider;
    const workspaceStore = {
      findActiveMembership: vi.fn(),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn(),
    };
    const service = new StorageService(
      repository,
      identityStore,
      provider,
      workspaceStore,
    );

    await expect(
      service.completeUpload({
        authUserId: "user-1",
        assetId: "asset-1",
        publicId: "veterans-bay/avatars/asset-1",
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_AUTHORIZATION_EXPIRED" });

    await expect(service.cleanupOrphans("user-1")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("blocks silent replacement and deletion of historical evidence", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };
    const evidence = pendingAsset({
      id: "evidence-1",
      purpose: "JOB_EVIDENCE",
      status: "ready",
      visibility: "private",
      organisationId: "org-1",
    });
    const repository = {
      findById: vi.fn().mockResolvedValue(evidence),
      markReplaced: vi.fn(),
      markDeleted: vi.fn(),
    } as unknown as StorageRepository;
    const provider = {
      destroyResource: vi.fn(),
    } as unknown as StorageProvider;
    const service = new StorageService(repository, identityStore, provider);

    await expect(
      service.replaceAsset({
        authUserId: "user-1",
        assetId: "evidence-1",
        replacementAssetId: "evidence-2",
      }),
    ).rejects.toMatchObject({ code: "REPLACEMENT_FORBIDDEN" });

    await expect(
      service.deleteAsset({
        authUserId: "user-1",
        assetId: "evidence-1",
      }),
    ).rejects.toMatchObject({ code: "DELETION_FORBIDDEN" });
  });

  it("delivers exact-tenant verification evidence to an administrator and audits access", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      recordAuditEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdentityStore;
    const evidence = pendingAsset({
      id: "evidence-1",
      cloudinaryPublicId: "veterans-bay/verification/evidence-1.pdf",
      purpose: "VERIFICATION_DOCUMENT",
      mimeType: "application/pdf",
      status: "ready",
      visibility: "private",
      organisationId: "organisation-1",
      linkedEntityType: "professional_profile",
      linkedEntityId: "professional-profile-1",
    });
    const repository = {
      findById: vi.fn().mockResolvedValue(evidence),
    } as unknown as StorageRepository;
    const provider = {
      createDeliveryUrl: vi
        .fn()
        .mockResolvedValue("https://res.cloudinary.test/signed-evidence"),
    } as unknown as StorageProvider;
    const workspaceStore = {
      findActiveMembership: vi.fn(),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([
        {
          assignmentId: "assignment-1",
          roleId: "platform-role-1",
          roleKey: "platform_admin",
          status: "active",
        },
      ]),
      listPermissionKeysForRoleIds: vi
        .fn()
        .mockResolvedValue(
          new Map([["platform-role-1", ["platform.admin"]]]),
        ),
    };
    const service = new StorageService(
      repository,
      identityStore,
      provider,
      workspaceStore,
    );

    await expect(
      service.getAdminEvidenceDeliveryUrl({
        authUserId: "user-1",
        organisationId: "organisation-1",
        assetId: "evidence-1",
        correlationId: "request-1",
      }),
    ).resolves.toEqual({
      url: "https://res.cloudinary.test/signed-evidence",
      visibility: "private",
    });
    expect(identityStore.recordAuditEvent).toHaveBeenCalledWith({
      actorAccountId: "profile-1",
      action: "professional.verification_evidence_viewed",
      entityType: "file_asset",
      entityId: "evidence-1",
      correlationId: "request-1",
      metadata: { organisationId: "organisation-1" },
    });

    await expect(
      service.getAdminEvidenceDeliveryUrl({
        authUserId: "user-1",
        organisationId: "another-organisation",
        assetId: "evidence-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
