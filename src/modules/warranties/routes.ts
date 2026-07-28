import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import {
  parseJsonBody,
  parseQuery,
  parseWithSchema,
} from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WarrantiesRepository } from "./repository";
import {
  warrantyClaimActionBodySchema,
  warrantyClaimSubmitBodySchema,
  warrantyEscalateBodySchema,
  warrantyIdSchema,
  warrantyListQuerySchema,
  warrantyResolveBodySchema,
  warrantyReturnVisitBodySchema,
} from "./schemas";
import { WarrantiesService } from "./service";
import type { WarrantyDetail, WarrantyPage } from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new WarrantiesService(
      new WarrantiesRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function id(value: string) {
  return parseWithSchema(warrantyIdSchema, value);
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  return account.authUserId;
}

function professionalSelection(context: {
  get(key: "workspaceSelection"):
    | {
        accountProfileId: string;
        workspace: {
          organisationId: string | null;
          membershipId: string | null;
          assignedJobsOnly: boolean;
        };
      }
    | undefined;
}) {
  const selection = context.get("workspaceSelection");
  if (
    !selection?.workspace.organisationId ||
    !selection.workspace.membershipId
  ) {
    throw new Error("Organisation workspace is required.");
  }
  return {
    actorAccountId: selection.accountProfileId,
    scope: {
      organisationId: selection.workspace.organisationId,
      membershipId: selection.workspace.membershipId,
      assignedJobsOnly: selection.workspace.assignedJobsOnly,
    },
  };
}

export function createWarrantyRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsManage),
  ] as const;

  routes.get(
    "/v1/professional/warranties",
    ...professionalRead,
    async (context) => {
      const selection = professionalSelection(context);
      const query = parseQuery(warrantyListQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listProfessional({
          scope: selection.scope,
          ...query,
        });
        return context.json<ApiSuccessBody<WarrantyPage>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/warranties/from-job/:jobId",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.ensureFromJob({
          ...selection,
          jobId: id(context.req.param("jobId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/warranties/:warrantyId",
    ...professionalRead,
    async (context) => {
      const selection = professionalSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          id(context.req.param("warrantyId")),
          selection.scope,
        );
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/warranty-claims/:claimId/action",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        warrantyClaimActionBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.actOnClaim({
          ...selection,
          ...values,
          claimId: id(context.req.param("claimId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/warranty-claims/:claimId/return-visit",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        warrantyReturnVisitBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.scheduleReturnVisit({
          ...selection,
          ...values,
          claimId: id(context.req.param("claimId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/warranty-claims/:claimId/resolve",
    ...professionalManage,
    async (context) => {
      const selection = professionalSelection(context);
      const values = await parseJsonBody(
        warrantyResolveBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.resolveClaim({
          ...selection,
          ...values,
          claimId: id(context.req.param("claimId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/warranties",
    requireSessionMiddleware,
    async (context) => {
      const query = parseQuery(warrantyListQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listClient({
          authUserId: authUserId(context),
          ...query,
        });
        return context.json<ApiSuccessBody<WarrantyPage>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/warranties/:warrantyId",
    requireSessionMiddleware,
    async (context) => {
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getClient(
          authUserId(context),
          id(context.req.param("warrantyId")),
        );
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/warranties/:warrantyId/claims",
    requireSessionMiddleware,
    async (context) => {
      const values = await parseJsonBody(
        warrantyClaimSubmitBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.submitClaim({
          authUserId: authUserId(context),
          warrantyId: id(context.req.param("warrantyId")),
          ...values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/warranties/:warrantyId/claims/:claimId/escalate",
    requireSessionMiddleware,
    async (context) => {
      const values = await parseJsonBody(
        warrantyEscalateBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.escalateClient({
          authUserId: authUserId(context),
          warrantyId: id(context.req.param("warrantyId")),
          claimId: id(context.req.param("claimId")),
          lockVersion: values.lockVersion,
          reason: values.reason,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<WarrantyDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
