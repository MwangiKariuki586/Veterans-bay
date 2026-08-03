import { Hono } from "hono";

import { requirePlatformAdministrator } from "../administration/authorization";
import { createDatabaseClient } from "../../platform/database/client";
import { parseQuery } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireProfessionalDashboardMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";
import { DashboardsRepository } from "./repository";
import { dashboardRangeQuerySchema } from "./schemas";

export function createDashboardRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get(
    "/v1/client/dashboard",
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection || selection.workspace.kind !== "client") {
        throw new Error("Client workspace required.");
      }
      return withRepository(context, (repository) =>
        repository.client(selection.accountProfileId),
      );
    },
  );

  routes.get(
    "/v1/professional/dashboard",
    requireProfessionalDashboardMiddleware,
    requirePermissionMiddleware(permissionKeys.organisationView),
    async (context) => {
      const selection = context.get("workspaceSelection");
      const organisationId = selection?.workspace.organisationId;
      if (!selection || !organisationId) {
        throw new Error("Organisation workspace required.");
      }
      const range = parseQuery(dashboardRangeQuerySchema, context.req.url);
      return withRepository(context, (repository) =>
        repository.professional(
          organisationId,
          selection.accountProfileId,
          range,
          selection.workspace.financialDataAccess &&
            selection.workspace.permissions.includes(
              permissionKeys.reportsFinancialView,
            ),
        ),
      );
    },
  );

  routes.get(
    "/v1/admin/dashboard",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const range = parseQuery(dashboardRangeQuerySchema, context.req.url);
      const client = createDatabaseClient(
        context.get("environment").DATABASE_URL,
      );
      try {
        await requirePlatformAdministrator(
          account.authUserId,
          new IdentityRepository(client.db),
          new WorkspaceRepository(client.db),
        );
        return context.json({
          data: await new DashboardsRepository(client.db).administrator(range),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}

async function withRepository<T>(
  context: {
    get(key: "environment"): { DATABASE_URL: string };
    get(key: "requestId"): string;
    get(key: "databaseClient"): ReturnType<typeof createDatabaseClient> | undefined;
    header(name: string, value: string): void;
    json(value: unknown): Response;
  },
  action: (repository: DashboardsRepository) => Promise<T>,
) {
  const sharedClient = context.get("databaseClient");
  const client = sharedClient ?? createDatabaseClient(context.get("environment").DATABASE_URL);
  const applicationStartedAt = performance.now();
  try {
    const data = await action(new DashboardsRepository(client.db));
    if (data && typeof data === "object" && "serverTiming" in data) {
      const timing = (data as { serverTiming?: { databaseMs: number; aggregationMs: number } }).serverTiming;
      if (timing) {
        context.header("Server-Timing", `db;dur=${timing.databaseMs.toFixed(1)}, aggregate;dur=${timing.aggregationMs.toFixed(1)}, app;dur=${(performance.now() - applicationStartedAt).toFixed(1)}`);
        delete (data as { serverTiming?: unknown }).serverTiming;
      }
    }
    return context.json({
      data,
      requestId: context.get("requestId"),
    });
  } finally {
    if (!sharedClient) await client.close();
  }
}
