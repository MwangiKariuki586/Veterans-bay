import { createMiddleware } from "hono/factory";

import { RateLimitExceededError } from "../../../platform/errors/app-error";
import type { ApiAppEnvironment } from "../types";

function clientIp(context: {
  req: { header: (name: string) => string | undefined };
}): string {
  return (
    context.req.header("cf-connecting-ip") ||
    context.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isPublicSubmission(method: string, path: string): boolean {
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
    return false;
  }

  return (
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/v1/public/") ||
    path === "/api/v1/reports"
  );
}

export const rateLimitMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const environment = context.get("environment");
    const path = context.req.path;
    const method = context.req.method;
    const publicSubmission = isPublicSubmission(method, path);

    const limiter = publicSubmission
      ? (environment.PUBLIC_SUBMISSION_RATE_LIMITER ?? environment.API_RATE_LIMITER)
      : environment.API_RATE_LIMITER;

    const key = publicSubmission
      ? `public:${clientIp(context)}:${path}`
      : `api:${clientIp(context)}:${path}`;

    const outcome = await limiter.limit({ key });

    if (!outcome.success) {
      throw new RateLimitExceededError();
    }

    await next();
  },
);
