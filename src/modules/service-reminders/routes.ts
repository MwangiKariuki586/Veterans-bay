import { Hono } from "hono";
import { createDatabaseClient } from "../../platform/database/client";
import { AppError } from "../../platform/errors/app-error";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody, parseWithSchema } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { customerIdSchema } from "../customers/schemas";
import { ServiceRemindersRepository } from "./repository";
import { reminderIdSchema, scheduleReminderBodySchema } from "./schemas";
function selection(context: {
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
  return { client, repository: new ServiceRemindersRepository(client.db) };
}
export function createServiceReminderRoutes() {
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
  routes.get(
    "/v1/professional/customers/:customerId/reminders",
    ...view,
    async (context) => {
      const scope = selection(context);
      const { client, repository } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        return context.json<ApiSuccessBody<unknown>>({
          data: await repository.list(
            parseWithSchema(customerIdSchema, context.req.param("customerId")),
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
    "/v1/professional/customers/:customerId/reminders",
    ...manage,
    async (context) => {
      const scope = selection(context);
      const values = await parseJsonBody(
        scheduleReminderBodySchema,
        context.req.raw,
      );
      const { client, repository } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await repository.schedule({
          ...scope,
          customerId: parseWithSchema(
            customerIdSchema,
            context.req.param("customerId"),
          ),
          reason: values.reason,
          dueAt: new Date(values.dueAt),
          correlationId: context.get("requestId"),
        });
        if (!data)
          throw new AppError({
            code: "REMINDER_UNAVAILABLE",
            message:
              "Reminders require a future date and an active registered customer.",
            status: 422,
          });
        return context.json<ApiSuccessBody<unknown>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );
  routes.post(
    "/v1/professional/reminders/:reminderId/cancel",
    ...manage,
    async (context) => {
      const scope = selection(context);
      const { client, repository } = setup(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await repository.cancel({
          ...scope,
          reminderId: parseWithSchema(
            reminderIdSchema,
            context.req.param("reminderId"),
          ),
        });
        if (!data)
          throw new AppError({
            code: "REMINDER_UNAVAILABLE",
            message: "The scheduled reminder is unavailable.",
            status: 409,
          });
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
