import { AppError } from "../../platform/errors/app-error";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  deliveryTypeForVisibility,
  type StorageProvider,
} from "../../platform/storage/cloudinary";
import {
  getStoragePurposePolicy,
  type StoragePurpose,
} from "../../platform/storage/policies";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
import type { FileAssetRecord, StorageRepository } from "./repository";

const UPLOAD_AUTHORIZATION_TTL_MS = 60 * 60 * 1000;

export interface UploadIntentResult {
  asset: FileAssetRecord;
  authorization: Awaited<ReturnType<StorageProvider["createSignedUpload"]>>;
}

export class StorageService {
  constructor(
    private readonly repository: StorageRepository,
    private readonly identityStore: IdentityStore,
    private readonly provider: StorageProvider,
    private readonly workspaceStore?: Pick<
      WorkspaceRepository,
      "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
    >,
  ) {}

  async createUploadIntent(input: {
    authUserId: string;
    purpose: StoragePurpose;
    mimeType: string;
    sizeBytes: number;
    organisationId?: string | null;
    workspaceOrganisationId?: string | null;
  }): Promise<UploadIntentResult> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const policy = getStoragePurposePolicy(input.purpose);

    if (!policy.allowedMimeTypes.includes(input.mimeType)) {
      throw new AppError({
        code: "UNSUPPORTED_FILE_TYPE",
        message: "The file type is not supported for this purpose.",
        status: 422,
      });
    }

    if (input.sizeBytes <= 0 || input.sizeBytes > policy.maxBytes) {
      throw new AppError({
        code: "FILE_TOO_LARGE",
        message: "The file exceeds the allowed size for this purpose.",
        status: 422,
      });
    }

    const organisationId = input.organisationId ?? input.workspaceOrganisationId ?? null;

    if (policy.requiresOrganisation && !organisationId) {
      throw new AppError({
        code: "ORGANISATION_REQUIRED",
        message: "An organisation workspace is required for this upload purpose.",
        status: 422,
      });
    }

    if (
      organisationId &&
      input.workspaceOrganisationId &&
      organisationId !== input.workspaceOrganisationId
    ) {
      throw new AppError({
        code: "WORKSPACE_UNAVAILABLE",
        message: "The requested organisation is outside the active workspace.",
        status: 403,
      });
    }

    const assetId = crypto.randomUUID();
    const publicId = `${policy.folder}/${assetId}`;
    const authorization = await this.provider.createSignedUpload({
      folder: policy.folder,
      publicId: assetId,
      resourceType: policy.resourceType,
      type: deliveryTypeForVisibility(policy.visibility),
    });

    const asset = await this.repository.createPendingAsset({
      id: assetId,
      cloudinaryPublicId: publicId,
      purpose: input.purpose,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      visibility: policy.visibility,
      ownerAccountId: profile.id,
      organisationId,
    });

