import { Hono } from "hono";

import { IdentityRepository } from "../identity/repository";
import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseWithSchema } from "../../platform/http/validation";
import { UnauthorizedError } from "../../platform/permissions/errors";
import { requireSessionMiddleware } from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { providerSlugSchema } from "./schemas";
import { SavedProfessionalsRepository } from "./repository";
import { SavedProfessionalsService } from "./service";
import type {
  SavedProfessional,
  SavedProfessionalMutation,
} from "./types";

function createService(
  databaseUrl: string,
  cloudName?: string,
  existingClient?: ReturnType<typeof createDatabaseClient>,
) {
  const client = existingClient ?? createDatabaseClient(databaseUrl);
  return {
    client,
    ownsClient: !existingClient,
    service: new SavedProfessionalsService(
      new SavedProfessionalsRepository(client.db),
      new IdentityRepository(client.db),
      cloudName,
    ),
  };
}

function requireAccount(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new UnauthorizedError();
  return account;
}

export function createSavedProfessionalsRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get(
    "/v1/client/saved-professionals",
    requireSessionMiddleware,
    async (context) => {
      const environment = context.get("environment");
      const existingClient = context.get("databaseClient");
      const { client, service, ownsClient } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
        existingClient,
      );
      try {
        const data = await service.list(requireAccount(context).authUserId);
        return context.json<ApiSuccessBody<SavedProfessional[]>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        if (ownsClient) await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/saved-professionals/:providerSlug",
    requireSessionMiddleware,
    async (context) => {
      const providerSlug = parseWithSchema(
        providerSlugSchema,
        context.req.param("providerSlug"),
      );
      const environment = context.get("environment");
      const existingClient = context.get("databaseClient");
      const { client, service, ownsClient } = createService(
        environment.DATABASE_URL,
        undefined,
        existingClient,
      );
      try {
        const data = await service.save({
          authUserId: requireAccount(context).authUserId,
          providerSlug,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<SavedProfessionalMutation>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        if (ownsClient) await client.close();
      }
    },
  );

  routes.delete(
    "/v1/client/saved-professionals/:providerSlug",
    requireSessionMiddleware,
    async (context) => {
      const providerSlug = parseWithSchema(
        providerSlugSchema,
        context.req.param("providerSlug"),
      );
      const environment = context.get("environment");
      const existingClient = context.get("databaseClient");
      const { client, service, ownsClient } = createService(
        environment.DATABASE_URL,
        undefined,
        existingClient,
      );
      try {
        const data = await service.remove(
          requireAccount(context).authUserId,
          providerSlug,
        );
        return context.json<ApiSuccessBody<SavedProfessionalMutation>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        if (ownsClient) await client.close();
      }
    },
  );

  return routes;
}
