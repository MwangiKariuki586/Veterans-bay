import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import {
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
  WORKSPACE_COOKIE,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { workspacePermissions } from "./permissions";
import { WorkspaceRepository } from "./repository";
import { selectWorkspaceBodySchema } from "./schemas";
import { defaultWorkspaceId, WorkspaceService } from "./service";
import type { WorkspaceSummary } from "./types";

function workspaceCookie(workspaceId: string, secure: boolean) {
  const attributes = [
    `${WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function createWorkspaceRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get("/v1/workspaces", requireSessionMiddleware, async (context) => {
    void workspacePermissions.list;
    const environment = context.get("environment");
    const account = context.get("account");
    if (!account) {
      throw new Error("Authenticated account is required.");
    }
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new WorkspaceService(
        new WorkspaceRepository(client.db),
        new IdentityRepository(client.db),
      );
      const result = await service.listWorkspaces(account.authUserId);

      return context.json<
        ApiSuccessBody<{
          workspaces: WorkspaceSummary[];
          defaultWorkspaceId: string | null;
        }>
      >({
        data: {
          workspaces: result.workspaces,
          defaultWorkspaceId: defaultWorkspaceId(result.workspaces),
        },
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/workspaces/select", requireSessionMiddleware, async (context) => {
    void workspacePermissions.select;
    const environment = context.get("environment");
    const account = context.get("account");
    if (!account) {
      throw new Error("Authenticated account is required.");
    }
    const input = await parseJsonBody(selectWorkspaceBodySchema, context.req.raw);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new WorkspaceService(
        new WorkspaceRepository(client.db),
        new IdentityRepository(client.db),
      );
      const selection = await service.resolveWorkspace(
        account.authUserId,
        input.workspaceId,
      );

      context.header(
        "set-cookie",
        workspaceCookie(
          selection.workspace.id,
          environment.APP_ENV === "production" || environment.APP_ENV === "preview",
        ),
      );

      return context.json<ApiSuccessBody<WorkspaceSummary>>({
        data: selection.workspace,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get(
    "/v1/workspaces/current",
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection) {
        throw new Error("Workspace selection is required.");
      }

      return context.json<ApiSuccessBody<WorkspaceSummary>>({
        data: selection.workspace,
        requestId: context.get("requestId"),
      });
    },
  );

  return routes;
}