    return { asset, authorization };
  }

  async completeUpload(input: {
    authUserId: string;
    assetId: string;
    publicId: string;
  }): Promise<FileAssetRecord> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const asset = await this.requireOwnedAsset(input.assetId, profile.id);

    if (asset.status !== "pending") {
      throw new AppError({
        code: "INVALID_ASSET_STATE",
        message: "Only pending uploads can be completed.",
        status: 409,
      });
    }

    if (Date.now() - asset.createdAt.getTime() > UPLOAD_AUTHORIZATION_TTL_MS) {
      throw new AppError({
        code: "UPLOAD_AUTHORIZATION_EXPIRED",
        message: "The upload authorization has expired.",
        status: 410,
      });
    }

    if (
      input.publicId !== asset.cloudinaryPublicId &&
      input.publicId !== asset.id
    ) {
      throw new AppError({
        code: "TAMPERED_UPLOAD",
        message: "The upload completion does not match the authorized asset.",
        status: 403,
      });
    }

    const policy = getStoragePurposePolicy(asset.purpose as StoragePurpose);
    const resource = await this.provider.getResource({
      publicId: asset.cloudinaryPublicId,
      resourceType: policy.resourceType,
      type: deliveryTypeForVisibility(asset.visibility as "public" | "private"),
    });

    if (!resource) {
      throw new AppError({
        code: "UPLOAD_NOT_FOUND",
        message: "The uploaded file could not be verified with the provider.",
        status: 422,
      });
    }

    if (resource.bytes > policy.maxBytes) {
      throw new AppError({
        code: "FILE_TOO_LARGE",
        message: "The uploaded file exceeds the allowed size for this purpose.",
        status: 422,
      });
    }

    if (
      resource.publicId !== asset.cloudinaryPublicId &&
      resource.publicId !== asset.id
    ) {
      throw new AppError({
        code: "TAMPERED_UPLOAD",
        message: "The upload completion does not match the authorized asset.",
        status: 403,
      });
    }

    return this.repository.markReady(asset.id, resource.bytes);
  }

  async getDeliveryUrl(input: {
    authUserId: string;
    assetId: string;
  }): Promise<{ url: string; visibility: "public" | "private" }> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const asset = await this.repository.findById(input.assetId);

    if (!asset || asset.status === "deleted") {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The requested asset was not found.",
        status: 404,
      });
    }

    if (asset.visibility === "private" && asset.ownerAccountId !== profile.id) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "You do not have permission to access this asset.",
        status: 403,
      });
    }

    if (asset.status !== "ready" && asset.status !== "replaced") {
      throw new AppError({
        code: "INVALID_ASSET_STATE",
        message: "The asset is not available for delivery.",
        status: 409,
      });
    }

    const policy = getStoragePurposePolicy(asset.purpose as StoragePurpose);
    const url = await this.provider.createDeliveryUrl({
      publicId: asset.cloudinaryPublicId,
      resourceType: policy.resourceType,
      visibility: asset.visibility as "public" | "private",
    });

    return {
      url,
      visibility: asset.visibility as "public" | "private",
    };
  }

  async linkAsset(input: {
    authUserId: string;
    assetId: string;
    linkedEntityType: string;
    linkedEntityId: string;
    organisationId?: string | null;
  }): Promise<FileAssetRecord> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const asset = await this.requireOwnedAsset(input.assetId, profile.id);

    if (asset.status !== "ready") {
      throw new AppError({
        code: "INVALID_ASSET_STATE",
        message: "Only ready assets can be linked.",
        status: 409,
      });
    }

    if (
      input.organisationId &&
      asset.organisationId &&
      input.organisationId !== asset.organisationId
    ) {
      throw new AppError({
        code: "WORKSPACE_UNAVAILABLE",
        message: "Cross-organisation asset linking is not allowed.",
        status: 403,
      });
    }

    const linked = await this.repository.linkAsset({
      assetId: asset.id,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
    });

    await this.identityStore.insertDomainEvent({
      eventType: "attachment.added",
      eventVersion: 1,
      aggregateType: input.linkedEntityType,
      aggregateId: input.linkedEntityId,
      actorAccountId: profile.id,
      payload: {
        assetId: linked.id,
        purpose: linked.purpose,
      },
    });

    return linked;
  }

  async replaceAsset(input: {
    authUserId: string;
    assetId: string;
    replacementAssetId: string;
  }): Promise<{ previous: FileAssetRecord; current: FileAssetRecord }> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const previous = await this.requireOwnedAsset(input.assetId, profile.id);
    const replacement = await this.requireOwnedAsset(
      input.replacementAssetId,
      profile.id,
    );
    const policy = getStoragePurposePolicy(previous.purpose as StoragePurpose);

    if (!policy.allowsReplacement || policy.historicalEvidence) {
      throw new AppError({
        code: "REPLACEMENT_FORBIDDEN",
        message: "This asset purpose does not allow silent replacement.",
        status: 409,
      });
    }

    if (replacement.status !== "ready" || previous.status !== "ready") {
      throw new AppError({
        code: "INVALID_ASSET_STATE",
        message: "Both assets must be ready before replacement.",
        status: 409,
      });
    }

    if (previous.purpose !== replacement.purpose) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Replacement assets must share the same purpose.",
        status: 422,
      });
    }

    let current = replacement;
    if (previous.linkedEntityType && previous.linkedEntityId) {
      current = await this.repository.linkAsset({
        assetId: replacement.id,
        linkedEntityType: previous.linkedEntityType,
        linkedEntityId: previous.linkedEntityId,
      });
    }

    const replaced = await this.repository.markReplaced(previous.id);
    return { previous: replaced, current };
  }

  async deleteAsset(input: {
    authUserId: string;
    assetId: string;
  }): Promise<FileAssetRecord> {
    const profile = await this.requireActiveProfile(input.authUserId);
    const asset = await this.requireOwnedAsset(input.assetId, profile.id);
    const policy = getStoragePurposePolicy(asset.purpose as StoragePurpose);

    if (policy.historicalEvidence && asset.status === "ready") {
      throw new AppError({
        code: "DELETION_FORBIDDEN",
        message: "Historical evidence cannot be deleted silently.",
        status: 409,
      });
    }

    try {
      await this.provider.destroyResource({
        publicId: asset.cloudinaryPublicId,
        resourceType: policy.resourceType,
        type: deliveryTypeForVisibility(asset.visibility as "public" | "private"),
      });
    } catch {
      // Provider cleanup is best-effort; metadata transition remains authoritative.
    }

    return this.repository.markDeleted(asset.id);
  }

  async cleanupOrphans(
    authUserId: string,
    olderThanHours = 24,
  ): Promise<{ cleaned: number }> {
    await this.requirePlatformAdmin(authUserId);

    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const orphans = await this.repository.listOrphanPending(cutoff);
    let cleaned = 0;

    for (const orphan of orphans) {
      const policy = getStoragePurposePolicy(orphan.purpose as StoragePurpose);
      try {
        await this.provider.destroyResource({
          publicId: orphan.cloudinaryPublicId,
          resourceType: policy.resourceType,
          type: deliveryTypeForVisibility(
            orphan.visibility as "public" | "private",
          ),
        });
      } catch {
        // Continue; deletion metadata still applied for idempotent cleanup.
      }
      await this.repository.markDeleted(orphan.id);
      cleaned += 1;
    }

    return { cleaned };
  }

  private async requirePlatformAdmin(authUserId: string) {
    const profile = await this.requireActiveProfile(authUserId);

    if (!this.workspaceStore) {
      throw new AppError({
        code: "CONFIGURATION_ERROR",
        message: "Platform authorization is not available.",
        status: 503,
      });
    }

    const assignments = await this.workspaceStore.listActivePlatformAssignments(
      profile.id,
    );
    const admin = assignments.find((item) => item.roleKey === "platform_admin");

    if (!admin) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "Platform administration permission is required.",
        status: 403,
      });
    }

    const permissionsByRole =
      await this.workspaceStore.listPermissionKeysForRoleIds([admin.roleId]);
    const permissions = permissionsByRole.get(admin.roleId) ?? [];

    if (!permissions.includes(permissionKeys.platformAdmin)) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "Platform administration permission is required.",
        status: 403,
      });
    }

    return profile;
  }

  private async requireActiveProfile(authUserId: string) {
    const profile = await this.identityStore.findProfileByAuthUserId(authUserId);
    if (!profile) {
      throw new AppError({
        code: "ACCOUNT_PROFILE_MISSING",
        message: "Account profile was not found.",
        status: 404,
      });
    }
    if (profile.status === "deactivated") {
      throw new AppError({
        code: "ACCOUNT_DEACTIVATED",
        message: "This account has been deactivated.",
        status: 403,
      });
    }
    const restrictions = await this.identityStore.findActiveRestrictions(profile.id);
    if (restrictions.length > 0) {
      throw new AppError({
        code: "ACCOUNT_RESTRICTED",
        message: "This account cannot perform protected actions.",
        status: 403,
      });
    }
    return profile;
  }

  private async requireOwnedAsset(assetId: string, ownerAccountId: string) {
    const asset = await this.repository.findById(assetId);
    if (!asset || asset.status === "deleted") {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The requested asset was not found.",
        status: 404,
      });
    }
    if (asset.ownerAccountId !== ownerAccountId) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "You do not have permission to access this asset.",
        status: 403,
      });
    }
    return asset;
  }
}
