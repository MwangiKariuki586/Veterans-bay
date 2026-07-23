import { z } from "zod";

const serviceFieldsSchema = z.object({
    name: z.string().trim().min(2).max(120),
    category: z.string().trim().min(2).max(120).nullable().optional(),
    description: z.string().trim().min(20).max(2_000).nullable().optional(),
    fulfilmentModel: z.enum(["on_site", "remote", "hybrid"]).nullable().optional(),
    pricingModel: z
      .enum(["fixed", "starting_from", "custom_quote"])
      .nullable()
      .optional(),
    priceMinor: z.number().int().nonnegative().nullable().optional(),
    estimatedDurationMinutes: z.number().int().positive().max(43_200).nullable().optional(),
    serviceAreas: z.array(z.string().trim().min(2).max(120)).max(30).optional(),
    requirements: z.array(z.string().trim().min(2).max(300)).max(30).optional(),
    warrantyDurationDays: z.number().int().nonnegative().max(3_650).nullable().optional(),
    warrantyTerms: z.string().trim().min(5).max(1_000).nullable().optional(),
    directBookingEnabled: z.boolean().optional(),
  });

function validatePricing(
  input: { pricingModel?: string | null; priceMinor?: number | null },
  context: z.RefinementCtx,
) {
    if (input.pricingModel === "custom_quote" && input.priceMinor != null) {
      context.addIssue({
        code: "custom",
        path: ["priceMinor"],
        message: "Custom-quotation services cannot define a displayed price.",
      });
    }
    if (input.priceMinor != null && !input.pricingModel) {
      context.addIssue({
        code: "custom",
        path: ["pricingModel"],
        message: "Choose a pricing model before entering a price.",
      });
    }
}

export const createProfessionalServiceBodySchema = serviceFieldsSchema.superRefine(
  validatePricing,
);

export const updateProfessionalServiceBodySchema = serviceFieldsSchema
  .partial()
  .extend({ version: z.number().int().positive() })
  .superRefine((input, context) => {
    validatePricing(input, context);
    if (Object.keys(input).every((key) => key === "version")) {
      context.addIssue({
        code: "custom",
        path: ["request"],
        message: "Provide at least one service field to update.",
      });
    }
  });

export const transitionProfessionalServiceBodySchema = z.object({
  version: z.number().int().positive(),
});

export const updateProfessionalProfileBodySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(40).max(2_000),
  primaryCategory: z.string().trim().min(2).max(100),
  operatingLocation: z.string().trim().min(2).max(160),
  serviceAreas: z.array(z.string().trim().min(1).max(120)).max(30),
});

export const attachProfessionalLogoBodySchema = z.object({
  assetId: z.uuid(),
});

export const createPortfolioItemBodySchema = z.object({
  assetId: z.uuid(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

export const attachServiceImageBodySchema = z.object({
  assetId: z.uuid(),
});
