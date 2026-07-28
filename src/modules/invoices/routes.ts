import { Hono } from "hono";

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
import { InvoicesRepository } from "./repository";
import {
  financialIdSchema,
  invoiceCancelBodySchema,
  invoiceIssueBodySchema,
  invoiceListQuerySchema,
  paymentAdjustmentBodySchema,
  paymentRecordBodySchema,
} from "./schemas";
import { InvoicesService } from "./service";
import type {
  InvoiceDetail,
  InvoicePage,
  PaymentSummary,
} from "./types";
import type { PageResult } from "../../platform/http/pagination";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new InvoicesService(
      new InvoicesRepository(client.db),
      new IdentityRepository(client.db),
    ),
  };
}

function id(value: string) {
  return parseWithSchema(financialIdSchema, value);
}

function authUserId(context: {
  get(key: "account"): { authUserId: string } | undefined;
}) {
  const account = context.get("account");
  if (!account) throw new Error("Authenticated account is required.");
  return account.authUserId;
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

export function createInvoiceRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.paymentsView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.paymentsManage),
  ] as const;

  routes.get(
    "/v1/professional/invoices",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const query = parseQuery(invoiceListQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listProfessional({
          scope: { organisationId: selection.organisationId },
          ...query,
        });
        return context.json<ApiSuccessBody<InvoicePage>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/payments",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const query = parseQuery(invoiceListQuerySchema.pick({
        page: true,
        pageSize: true,
      }), context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listPayments({
          organisationId: selection.organisationId,
          ...query,
        });
        return context.json<ApiSuccessBody<PageResult<PaymentSummary>>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/invoices/from-job/:jobId",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createFromJob({
          ...selection,
          jobId: id(context.req.param("jobId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<InvoiceDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/invoices/:invoiceId",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          id(context.req.param("invoiceId")),
          selection.organisationId,
        );
        return context.json<ApiSuccessBody<InvoiceDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/invoices/:invoiceId/issue",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const values = await parseJsonBody(
        invoiceIssueBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.issue({
          ...selection,
          ...values,
          invoiceId: id(context.req.param("invoiceId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<InvoiceDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/invoices/:invoiceId/cancel",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const values = await parseJsonBody(
        invoiceCancelBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.cancel({
          ...selection,
          ...values,
          invoiceId: id(context.req.param("invoiceId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<InvoiceDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/invoices/:invoiceId/payments",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const values = await parseJsonBody(
        paymentRecordBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.recordPayment({
          ...selection,
          ...values,
          invoiceId: id(context.req.param("invoiceId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<InvoiceDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/payments/:paymentId/adjustments",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const values = await parseJsonBody(
        paymentAdjustmentBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.adjustPayment({
          ...selection,
          ...values,
          paymentId: id(context.req.param("paymentId")),
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<InvoiceDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/invoices",
    requireSessionMiddleware,
    async (context) => {
      const query = parseQuery(invoiceListQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listClient({
          authUserId: authUserId(context),
          ...query,
        });
        return context.json<ApiSuccessBody<InvoicePage>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/client/invoices/:invoiceId",
    requireSessionMiddleware,
    async (context) => {
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getClient(
          authUserId(context),
          id(context.req.param("invoiceId")),
        );
        return context.json<ApiSuccessBody<InvoiceDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  return routes;
}
