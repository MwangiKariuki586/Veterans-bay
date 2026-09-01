import { z } from "zod";

import {
  bookingOrigins,
  bookingStatuses,
  clientBookingStages,
} from "./types";

const uuidSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });
const timezoneSchema = z.string().trim().min(1).max(64);
const publicSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const bookingIdSchema = uuidSchema;

export const bookingListQuerySchema = z.object({
  status: z.enum(bookingStatuses).optional(),
  bucket: z
    .enum(["pending", "scheduled", "needs-action", "closed"])
    .optional(),
  stage: z.enum(clientBookingStages).optional(),
  origin: z.enum(bookingOrigins).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z
    .enum([
      "updated_desc",
      "updated_asc",
      "starts_desc",
      "starts_asc",
      "total_desc",
      "total_asc",
    ])
    .default("updated_desc"),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const calendarRangeSchema = z.object({
  from: dateTimeSchema,
  to: dateTimeSchema,
});

const validCalendarRange = <T extends { from: string; to: string }>(value: T) =>
  new Date(value.to) > new Date(value.from);

export const calendarQuerySchema = calendarRangeSchema
  .extend({
    membershipId: uuidSchema.optional(),
  })
  .refine((value) => new Date(value.to) > new Date(value.from), {
    message: "Calendar end must follow its start.",
    path: ["to"],
  });

export const slotQuerySchema = calendarRangeSchema.refine(validCalendarRange, {
  message: "Slot search end must follow its start.",
  path: ["to"],
});

export const clientCreateBookingBodySchema = z.discriminatedUnion("origin", [
  z.object({
    origin: z.literal(bookingOrigins[1]),
    professionalSlug: publicSlugSchema,
    serviceSlug: publicSlugSchema,
    membershipId: uuidSchema,
    requestedStartAt: dateTimeSchema,
    timezone: timezoneSchema,
    cancellationPolicyAcknowledged: z.literal(true),
  }),
  z.object({
    origin: z.literal(bookingOrigins[3]),
    sourceBookingId: uuidSchema,
    membershipId: uuidSchema,
    requestedStartAt: dateTimeSchema,
    timezone: timezoneSchema,
    cancellationPolicyAcknowledged: z.literal(true),
  }),
]);

export const professionalCreateBookingBodySchema = z.discriminatedUnion(
  "origin",
  [
    z.object({
      origin: z.literal(bookingOrigins[2]),
      requestId: uuidSchema,
      serviceId: uuidSchema,
      membershipId: uuidSchema,
      requestedStartAt: dateTimeSchema,
      timezone: timezoneSchema,
      cancellationPolicyAcknowledged: z.literal(true),
    }),
    z.object({
      origin: z.literal(bookingOrigins[4]),
      clientAccountId: uuidSchema,
      serviceId: uuidSchema,
      membershipId: uuidSchema,
      requestedStartAt: dateTimeSchema,
      timezone: timezoneSchema,
      cancellationPolicyAcknowledged: z.literal(true),
    }),
    z.object({
      origin: z.literal(bookingOrigins[3]),
      customerId: uuidSchema,
      sourceBookingId: uuidSchema,
      serviceId: uuidSchema,
      membershipId: uuidSchema,
      requestedStartAt: dateTimeSchema,
      timezone: timezoneSchema,
      cancellationPolicyAcknowledged: z.literal(true),
    }),
  ],
);

export const bookingScheduleBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  membershipId: uuidSchema,
  startsAt: dateTimeSchema,
  cancellationPolicyAcknowledged: z.literal(true),
});

export const bookingRescheduleRequestBodySchema =
  bookingScheduleBodySchema.extend({
    reason: z.string().trim().min(3).max(500),
  });

export const bookingActionBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  note: z.string().trim().min(3).max(500).optional(),
});

export const bookingCancelBodySchema = bookingActionBodySchema.extend({
  reason: z.string().trim().min(3).max(500),
  cancellationPolicyAcknowledged: z.literal(true),
});

export const availabilityRuleBodySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

export const replaceAvailabilityBodySchema = z.object({
  membershipId: uuidSchema,
  timezone: timezoneSchema,
  rules: z
    .array(availabilityRuleBodySchema)
    .max(21)
    .refine(
      (rules) => rules.every((rule) => rule.endMinute > rule.startMinute),
      "Availability end must follow its start.",
    ),
});

export const createAvailabilityBlockBodySchema = z
  .object({
    membershipId: uuidSchema,
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    reason: z.string().trim().min(3).max(240),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "Unavailable end must follow its start.",
    path: ["endsAt"],
  });
