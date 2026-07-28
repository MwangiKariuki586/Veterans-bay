import { z } from "zod";
export const reminderIdSchema = z.string().uuid();
export const scheduleReminderBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  dueAt: z.string().datetime({ offset: true }),
});
