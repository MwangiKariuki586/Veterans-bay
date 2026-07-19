import { createMiddleware } from "hono/factory";

import { logInfo } from "../../../platform/logging/logger";
import type { ApiAppEnvironment } from "../types";

export const requestLoggingMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const startedAt = Date.now();

    await next();

    logInfo({
      event: "api.request_completed",
      requestId: context.get("requestId"),
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    });
  },
);
