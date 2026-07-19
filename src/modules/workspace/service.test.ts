import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "./repository";
import { WorkspaceService } from "./service";
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
  it("lists client, organisation, and platform workspaces from live records", async () => {
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
      buildClientWorkspaceId("profile-1"),
      buildOrganisationWorkspaceId("org-1"),
      buildPlatformWorkspaceId(),
    ]);
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

  it("blocks removing the final owner without transfer", async () => {
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
      listActivePlatformAssignments: vi.fn().mockResolvedValue([]),
      listPermissionKeysForRoleIds: vi.fn().mockResolvedValue(
        new Map([
          ["role-owner", ["organisation.view", "organisation.manage", "organisation.members.manage"]],
        ]),
      ),
      countActiveOwners: vi.fn().mockResolvedValue(1),
      findActiveMembership: vi.fn().mockResolvedValue({
        membershipId: "membership-1",
        organisationId: "org-1",
        organisationName: "Bay Repairs",
        organisationSlug: "bay-repairs",
        organisationStatus: "active",
        membershipStatus: "active",
        roleId: "role-owner",
        roleKey: "owner",
      }),
      markMembershipRemoved: vi.fn(),
      updateMembershipRole: vi.fn(),
      findOrganisationRoleByKey: vi.fn(),
    } as unknown as WorkspaceRepository;

    const service = new WorkspaceService(workspaceRepository, identityStore);

    await expect(
      service.removeMember({
        actorAuthUserId: "user-1",
        organisationId: "org-1",
        membershipId: "membership-1",
        targetAccountProfileId: "profile-1",
        targetRoleKey: "owner",
      }),
    ).rejects.toMatchObject({ code: "OWNER_TRANSFER_REQUIRED" });
  });
});
