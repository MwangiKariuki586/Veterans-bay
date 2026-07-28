import { z } from "zod";

import { paginationQuerySchema } from "../../platform/http/pagination";
import { jobStatuses } from "./types";

export const jobIdSchema = z.uuid();

export const jobListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(jobStatuses).optional(),
});

export const jobActionBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const jobAssignmentBodySchema = z.object({
  membershipId: z.uuid(),
  lockVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const jobChecklistBodySchema = z.object({
  completed: z.boolean(),
  resultNote: z.string().trim().max(1000).optional(),
});

export const jobUpdateBodySchema = z.object({
  updateType: z.enum([
    "PROGRESS",
    "NOTE",
    "MATERIAL",
    "EXPENSE",
    "CLARIFICATION",
  ]),
  visibility: z.enum(["CLIENT", "PROFESSIONAL"]).default("CLIENT"),
  content: z.string().trim().min(1).max(4000),
  quantity: z.number().int().positive().optional(),
  amountMinor: z.number().int().nonnegative().optional(),
});

export const jobEvidenceBodySchema = z.object({
  assetId: z.uuid(),
  evidenceType: z.enum([
    "BEFORE",
    "PROGRESS",
    "AFTER",
    "VARIATION",
    "COMPLETION",
  ]),
  visibility: z.enum(["CLIENT", "PROFESSIONAL"]).default("CLIENT"),
  caption: z.string().trim().max(1000).optional(),
});

export const jobVariationBodySchema = z.object({
  description: z.string().trim().min(3).max(4000),
  reason: z.string().trim().min(3).max(2000),
  additionalAmountMinor: z.number().int().nonnegative(),
  scheduleImpactMinutes: z.number().int().min(0).max(525_600).default(0),
  expiresAt: z.string().datetime().optional(),
});

export const jobVariationSubmitBodySchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const jobVariationResponseBodySchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
  comment: z.string().trim().max(2000).optional(),
});

export const jobCompletionBodySchema = z.object({
  response: z.enum([
    "CONFIRM",
    "CONFIRM_WITH_COMMENTS",
    "UNRESOLVED",
    "CLARIFICATION",
  ]),
  comments: z.string().trim().max(4000).optional(),
});

export const jobMessageBodySchema = z.object({
  idempotencyKey: z.uuid(),
  body: z.string().trim().min(1).max(4000),
});
