import { z } from "zod";

export const createMarketplaceCategoryBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const marketplaceCategoryStatusBodySchema = z.object({
  action: z.enum(["activate", "deactivate"]),
  reason: z.string().trim().min(5).max(500),
});

export const marketplaceListingsQuerySchema = z.object({
  status: z.enum(["all", "visible", "hidden"]).default("all"),
  q: z.string().trim().min(2).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(10).default(10),
});

export const listingModerationBodySchema = z.object({
  action: z.enum(["hide", "restore"]),
  reason: z.string().trim().min(5).max(500),
});
