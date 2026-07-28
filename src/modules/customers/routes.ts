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
import { CustomersRepository } from "./repository";
import {
  createCustomerBodySchema,
  customerIdSchema,
  customerListQuerySchema,
  customerNoteBodySchema,
  customerTagBodySchema,
} from "./schemas";
import { CustomersService } from "./service";

function selected(context: {
  get(
    key: "workspaceSelection",
  ):
    | { accountProfileId: string; workspace: { organisationId: string | null } }
    | undefined;
}) {
  const value = context.get("workspaceSelection");
  if (!value?.workspace.organisationId)
    throw new Error("Organisation workspace required.");
  return {
    organisationId: value.workspace.organisationId,
    actorAccountId: value.accountProfileId,
  };
}
function setup(url: string) {
  const client = createDatabaseClient(url);
  const repository = new CustomersRepository(client.db);
  return { client, repository, service: new CustomersService(repository) };
}
const id = (value: string) => parseWithSchema(customerIdSchema, value);
export function createCustomerRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const view = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.customersView),
  ] as const;
  const manage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.customersManage),
  ] as const;
  routes.get("/v1/professional/customers", ...view, async (context) => {
    const scope = selected(context);
    const query = parseQuery(customerListQuerySchema, context.req.url);
    const { client, service } = setup(context.get("environment").DATABASE_URL);
    try {
      return context.json<ApiSuccessBody<unknown>>({
        data: await service.list({ ...scope, ...query }),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });
  routes.post("/v1/professional/customers", ...manage, async (context) => {
    const scope = selected(context);
    const values = await parseJsonBody(
      createCustomerBodySchema,
      context.req.raw,
    );
    const { client, service } = setup(context.get("environment").DATABASE_URL);
    try {
      return context.json<ApiSuccessBody<unknown>>(
        {
          data: await service.create({
            ...scope,
            ...values,
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        },
        201,
      );
    } finally {
      await client.close();
    }
  });
  routes.get(
    "/v1/professional/customers/:customerId",
    ...view,
    async (context) => {
      const scope = selected(context);
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.get(
            id(context.req.param("customerId")),
            scope.organisationId,
          ),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/customers/:customerId/notes",
    ...manage,
    async (context) => {
      const scope = selected(context);
      const values = await parseJsonBody(
        customerNoteBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>(
          {
            data: await service.addNote({
              ...scope,
              ...values,
              customerId: id(context.req.param("customerId")),
            }),
            requestId: context.get("requestId"),
          },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/customers/:customerId/tags",
    ...manage,
    async (context) => {
      const scope = selected(context);
      const values = await parseJsonBody(
        customerTagBodySchema,
        context.req.raw,
      );
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>(
          {
            data: await service.addTag({
              ...scope,
              ...values,
              customerId: id(context.req.param("customerId")),
              correlationId: context.get("requestId"),
            }),
            requestId: context.get("requestId"),
          },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/customers/:customerId/invite",
    ...manage,
    async (context) => {
      const scope = selected(context);
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.invite({
            ...scope,
            customerId: id(context.req.param("customerId")),
            correlationId: context.get("requestId"),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/customers/:customerId/reconcile",
    ...manage,
    async (context) => {
      const scope = selected(context);
      const { client, service } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await service.reconcile({
            organisationId: scope.organisationId,
            customerId: id(context.req.param("customerId")),
          }),
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );
  routes.get(
    "/v1/professional/customers/:customerId/balance",
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.paymentsView),
    async (context) => {
      const scope = selected(context);
      const { client, repository } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await repository.balance(
          id(context.req.param("customerId")),
          scope.organisationId,
        );
        if (!data) throw new Error("Customer not found.");
        return context.json<ApiSuccessBody<unknown>>({
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
