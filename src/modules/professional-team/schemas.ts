import { z } from "zod";

import { teamRoleKeys } from "./types";

export const inviteTeamMemberBodySchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(teamRoleKeys).exclude(["owner"]),
  assignedJobsOnly: z.boolean().optional(),
  financialDataAccess: z.boolean().optional(),
});

export const acceptTeamInvitationBodySchema = z.object({
  token: z.string().min(32).max(512),
});

export const updateTeamMemberBodySchema = z
  .object({
    role: z.enum(teamRoleKeys).exclude(["owner"]).optional(),
    status: z.enum(["active", "deactivated"]).optional(),
    assignedJobsOnly: z.boolean().optional(),
    financialDataAccess: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one team member change is required.",
  });

export const transferOwnershipBodySchema = z.object({
  targetMembershipId: z.uuid(),
});
