import { z } from "zod";

export const notificationIdSchema = z.string().uuid();

export const notificationListQuerySchema = z.object({
  filter: z.enum(["all", "unread"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
