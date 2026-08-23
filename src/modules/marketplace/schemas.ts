import { z } from "zod";

const optionalSearchValue = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional();

export const marketplaceSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100).optional(),
  category: optionalSearchValue,
  location: optionalSearchValue,
  fulfilmentModel: z.enum(["on_site", "remote", "hybrid"]).optional(),
  pricingModel: z.enum(["fixed", "starting_from", "custom_quote"]).optional(),
  availability: z.literal("today").optional(),
  verified: z.enum(["true", "false"]).optional(),
  topRated: z.literal("true").optional(),
  instantBooking: z.literal("true").optional(),
  sort: z.enum(["relevance", "newest"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(10).default(10),
});

const marketplaceSearchEventSchema = z.object({
  eventType: z.literal("marketplace.search_performed"),
  activeFilters: z
    .array(
      z.enum([
        "q",
        "category",
        "location",
        "fulfilmentModel",
        "pricingModel",
        "availability",
        "verified",
        "topRated",
        "instantBooking",
      ]),
    )
    .max(9),
  page: z.number().int().min(1).max(10_000),
  resultCount: z.number().int().min(0).max(1_000_000),
  sort: z.enum(["relevance", "newest"]),
});

const marketplaceViewEventSchema = z.object({
  eventType: z.enum(["professional.profile_viewed", "service.viewed"]),
  targetSlug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const marketplaceAnalyticsEventSchema = z.discriminatedUnion(
  "eventType",
  [
    marketplaceSearchEventSchema,
    z.object({
      eventType: z.literal("professional.profile_viewed"),
      targetSlug: marketplaceViewEventSchema.shape.targetSlug,
    }),
    z.object({
      eventType: z.literal("service.viewed"),
      targetSlug: marketplaceViewEventSchema.shape.targetSlug,
    }),
  ],
);
