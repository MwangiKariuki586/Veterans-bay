import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseWithSchema } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import { getStoragePurposePolicy } from "../../platform/storage/policies";
import {
  CloudinaryStorageProvider,
  parseCloudinaryConfig,
} from "../../platform/storage/cloudinary";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { ConversationsRepository } from "./repository";
import {
  conversationAttachmentIdSchema,
  conversationRequestIdSchema,
  sendConversationMessageBodySchema,
} from "./schemas";
import { ConversationsService } from "./service";
import type { EngagementConversation } from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new ConversationsService(
      new ConversationsRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  return account.authUserId;
}

function requestId(value: string) {
  return parseWithSchema(conversationRequestIdSchema, value);
}

function attachmentId(value: string) {
  return parseWithSchema(conversationAttachmentIdSchema, value);
}

function deliveryProvider(environment: {
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
  return new CloudinaryStorageProvider(config);
}

export function createConversationRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const clientPaths = [
    "/v1/client/requests/:requestId/conversation",
    "/v1/client/requests/:requestId/conversation/*",
  ] as const;
  for (const path of clientPaths) {
    routes.use(path, requireSessionMiddleware);
  }

  routes.get(
    "/v1/client/requests/:requestId/conversation",
    async (context) => {
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getClientConversation(
          authUserId(context),
          requestId(context.req.param("requestId")),
        );
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/requests/:requestId/conversation/messages",
    async (context) => {
      const input = await parseJsonBody(
        sendConversationMessageBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.sendClientMessage({
          authUserId: authUserId(context),
          requestId: requestId(context.req.param("requestId")),
          ...input,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/requests/:requestId/conversation/read",
    async (context) => {
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.markClientRead({
          authUserId: authUserId(context),
          requestId: requestId(context.req.param("requestId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/requests/:requestId/conversation/attachments/:assetId/delivery",
    async (context) => {
      const environment = context.get("environment");
      const { client, service } = createService(environment.DATABASE_URL);
      try {
        const attachment = await service.getClientAttachment({
          authUserId: authUserId(context),
          requestId: requestId(context.req.param("requestId")),
          assetId: attachmentId(context.req.param("assetId")),
        });
        const url = await deliveryProvider(environment).createDeliveryUrl({
          publicId: attachment.cloudinaryPublicId,
          resourceType: getStoragePurposePolicy("MESSAGE_ATTACHMENT").resourceType,
          visibility: "private",
        });
        return context.json({
          data: { url, visibility: "private" as const },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.enquiriesView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.enquiriesManage),
  ] as const;

  routes.get(
    "/v1/professional/enquiries/:requestId/conversation",
    ...professionalRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessionalConversation({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          requestId: requestId(context.req.param("requestId")),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/enquiries/:requestId/conversation/messages",
    ...professionalManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const input = await parseJsonBody(
        sendConversationMessageBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.sendProfessionalMessage({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          requestId: requestId(context.req.param("requestId")),
          ...input,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/enquiries/:requestId/conversation/read",
    ...professionalRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.markProfessionalRead({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          requestId: requestId(context.req.param("requestId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<EngagementConversation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/enquiries/:requestId/conversation/attachments/:assetId/delivery",
    ...professionalRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const environment = context.get("environment");
      const { client, service } = createService(environment.DATABASE_URL);
      try {
        const attachment = await service.getProfessionalAttachment({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          requestId: requestId(context.req.param("requestId")),
          assetId: attachmentId(context.req.param("assetId")),
        });
        const url = await deliveryProvider(environment).createDeliveryUrl({
          publicId: attachment.cloudinaryPublicId,
          resourceType: getStoragePurposePolicy("MESSAGE_ATTACHMENT").resourceType,
          visibility: "private",
        });
        return context.json({
          data: { url, visibility: "private" as const },
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
