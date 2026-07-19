import { z } from "zod";

export const readinessQuerySchema = z
  .object({
    format: z.literal("summary").optional(),
  })
  .strict();

export const systemProbeBodySchema = z
  .object({
    value: z.string().trim().min(1).max(100),
  })
  .strict();
