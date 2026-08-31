import { z } from "zod";

import { paginationQuerySchema } from "../../platform/http/pagination";
import { serviceRequestSources } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

const requestValuesSchema = z.object({
  source: z.enum(serviceRequestSources).default("MARKETPLACE_DISCOVERY"),
  category: optionalText(120),
  preferredProfessionalSlug: optionalText(160),
  preferredServiceSlug: optionalText(160),
  description: optionalText(5_000),
  location: optionalText(300),
  preferredTime: optionalText(300),
  budgetMinMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  budgetMaxMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  urgency: z.enum(["FLEXIBLE", "SOON", "URGENT"]).nullable().optional(),
  contactPreference: z.enum(["IN_APP", "PHONE", "EMAIL"]).nullable().optional(),
});

export const createServiceRequestBodySchema = requestValuesSchema.extend({
  idempotencyKey: z.uuid(),
});

export const updateServiceRequestBodySchema = requestValuesSchema
  .partial()
  .extend({ version: z.number().int().positive() });

export const submitServiceRequestBodySchema = z.object({
  version: z.number().int().positive(),
});

export const transitionServiceRequestBodySchema = z.object({
  version: z.number().int().positive(),
  note: z.string().trim().min(5).max(2_000).optional(),
});

export const addRequestInformationBodySchema = z.object({
  version: z.number().int().positive(),
  note: z.string().trim().min(5).max(2_000),
});

export const privateRequestNoteBodySchema = z.object({
  note: z.string().trim().min(1).max(4_000),
});

export const attachServiceRequestAssetBodySchema = z.object({
  assetId: z.uuid(),
});

export const serviceRequestIdSchema = z.uuid();

export const clientServiceRequestListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "MORE_INFORMATION_REQUIRED",
      "ASSESSMENT_REQUIRED",
      "QUOTED",
      "CONVERTED",
      "DECLINED",
      "CANCELLED",
      "EXPIRED",
    ])
    .optional(),
  bucket: z.enum(["draft", "active", "needs-action", "closed"]).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  preferredTime: z.string().trim().min(1).max(60).optional(),
  urgency: z.enum(["FLEXIBLE", "SOON", "URGENT"]).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z
    .enum([
      "updated_desc",
      "updated_asc",
      "category_asc",
      "category_desc",
      "status_asc",
      "status_desc",
    ])
    .default("updated_desc"),
});
