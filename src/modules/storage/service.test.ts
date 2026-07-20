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
});
