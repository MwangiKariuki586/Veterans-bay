import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseQuery, parseWithSchema } from "../../platform/http/validation";
import {
  requireSessionMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { NotificationsRepository } from "./repository";
import {
  notificationIdSchema,
  notificationListQuerySchema,
} from "./schemas";
import { NotificationsService } from "./service";
import type {
  NotificationCount,
  NotificationListResult,
} from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new NotificationsService(
      new NotificationsRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  return account.authUserId;
}

export function createNotificationRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  routes.use("/v1/notifications", requireSessionMiddleware);
  routes.use("/v1/notifications/*", requireSessionMiddleware);

  routes.get("/v1/notifications", async (context) => {
    const query = parseQuery(notificationListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.list({
        authUserId: authUserId(context),
        ...query,
      });
      return context.json<ApiSuccessBody<NotificationListResult>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/notifications/unread-count", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.unreadCount(authUserId(context));
      return context.json<ApiSuccessBody<NotificationCount>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/notifications/read-all", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.markAllRead({
        authUserId: authUserId(context),
        correlationId: context.get("requestId"),
      });
      return context.json({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/notifications/:notificationId/read", async (context) => {
    const notificationId = parseWithSchema(
      notificationIdSchema,
      context.req.param("notificationId"),
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.markRead({
        authUserId: authUserId(context),
        notificationId,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<NotificationCount>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  return routes;
}
