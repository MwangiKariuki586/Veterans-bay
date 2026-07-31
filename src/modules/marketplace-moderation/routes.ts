import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import { parseJsonBody, parseQuery } from "../../platform/http/validation";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";
import { MarketplaceModerationRepository } from "./repository";
import {
  createMarketplaceCategoryBodySchema,
  listingModerationBodySchema,
  marketplaceCategoryStatusBodySchema,
  marketplaceListingsQuerySchema,
} from "./schemas";
import { MarketplaceModerationService } from "./service";
import { applyPublicProjectionCache } from "../../platform/http/public-cache";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new MarketplaceModerationService(
      new MarketplaceModerationRepository(client.db),
      new IdentityRepository(client.db),
      new WorkspaceRepository(client.db),
    ),
  };
}

export function createMarketplaceModerationRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get("/v1/public/categories", async (context) => {
    applyPublicProjectionCache(context);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      return context.json({
        data: await service.listPublicCategories(),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get(
    "/v1/admin/categories",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json({
          data: await service.listCategories(account.authUserId),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/admin/categories",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = await parseJsonBody(
        createMarketplaceCategoryBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json(
          {
            data: await service.createCategory({
              authUserId: account.authUserId,
              name: input.name,
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
    "/v1/admin/categories/:categoryId/status",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const categoryId = context.req.param("categoryId");
      if (!uuid.test(categoryId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The category identifier is invalid.",
          status: 422,
        });
      }
      const input = await parseJsonBody(
        marketplaceCategoryStatusBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json({
          data: await service.setCategoryStatus({
            authUserId: account.authUserId,
            categoryId,
            ...input,
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/admin/marketplace/listings",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const input = parseQuery(marketplaceListingsQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json({
          data: await service.listListings(account.authUserId, input),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/admin/marketplace/listings/:serviceId/moderation",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const serviceId = context.req.param("serviceId");
      if (!uuid.test(serviceId)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The service identifier is invalid.",
          status: 422,
        });
      }
      const input = await parseJsonBody(
        listingModerationBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json({
          data: await service.moderateListing({
            authUserId: account.authUserId,
            serviceId,
            ...input,
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
