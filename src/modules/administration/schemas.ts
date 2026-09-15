import { z } from "zod";

export const reportCategories = [
  "MISLEADING_LISTING",
  "ABUSIVE_COMMUNICATION",
  "FRAUD_CONCERN",
  "POOR_SERVICE_CONDUCT",
  "PAYMENT_DISAGREEMENT",
  "REVIEW_MANIPULATION",
  "OFF_PLATFORM_PAYMENT_REQUEST",
  "IDENTITY_CONCERN",
] as const;

export const submitReportBodySchema = z.object({
  category: z.enum(reportCategories),
  subjectType: z
    .enum(["ACCOUNT", "LISTING", "MESSAGE", "REVIEW", "JOB", "PAYMENT", "WARRANTY_CLAIM"]),
  subjectId: z.string().trim().min(1).max(120),
  organisationId: z.uuid().nullable().optional(),
  summary: z.string().trim().min(3).max(200),
  details: z.string().trim().min(10).max(4000),
});

export const adminQueueQuerySchema = z.object({
  status: z
    .enum(["all", "OPEN", "IN_REVIEW", "INVESTIGATING", "AWAITING_DECISION", "RESOLVED", "DISMISSED"])
    .default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const openCaseBodySchema = z.object({
  subjectAccountId: z.uuid().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  reason: z.string().trim().min(10).max(2000),
});

export const transitionCaseBodySchema = z.object({
  action: z.enum([
    "START_INVESTIGATION",
    "AWAIT_DECISION",
    "RESOLVE_NO_ACTION",
    "DISMISS",
    "HIDE_REVIEW",
    "SUSPEND_ACCOUNT",
    "RESTORE_ACCOUNT",
  ]),
  reason: z.string().trim().min(10).max(2000),
  evidenceSummary: z.string().trim().min(10).max(4000).optional(),
});

export const resolveDisputeBodySchema = z.object({
  action: z.enum(["START_INVESTIGATION", "AWAIT_DECISION", "RESOLVE", "DISMISS"]),
  reason: z.string().trim().min(10).max(2000),
  evidenceSummary: z.string().trim().min(10).max(4000).optional(),
});

export const openDisputeBodySchema = z.object({
  jobId: z.uuid(),
  reason: z.string().trim().min(10).max(2000),
});

export const warrantyAdminDecisionBodySchema = z.object({
  action: z.enum(["RESOLVE", "REJECT"]),
  reason: z.string().trim().min(10).max(2000),
  evidenceSummary: z.string().trim().min(10).max(4000),
});

export const upsertPlatformRuleBodySchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1000),
  value: z.record(z.string(), z.unknown()),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().min(10).max(2000),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
