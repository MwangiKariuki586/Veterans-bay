import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import {
  parseJsonBody,
  parseQuery,
  parseWithSchema,
} from "../../platform/http/validation";
import type { PageResult } from "../../platform/http/pagination";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { BookingsRepository } from "./repository";
import {
  bookingActionBodySchema,
  bookingCancelBodySchema,
  bookingIdSchema,
  bookingListQuerySchema,
  bookingRescheduleRequestBodySchema,
  bookingScheduleBodySchema,
  calendarQuerySchema,
  clientCreateBookingBodySchema,
  createAvailabilityBlockBodySchema,
  professionalCreateBookingBodySchema,
  replaceAvailabilityBodySchema,
  slotQuerySchema,
} from "./schemas";
import { BookingsService } from "./service";
import type {
  AvailabilityConfiguration,
  BookingDetail,
  BookingSlot,
  BookingSummary,
  CalendarEntry,
} from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return {
    client,
    service: new BookingsService(
      new BookingsRepository(client.db),
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

function id(value: string) {
  return parseWithSchema(bookingIdSchema, value);
}

export function createBookingRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const professionalRead = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.bookingsView),
  ] as const;
  const professionalManage = [
    requireSessionMiddleware,
    requireWorkspaceMiddleware,
    requirePermissionMiddleware(permissionKeys.bookingsManage),
  ] as const;

  routes.get("/v1/professional/bookings", ...professionalRead, async (context) => {
    const selection = organisationSelection(context);
    const query = parseQuery(bookingListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listProfessional({
        organisationId: selection.organisationId,
        ...query,
      });
      return context.json<ApiSuccessBody<PageResult<BookingSummary>>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/professional/bookings",
    ...professionalManage,
    async (context) => {
      const values = await parseJsonBody(
        professionalCreateBookingBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createProfessional({
          ...selection,
          values,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<BookingDetail>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/bookings/:bookingId",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.getProfessional(
          selection.organisationId,
          id(context.req.param("bookingId")),
        );
        return context.json<ApiSuccessBody<BookingDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/bookings/:bookingId/slots",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const query = parseQuery(slotQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listSlotsForProfessional({
          organisationId: selection.organisationId,
          bookingId: id(context.req.param("bookingId")),
          ...query,
        });
        return context.json<ApiSuccessBody<BookingSlot[]>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  for (const action of ["confirm", "reschedule"] as const) {
    routes.post(
      `/v1/professional/bookings/:bookingId/${action}`,
      ...professionalManage,
      async (context) => {
        const values = await parseJsonBody(
          bookingScheduleBodySchema,
          context.req.raw,
        );
        const selection = organisationSelection(context);
        const { client, service } = createService(
          context.get("environment").DATABASE_URL,
        );
        try {
          const data = await service.confirm({
            ...selection,
            bookingId: id(context.req.param("bookingId")),
            expectedLockVersion: values.lockVersion,
            membershipId: values.membershipId,
            startsAt: values.startsAt,
            reschedule: action === "reschedule",
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<BookingDetail>>({
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
    "/v1/professional/bookings/:bookingId/cancel",
    ...professionalManage,
    async (context) => {
      const values = await parseJsonBody(
        bookingCancelBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.cancelProfessional({
          ...selection,
          bookingId: id(context.req.param("bookingId")),
          expectedLockVersion: values.lockVersion,
          reason: values.reason,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<BookingDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  for (const action of ["complete", "no-show"] as const) {
    routes.post(
      `/v1/professional/bookings/:bookingId/${action}`,
      ...professionalManage,
      async (context) => {
        const values = await parseJsonBody(
          bookingActionBodySchema,
          context.req.raw,
        );
        const selection = organisationSelection(context);
        const { client, service } = createService(
          context.get("environment").DATABASE_URL,
        );
        try {
          const data = await service.terminalTransition({
            ...selection,
            bookingId: id(context.req.param("bookingId")),
            expectedLockVersion: values.lockVersion,
            action: action === "complete" ? "COMPLETED" : "NO_SHOW",
            note: values.note,
            correlationId: context.get("requestId"),
          });
          return context.json<ApiSuccessBody<BookingDetail>>({
            data,
            requestId: context.get("requestId"),
          });
        } finally {
          await client.close();
        }
      },
    );
  }

  routes.get(
    "/v1/professional/calendar",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const query = parseQuery(calendarQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listCalendar({
          organisationId: selection.organisationId,
          ...query,
        });
        return context.json<ApiSuccessBody<CalendarEntry[]>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get(
    "/v1/professional/availability",
    ...professionalRead,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listAvailability(selection.organisationId);
        return context.json<ApiSuccessBody<AvailabilityConfiguration>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.put(
    "/v1/professional/availability",
    ...professionalManage,
    async (context) => {
      const values = await parseJsonBody(
        replaceAvailabilityBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.replaceAvailability({
          ...selection,
          ...values,
        });
        return context.json<ApiSuccessBody<AvailabilityConfiguration>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/professional/availability/blocks",
    ...professionalManage,
    async (context) => {
      const values = await parseJsonBody(
        createAvailabilityBlockBodySchema,
        context.req.raw,
      );
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.createAvailabilityBlock({
          ...selection,
          ...values,
        });
        return context.json<ApiSuccessBody<AvailabilityConfiguration>>(
          { data, requestId: context.get("requestId") },
          201,
        );
      } finally {
        await client.close();
      }
    },
  );

  routes.delete(
    "/v1/professional/availability/blocks/:blockId",
    ...professionalManage,
    async (context) => {
      const selection = organisationSelection(context);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.deleteAvailabilityBlock(
          selection.organisationId,
          id(context.req.param("blockId")),
        );
        return context.json<ApiSuccessBody<AvailabilityConfiguration>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.use("/v1/client/bookings", requireSessionMiddleware);
  routes.use("/v1/client/bookings/*", requireSessionMiddleware);
  routes.use("/v1/client/services/*", requireSessionMiddleware);

  routes.get(
    "/v1/client/services/:professionalSlug/:serviceSlug/booking-slots",
    async (context) => {
      const query = parseQuery(slotQuerySchema, context.req.url);
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.listDirectServiceSlots({
          authUserId: authUserId(context),
          professionalSlug: context.req.param("professionalSlug"),
          serviceSlug: context.req.param("serviceSlug"),
          ...query,
        });
        return context.json<ApiSuccessBody<BookingSlot[]>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.get("/v1/client/bookings", async (context) => {
    const query = parseQuery(bookingListQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listClient({
        authUserId: authUserId(context),
        ...query,
      });
      return context.json<ApiSuccessBody<PageResult<BookingSummary>>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/client/bookings", async (context) => {
    const values = await parseJsonBody(
      clientCreateBookingBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.createClient({
        authUserId: authUserId(context),
        values,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<BookingDetail>>(
        { data, requestId: context.get("requestId") },
        201,
      );
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/bookings/:bookingId", async (context) => {
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.getClient(
        authUserId(context),
        id(context.req.param("bookingId")),
      );
      return context.json<ApiSuccessBody<BookingDetail>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/client/bookings/:bookingId/slots", async (context) => {
    const query = parseQuery(slotQuerySchema, context.req.url);
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.listSlotsForClient({
        authUserId: authUserId(context),
        bookingId: id(context.req.param("bookingId")),
        ...query,
      });
      return context.json<ApiSuccessBody<BookingSlot[]>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post(
    "/v1/client/bookings/:bookingId/schedule-request",
    async (context) => {
      const values = await parseJsonBody(
        bookingScheduleBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.requestSchedule({
          authUserId: authUserId(context),
          bookingId: id(context.req.param("bookingId")),
          expectedLockVersion: values.lockVersion,
          membershipId: values.membershipId,
          startsAt: values.startsAt,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<BookingDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post(
    "/v1/client/bookings/:bookingId/reschedule-request",
    async (context) => {
      const values = await parseJsonBody(
        bookingRescheduleRequestBodySchema,
        context.req.raw,
      );
      const { client, service } = createService(
        context.get("environment").DATABASE_URL,
      );
      try {
        const data = await service.requestReschedule({
          authUserId: authUserId(context),
          bookingId: id(context.req.param("bookingId")),
          expectedLockVersion: values.lockVersion,
          membershipId: values.membershipId,
          startsAt: values.startsAt,
          reason: values.reason,
          correlationId: context.get("requestId"),
        });
        return context.json<ApiSuccessBody<BookingDetail>>({
          data,
          requestId: context.get("requestId"),
        });
      } finally {
        await client.close();
      }
    },
  );

  routes.post("/v1/client/bookings/:bookingId/cancel", async (context) => {
    const values = await parseJsonBody(
      bookingCancelBodySchema,
      context.req.raw,
    );
    const { client, service } = createService(
      context.get("environment").DATABASE_URL,
    );
    try {
      const data = await service.cancelClient({
        authUserId: authUserId(context),
        bookingId: id(context.req.param("bookingId")),
        expectedLockVersion: values.lockVersion,
        reason: values.reason,
        correlationId: context.get("requestId"),
      });
      return context.json<ApiSuccessBody<BookingDetail>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  return routes;
}
