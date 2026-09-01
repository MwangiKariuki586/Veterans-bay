import { Hono, type Context } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import {
  parseJsonBody,
  parseQuery,
  parseWithSchema,
} from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { QuotationsRepository } from "./repository";
import { createQuotationPdf } from "./quotation-pdf";
import {
  createQuotationBodySchema,
  quotationActionBodySchema,
  quotationComparisonQuerySchema,
  quotationIdSchema,
  quotationListQuerySchema,
  quotationResponseBodySchema,
  updateQuotationBodySchema,
} from "./schemas";
import { QuotationsService } from "./service";
import type {
  ClientQuotationSummary,
  QuotationComparison,
  QuotationDetail,
  QuotationSummary,
} from "./types";
import type { PageResult } from "../../platform/http/pagination";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new QuotationsService(
      new QuotationsRepository(client.db),
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

function quotationId(value: string) {
  return parseWithSchema(quotationIdSchema, value);
}

function organisationSelection(context: {
  get(key: "workspaceSelection"):
    | {
        accountProfileId: string;
        workspace: { organisationId: string | null };
      }
    | undefined;
}) {
  const selection = context.get("workspaceSelection");
  if (!selection?.workspace.organisationId) {
    throw new Error("Organisation workspace is required.");
  }
  return {
    actorAccountId: selection.accountProfileId,
    organisationId: selection.workspace.organisationId,
  };
}

export function createQuotationRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.quotationsView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.quotationsManage),
  ] as const;

  routes.get(
    "/v1/professional/quotations",
    ...professionalRead,
    async (context) => {
      const query = parseQuery(quotationListQuerySchema, context.req.url);
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listProfessional({
          organisationId: selection.organisationId,
          ...query,
        });
        return context.json<ApiSuccessBody<PageResult<QuotationSummary>>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/quotations",
    ...professionalManage,
    async (context) => {
      const { requestId, ...values } = await parseJsonBody(
        createQuotationBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createDraft({
          ...selection,
          requestId,
          values,
        });
        return context.json<ApiSuccessBody<QuotationDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/quotations/:quotationId",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          selection.organisationId,
          quotationId(context.req.param("quotationId")),
        );
        return context.json<ApiSuccessBody<QuotationDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.patch(
    "/v1/professional/quotations/:quotationId",
    ...professionalManage,
    async (context) => {
      const { lockVersion, ...values } = await parseJsonBody(
        updateQuotationBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.updateDraft({
          ...selection,
          quotationId: quotationId(context.req.param("quotationId")),
          expectedLockVersion: lockVersion,
          values,
        });
        return context.json<ApiSuccessBody<QuotationDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/quotations/:quotationId/submit",
    ...professionalManage,
    async (context) => {
      const { lockVersion } = await parseJsonBody(
        quotationActionBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.submit({
          ...selection,
          quotationId: quotationId(context.req.param("quotationId")),
          expectedLockVersion: lockVersion,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<QuotationDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/quotations/:quotationId/revisions",
    ...professionalManage,
    async (context) => {
      const { lockVersion, ...values } = await parseJsonBody(
        updateQuotationBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createRevision({
          ...selection,
          quotationId: quotationId(context.req.param("quotationId")),
          expectedLockVersion: lockVersion,
          values,
        });
        return context.json<ApiSuccessBody<QuotationDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/quotations/:quotationId/compare",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const query = parseQuery(
        quotationComparisonQuerySchema,
        context.req.url,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.compareProfessional({
          organisationId: selection.organisationId,
          quotationId: quotationId(context.req.param("quotationId")),
          ...query,
        });
        return context.json<ApiSuccessBody<QuotationComparison>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/quotations/:quotationId/download",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const id = quotationId(context.req.param("quotationId"));
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const quotation = await service.getProfessional(
          selection.organisationId,
          id,
        );
        return downloadableQuotation(context, quotation);
      } finally {
        await client.close();
      }
    },
  );

  routes.use("/v1/client/quotations", requireSessionMiddleware);
  routes.use("/v1/client/quotations/*", requireSessionMiddleware);

  routes.get("/v1/client/quotations", async (context) => {
    const query = parseQuery(quotationListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listClient({
        authUserId: authUserId(context),
        ...query,
      });
      return context.json<ApiSuccessBody<PageResult<QuotationSummary> & {
        summary: ClientQuotationSummary;
        categories: string[];
      }>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/quotations/:quotationId", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getClient({
        authUserId: authUserId(context),
        quotationId: quotationId(context.req.param("quotationId")),
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<QuotationDetail>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  for (const action of ["decline", "request-revision"] as const) {
    routes.post(
      `/v1/client/quotations/:quotationId/${action}`,
      async (context) => {
        const input = await parseJsonBody(
          quotationResponseBodySchema,
          context.req.raw,
        );
        const { client, service } = createService(
          context.get("environment").DATABASE_URL,
        );
        try {
          const data = await service.clientRespond({
            authUserId: authUserId(context),
            quotationId: quotationId(context.req.param("quotationId")),
            expectedLockVersion: input.lockVersion,
            action:
              action === "decline" ? "DECLINED" : "REVISION_REQUESTED",
            note: input.note,
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<QuotationDetail>>({
            data,
            requestId: context.get("requestId"),
          });
        } finally {
          await client.close();
        }
      },
    );
  }

  routes.post(
    "/v1/client/quotations/:quotationId/accept",
    async (context) => {
      const input = await parseJsonBody(
        quotationActionBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.accept({
          authUserId: authUserId(context),
          quotationId: quotationId(context.req.param("quotationId")),
          expectedLockVersion: input.lockVersion,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<QuotationDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/quotations/:quotationId/compare",
    async (context) => {
      const query = parseQuery(
        quotationComparisonQuerySchema,
        context.req.url,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.compareClient({
          authUserId: authUserId(context),
          quotationId: quotationId(context.req.param("quotationId")),
          ...query,
        });
        return context.json<ApiSuccessBody<QuotationComparison>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/quotations/:quotationId/download",
    async (context) => {
      const id = quotationId(context.req.param("quotationId"));
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const quotation = await service.getClient({
          authUserId: authUserId(context),
          quotationId: id,
          correlationId: context.get("requestId"),
        });
        return downloadableQuotation(context, quotation);
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}

function downloadableQuotation(
  context: Context<ApiAppEnvironment>,
  quotation: QuotationDetail,
) {
  const version = quotation.versions.find(
    (item) => item.versionNumber === quotation.currentVersionNumber,
  );
  if (!version) throw new Error("Quotation current-version invariant violated.");
  const body = createQuotationPdf(quotation);
  return context.body(body, 200, {
    "Accept-Ranges": "none",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="quotation-${quotation.id}-v${version.versionNumber}.pdf"`,
    "Content-Length": String(body.byteLength),
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
  });
}
