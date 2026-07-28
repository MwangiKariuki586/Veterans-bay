import { Hono } from "hono";

import { IdentityRepository } from "../identity/repository";
import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseQuery, parseWithSchema } from "../../platform/http/validation";
import { UnauthorizedError } from "../../platform/permissions/errors";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { ServiceRequestsRepository } from "./repository";
import {
  attachServiceRequestAssetBodySchema,
  addRequestInformationBodySchema,
  clientServiceRequestListQuerySchema,
  createServiceRequestBodySchema,
  privateRequestNoteBodySchema,
  serviceRequestIdSchema,
  submitServiceRequestBodySchema,
  transitionServiceRequestBodySchema,
  updateServiceRequestBodySchema,
} from "./schemas";
import { ServiceRequestsService } from "./service";
import type {
  ClientServiceRequest,
  ProfessionalServiceRequest,
  ServiceRequestOptions,
} from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new ServiceRequestsService(
      new ServiceRequestsRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new UnauthorizedError();
  return account.authUserId;
}

export function createServiceRequestRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  routes.use("/v1/client/requests/*", requireSessionMiddleware);
  routes.use("/v1/client/requests", requireSessionMiddleware);

  routes.get("/v1/client/requests/options", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getOptions(authUserId(context));
      return context.json<ApiSuccessBody<ServiceRequestOptions>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/requests", async (context) => {
    const query = parseQuery(clientServiceRequestListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listClient({
        authUserId: authUserId(context),
        ...query,
      });
      return context.json({ data, requestId: context.get("requestId") });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/requests", async (context) => {
    const { idempotencyKey, ...values } = await parseJsonBody(
      createServiceRequestBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.createDraft({
        authUserId: authUserId(context),
        idempotencyKey,
        values: {
          source: values.source,
          category: values.category ?? null,
          preferredProfessionalSlug: values.preferredProfessionalSlug ?? null,
          preferredServiceSlug: values.preferredServiceSlug ?? null,
          description: values.description ?? null,
          location: values.location ?? null,
          preferredTime: values.preferredTime ?? null,
          budgetMinMinor: values.budgetMinMinor ?? null,
          budgetMaxMinor: values.budgetMaxMinor ?? null,
          urgency: values.urgency ?? null,
          contactPreference: values.contactPreference ?? null,
        },
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>(
        { data, requestId: context.get("requestId") },
        201,
      );
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/requests/:requestId", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getClient(authUserId(context), requestId);
      return context.json<ApiSuccessBody<ClientServiceRequest>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.patch("/v1/client/requests/:requestId", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const { version, ...values } = await parseJsonBody(
      updateServiceRequestBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.updateDraft({
        authUserId: authUserId(context),
        requestId,
        expectedVersion: version,
        values,
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/requests/:requestId/submit", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const { version } = await parseJsonBody(
      submitServiceRequestBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.submit({
        authUserId: authUserId(context),
        requestId,
        expectedVersion: version,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/requests/:requestId/cancel", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const { version } = await parseJsonBody(
      submitServiceRequestBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.cancel({
        authUserId: authUserId(context),
        requestId,
        expectedVersion: version,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/requests/:requestId/information", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const input = await parseJsonBody(
      addRequestInformationBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.addInformation({
        authUserId: authUserId(context),
        requestId,
        expectedVersion: input.version,
        note: input.note,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/requests/:requestId/attachments", async (context) => {
    const requestId = parseWithSchema(
      serviceRequestIdSchema,
      context.req.param("requestId"),
    );
    const { assetId } = await parseJsonBody(
      attachServiceRequestAssetBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.attachAsset({
        authUserId: authUserId(context),
        requestId,
        assetId,
      });
      return context.json<ApiSuccessBody<ClientServiceRequest>>(
        { data, requestId: context.get("requestId") },
        201,
      );
    } finally {
      await client.close();
    }
  });

  routes.delete(
    "/v1/client/requests/:requestId/attachments/:attachmentId",
    async (context) => {
      const requestId = parseWithSchema(
        serviceRequestIdSchema,
        context.req.param("requestId"),
      );
      const attachmentId = parseWithSchema(
        serviceRequestIdSchema,
        context.req.param("attachmentId"),
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.removeAsset({
          authUserId: authUserId(context),
          requestId,
          attachmentId,
        });
        return context.json<ApiSuccessBody<ClientServiceRequest>>({
          data,
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
    "/v1/professional/enquiries",
    ...professionalRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const query = parseQuery(
        clientServiceRequestListQuerySchema,
        context.req.url,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listProfessional({
          organisationId: selection.workspace.organisationId,
          ...query,
        });
        return context.json({ data, requestId: context.get("requestId") });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/enquiries/:requestId",
    ...professionalRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const requestId = parseWithSchema(
        serviceRequestIdSchema,
        context.req.param("requestId"),
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          selection.workspace.organisationId,
          requestId,
        );
        return context.json<ApiSuccessBody<ProfessionalServiceRequest>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  for (const action of [
    "review",
    "request-information",
    "request-assessment",
    "decline",
  ] as const) {
    routes.post(
      `/v1/professional/enquiries/:requestId/${action}`,
      ...professionalManage,
      async (context) => {
        const selection = context.get("workspaceSelection");
        if (!selection?.workspace.organisationId) {
          throw new Error("Organisation workspace is required.");
        }
        const requestId = parseWithSchema(
          serviceRequestIdSchema,
          context.req.param("requestId"),
        );
        const input = await parseJsonBody(
          transitionServiceRequestBodySchema,
          context.req.raw,
        );
        const { client, service } = createService(
          context.get("environment").DATABASE_URL,
        );
        try {
          const data = await service.professionalTransition({
            organisationId: selection.workspace.organisationId,
            requestId,
            actorAccountId: selection.accountProfileId,
            expectedVersion: input.version,
            action,
            note: input.note,
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<ProfessionalServiceRequest>>({
            data,
            requestId: context.get("requestId"),
          });
        } finally {
          await client.close();
        }
      },
    );
  }

  routes.post(
    "/v1/professional/enquiries/:requestId/private-notes",
    ...professionalManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const requestId = parseWithSchema(
        serviceRequestIdSchema,
        context.req.param("requestId"),
      );
      const { note } = await parseJsonBody(
        privateRequestNoteBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.addPrivateNote({
          organisationId: selection.workspace.organisationId,
          requestId,
          actorAccountId: selection.accountProfileId,
          note,
        });
        return context.json<ApiSuccessBody<ProfessionalServiceRequest>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
