import { z } from "zod";

export const updateProfileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(5).max(40).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const deactivateAccountBodySchema = z.object({
  confirmation: z.literal("DEACTIVATE"),
});
