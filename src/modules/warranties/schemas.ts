import { z } from "zod";

import { paginationQuerySchema } from "../../platform/http/pagination";
import { warrantyClaimStatuses, warrantyStatuses } from "./types";

export const warrantyIdSchema = z.uuid();
export const warrantyListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(warrantyStatuses).optional(),
  bucket: z.enum(["all", "active", "expiring-soon", "expired", "voided"]).optional(),
  service: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["expiry_asc", "expiry_desc", "created_desc", "created_asc"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export const warrantyClaimListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(warrantyClaimStatuses).optional(),
});
export const warrantyClaimSubmitBodySchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  preferredResolution: z.string().trim().max(1000).optional(),
  evidenceAssetIds: z.array(z.uuid()).max(10).default([]),
});
export const warrantyClaimActionBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  action: z.enum(["START_REVIEW", "ACCEPT", "REJECT", "ESCALATE"]),
  reason: z.string().trim().max(2000).optional(),
});
export const warrantyEscalateBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(2000),
});
export const warrantyReturnVisitBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().max(1000).optional(),
});
export const warrantyResolveBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  resolutionNotes: z.string().trim().min(3).max(3000),
  evidenceAssetIds: z.array(z.uuid()).max(10).default([]),
});
export const warrantyClaimEvidenceBodySchema = z.object({
  assetId: z.uuid(),
  evidenceType: z.enum(["SUBMISSION", "REVIEW", "RESOLUTION"]),
  caption: z.string().trim().max(1000).optional(),
});
