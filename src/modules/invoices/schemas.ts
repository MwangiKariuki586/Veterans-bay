import { z } from "zod";

import { paginationQuerySchema } from "../../platform/http/pagination";
import { invoiceStatuses, paymentMethods } from "./types";

export const financialIdSchema = z.uuid();

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(invoiceStatuses).optional(),
  bucket: z.enum(["outstanding", "overdue", "settled", "drafts"]).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z
    .enum([
      "updated_desc",
      "updated_asc",
      "due_asc",
      "due_desc",
      "balance_desc",
      "balance_asc",
    ])
    .default("updated_desc"),
});

export const invoiceIssueBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  dueAt: z.string().datetime(),
});

export const invoiceCancelBodySchema = z.object({
  lockVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
});

export const paymentAllocationSchema = z.object({
  invoiceItemId: z.uuid(),
  amountMinor: z.number().int().positive(),
});

export const paymentRecordBodySchema = z.object({
  idempotencyKey: z.uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  method: z.enum(paymentMethods),
  transactionReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  evidenceAssetId: z.uuid().optional(),
  paidAt: z.string().datetime(),
  allocations: z.array(paymentAllocationSchema).min(1).max(100),
});

export const paymentAdjustmentBodySchema = z.object({
  idempotencyKey: z.uuid(),
  adjustmentType: z.enum(["REVERSAL", "REFUND"]),
  amountMinor: z.number().int().positive(),
  reason: z.string().trim().min(3).max(2000),
  transactionReference: z.string().trim().max(200).optional(),
  evidenceAssetId: z.uuid().optional(),
  recordedAt: z.string().datetime(),
});
