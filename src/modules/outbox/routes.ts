import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { OutboxPublisher } from "./publisher";
import { OutboxRepository } from "./repository";
import { OutboxService } from "./service";

export function createOutboxRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.post("/v1/system/outbox-proof", requireSessionMiddleware, async (context) => {
    const environment = context.get("environment");
    const account = context.get("account");
    if (!account) {
      throw new Error("Authenticated account is required.");
    }

    const queue = environment.DOMAIN_EVENTS_QUEUE;
    if (!queue) {
      return context.json(
        {
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Domain events queue is not configured.",
          },
          requestId: context.get("requestId"),
        },
        503,
      );
    }

    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const repository = new OutboxRepository(client.db);
      const publisher = new OutboxPublisher(
        repository,
        {
          send: async (message) => queue.send(message),
        },
        `api:${context.get("requestId")}`,
      );
      const service = new OutboxService(repository, publisher);
      const result = await service.createProofAndPublish({
        correlationId: context.get("requestId"),
      });

      return context.json<
        ApiSuccessBody<{
          eventId: string;
          marker: string;
          publication: typeof result.publication;
        }>
      >({
        data: result,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  return routes;
}
