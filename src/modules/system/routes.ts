import { Hono } from "hono";

import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseQuery } from "../../platform/http/validation";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { systemPermissions } from "./permissions";
import {
  RuntimeSystemRepository,
  type SystemRepository,
} from "./repository";
import { readinessQuerySchema, systemProbeBodySchema } from "./schemas";
import { SystemService } from "./service";
import type { HealthStatus, ReadinessStatus } from "./types";

export function createSystemRoutes(
  systemRepository?: SystemRepository,
) {
  const routes = new Hono<ApiAppEnvironment>();

  function resolveService(databaseUrl: string) {
    return new SystemService(
      systemRepository ?? new RuntimeSystemRepository(databaseUrl),
    );
  }

  routes.get("/health", (context) => {
    void systemPermissions.health;
    const requestId = context.get("requestId");
    const service = resolveService(context.get("environment").DATABASE_URL);

    return context.json<ApiSuccessBody<HealthStatus>>({
      data: service.getHealth(),
      requestId,
    });
  });

  routes.get("/ready", async (context) => {
    void systemPermissions.readiness;
    parseQuery(readinessQuerySchema, context.req.url);
    const requestId = context.get("requestId");
    const service = resolveService(context.get("environment").DATABASE_URL);

    return context.json<ApiSuccessBody<ReadinessStatus>>({
      data: await service.getReadiness(),
      requestId,
    });
  });

  routes.post("/v1/system/probe", async (context) => {
    void systemPermissions.probe;
    const requestId = context.get("requestId");
    const input = await parseJsonBody(systemProbeBodySchema, context.req.raw);
    const service = resolveService(context.get("environment").DATABASE_URL);

    return context.json<ApiSuccessBody<{ value: string }>>({
      data: service.probe(input.value),
      requestId,
    });
  });

  return routes;
}
