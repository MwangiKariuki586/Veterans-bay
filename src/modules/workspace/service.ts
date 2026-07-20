import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "./repository";
import {
  buildClientWorkspaceId,
  buildOrganisationWorkspaceId,
  buildPlatformWorkspaceId,
  parseWorkspaceId,
  type WorkspaceSelection,
  type WorkspaceSummary,
} from "./types";

export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly identityStore: IdentityStore,
  ) {}

  async listWorkspaces(authUserId: string): Promise<{
    accountProfileId: string;
    workspaces: WorkspaceSummary[];
  }> {
    const profile = await this.identityStore.findProfileByAuthUserId(authUserId);

    if (!profile) {
      throw new AppError({
        code: "ACCOUNT_PROFILE_MISSING",
        message: "Account profile was not found.",
        status: 404,
      });
    }

    if (profile.status === "deactivated") {
      throw new AppError({
        code: "ACCOUNT_DEACTIVATED",
        message: "This account has been deactivated.",
        status: 403,
      });
    }

    const restrictions = await this.identityStore.findActiveRestrictions(
      profile.id,
    );
    if (restrictions.length > 0) {
      throw new AppError({
        code: "ACCOUNT_RESTRICTED",
        message: "This account cannot perform protected actions.",
        status: 403,
      });
    }

    const [memberships, platformAssignments] = await Promise.all([
      this.workspaceRepository.listActiveOrganisationMemberships(profile.id),
      this.workspaceRepository.listActivePlatformAssignments(profile.id),
    ]);

    const roleIds = [
      ...memberships.map((item) => item.roleId),
      ...platformAssignments.map((item) => item.roleId),
    ];
    const permissionsByRole =
      await this.workspaceRepository.listPermissionKeysForRoleIds(roleIds);

    const workspaces: WorkspaceSummary[] = [
      {
        id: buildClientWorkspaceId(profile.id),
        kind: "client",
        label: "Client workspace",
        href: "/client",
        organisationId: null,
        membershipId: null,
        roleKey: null,
        permissions: [],
      },
    ];

    for (const membership of memberships) {
      if (
        membership.organisationStatus === "suspended" ||
        membership.organisationStatus === "deactivated"
      ) {
        continue;
      }

      workspaces.push({
        id: buildOrganisationWorkspaceId(membership.organisationId),
        kind: "organisation",
        label: membership.organisationName,
        href: "/professional",
        organisationId: membership.organisationId,
        membershipId: membership.membershipId,
        roleKey: membership.roleKey,
        permissions: permissionsByRole.get(membership.roleId) ?? [],
      });
    }

    if (platformAssignments.some((item) => item.roleKey === "platform_admin")) {
      const adminAssignment = platformAssignments.find(
        (item) => item.roleKey === "platform_admin",
      );
      workspaces.push({
        id: buildPlatformWorkspaceId(),
        kind: "platform",
        label: "Platform administration",
        href: "/admin",
        organisationId: null,
        membershipId: null,
        roleKey: "platform_admin",
        permissions: adminAssignment
          ? (permissionsByRole.get(adminAssignment.roleId) ?? [])
          : [],
      });
    }

    return {
      accountProfileId: profile.id,
      workspaces,
    };
  }

  async resolveWorkspace(
    authUserId: string,
    workspaceId: string,
  ): Promise<WorkspaceSelection> {
    const { accountProfileId, workspaces } = await this.listWorkspaces(authUserId);
    const workspace = workspaces.find((item) => item.id === workspaceId);

    if (!workspace) {
      throw new AppError({
        code: "WORKSPACE_UNAVAILABLE",
        message: "The requested workspace is not available.",
        status: 403,
      });
    }

    // Re-validate organisation membership against live records for stale-session safety.
    if (workspace.kind === "organisation" && workspace.organisationId) {
      const membership = await this.workspaceRepository.findActiveMembership(
        accountProfileId,
        workspace.organisationId,
      );
      if (!membership) {
        throw new AppError({
          code: "WORKSPACE_UNAVAILABLE",
          message: "The requested workspace is not available.",
          status: 403,
        });
      }
    }

    return {
      workspace,
      accountProfileId,
      authUserId,
    };
  }

  async changeMemberRole(input: {
    actorAuthUserId: string;
    organisationId: string;
    membershipId: string;
    roleKey: string;
    correlationId?: string;
  }): Promise<void> {
    const selection = await this.resolveWorkspace(
      input.actorAuthUserId,
      buildOrganisationWorkspaceId(input.organisationId),
    );

    if (!selection.workspace.permissions.includes("organisation.members.manage")) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "You do not have permission to perform this action.",
        status: 403,
      });
    }

    const role = await this.workspaceRepository.findOrganisationRoleByKey(
      input.roleKey,
    );
    if (!role) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "The requested role is invalid.",
        status: 422,
      });
    }

    await this.workspaceRepository.updateMembershipRole(
      input.membershipId,
      role.id,
    );

    await this.identityStore.insertDomainEvent({
      eventType: "organization.member_role_changed",
      eventVersion: 1,
      aggregateType: "organisation_membership",
      aggregateId: input.membershipId,
      actorAccountId: selection.accountProfileId,
      correlationId: input.correlationId,
      payload: {
        organisationId: input.organisationId,
        roleKey: input.roleKey,
      },
    });
  }

  async removeMember(input: {
    actorAuthUserId: string;
    organisationId: string;
    membershipId: string;
    targetAccountProfileId: string;
    targetRoleKey: string;
    correlationId?: string;
  }): Promise<void> {
    const selection = await this.resolveWorkspace(
      input.actorAuthUserId,
      buildOrganisationWorkspaceId(input.organisationId),
    );

    if (!selection.workspace.permissions.includes("organisation.members.manage")) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "You do not have permission to perform this action.",
        status: 403,
      });
    }

    if (input.targetRoleKey === "owner") {
      const ownerCount = await this.workspaceRepository.countActiveOwners(
        input.organisationId,
      );
      if (ownerCount <= 1) {
        throw new AppError({
          code: "OWNER_TRANSFER_REQUIRED",
          message:
            "The final owner cannot lose ownership without an approved transfer.",
          status: 409,
        });
      }
    }

    await this.workspaceRepository.markMembershipRemoved(input.membershipId);

    await this.identityStore.insertDomainEvent({
      eventType: "organization.member_removed",
      eventVersion: 1,
      aggregateType: "organisation_membership",
      aggregateId: input.membershipId,
      actorAccountId: selection.accountProfileId,
      correlationId: input.correlationId,
      payload: {
        organisationId: input.organisationId,
        targetAccountProfileId: input.targetAccountProfileId,
      },
    });
  }
}

export function defaultWorkspaceId(workspaces: WorkspaceSummary[]): string | null {
  if (workspaces.length === 1) {
    return workspaces[0]?.id ?? null;
  }

  return null;
}

export function isValidWorkspaceIdFormat(workspaceId: string): boolean {
  return parseWorkspaceId(workspaceId) !== null;
}
