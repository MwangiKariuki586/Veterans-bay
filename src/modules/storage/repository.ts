import { and, eq, lt, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { fileAssets } from "../../platform/database/schema/file-assets";
import {
  jobAssignments,
  jobs,
} from "../../platform/database/schema/fulfilment";
import {
  organisationMemberships,
  permissions,
  rolePermissions,
} from "../../platform/database/schema/roles";
import { permissionKeys } from "../../platform/permissions/keys";

export type FileAssetRecord = typeof fileAssets.$inferSelect;

export class StorageRepository {
  constructor(private readonly db: Database) {}

  async createPendingAsset(input: {
    id: string;
    cloudinaryPublicId: string;
    purpose: string;
    mimeType: string;
    sizeBytes: number;
    visibility: "public" | "private";
    ownerAccountId: string;
    organisationId: string | null;
  }): Promise<FileAssetRecord> {
    const [asset] = await this.db
      .insert(fileAssets)
      .values({
        id: input.id,
        cloudinaryPublicId: input.cloudinaryPublicId,
        purpose: input.purpose,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        visibility: input.visibility,
        ownerAccountId: input.ownerAccountId,
        organisationId: input.organisationId,
        status: "pending",
      })
      .returning();

    return asset;
  }

  async findById(assetId: string): Promise<FileAssetRecord | null> {
    const [asset] = await this.db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, assetId))
      .limit(1);

    return asset ?? null;
  }

  async canAccessJobEvidence(
    accountProfileId: string,
    jobId: string,
  ): Promise<boolean> {
    const [allowed] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.id, jobId),
          sql`(
            ${jobs.clientAccountId} = ${accountProfileId}
            or exists (
              select 1
              from ${organisationMemberships}
              join ${rolePermissions}
                on ${rolePermissions.roleId} = ${organisationMemberships.roleId}
              join ${permissions}
                on ${permissions.id} = ${rolePermissions.permissionId}
              where ${organisationMemberships.organisationId} = ${jobs.organisationId}
                and ${organisationMemberships.accountProfileId} = ${accountProfileId}
                and ${organisationMemberships.status} = 'active'
                and ${permissions.key} = ${permissionKeys.jobsView}
                and (
                  ${organisationMemberships.assignedJobsOnly} = false
                  or exists (
                    select 1 from ${jobAssignments}
                    where ${jobAssignments.jobId} = ${jobs.id}
                      and ${jobAssignments.membershipId} = ${organisationMemberships.id}
                      and ${jobAssignments.active} = true
                  )
                )
            )
          )`,
        ),
      )
      .limit(1);
    return Boolean(allowed);
  }

  async markReady(
    assetId: string,
    sizeBytes: number,
    cloudinaryPublicId?: string,
  ): Promise<FileAssetRecord> {
    const [asset] = await this.db
      .update(fileAssets)
      .set({
        status: "ready",
        sizeBytes,
        ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, assetId))
      .returning();

    return asset;
  }

  async linkAsset(input: {
    assetId: string;
    linkedEntityType: string;
    linkedEntityId: string;
  }): Promise<FileAssetRecord> {
    const [asset] = await this.db
      .update(fileAssets)
      .set({
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, input.assetId))
      .returning();

    return asset;
  }

  async markReplaced(assetId: string): Promise<FileAssetRecord> {
    const [asset] = await this.db
      .update(fileAssets)
      .set({
        status: "replaced",
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, assetId))
      .returning();

    return asset;
  }

  async markDeleted(assetId: string): Promise<FileAssetRecord> {
    const [asset] = await this.db
      .update(fileAssets)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, assetId))
      .returning();

    return asset;
  }

  async listOrphanPending(olderThan: Date): Promise<FileAssetRecord[]> {
    return this.db
      .select()
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.status, "pending"),
          lt(fileAssets.createdAt, olderThan),
          sql`${fileAssets.linkedEntityType} is null`,
        ),
      );
  }
}
