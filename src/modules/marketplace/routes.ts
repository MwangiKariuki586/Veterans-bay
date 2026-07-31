import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseQuery } from "../../platform/http/validation";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { MarketplaceRepository } from "./repository";
import {
  marketplaceAnalyticsEventSchema,
  marketplaceSearchQuerySchema,
} from "./schemas";
import { MarketplaceService } from "./service";
import type { MarketplaceSearchResult } from "./types";
import { applyPublicProjectionCache } from "../../platform/http/public-cache";

export function createMarketplaceRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get("/v1/public/marketplace", async (context) => {
    applyPublicProjectionCache(context);
    const input = parseQuery(marketplaceSearchQuerySchema, context.req.url);
    const environment = context.get("environment");
    const client = createDatabaseClient(environment.DATABASE_URL);
    try {
      const data = await new MarketplaceService(
        new MarketplaceRepository(client.db),
        environment.CLOUDINARY_CLOUD_NAME,
      ).search(input);
      return context.json<ApiSuccessBody<MarketplaceSearchResult>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/public/marketplace/events", async (context) => {
    const event = await parseJsonBody(
      marketplaceAnalyticsEventSchema,
      context.req.raw,
    );
    const environment = context.get("environment");
    const client = createDatabaseClient(environment.DATABASE_URL);
    try {
      await new MarketplaceService(
        new MarketplaceRepository(client.db),
      ).recordAnalytics(event);
      return context.json(
        {
          data: { accepted: true as const },
          requestId: context.get("requestId"),
        },
        202,
      );
    } finally {
      await client.close();
    }
  });

  return routes;
}
