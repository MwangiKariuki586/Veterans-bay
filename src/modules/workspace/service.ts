import { AppError } from "../../platform/errors/app-error";
import type { AccountProfileRecord, IdentityStore } from "../identity/repository";
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

    const organisationWorkspaces: WorkspaceSummary[] = [];

    for (const membership of memberships) {
      if (
        membership.organisationStatus === "suspended" ||
        membership.organisationStatus === "deactivated"
      ) {
        continue;
      }

      organisationWorkspaces.push({
        id: buildOrganisationWorkspaceId(membership.organisationId),
        kind: "organisation",
        label: membership.organisationName,
        href:
          membership.organisationStatus === "active"
            ? "/professional"
            : membership.organisationStatus === "pending_review"
              ? "/professional/onboarding/review"
              : "/professional/onboarding",
        organisationId: membership.organisationId,
        membershipId: membership.membershipId,
        roleKey: membership.roleKey,
        organisationStatus: membership.organisationStatus as
          | "draft"
          | "pending_review"
          | "active"
          | "requires_changes",
        permissions: (permissionsByRole.get(membership.roleId) ?? []).filter(
          (permission) =>
            membership.financialDataAccess ||
            (permission !== "payments.view" &&
              permission !== "payments.manage" &&
              permission !== "reports.financial.view"),
        ),
        assignedJobsOnly: membership.assignedJobsOnly,
        financialDataAccess: membership.financialDataAccess,
      });
    }

    const adminAssignment = platformAssignments.find(
      (item) => item.roleKey === "platform_admin",
    );
    const platformWorkspace: WorkspaceSummary | null = adminAssignment
      ? {
          id: buildPlatformWorkspaceId(),
          kind: "platform",
          label: "Platform administration",
          href: "/admin",
          organisationId: null,
          membershipId: null,
          roleKey: "platform_admin",
          organisationStatus: null,
          permissions: permissionsByRole.get(adminAssignment.roleId) ?? [],
          assignedJobsOnly: false,
          financialDataAccess: true,
        }
      : null;

    // Single-role accounts: organisation members are professionals, not clients.
    // Platform admins without an organisation also keep the client shell so an
    // ops account used for marketplace verification can open /client directly.
    const clientWorkspace: WorkspaceSummary = {
      id: buildClientWorkspaceId(profile.id),
      kind: "client",
      label: "Client workspace",
      href: "/client",
      organisationId: null,
      membershipId: null,
      roleKey: null,
      organisationStatus: null,
      permissions: [],
      assignedJobsOnly: false,
      financialDataAccess: false,
    };

    const workspaces: WorkspaceSummary[] =
      organisationWorkspaces.length > 0
        ? organisationWorkspaces
        : platformWorkspace
          ? [platformWorkspace, clientWorkspace]
          : [clientWorkspace];

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

  async resolveWorkspaceForActiveProfile(
    profile: AccountProfileRecord,
    authUserId: string,
    workspaceId: string,
  ): Promise<WorkspaceSelection> {
    const parsed = parseWorkspaceId(workspaceId);
    if (!parsed) throw unavailable();

    if (parsed.kind === "client") {
      if (parsed.referenceId !== profile.id) throw unavailable();
      return { accountProfileId: profile.id, authUserId, workspace: { id: workspaceId, kind: "client", label: "Client workspace", href: "/client", organisationId: null, membershipId: null, roleKey: null, organisationStatus: null, permissions: [], assignedJobsOnly: false, financialDataAccess: false } };
    }

    if (parsed.kind === "organisation") {
      const membership = await this.workspaceRepository.findActiveMembership(profile.id, parsed.referenceId);
      if (!membership || membership.organisationStatus === "suspended" || membership.organisationStatus === "deactivated") throw unavailable();
      const permissions = (await this.workspaceRepository.listPermissionKeysForRoleIds([membership.roleId])).get(membership.roleId) ?? [];
      return { accountProfileId: profile.id, authUserId, workspace: {
        id: workspaceId, kind: "organisation", label: membership.organisationName,
        href: membership.organisationStatus === "active" ? "/professional" : membership.organisationStatus === "pending_review" ? "/professional/onboarding/review" : "/professional/onboarding",
        organisationId: membership.organisationId, membershipId: membership.membershipId, roleKey: membership.roleKey,
        organisationStatus: membership.organisationStatus as "draft" | "pending_review" | "active" | "requires_changes",
        permissions: permissions.filter((permission) => membership.financialDataAccess || !["payments.view", "payments.manage", "reports.financial.view"].includes(permission)),
        assignedJobsOnly: membership.assignedJobsOnly, financialDataAccess: membership.financialDataAccess,
      } };
    }

    const assignments = await this.workspaceRepository.listActivePlatformAssignments(profile.id);
    const admin = assignments.find((item) => item.roleKey === "platform_admin");
    if (!admin) throw unavailable();
    const permissions = (await this.workspaceRepository.listPermissionKeysForRoleIds([admin.roleId])).get(admin.roleId) ?? [];
    return { accountProfileId: profile.id, authUserId, workspace: { id: workspaceId, kind: "platform", label: "Platform administration", href: "/admin", organisationId: null, membershipId: null, roleKey: "platform_admin", organisationStatus: null, permissions, assignedJobsOnly: false, financialDataAccess: true } };
  }

}

function unavailable() {
  return new AppError({ code: "WORKSPACE_UNAVAILABLE", message: "The requested workspace is not available.", status: 403 });
}

export function primaryWorkspace(
  workspaces: WorkspaceSummary[],
): WorkspaceSummary | null {
  const platform = workspaces.find((item) => item.kind === "platform");
  if (platform) return platform;

  const organisation = workspaces.find((item) => item.kind === "organisation");
  if (organisation) return organisation;

  return workspaces.find((item) => item.kind === "client") ?? workspaces[0] ?? null;
}

export function defaultWorkspaceId(workspaces: WorkspaceSummary[]): string | null {
  return primaryWorkspace(workspaces)?.id ?? null;
}

export function isValidWorkspaceIdFormat(workspaceId: string): boolean {
  return parseWorkspaceId(workspaceId) !== null;
}
