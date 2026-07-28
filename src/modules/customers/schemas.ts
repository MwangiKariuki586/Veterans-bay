import { z } from "zod";
import { paginationQuerySchema } from "../../platform/http/pagination";

export const customerIdSchema = z.string().uuid();
export const customerListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum([
      "IMPORTED",
      "INVITATION_PENDING",
      "REGISTERED",
      "DUPLICATE_CANDIDATE",
      "ARCHIVED",
    ])
    .optional(),
});
export const createCustomerBodySchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    acquisitionSource: z.enum([
      "PROFESSIONAL_INVITED",
      "PROFESSIONAL_IMPORTED",
      "CLIENT_REFERRAL",
      "REPEAT_CLIENT",
    ]),
  })
  .refine((value) => value.email || value.phone, {
    message: "Email or phone is required.",
  });
export const customerNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export const customerTagBodySchema = z.object({
  name: z.string().trim().min(1).max(40),
});
