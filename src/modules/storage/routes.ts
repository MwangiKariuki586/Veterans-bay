import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import {
  CloudinaryStorageProvider,
  parseCloudinaryConfig,
} from "../../platform/storage/cloudinary";
import {
  requireSessionMiddleware,
  WORKSPACE_COOKIE,
  WORKSPACE_HEADER,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";
import { storagePermissions } from "./permissions";
import { StorageRepository } from "./repository";
import {
  completeUploadBodySchema,
  linkAssetBodySchema,
  replaceAssetBodySchema,
  uploadIntentBodySchema,
} from "./schemas";
import { StorageService } from "./service";

function createStorageService(
  db: ConstructorParameters<typeof StorageRepository>[0],
  cloudinary: NonNullable<ReturnType<typeof parseCloudinaryConfig>>,
) {
  return new StorageService(
    new StorageRepository(db),
    new IdentityRepository(db),
    new CloudinaryStorageProvider(cloudinary),
    new WorkspaceRepository(db),
  );
}

function readWorkspaceOrganisationId(cookieHeader: string | undefined, headerValue: string | undefined) {
  const raw =
    headerValue?.trim() ||
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${WORKSPACE_COOKIE}=`))
      ?.slice(WORKSPACE_COOKIE.length + 1);

  if (!raw) {
    return null;
  }

  const workspaceId = decodeURIComponent(raw);
  if (!workspaceId.startsWith("organisation:")) {
    return null;
  }

  return workspaceId.slice("organisation:".length);
}

function requireStorageService(environment: {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}) {
  const config = parseCloudinaryConfig(environment);
  if (!config) {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      message: "File storage is not configured.",
      status: 503,
    });
  }

  return config;
}

export function createStorageRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.post("/v1/storage/upload-intent", requireSessionMiddleware, async (context) => {
    void storagePermissions.uploadIntent;
    const environment = context.get("environment");
    const account = context.get("account");
    if (!account) {
      throw new Error("Authenticated account is required.");
    }

    const input = await parseJsonBody(uploadIntentBodySchema, context.req.raw);
    const cloudinary = requireStorageService(environment);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = createStorageService(client.db, cloudinary);
      const result = await service.createUploadIntent({
        authUserId: account.authUserId,
        purpose: input.purpose,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        organisationId: input.organisationId,
        workspaceOrganisationId: readWorkspaceOrganisationId(
          context.req.header("cookie"),
          context.req.header(WORKSPACE_HEADER),
        ),
      });

      return context.json<
        ApiSuccessBody<{
          assetId: string;
          authorization: typeof result.authorization;
        }>
      >({
        data: {
          assetId: result.asset.id,
          authorization: result.authorization,
        },
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/storage/assets/:assetId/complete",
    requireSessionMiddleware,
    async (context) => {
      void storagePermissions.uploadComplete;
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }

      const input = await parseJsonBody(completeUploadBodySchema, context.req.raw);
      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);

      try {
        const service = createStorageService(client.db, cloudinary);
        const asset = await service.completeUpload({
          authUserId: account.authUserId,
          assetId: context.req.param("assetId"),
          publicId: input.publicId,
        });

        return context.json({
          data: {
            id: asset.id,
            status: asset.status,
            purpose: asset.purpose,
            visibility: asset.visibility,
            sizeBytes: asset.sizeBytes,
          },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/storage/assets/:assetId/delivery",
    requireSessionMiddleware,
    async (context) => {
      void storagePermissions.delivery;
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }

      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);

      try {
        const service = createStorageService(client.db, cloudinary);
        const delivery = await service.getDeliveryUrl({
          authUserId: account.authUserId,
          assetId: context.req.param("assetId"),
        });

        return context.json({
          data: delivery,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/admin/professionals/:organisationId/evidence/:assetId",
    requireSessionMiddleware,
    async (context) => {
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }
      const organisationId = context.req.param("organisationId");
      const assetId = context.req.param("assetId");
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuid.test(organisationId) || !uuid.test(assetId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The evidence identifier is invalid.",
          status: 422,
        });
      }

      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);
      try {
        const service = createStorageService(client.db, cloudinary);
        const data = await service.getAdminEvidenceDeliveryUrl({
          authUserId: account.authUserId,
          organisationId,
          assetId,
          correlationId: context.get("requestId"),
        });
        return context.json({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/storage/assets/:assetId/link",
    requireSessionMiddleware,
    async (context) => {
      void storagePermissions.link;
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }

      const input = await parseJsonBody(linkAssetBodySchema, context.req.raw);
      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);

      try {
        const service = createStorageService(client.db, cloudinary);
        const asset = await service.linkAsset({
          authUserId: account.authUserId,
          assetId: context.req.param("assetId"),
          linkedEntityType: input.linkedEntityType,
          linkedEntityId: input.linkedEntityId,
          organisationId: readWorkspaceOrganisationId(
            context.req.header("cookie"),
            context.req.header(WORKSPACE_HEADER),
          ),
        });

        return context.json({
          data: {
            id: asset.id,
            linkedEntityType: asset.linkedEntityType,
            linkedEntityId: asset.linkedEntityId,
          },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/storage/assets/:assetId/replace",
    requireSessionMiddleware,
    async (context) => {
      void storagePermissions.replace;
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }

      const input = await parseJsonBody(replaceAssetBodySchema, context.req.raw);
      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);

      try {
        const service = createStorageService(client.db, cloudinary);
        const result = await service.replaceAsset({
          authUserId: account.authUserId,
          assetId: context.req.param("assetId"),
          replacementAssetId: input.replacementAssetId,
        });

        return context.json({
          data: {
            previousAssetId: result.previous.id,
            currentAssetId: result.current.id,
          },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.delete(
    "/v1/storage/assets/:assetId",
    requireSessionMiddleware,
    async (context) => {
      void storagePermissions.delete;
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) {
        throw new Error("Authenticated account is required.");
      }

      const cloudinary = requireStorageService(environment);
      const client = createDatabaseClient(environment.DATABASE_URL);

      try {
        const service = createStorageService(client.db, cloudinary);
        const asset = await service.deleteAsset({
          authUserId: account.authUserId,
          assetId: context.req.param("assetId"),
        });

        return context.json({
          data: { id: asset.id, status: asset.status },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post("/v1/storage/cleanup", requireSessionMiddleware, async (context) => {
    void storagePermissions.cleanup;
    const environment = context.get("environment");
    const account = context.get("account");
    if (!account) {
      throw new Error("Authenticated account is required.");
    }

    const cloudinary = requireStorageService(environment);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = createStorageService(client.db, cloudinary);
      const result = await service.cleanupOrphans(account.authUserId);

      return context.json({
        data: result,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  return routes;
}
