import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseQuery, parseWithSchema } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";

import { ClientContextRepository } from "./repository";
import { clientContextParamsSchema, clientContextQuerySchema } from "./schemas";
import { ClientContextService } from "./service";

function selected(context: {
  get(
    key: "workspaceSelection",
  ):
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
  const value = context.get("workspaceSelection");
  if (!value?.workspace.organisationId)
    throw new Error("Organisation workspace required.");
  return {
    organisationId: value.workspace.organisationId,
    actorAccountId: value.accountProfileId,
    membershipId: value.workspace.membershipId ?? null,
    assignedJobsOnly: Boolean(value.workspace.assignedJobsOnly),
  };
}

export function createClientContextRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get(
    "/v1/professional/clients/:clientId",
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.customersView),
    async (context) => {
      const scope = selected(context);
      const { clientId } = parseWithSchema(
        clientContextParamsSchema,
        { clientId: context.req.param("clientId") },
      );
      const query = parseQuery(clientContextQuerySchema, context.req.url);
      const { client, service } = (() => {
        const c = createDatabaseClient(context.get("environment").DATABASE_URL);
        return {
          client: c,
          service: new ClientContextService(new ClientContextRepository(c.db)),
        };
      })();

      try {
        const data = await service.getClientContext({
          organisationId: scope.organisationId,
          clientAccountId: clientId,
          actorAccountId: scope.actorAccountId,
          membershipId: scope.membershipId,
          assignedJobsOnly: scope.assignedJobsOnly,
          contextId: query.contextId ?? null,
          contextType: query.contextType ?? null,
        });

        return context.json<ApiSuccessBody<typeof data>>({
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
