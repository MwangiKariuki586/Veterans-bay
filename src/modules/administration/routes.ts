import { Hono, type Context } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import { parseJsonBody, parseQuery } from "../../platform/http/validation";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";
import { AdministrationRepository } from "./repository";
import {
  adminQueueQuerySchema,
  auditQuerySchema,
  openCaseBodySchema,
  openDisputeBodySchema,
  resolveDisputeBodySchema,
  submitReportBodySchema,
  transitionCaseBodySchema,
  upsertPlatformRuleBodySchema,
  warrantyAdminDecisionBodySchema,
} from "./schemas";
import { AdministrationService } from "./service";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ruleKey = /^[a-z][a-z0-9_.-]{2,79}$/;

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new AdministrationService(
      new AdministrationRepository(client.db),
      new IdentityRepository(client.db),
      new WorkspaceRepository(client.db),
    ),
  };
}

function id(value: string) {
  if (!uuid.test(value)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "The record identifier is invalid.",
      status: 422,
    });
  }
  return value;
}

export function createAdministrationRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.use("/v1/reports", requireSessionMiddleware);
  routes.use("/v1/disputes", requireSessionMiddleware);
  routes.use("/v1/admin/*", requireSessionMiddleware);

  routes.post("/v1/reports", async (context) => {
    const account = context.get("account");
    if (!account) throw new Error("Authenticated account is required.");
    const input = await parseJsonBody(submitReportBodySchema, context.req.raw);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      return context.json(
        {
          data: await service.submitReport(account.authUserId, {
            ...input,
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        },
        201,
      );
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/admin/reports", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.listReports(
        authUserId,
        parseQuery(adminQueueQuerySchema, context.req.url),
      ),
    );
  });

  routes.post("/v1/admin/reports/:reportId/cases", async (context) => {
    const input = await parseJsonBody(openCaseBodySchema, context.req.raw);
    return withAdmin(context, (service, authUserId) =>
      service.openCase(authUserId, id(context.req.param("reportId")), {
        ...input,
        correlationId: context.get("requestId"),
      }),
    );
  });

  routes.get("/v1/admin/moderation/cases", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.listCases(
        authUserId,
        parseQuery(adminQueueQuerySchema, context.req.url),
      ),
    );
  });

  routes.get("/v1/admin/moderation/cases/:caseId", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.getCase(authUserId, id(context.req.param("caseId"))),
    );
  });

  routes.post(
    "/v1/admin/moderation/cases/:caseId/transition",
    async (context) => {
      const input = await parseJsonBody(
        transitionCaseBodySchema,
        context.req.raw,
      );
      return withAdmin(context, (service, authUserId) =>
        service.transitionCase(
          authUserId,
          id(context.req.param("caseId")),
          { ...input, correlationId: context.get("requestId") },
        ),
      );
    },
  );

  routes.get("/v1/admin/disputes", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.listDisputes(
        authUserId,
        parseQuery(adminQueueQuerySchema, context.req.url),
      ),
    );
  });

  routes.post("/v1/disputes", async (context) => {
    const account = context.get("account");
    if (!account) throw new Error("Authenticated account is required.");
    const input = await parseJsonBody(openDisputeBodySchema, context.req.raw);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      return context.json(
        {
          data: await service.openDispute(account.authUserId, {
            ...input,
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        },
        201,
      );
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/admin/disputes/:disputeId/transition", async (context) => {
    const input = await parseJsonBody(
      resolveDisputeBodySchema,
      context.req.raw,
    );
    return withAdmin(context, (service, authUserId) =>
      service.transitionDispute(
        authUserId,
        id(context.req.param("disputeId")),
        { ...input, correlationId: context.get("requestId") },
      ),
    );
  });

  routes.get("/v1/admin/warranties/escalated", async (context) => {
    return withAdmin(context, (service, authUserId) => {
      const query = parseQuery(adminQueueQuerySchema, context.req.url);
      return service.listEscalatedWarranties(authUserId, query);
    });
  });

  routes.post(
    "/v1/admin/warranties/escalated/:claimId/decision",
    async (context) => {
      const input = await parseJsonBody(
        warrantyAdminDecisionBodySchema,
        context.req.raw,
      );
      return withAdmin(context, (service, authUserId) =>
        service.decideEscalatedWarranty(
          authUserId,
          id(context.req.param("claimId")),
          { ...input, correlationId: context.get("requestId") },
        ),
      );
    },
  );

  routes.get("/v1/admin/audit", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.listAudit(
        authUserId,
        parseQuery(auditQuerySchema, context.req.url),
      ),
    );
  });

  routes.get("/v1/admin/rules", async (context) => {
    return withAdmin(context, (service, authUserId) =>
      service.listRules(authUserId),
    );
  });

  routes.put("/v1/admin/rules/:key", async (context) => {
    const key = context.req.param("key");
    if (!ruleKey.test(key)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "The rule key is invalid.",
        status: 422,
      });
    }
    const input = await parseJsonBody(
      upsertPlatformRuleBodySchema,
      context.req.raw,
    );
    return withAdmin(context, (service, authUserId) =>
      service.upsertRule(authUserId, key, {
        ...input,
        correlationId: context.get("requestId"),
      }),
    );
  });

  return routes;
}

async function withAdmin<T>(
  context: Context<ApiAppEnvironment>,
  action: (service: AdministrationService, authUserId: string) => Promise<T>,
) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  const { client, service } = createService(
    context.get("environment").DATABASE_URL,
  );
  try {
    return context.json({
      data: await action(service, account.authUserId),
      requestId: context.get("requestId"),
    });
  } finally {
    await client.close();
  }
}
