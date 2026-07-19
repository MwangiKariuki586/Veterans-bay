import { z } from "zod";

export const selectWorkspaceBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
});

export const changeMemberRoleBodySchema = z.object({
  membershipId: z.uuid(),
  roleKey: z.enum(["owner", "admin", "member", "technician"]),
});

export const removeMemberBodySchema = z.object({
  membershipId: z.uuid(),
  targetAccountProfileId: z.uuid(),
  targetRoleKey: z.enum(["owner", "admin", "member", "technician"]),
});
