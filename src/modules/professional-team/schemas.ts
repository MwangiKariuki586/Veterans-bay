import { z } from "zod";

import { paginationQuerySchema } from "../../platform/http/pagination";
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

export const teamMemberListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.enum(teamRoleKeys).optional(),
  status: z.enum(["active", "deactivated"]).optional(),
  availability: z.enum(["available", "on_job", "unavailable"]).optional(),
  sort: z
    .enum(["name_asc", "name_desc", "joined_desc", "joined_asc", "updated_desc", "updated_asc"])
    .default("name_asc"),
});

export const teamInvitationListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["pending", "expired", "accepted", "revoked"]).optional(),
  sort: z
    .enum(["created_desc", "created_asc", "expires_desc", "expires_asc"])
    .default("expires_asc"),
});
