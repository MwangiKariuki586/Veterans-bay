import { z } from "zod";

import {
  quotationLineItemCategories,
  quotationStatuses,
} from "./types";

const minorAmountSchema = z.number().int().min(0).max(10_000_000_000);

const lineItemSchema = z.object({
  category: z.enum(quotationLineItemCategories),
  description: z.string().trim().min(2).max(500),
  quantity: z.number().int().min(1).max(10_000),
  unitPriceMinor: minorAmountSchema,
});

export const quotationDraftValuesSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z]{3}$/.test(value), "Use an ISO currency code."),
    lineItems: z.array(lineItemSchema).min(1).max(50),
    discountMinor: minorAmountSchema.default(0),
    taxMinor: minorAmountSchema.default(0),
    depositMinor: minorAmountSchema.default(0),
    expectedDurationMinutes: z.number().int().min(15).max(525_600),
    proposedStartAt: z.iso.datetime({ offset: true }).nullable().default(null),
    validUntil: z.iso.datetime({ offset: true }),
    scope: z.string().trim().min(10).max(10_000),
    exclusions: z.string().trim().min(2).max(5_000),
    warrantyTerms: z.string().trim().min(2).max(5_000),
    paymentTerms: z.string().trim().min(2).max(5_000),
  })
  .superRefine((value, context) => {
    const subtotal = value.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceMinor,
      0,
    );
    const total = subtotal - value.discountMinor + value.taxMinor;
    if (value.discountMinor > subtotal) {
      context.addIssue({
        code: "custom",
        path: ["discountMinor"],
        message: "Discount cannot exceed the subtotal.",
      });
    }
    if (value.depositMinor > total) {
      context.addIssue({
        code: "custom",
        path: ["depositMinor"],
        message: "Deposit cannot exceed the quotation total.",
      });
    }
  });

export const createQuotationBodySchema = quotationDraftValuesSchema.extend({
  requestId: z.uuid(),
});

export const updateQuotationBodySchema = quotationDraftValuesSchema.extend({
  lockVersion: z.number().int().positive(),
});

export const quotationActionBodySchema = z.object({
  lockVersion: z.number().int().positive(),
});

export const quotationResponseBodySchema = quotationActionBodySchema.extend({
  note: z.string().trim().min(3).max(2_000).optional(),
});

export const quotationIdSchema = z.uuid();

export const quotationListQuerySchema = z.object({
  status: z.enum(quotationStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const quotationComparisonQuerySchema = z.object({
  fromVersion: z.coerce.number().int().positive(),
  toVersion: z.coerce.number().int().positive(),
});
