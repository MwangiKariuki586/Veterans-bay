import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const workingDaySchema = z.object({
  enabled: z.boolean(),
  opensAt: timeSchema,
  closesAt: timeSchema,
});

export const workingHoursSchema = z.record(
  z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  workingDaySchema,
);

export const createOnboardingBodySchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const updateOnboardingBodySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    businessType: z.enum(["independent", "business"]).nullable().optional(),
    primaryCategory: z.string().trim().min(2).max(120).nullable().optional(),
    description: z.string().trim().min(20).max(2_000).nullable().optional(),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(40)
      .regex(/^\+?[0-9][0-9\s().-]{5,38}[0-9]$/)
      .nullable()
      .optional(),
    email: z.email().max(254).nullable().optional(),
    operatingLocation: z.string().trim().min(2).max(240).nullable().optional(),
    serviceAreas: z
      .array(z.string().trim().min(2).max(120))
      .max(30)
      .optional(),
    workingHours: workingHoursSchema.optional(),
    verificationType: z.string().trim().min(2).max(80).nullable().optional(),
    verificationReference: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .nullable()
      .optional(),
    termsAccepted: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be supplied.",
  });

export const attachOnboardingAssetBodySchema = z.object({
  assetId: z.uuid(),
  kind: z.enum(["logo", "verification_document"]),
  documentType: z.string().trim().min(2).max(80).optional(),
});

export const onboardingReviewDecisionBodySchema = z.object({
  decision: z.enum([
    "approve",
    "request_changes",
    "reject",
    "suspend",
    "restore",
  ]),
  reason: z.string().trim().min(5).max(500),
});

export const adminProfessionalReviewQuerySchema = z.object({
  status: z
    .enum([
      "pending_review",
      "requires_changes",
      "active",
      "suspended",
      "deactivated",
    ])
    .default("pending_review"),
  q: z.string().trim().min(2).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(10).default(10),
});
