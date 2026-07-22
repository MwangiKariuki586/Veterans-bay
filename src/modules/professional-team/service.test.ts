import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { ProfessionalTeamStore, TeamInvitationRecord, TeamMemberRecord } from "./repository";
import { ProfessionalTeamService } from "./service";

const member: TeamMemberRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  accountProfileId: "profile-2",
  name: "Brian Otieno",
  email: "brian@example.com",
  phone: null,
  roleId: "role-technician",
  roleKey: "technician",
  status: "active",
  assignedJobsOnly: true,
  financialDataAccess: false,
  createdAt: new Date("2026-07-20T10:00:00Z"),
  updatedAt: new Date("2026-07-20T10:00:00Z"),
};

function invitation(overrides: Partial<TeamInvitationRecord> = {}): TeamInvitationRecord {
  return {
    id: "invite-1",
    email: "brian@example.com",
    roleKey: "technician",
    status: "pending",
    assignedJobsOnly: true,
    financialDataAccess: false,
    invitedBy: "Alex Veteran",
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  };
}

function store(overrides: Partial<ProfessionalTeamStore> = {}): ProfessionalTeamStore {
  return {
    listMembers: vi.fn().mockResolvedValue([member]),
    findMember: vi.fn().mockResolvedValue(member),
    listInvitations: vi.fn().mockResolvedValue([]),
    listHistory: vi.fn().mockResolvedValue([]),
    createInvitation: vi.fn().mockImplementation(async (input) => invitation({
      email: input.email,
      roleKey: input.roleKey,
      assignedJobsOnly: input.assignedJobsOnly,
      financialDataAccess: input.financialDataAccess,
      expiresAt: input.expiresAt,
    })),
    acceptInvitation: vi.fn().mockResolvedValue("membership-2"),
    revokeInvitation: vi.fn(),
    updateMember: vi.fn(),
    transferOwnership: vi.fn(),
    ...overrides,
  };
}

function identity(): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: "profile-2",
      authUserId: "user-2",
      displayName: "Brian Otieno",
      primaryEmail: "brian@example.com",
      phone: null,
      timezone: "UTC",
      status: "active",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findActiveRestrictions: vi.fn().mockResolvedValue([]),
    updateProfile: vi.fn(),
    deactivateProfile: vi.fn(),
    recordAuditEvent: vi.fn(),
    insertDomainEvent: vi.fn(),
  };
}

describe("ProfessionalTeamService", () => {
  it("creates technician invitations with safe assignment and financial defaults", async () => {
    const repository = store();
    const service = new ProfessionalTeamService(repository, identity());

    const result = await service.invite({
      organisationId: "org-1",
      actorAccountId: "profile-1",
      actorName: "Alex Veteran",
      email: " BRIAN@example.com ",
      role: "technician",
    });

    expect(result).toMatchObject({ email: "brian@example.com", assignedJobsOnly: true, financialDataAccess: false });
    expect(repository.createInvitation).toHaveBeenCalledWith(expect.objectContaining({
      token: expect.any(String),
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("projects expired invitations without mutating their audit record", async () => {
    const repository = store({
      listInvitations: vi.fn().mockResolvedValue([invitation({ expiresAt: new Date(Date.now() - 1_000) })]),
    });
    const result = await new ProfessionalTeamService(repository, identity()).overview("org-1");
    expect(result.invitations[0]?.status).toBe("expired");
  });

  it("accepts an invitation only using the active account's authoritative email", async () => {
    const repository = store();
    const membershipId = await new ProfessionalTeamService(repository, identity()).accept({
      authUserId: "user-2",
      token: "a".repeat(64),
    });
    expect(membershipId).toBe("membership-2");
    expect(repository.acceptInvitation).toHaveBeenCalledWith(expect.objectContaining({
      accountProfileId: "profile-2",
      accountEmail: "brian@example.com",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("blocks owner mutation and self-deactivation outside ownership transfer", async () => {
    const owner = { ...member, roleKey: "owner", roleId: "role-owner" };
    const ownerStore = store({ findMember: vi.fn().mockResolvedValue(owner) });
    const service = new ProfessionalTeamService(ownerStore, identity());

    await expect(service.update({ organisationId: "org-1", actorMembershipId: owner.id, actorAccountId: "profile-1", membershipId: owner.id, role: "manager" })).rejects.toMatchObject({ code: "OWNER_TRANSFER_REQUIRED" });
    expect(ownerStore.updateMember).not.toHaveBeenCalled();
  });

  it("keeps tenant scope on member detail and mutation store calls", async () => {
    const repository = store({ findMember: vi.fn().mockResolvedValue(null) });
    const service = new ProfessionalTeamService(repository, identity());
    await expect(service.member("org-other", member.id)).rejects.toMatchObject({ code: "TEAM_MEMBER_NOT_FOUND" });
    expect(repository.findMember).toHaveBeenCalledWith("org-other", member.id);
  });
});
