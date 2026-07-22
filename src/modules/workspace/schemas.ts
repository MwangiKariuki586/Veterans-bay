import { z } from "zod";

export const selectWorkspaceBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
});
