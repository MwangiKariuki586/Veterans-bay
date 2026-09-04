import { z } from "zod";

export const updateProfileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(5).max(40).nullable().optional(),
  location: z.string().trim().min(2).max(120).nullable().optional(),
  bio: z.string().trim().min(3).max(2000).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const attachAvatarBodySchema = z.object({
  assetId: z.string().uuid(),
});

export const deactivateAccountBodySchema = z.object({
  confirmation: z.literal("DEACTIVATE"),
});
