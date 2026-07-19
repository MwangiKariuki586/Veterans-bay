import { createMiddleware } from "hono/factory";

import { logError } from "../../../platform/logging/logger";
import type { ApiErrorBody } from "../../../platform/http/contracts";
import { apiEnvironmentSchema } from "../environment";
import type { ApiAppEnvironment } from "../types";

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function readOptionalString(
  env: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const requestContextMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const suppliedRequestId = context.req.header("x-request-id");
    const requestId =
      suppliedRequestId && requestIdPattern.test(suppliedRequestId)
        ? suppliedRequestId
        : crypto.randomUUID();

    context.set("requestId", requestId);
    context.header("x-request-id", requestId);

    // Read bindings by key. Cloudflare env objects may not enumerate optional
    // .dev.vars entries for Zod's object parse.
    const envBindings = context.env as unknown as Record<string, unknown>;
    const parsedEnvironment = apiEnvironmentSchema.safeParse({
      APP_ENV: envBindings.APP_ENV,
      API_RATE_LIMITER: envBindings.API_RATE_LIMITER,
      BETTER_AUTH_SECRET: envBindings.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: envBindings.BETTER_AUTH_URL,
      CLOUDINARY_API_KEY: readOptionalString(envBindings, "CLOUDINARY_API_KEY"),
      CLOUDINARY_API_SECRET: readOptionalString(
        envBindings,
        "CLOUDINARY_API_SECRET",
      ),
      CLOUDINARY_CLOUD_NAME: readOptionalString(
        envBindings,
        "CLOUDINARY_CLOUD_NAME",
      ),
      DATABASE_URL: envBindings.DATABASE_URL,
      DOMAIN_EVENTS_QUEUE: envBindings.DOMAIN_EVENTS_QUEUE,
      PUBLIC_SUBMISSION_RATE_LIMITER: envBindings.PUBLIC_SUBMISSION_RATE_LIMITER,
      WEB_ORIGIN: envBindings.WEB_ORIGIN,
    });

    if (!parsedEnvironment.success) {
      logError({
        event: "api.configuration_unavailable",
        requestId,
        method: context.req.method,
        path: context.req.path,
        status: 503,
        errorCategory: "configuration",
        issues: parsedEnvironment.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join("."),
        })),
      });

      return context.json<ApiErrorBody>(
        {
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Service configuration is unavailable.",
          },
          requestId,
        },
        503,
      );
    }

    context.set("environment", parsedEnvironment.data);
    await next();
  },
);
