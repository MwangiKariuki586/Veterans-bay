import { z } from "zod";

export const clientContextParamsSchema = z.object({
  clientId: z.string().uuid(),
});

export const clientContextQuerySchema = z.object({
  contextId: z.string().uuid().optional(),
  contextType: z.enum(["job", "booking", "request", "customer"]).optional(),
});
