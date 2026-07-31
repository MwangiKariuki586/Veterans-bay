import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { applyPublicProjectionCache } from "../../platform/http/public-cache";
import { ProfessionalServicesRepository } from "./repository";
import { PublicCatalogueRepository } from "./public-repository";
import { PublicCatalogueService } from "./public-service";
import {
  attachProfessionalLogoBodySchema,
  attachServiceImageBodySchema,
  createPortfolioItemBodySchema,
  createProfessionalServiceBodySchema,
  transitionProfessionalServiceBodySchema,
  updateProfessionalProfileBodySchema,
  updateProfessionalServiceBodySchema,
} from "./schemas";
import { ProfessionalServicesService } from "./service";
import type {
  ManagedImageAsset,
  ManagedPortfolioItem,
  ManagedProfessionalProfile,
  ProfessionalServiceSummary,
  PublicProfessionalProfile,
  PublicServiceDetail,
} from "./types";

function createService(databaseUrl: string, cloudName?: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new ProfessionalServicesService(
      new ProfessionalServicesRepository(client.db),
      cloudName,
    ),
  };
}

export function createProfessionalServicesRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const workspaceRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.servicesView),
  ] as const;
  const workspaceManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.servicesManage),
  ] as const;

  routes.get("/v1/public/professionals/:slug", async (context) => {
    applyPublicProjectionCache(context);
    const environment = context.get("environment");
    const client = createDatabaseClient(environment.DATABASE_URL);
    try {
      const service = new PublicCatalogueService(
        new PublicCatalogueRepository(client.db),
        environment.CLOUDINARY_CLOUD_NAME,
      );
      const data = await service.getProfessional(context.req.param("slug"));
      return context.json<ApiSuccessBody<PublicProfessionalProfile>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/public/services/:slug", async (context) => {
    applyPublicProjectionCache(context);
    const environment = context.get("environment");
    const client = createDatabaseClient(environment.DATABASE_URL);
    try {
      const service = new PublicCatalogueService(
        new PublicCatalogueRepository(client.db),
        environment.CLOUDINARY_CLOUD_NAME,
      );
      const data = await service.getService(context.req.param("slug"));
      return context.json<ApiSuccessBody<PublicServiceDetail>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/professional/profile", ...workspaceRead, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection?.workspace.organisationId) {
      throw new Error("Organisation workspace is required.");
    }
    const environment = context.get("environment");
    const { client, service } = createService(
      environment.DATABASE_URL,
      environment.CLOUDINARY_CLOUD_NAME,
    );
    try {
      const data = await service.getManagedProfile(
        selection.workspace.organisationId,
      );
      return context.json<ApiSuccessBody<ManagedProfessionalProfile>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.patch("/v1/professional/profile", ...workspaceManage, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection?.workspace.organisationId) {
      throw new Error("Organisation workspace is required.");
    }
    const values = await parseJsonBody(
      updateProfessionalProfileBodySchema,
      context.req.raw,
    );
    const environment = context.get("environment");
    const { client, service } = createService(
      environment.DATABASE_URL,
      environment.CLOUDINARY_CLOUD_NAME,
    );
    try {
      const data = await service.updateManagedProfile({
        organisationId: selection.workspace.organisationId,
        values,
      });
      return context.json<ApiSuccessBody<ManagedProfessionalProfile>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/professional/profile/logo",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { assetId } = await parseJsonBody(
        attachProfessionalLogoBodySchema,
        context.req.raw,
      );
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.attachLogo({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          assetId,
        });
        return context.json<ApiSuccessBody<ManagedProfessionalProfile>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/profile/portfolio",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const input = await parseJsonBody(
        createPortfolioItemBodySchema,
        context.req.raw,
      );
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.addPortfolioItem({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          assetId: input.assetId,
          title: input.title,
          description: input.description ?? null,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<ManagedPortfolioItem>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.delete(
    "/v1/professional/profile/portfolio/:itemId",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.removePortfolioItem(
          selection.workspace.organisationId,
          context.req.param("itemId"),
        );
        return context.json<ApiSuccessBody<ManagedPortfolioItem>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get("/v1/professional/services", ...workspaceRead, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection?.workspace.organisationId) {
      throw new Error("Organisation workspace is required.");
    }
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.list(selection.workspace.organisationId);
      return context.json<ApiSuccessBody<ProfessionalServiceSummary[]>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/professional/services",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const input = await parseJsonBody(
        createProfessionalServiceBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createDraft({
          organisationId: selection.workspace.organisationId,
          actorAccountId: selection.accountProfileId,
          values: input,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<ProfessionalServiceSummary>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/services/:serviceId",
    ...workspaceRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { client, service } = createService(context.get("environment").DATABASE_URL);
      try {
        const data = await service.get(
          selection.workspace.organisationId,
          context.req.param("serviceId"),
        );
        return context.json<ApiSuccessBody<ProfessionalServiceSummary>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/services/:serviceId/images",
    ...workspaceRead,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.listServiceImages(
          selection.workspace.organisationId,
          context.req.param("serviceId"),
        );
        return context.json<ApiSuccessBody<ManagedImageAsset[]>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/services/:serviceId/images",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { assetId } = await parseJsonBody(
        attachServiceImageBodySchema,
        context.req.raw,
      );
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.addServiceImage({
          organisationId: selection.workspace.organisationId,
          serviceId: context.req.param("serviceId"),
          actorAccountId: selection.accountProfileId,
          assetId,
        });
        return context.json<ApiSuccessBody<ManagedImageAsset>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.delete(
    "/v1/professional/services/:serviceId/images/:imageId",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const environment = context.get("environment");
      const { client, service } = createService(
        environment.DATABASE_URL,
        environment.CLOUDINARY_CLOUD_NAME,
      );
      try {
        const data = await service.removeServiceImage(
          selection.workspace.organisationId,
          context.req.param("serviceId"),
          context.req.param("imageId"),
        );
        return context.json<ApiSuccessBody<ManagedImageAsset>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.patch(
    "/v1/professional/services/:serviceId",
    ...workspaceManage,
    async (context) => {
      const selection = context.get("workspaceSelection");
      if (!selection?.workspace.organisationId) {
        throw new Error("Organisation workspace is required.");
      }
      const { version, ...values } = await parseJsonBody(
        updateProfessionalServiceBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(context.get("environment").DATABASE_URL);
      try {
        const data = await service.update({
          organisationId: selection.workspace.organisationId,
          serviceId: context.req.param("serviceId"),
          actorAccountId: selection.accountProfileId,
          expectedVersion: version,
          values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<ProfessionalServiceSummary>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  for (const action of ["publish", "unpublish"] as const) {
    routes.post(
      `/v1/professional/services/:serviceId/${action}`,
      ...workspaceManage,
      async (context) => {
        const selection = context.get("workspaceSelection");
        if (!selection?.workspace.organisationId) {
          throw new Error("Organisation workspace is required.");
        }
        const { version } = await parseJsonBody(
          transitionProfessionalServiceBodySchema,
          context.req.raw,
        );
        const { client, service } = createService(context.get("environment").DATABASE_URL);
        try {
          const data = await service[action]({
            organisationId: selection.workspace.organisationId,
            serviceId: context.req.param("serviceId"),
            actorAccountId: selection.accountProfileId,
            expectedVersion: version,
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<ProfessionalServiceSummary>>({
            data,
            requestId: context.get("requestId"),
          });
        } finally {
          await client.close();
        }
      },
    );
  }

  return routes;
}
