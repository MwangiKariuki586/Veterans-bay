import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { OutboxPublisher } from "./publisher";
import { OutboxRepository } from "./repository";
import { OutboxService } from "./service";
import { deadLetterResolutionBodySchema } from "./schemas";
import { requirePlatformAdministrator } from "../administration/authorization";
import { IdentityRepository } from "../identity/repository";
import { WorkspaceRepository } from "../workspace/repository";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  routes.get(
    "/v1/admin/operations/async",
    requireSessionMiddleware,
    async (context) => {
      const environment = context.get("environment");
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const client = createDatabaseClient(environment.DATABASE_URL);
      try {
        await requirePlatformAdministrator(
          account.authUserId,
          new IdentityRepository(client.db),
          new WorkspaceRepository(client.db),
        );
        return context.json({
          data: await new OutboxRepository(client.db).diagnostics(),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/admin/operations/dead-letters/:deadLetterId/:action",
    requireSessionMiddleware,
    async (context) => {
      const account = context.get("account");
      if (!account) throw new Error("Authenticated account is required.");
      const deadLetterId = context.req.param("deadLetterId");
      const action = context.req.param("action");
      if (!uuid.test(deadLetterId) || !["retry", "discard"].includes(action)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "The dead-letter operation is invalid.",
          status: 422,
        });
      }
      const input = await parseJsonBody(
        deadLetterResolutionBodySchema,
        context.req.raw,
      );
      const client = createDatabaseClient(
        context.get("environment").DATABASE_URL,
      );
      try {
        const administrator = await requirePlatformAdministrator(
          account.authUserId,
          new IdentityRepository(client.db),
          new WorkspaceRepository(client.db),
        );
        const repository = new OutboxRepository(client.db);
        const result =
          action === "retry"
            ? await repository.retryDeadLetter({
                deadLetterId,
                actorAccountId: administrator.id,
                reason: input.reason,
                correlationId: context.get("requestId"),
              })
            : await repository.discardDeadLetter({
                deadLetterId,
                actorAccountId: administrator.id,
                reason: input.reason,
                correlationId: context.get("requestId"),
              });
        if (!result) {
          throw new AppError({
            code: "DEAD_LETTER_NOT_AVAILABLE",
            message: "The dead letter is no longer open.",
            status: 409,
          });
        }
        return context.json({
          data: result,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
