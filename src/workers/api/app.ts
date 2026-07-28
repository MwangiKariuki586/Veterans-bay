import { bodyLimit } from "hono/body-limit";
import { Hono } from "hono";

import {
  AppError,
  type ValidationIssue,
} from "../../platform/errors/app-error";
import { createBookingRoutes } from "../../modules/bookings/routes";
import { createNotificationRoutes } from "../../modules/notifications/routes";
import type { ApiErrorBody } from "../../platform/http/contracts";
import { logError } from "../../platform/logging/logger";
import { createIdentityRoutes } from "../../modules/identity/routes";
import { createConversationRoutes } from "../../modules/conversations/routes";
import { createMarketplaceRoutes } from "../../modules/marketplace/routes";
import { createMarketplaceModerationRoutes } from "../../modules/marketplace-moderation/routes";
import { createOutboxRoutes } from "../../modules/outbox/routes";
import { createQuotationRoutes } from "../../modules/quotations/routes";
import { createProfessionalOnboardingRoutes } from "../../modules/professional-onboarding/routes";
import { createProfessionalServicesRoutes } from "../../modules/professional-services/routes";
import { createProfessionalTeamRoutes } from "../../modules/professional-team/routes";
import { createSavedProfessionalsRoutes } from "../../modules/saved-professionals/routes";
import { createServiceRequestRoutes } from "../../modules/service-requests/routes";
import { createStorageRoutes } from "../../modules/storage/routes";
import type { SystemRepository } from "../../modules/system/repository";
import { createSystemRoutes } from "../../modules/system/routes";
import { createWorkspaceRoutes } from "../../modules/workspace/routes";
import { createAuth } from "../../platform/auth/create-auth";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestContextMiddleware } from "./middleware/request-context";
import { requestLoggingMiddleware } from "./middleware/request-logging";
import { trustedOriginMiddleware } from "./middleware/trusted-origin";
import type { ApiAppEnvironment } from "./types";

const defaultBodyLimitBytes = 64 * 1024;

interface ApiAppDependencies {
  systemRepository?: SystemRepository;
}

function errorBody(
  code: string,
  message: string,
  requestId: string,
  issues?: ValidationIssue[],
): ApiErrorBody {
  return {
    error: {
      code,
      ...(issues ? { issues } : {}),
      message,
    },
    requestId,
  };
}

export function createApiApp(dependencies: ApiAppDependencies = {}) {
  const api = new Hono<ApiAppEnvironment>();

  api.use("*", requestContextMiddleware);
  api.use("*", requestLoggingMiddleware);
  api.use("*", trustedOriginMiddleware);
  api.use(
    "/api/*",
    bodyLimit({
      maxSize: defaultBodyLimitBytes,
      onError: (context) =>
        context.json<ApiErrorBody>(
          errorBody(
            "REQUEST_TOO_LARGE",
            "The request body is too large.",
            context.get("requestId"),
          ),
          413,
        ),
    }),
  );
  api.use("/api/*", rateLimitMiddleware);

  api.on(["GET", "POST"], "/api/auth/*", (context) => {
    const auth = createAuth(context.get("environment"));
    return auth.handler(context.req.raw);
  });

  api.route("/api", createSystemRoutes(dependencies.systemRepository));
  api.route("/api", createIdentityRoutes());
  api.route("/api", createMarketplaceRoutes());
  api.route("/api", createMarketplaceModerationRoutes());
  api.route("/api", createSavedProfessionalsRoutes());
  api.route("/api", createServiceRequestRoutes());
  api.route("/api", createConversationRoutes());
  api.route("/api", createQuotationRoutes());
  api.route("/api", createBookingRoutes());
  api.route("/api", createNotificationRoutes());
  api.route("/api", createWorkspaceRoutes());
  api.route("/api", createStorageRoutes());
  api.route("/api", createOutboxRoutes());
  api.route("/api", createProfessionalOnboardingRoutes());
  api.route("/api", createProfessionalServicesRoutes());
  api.route("/api", createProfessionalTeamRoutes());

  api.notFound((context) =>
    context.json<ApiErrorBody>(
      errorBody(
        "NOT_FOUND",
        "The requested resource was not found.",
        context.get("requestId"),
      ),
      404,
    ),
  );

  api.onError((error, context) => {
    const requestId = context.get("requestId") ?? crypto.randomUUID();
    const mappedError =
      error instanceof AppError
        ? error
        : new AppError({
            cause: error,
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred.",
            status: 500,
          });

    logError({
      event: "api.request_failed",
      requestId,
      method: context.req.method,
      path: context.req.path,
      status: mappedError.status,
      errorCategory: mappedError.code,
    });

    return context.json<ApiErrorBody>(
      errorBody(
        mappedError.code,
        mappedError.message,
        requestId,
        mappedError.issues,
      ),
      mappedError.status as 400,
    );
  });

  return api;
}

export const app = createApiApp();
