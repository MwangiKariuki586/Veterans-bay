import { Hono } from "hono";
import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseWithSchema } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { ReviewsRepository } from "./repository";
import {
  reportReviewBodySchema,
  respondReviewBodySchema,
  reviewIdSchema,
  submitReviewBodySchema,
} from "./schemas";
import { ReviewsService } from "./service";

function setup(url: string) {
  const client = createDatabaseClient(url);
  const repo = new ReviewsRepository(client.db);
  return {
    client,
    repo,
    service: new ReviewsService(repo, new IdentityRepository(client.db)),
  };
}
function user(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account required.");
  return account.authUserId;
}
function professional(context: {
  get(
    key: "workspaceSelection",
  ):
    | { accountProfileId: string; workspace: { organisationId: string | null } }
    | undefined;
}) {
  const selected = context.get("workspaceSelection");
  if (!selected?.workspace.organisationId)
    throw new Error("Organisation workspace required.");
  return {
    organisationId: selected.workspace.organisationId,
    actorAccountId: selected.accountProfileId,
  };
}

export function createReviewRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  routes.get(
    "/v1/client/jobs/:jobId/review",
    requireSessionMiddleware,
    async (context) => {
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.eligibility(
            user(context),
            parseWithSchema(reviewIdSchema, context.req.param("jobId")),
          ),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/client/jobs/:jobId/review",
    requireSessionMiddleware,
    async (context) => {
      const values = await parseJsonBody(
        submitReviewBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>(
          {
            data: await service.submit({
              ...values,
              authUserId: user(context),
              jobId: parseWithSchema(
                reviewIdSchema,
                context.req.param("jobId"),
              ),
              correlationId: context.get("requestId"),
            }),
            requestId: context.get("requestId"),
          },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/client/reviews/:reviewId/report",
    requireSessionMiddleware,
    async (context) => {
      const values = await parseJsonBody(
        reportReviewBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.report({
            ...values,
            authUserId: user(context),
            reviewId: parseWithSchema(
              reviewIdSchema,
              context.req.param("reviewId"),
            ),
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  const read = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsView),
  ] as const;
  const manage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.jobsManage),
  ] as const;
  routes.get("/v1/professional/reviews", ...read, async (context) => {
    const p = professional(context);
    const { client, service } = setup(context.get("environment").DATABASE_URL);
    try {
      return context.json<ApiSuccessBody<unknown>>({
        data: await service.listProfessional(p.organisationId),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });
  routes.post(
    "/v1/professional/reviews/:reviewId/respond",
    ...manage,
    async (context) => {
      const p = professional(context);
      const values = await parseJsonBody(
        respondReviewBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.respond({
            ...p,
            ...values,
            reviewId: parseWithSchema(
              reviewIdSchema,
              context.req.param("reviewId"),
            ),
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/reviews/:reviewId/report",
    ...manage,
    async (context) => {
      const p = professional(context);
      const values = await parseJsonBody(
        reportReviewBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.reportProfessional({
            ...p,
            ...values,
            reviewId: parseWithSchema(
              reviewIdSchema,
              context.req.param("reviewId"),
            ),
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  return routes;
}
