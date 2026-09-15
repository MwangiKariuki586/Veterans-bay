import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "./repository";
import { defaultWorkspaceId, WorkspaceService } from "./service";
import {
  buildClientWorkspaceId,
  buildOrganisationWorkspaceId,
  buildPlatformWorkspaceId,
} from "./types";

function profile() {
  return {
    id: "profile-1",
    authUserId: "user-1",
    displayName: "Alex",
    primaryEmail: "alex@example.com",
    phone: null,
    timezone: "UTC",
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("WorkspaceService", () => {
  it("lists organisation workspaces from live membership records", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };

    const workspaceRepository: WorkspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([
        {
          membershipId: "membership-1",
          organisationId: "org-1",
          organisationName: "Bay Repairs",
          organisationSlug: "bay-repairs",
          organisationStatus: "active",
          membershipStatus: "active",
          roleId: "role-owner",
          roleKey: "owner",
        },
      ]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([
        {
          assignmentId: "assignment-1",
          roleId: "role-platform",
          roleKey: "platform_admin",
          status: "active",
        },
      ]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(
        new Map([
          ["role-owner", ["organisation.view", "organisation.manage", "organisation.members.manage"]],
          ["role-platform", ["platform.admin"]],
        ]),
      ),
      countActiveOwners: vi.fn(),
      findActiveMembership: vi.fn(),
      markMembershipRemoved: vi.fn(),
      updateMembershipRole: vi.fn(),
      findOrganisationRoleByKey: vi.fn(),
    } as unknown as WorkspaceRepository;

    const service = new WorkspaceService(workspaceRepository, identityStore);
    const result = await service.listWorkspaces("user-1");

    expect(result.workspaces.map((item) => item.id)).toEqual([
      buildOrganisationWorkspaceId("org-1"),
    ]);
    expect(
      result.workspaces.find((item) => item.kind === "organisation"),
    ).toMatchObject({
      organisationStatus: "active",
      href: "/professional",
    });
  });

  it("does not expose a client workspace to organisation members", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityStore;
    const workspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([
        {
          membershipId: "membership-1",
          organisationId: "org-1",
          organisationName: "Bay Repairs",
          organisationSlug: "bay-repairs",
          organisationStatus: "active",
          membershipStatus: "active",
          roleId: "role-owner",
          roleKey: "owner",
          assignedJobsOnly: false,
          financialDataAccess: true,
        },
      ]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(new Map()),
    } as unknown as WorkspaceRepository;

    const result = await new WorkspaceService(
      workspaceRepository,
      identityStore,
    ).listWorkspaces("user-1");

    expect(result.workspaces.every((item) => item.kind !== "client")).toBe(true);
  });

  it("opens platform administration before the client shell for admins", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityStore;
    const workspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([
        {
          assignmentId: "assignment-1",
          roleId: "role-platform",
          roleKey: "platform_admin",
          status: "active",
        },
      ]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(
        new Map([["role-platform", ["platform.admin"]]]),
      ),
    } as unknown as WorkspaceRepository;

    const result = await new WorkspaceService(
      workspaceRepository,
      identityStore,
    ).listWorkspaces("user-1");

    expect(result.workspaces.map((item) => item.kind)).toEqual([
      "platform",
      "client",
    ]);
    expect(defaultWorkspaceId(result.workspaces)).toBe(buildPlatformWorkspaceId());
  });

  it("routes a pending professional to application status instead of the dashboard", async () => {
    const identityStore = {
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
    } as unknown as IdentityStore;
    const workspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([
        {
          membershipId: "membership-1",
          organisationId: "org-1",
          organisationName: "Bay Repairs",
          organisationSlug: "bay-repairs",
          organisationStatus: "pending_review",
          membershipStatus: "active",
          roleId: "role-owner",
          roleKey: "owner",
          assignedJobsOnly: false,
          financialDataAccess: true,
        },
      ]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(new Map()),
    } as unknown as WorkspaceRepository;

    const result = await new WorkspaceService(
      workspaceRepository,
      identityStore,
    ).listWorkspaces("user-1");

    expect(result.workspaces[0]).toMatchObject({
      organisationStatus: "pending_review",
      href: "/professional/onboarding/review",
    });
  });

  it("rejects cross-organisation and stale membership access", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };

    const workspaceRepository: WorkspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(new Map()),
      countActiveOwners: vi.fn(),
      findActiveMembership: vi.fn().mockResolvedValue(null),
      markMembershipRemoved: vi.fn(),
      updateMembershipRole: vi.fn(),
      findOrganisationRoleByKey: vi.fn(),
    } as unknown as WorkspaceRepository;

    const service = new WorkspaceService(workspaceRepository, identityStore);

    await expect(
      service.resolveWorkspace("user-1", buildOrganisationWorkspaceId("org-other")),
    ).rejects.toMatchObject({ code: "WORKSPACE_UNAVAILABLE" });
  });

  it("removes financial permissions when membership access is restricted", async () => {
    const identityStore: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };

    const workspaceRepository: WorkspaceRepository = {
      listActiveOrganisationMemberships: vi.fn().mockResolvedValue([
        {
          membershipId: "membership-1",
          organisationId: "org-1",
          organisationName: "Bay Repairs",
          organisationSlug: "bay-repairs",
          organisationStatus: "active",
          membershipStatus: "active",
          roleId: "role-owner",
          roleKey: "owner",
          assignedJobsOnly: false,
          financialDataAccess: false,
        },
      ]),
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(
        new Map([
          ["role-owner", ["organisation.view", "payments.view", "reports.financial.view"]],
        ]),
      ),
      countActiveOwners: vi.fn(),
      findActiveMembership: vi.fn().mockResolvedValue({
        membershipId: "membership-1",
        organisationId: "org-1",
        organisationName: "Bay Repairs",
        organisationSlug: "bay-repairs",
        organisationStatus: "active",
        membershipStatus: "active",
        roleId: "role-owner",
        roleKey: "owner",
        assignedJobsOnly: false,
        financialDataAccess: false,
      }),
      markMembershipRemoved: vi.fn(),
      updateMembershipRole: vi.fn(),
      findOrganisationRoleByKey: vi.fn(),
    } as unknown as WorkspaceRepository;

    const service = new WorkspaceService(workspaceRepository, identityStore);

    const result = await service.listWorkspaces("user-1");
    const organisation = result.workspaces.find((item) => item.kind === "organisation");
    expect(organisation?.permissions).toEqual(["organisation.view"]);
  });
});
