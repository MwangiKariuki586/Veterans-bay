import { createMiddleware } from "hono/factory";

import { AppError } from "../../../platform/errors/app-error";
import type { ApiAppEnvironment } from "../types";

export const trustedOriginMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const origin = context.req.header("origin");

    if (origin) {
      if (origin !== context.get("environment").WEB_ORIGIN) {
        throw new AppError({
          code: "ORIGIN_NOT_ALLOWED",
          message: "The request origin is not allowed.",
          status: 403,
        });
      }

      context.header("access-control-allow-origin", origin);
      context.header("access-control-allow-credentials", "true");
      context.header("vary", "Origin");
    }

    if (context.req.method === "OPTIONS") {
      context.header(
        "access-control-allow-headers",
        "authorization, content-type, x-request-id",
      );
      context.header(
        "access-control-allow-methods",
        "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
      );
      context.header("access-control-max-age", "600");
      return context.body(null, 204);
    }

    await next();
  },
);
