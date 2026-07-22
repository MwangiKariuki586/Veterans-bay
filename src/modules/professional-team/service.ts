import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import type {
  ProfessionalTeamStore,
  TeamInvitationRecord,
  TeamMemberRecord,
} from "./repository";
import type {
  TeamInvitationSummary,
  TeamMemberDetail,
  TeamMemberSummary,
  TeamOverview,
  TeamRoleKey,
} from "./types";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const financialPermissionRoles = new Set<TeamRoleKey>(["owner", "accountant"]);

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapMember(record: TeamMemberRecord): TeamMemberSummary {
  return {
    id: record.id,
    accountProfileId: record.accountProfileId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    role: record.roleKey as TeamRoleKey,
    status: record.status === "active" ? "active" : "deactivated",
    assignedJobsOnly: record.assignedJobsOnly,
    financialDataAccess: record.financialDataAccess,
    joinedAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapInvitation(record: TeamInvitationRecord): TeamInvitationSummary {
  return {
    id: record.id,
    email: record.email,
    role: record.roleKey as TeamRoleKey,
    status:
      record.status === "pending" && record.expiresAt <= new Date()
        ? "expired"
        : (record.status as TeamInvitationSummary["status"]),
    assignedJobsOnly: record.assignedJobsOnly,
    financialDataAccess: record.financialDataAccess,
    invitedBy: record.invitedBy,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export class ProfessionalTeamService {
  constructor(
    private readonly store: ProfessionalTeamStore,
    private readonly identityStore: IdentityStore,
  ) {}

  async overview(organisationId: string, canManage = false): Promise<TeamOverview> {
    const [members, invitations] = await Promise.all([
      this.store.listMembers(organisationId),
      this.store.listInvitations(organisationId),
    ]);
    return { members: members.map(mapMember), invitations: invitations.map(mapInvitation), canManage };
  }

  async member(organisationId: string, membershipId: string): Promise<TeamMemberDetail> {
    const [member, history] = await Promise.all([
      this.store.findMember(organisationId, membershipId),
      this.store.listHistory(organisationId, membershipId),
    ]);
    if (!member) throw new AppError({ code: "TEAM_MEMBER_NOT_FOUND", message: "The team member was not found.", status: 404 });
    return {
      ...mapMember(member),
      history: history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  async invite(input: {
    organisationId: string;
    actorAccountId: string;
    actorName: string;
    email: string;
    role: Exclude<TeamRoleKey, "owner">;
    assignedJobsOnly?: boolean;
    financialDataAccess?: boolean;
    correlationId?: string;
  }) {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    const record = await this.store.createInvitation({
      organisationId: input.organisationId,
      actorAccountId: input.actorAccountId,
      actorName: input.actorName,
      email: input.email.trim().toLowerCase(),
      roleKey: input.role,
      token,
      tokenHash: await hashToken(token),
      expiresAt: new Date(Date.now() + invitationLifetimeMs),
      assignedJobsOnly: input.assignedJobsOnly ?? input.role === "technician",
      financialDataAccess:
        input.financialDataAccess ?? financialPermissionRoles.has(input.role),
      correlationId: input.correlationId,
    });
    return mapInvitation(record);
  }

  async accept(input: { authUserId: string; token: string; correlationId?: string }) {
    const account = await this.requireActiveAccount(input.authUserId);
    return this.store.acceptInvitation({
      tokenHash: await hashToken(input.token),
      accountProfileId: account.id,
      accountEmail: account.primaryEmail.trim().toLowerCase(),
      correlationId: input.correlationId,
    });
  }

  async update(input: {
    organisationId: string;
    actorMembershipId: string;
    actorAccountId: string;
    membershipId: string;
    role?: Exclude<TeamRoleKey, "owner">;
    status?: "active" | "deactivated";
    assignedJobsOnly?: boolean;
    financialDataAccess?: boolean;
    correlationId?: string;
  }) {
    const member = await this.store.findMember(input.organisationId, input.membershipId);
    if (!member) throw new AppError({ code: "TEAM_MEMBER_NOT_FOUND", message: "The team member was not found.", status: 404 });
    if (member.roleKey === "owner" && (input.role || input.status === "deactivated")) {
      throw new AppError({ code: "OWNER_TRANSFER_REQUIRED", message: "Transfer ownership before changing or deactivating the owner.", status: 409 });
    }
    if (input.membershipId === input.actorMembershipId && input.status === "deactivated") {
      throw new AppError({ code: "SELF_DEACTIVATION_DENIED", message: "You cannot deactivate your own active workspace membership.", status: 409 });
    }
    if (input.financialDataAccess && input.role && !financialPermissionRoles.has(input.role)) {
      throw new AppError({ code: "FINANCIAL_ACCESS_INVALID", message: "Financial access is only available to roles with financial permissions.", status: 422 });
    }
    await this.store.updateMember({
      organisationId: input.organisationId,
      membershipId: input.membershipId,
      actorAccountId: input.actorAccountId,
      roleKey: input.role,
      status: input.status === "deactivated" ? "removed" : input.status,
      assignedJobsOnly: input.assignedJobsOnly,
      financialDataAccess: input.financialDataAccess,
      correlationId: input.correlationId,
    });
  }

  transferOwnership(input: {
    organisationId: string;
    actorMembershipId: string;
    targetMembershipId: string;
    actorAccountId: string;
    correlationId?: string;
  }) {
    if (input.actorMembershipId === input.targetMembershipId) {
      throw new AppError({ code: "OWNERSHIP_TRANSFER_INVALID", message: "Choose another active member for ownership.", status: 422 });
    }
    return this.store.transferOwnership(input);
  }

  revokeInvitation(organisationId: string, invitationId: string) {
    return this.store.revokeInvitation(organisationId, invitationId);
  }

  private async requireActiveAccount(authUserId: string) {
    const account = await this.identityStore.findProfileByAuthUserId(authUserId);
    if (!account) throw new AppError({ code: "ACCOUNT_PROFILE_MISSING", message: "Account profile was not found.", status: 404 });
    if (account.status === "deactivated") throw new AppError({ code: "ACCOUNT_DEACTIVATED", message: "This account has been deactivated.", status: 403 });
    const restrictions = await this.identityStore.findActiveRestrictions(account.id);
    if (restrictions.length) throw new AppError({ code: "ACCOUNT_RESTRICTED", message: "This account cannot perform protected actions.", status: 403 });
    return account;
  }
}
