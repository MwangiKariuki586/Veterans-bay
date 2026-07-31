import { z } from "zod";

export const dashboardRangeQuerySchema = z
  .object({
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .transform((value) => {
    const to = value.to ? new Date(value.to) : new Date();
    const from = value.from
      ? new Date(value.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (from >= to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new Error("Dashboard ranges must be ordered and no longer than 366 days.");
    }
    return { from, to };
  });
