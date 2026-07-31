import { z } from "zod";

export const deadLetterResolutionBodySchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});
