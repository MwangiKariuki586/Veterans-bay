import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import {
  parseJsonBody,
  parseQuery,
} from "../../platform/http/validation";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";
import { ProfessionalOnboardingRepository } from "./repository";
import {
  attachOnboardingAssetBodySchema,
  adminProfessionalReviewQuerySchema,
  createOnboardingBodySchema,
  onboardingReviewDecisionBodySchema,
  updateOnboardingBodySchema,
} from "./schemas";
import { ProfessionalOnboardingService } from "./service";
import type { OnboardingSummary } from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new ProfessionalOnboardingService(
      new ProfessionalOnboardingRepository(client.db),
      new IdentityRepository(client.db),
      new WorkspaceRepository(client.db),
    ),
  };
}

export function createProfessionalOnboardingRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get(
    "/v1/professional/onboarding",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.get(account.authUserId);
        return context.json<ApiSuccessBody<OnboardingSummary | null>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/onboarding",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = await parseJsonBody(createOnboardingBodySchema, context.req.raw);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.create({
          authUserId: account.authUserId,
          name: input.name,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<OnboardingSummary>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/admin/professionals",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = parseQuery(
        adminProfessionalReviewQuerySchema,
        context.req.url,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listForReview(account.authUserId, input);
        return context.json({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/admin/professionals/:organisationId",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const organisationId = context.req.param("organisationId");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organisationId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The organisation identifier is invalid.",
          status: 422,
        });
      }
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getForReview(
          account.authUserId,
          organisationId,
        );
        return context.json({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.patch(
    "/v1/professional/onboarding",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = await parseJsonBody(updateOnboardingBodySchema, context.req.raw);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.update({
          authUserId: account.authUserId,
          values: input,
        });
        return context.json<ApiSuccessBody<OnboardingSummary>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/onboarding/assets",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = await parseJsonBody(
        attachOnboardingAssetBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.attachAsset({
          authUserId: account.authUserId,
          ...input,
        });
        return context.json<ApiSuccessBody<OnboardingSummary>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/admin/professionals/:organisationId/decision",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const organisationId = context.req.param("organisationId");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organisationId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The organisation identifier is invalid.",
          status: 422,
        });
      }
      const input = await parseJsonBody(
        onboardingReviewDecisionBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.recordReviewDecision({
          authUserId: account.authUserId,
          organisationId,
          decision: input.decision,
          reason: input.reason,
          correlationId: context.get("requestId"),
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

  routes.post(
    "/v1/professional/onboarding/submit",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.submit({
          authUserId: account.authUserId,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<OnboardingSummary>>({
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
