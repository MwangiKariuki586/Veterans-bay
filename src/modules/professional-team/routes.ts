import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import { permissionKeys } from "../../platform/permissions/keys";
import {
  requirePermissionMiddleware,
  requireSessionMiddleware,
  requireWorkspaceMiddleware,
} from "../../workers/api/middleware/authorization";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { IdentityRepository } from "../identity/repository";
import { ProfessionalTeamRepository } from "./repository";
import {
  acceptTeamInvitationBodySchema,
  inviteTeamMemberBodySchema,
  transferOwnershipBodySchema,
  updateTeamMemberBodySchema,
} from "./schemas";
import { ProfessionalTeamService } from "./service";
import type { TeamInvitationSummary, TeamMemberDetail, TeamOverview } from "./types";

function createService(databaseUrl: string) {
  const client = createDatabaseClient(databaseUrl);
  return { client, service: new ProfessionalTeamService(new ProfessionalTeamRepository(client.db), new IdentityRepository(client.db)) };
}

export function createProfessionalTeamRoutes() {
  const routes = new Hono<ApiAppEnvironment>();
  const workspaceRead = [requireSessionMiddleware, requireWorkspaceMiddleware, requirePermissionMiddleware(permissionKeys.organisationView)] as const;
  const workspaceManage = [requireSessionMiddleware, requireWorkspaceMiddleware, requirePermissionMiddleware(permissionKeys.organisationMembersManage)] as const;

  routes.post("/v1/professional/team/invitations/accept", requireSessionMiddleware, async (context) => {
    const account = context.get("account");
    if (!account) throw new Error("Authenticated account is required.");
    const input = await parseJsonBody(acceptTeamInvitationBodySchema, context.req.raw);
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      const membershipId = await service.accept({ authUserId: account.authUserId, token: input.token, correlationId: context.get("requestId") });
      return context.json<ApiSuccessBody<{ membershipId: string }>>({ data: { membershipId }, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  routes.get("/v1/professional/team", ...workspaceRead, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection || selection.workspace.kind !== "organisation" || !selection.workspace.organisationId) throw new Error("Organisation workspace is required.");
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      const data = await service.overview(
        selection.workspace.organisationId,
        selection.workspace.permissions.includes(permissionKeys.organisationMembersManage),
      );
      return context.json<ApiSuccessBody<TeamOverview>>({ data, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  routes.get("/v1/professional/team/members/:membershipId", ...workspaceRead, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection || !selection.workspace.organisationId) throw new Error("Organisation workspace is required.");
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      const data = await service.member(selection.workspace.organisationId, context.req.param("membershipId"));
      return context.json<ApiSuccessBody<TeamMemberDetail>>({ data, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  routes.post("/v1/professional/team/invitations", ...workspaceManage, async (context) => {
    const selection = context.get("workspaceSelection");
    const account = context.get("account");
    if (!selection || !selection.workspace.organisationId || !account) throw new Error("Organisation workspace is required.");
    const input = await parseJsonBody(inviteTeamMemberBodySchema, context.req.raw);
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      const data = await service.invite({ organisationId: selection.workspace.organisationId, actorAccountId: selection.accountProfileId, actorName: account.name, ...input, correlationId: context.get("requestId") });
      return context.json<ApiSuccessBody<TeamInvitationSummary>>({ data, requestId: context.get("requestId") }, 201);
    } finally { await client.close(); }
  });

  routes.delete("/v1/professional/team/invitations/:invitationId", ...workspaceManage, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection || !selection.workspace.organisationId) throw new Error("Organisation workspace is required.");
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      await service.revokeInvitation(selection.workspace.organisationId, context.req.param("invitationId"));
      return context.json<ApiSuccessBody<{ revoked: true }>>({ data: { revoked: true }, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  routes.patch("/v1/professional/team/members/:membershipId", ...workspaceManage, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection || !selection.workspace.organisationId || !selection.workspace.membershipId) throw new Error("Organisation workspace is required.");
    const input = await parseJsonBody(updateTeamMemberBodySchema, context.req.raw);
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      await service.update({ organisationId: selection.workspace.organisationId, actorMembershipId: selection.workspace.membershipId, actorAccountId: selection.accountProfileId, membershipId: context.req.param("membershipId"), ...input, correlationId: context.get("requestId") });
      return context.json<ApiSuccessBody<{ updated: true }>>({ data: { updated: true }, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  routes.post("/v1/professional/team/ownership-transfer", ...workspaceManage, async (context) => {
    const selection = context.get("workspaceSelection");
    if (!selection || !selection.workspace.organisationId || !selection.workspace.membershipId) throw new Error("Organisation workspace is required.");
    const input = await parseJsonBody(transferOwnershipBodySchema, context.req.raw);
    const { client, service } = createService(context.get("environment").DATABASE_URL);
    try {
      await service.transferOwnership({ organisationId: selection.workspace.organisationId, actorMembershipId: selection.workspace.membershipId, actorAccountId: selection.accountProfileId, targetMembershipId: input.targetMembershipId, correlationId: context.get("requestId") });
      return context.json<ApiSuccessBody<{ transferred: true }>>({ data: { transferred: true }, requestId: context.get("requestId") });
    } finally { await client.close(); }
  });

  return routes;
}
