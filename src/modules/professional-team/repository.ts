import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  organisationInvitations,
  organisationMembershipHistory,
  organisationMembershipRoleHistory,
  organisationMemberships,
  roles,
} from "../../platform/database/schema/roles";
import { AppError } from "../../platform/errors/app-error";
import { professionalTeamEvents } from "./permissions";

const fromRole = alias(roles, "from_role");
const toRole = alias(roles, "to_role");

export interface TeamMemberRecord {
  id: string;
  accountProfileId: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleKey: string;
  status: string;
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInvitationRecord {
  id: string;
  email: string;
  roleKey: string;
  status: string;
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TeamHistoryRecord {
  id: string;
  kind: "membership" | "role";
  from: string | null;
  to: string;
  actorName: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface ProfessionalTeamStore {
  listMembers(organisationId: string): Promise<TeamMemberRecord[]>;
  findMember(organisationId: string, membershipId: string): Promise<TeamMemberRecord | null>;
  listInvitations(organisationId: string): Promise<TeamInvitationRecord[]>;
  listHistory(organisationId: string, membershipId: string): Promise<TeamHistoryRecord[]>;
  createInvitation(input: {
    organisationId: string;
    actorAccountId: string;
    actorName: string;
    email: string;
    roleKey: string;
    tokenHash: string;
    token: string;
    expiresAt: Date;
    assignedJobsOnly: boolean;
    financialDataAccess: boolean;
    correlationId?: string;
  }): Promise<TeamInvitationRecord>;
  acceptInvitation(input: {
    tokenHash: string;
    accountProfileId: string;
    accountEmail: string;
    correlationId?: string;
  }): Promise<string>;
  revokeInvitation(organisationId: string, invitationId: string): Promise<void>;
  updateMember(input: {
    organisationId: string;
    membershipId: string;
    actorAccountId: string;
    roleKey?: string;
    status?: "active" | "removed";
    assignedJobsOnly?: boolean;
    financialDataAccess?: boolean;
    correlationId?: string;
  }): Promise<void>;
  transferOwnership(input: {
    organisationId: string;
    actorMembershipId: string;
    targetMembershipId: string;
    actorAccountId: string;
    correlationId?: string;
  }): Promise<void>;
}

function memberSelection(db: Database) {
  return db
    .select({
      id: organisationMemberships.id,
      accountProfileId: organisationMemberships.accountProfileId,
      name: accountProfiles.displayName,
      email: accountProfiles.primaryEmail,
      phone: accountProfiles.phone,
      roleId: roles.id,
      roleKey: roles.key,
      status: organisationMemberships.status,
      assignedJobsOnly: organisationMemberships.assignedJobsOnly,
      financialDataAccess: organisationMemberships.financialDataAccess,
      createdAt: organisationMemberships.createdAt,
      updatedAt: organisationMemberships.updatedAt,
    })
    .from(organisationMemberships)
    .innerJoin(accountProfiles, eq(organisationMemberships.accountProfileId, accountProfiles.id))
    .innerJoin(roles, eq(organisationMemberships.roleId, roles.id));
}

export class ProfessionalTeamRepository implements ProfessionalTeamStore {
  constructor(private readonly db: Database) {}

  async listMembers(organisationId: string) {
    return memberSelection(this.db)
      .where(eq(organisationMemberships.organisationId, organisationId))
      .orderBy(asc(accountProfiles.displayName));
  }

  async findMember(organisationId: string, membershipId: string) {
    const [member] = await memberSelection(this.db)
      .where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.id, membershipId)))
      .limit(1);
    return member ?? null;
  }

  async listInvitations(organisationId: string) {
    return this.db
      .select({
        id: organisationInvitations.id,
        email: organisationInvitations.email,
        roleKey: roles.key,
        status: organisationInvitations.status,
        assignedJobsOnly: organisationInvitations.assignedJobsOnly,
        financialDataAccess: organisationInvitations.financialDataAccess,
        invitedBy: accountProfiles.displayName,
        expiresAt: organisationInvitations.expiresAt,
        createdAt: organisationInvitations.createdAt,
      })
      .from(organisationInvitations)
      .innerJoin(roles, eq(organisationInvitations.roleId, roles.id))
      .innerJoin(accountProfiles, eq(organisationInvitations.invitedByAccountId, accountProfiles.id))
      .where(eq(organisationInvitations.organisationId, organisationId))
      .orderBy(desc(organisationInvitations.createdAt));
  }

  async listHistory(organisationId: string, membershipId: string) {
    const membershipRows = await this.db
      .select({
        id: organisationMembershipHistory.id,
        from: organisationMembershipHistory.fromStatus,
        to: organisationMembershipHistory.toStatus,
        actorName: accountProfiles.displayName,
        reason: organisationMembershipHistory.reason,
        createdAt: organisationMembershipHistory.createdAt,
      })
      .from(organisationMembershipHistory)
      .leftJoin(accountProfiles, eq(organisationMembershipHistory.actorAccountId, accountProfiles.id))
      .where(and(eq(organisationMembershipHistory.organisationId, organisationId), eq(organisationMembershipHistory.membershipId, membershipId)));
    const roleRows = await this.db
      .select({
        id: organisationMembershipRoleHistory.id,
        from: fromRole.key,
        to: toRole.key,
        actorName: accountProfiles.displayName,
        createdAt: organisationMembershipRoleHistory.createdAt,
      })
      .from(organisationMembershipRoleHistory)
      .leftJoin(fromRole, eq(fromRole.id, organisationMembershipRoleHistory.fromRoleId))
      .innerJoin(toRole, eq(toRole.id, organisationMembershipRoleHistory.toRoleId))
      .leftJoin(accountProfiles, eq(organisationMembershipRoleHistory.actorAccountId, accountProfiles.id))
      .where(and(eq(organisationMembershipRoleHistory.organisationId, organisationId), eq(organisationMembershipRoleHistory.membershipId, membershipId)));
    return [
      ...membershipRows.map((row) => ({ ...row, kind: "membership" as const })),
      ...roleRows.map((row) => ({ ...row, kind: "role" as const, reason: null })),
    ].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async createInvitation(input: Parameters<ProfessionalTeamStore["createInvitation"]>[0]) {
    return this.db.transaction(async (tx) => {
      const [role] = await tx.select({ id: roles.id }).from(roles)
        .where(and(eq(roles.scope, "organisation"), eq(roles.key, input.roleKey))).limit(1);
      if (!role) throw new AppError({ code: "INVALID_TEAM_ROLE", message: "The selected team role is unavailable.", status: 422 });

      await tx.update(organisationInvitations).set({ status: "revoked", updatedAt: new Date() })
        .where(and(eq(organisationInvitations.organisationId, input.organisationId), eq(organisationInvitations.email, input.email), eq(organisationInvitations.status, "pending")));
      const [invitation] = await tx.insert(organisationInvitations).values({
        organisationId: input.organisationId, email: input.email, roleId: role.id,
        tokenHash: input.tokenHash, invitedByAccountId: input.actorAccountId,
        expiresAt: input.expiresAt, assignedJobsOnly: input.assignedJobsOnly,
        financialDataAccess: input.financialDataAccess,
      }).returning();
      await tx.insert(outboxEvents).values({
        eventType: professionalTeamEvents.invited, eventVersion: 1,
        aggregateType: "organisation_invitation", aggregateId: invitation.id,
        organisationId: input.organisationId, actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { invitationId: invitation.id, email: input.email, token: input.token, expiresAt: input.expiresAt.toISOString() },
      });
      return { ...invitation, roleKey: input.roleKey, invitedBy: input.actorName };
    });
  }

  async acceptInvitation(input: Parameters<ProfessionalTeamStore["acceptInvitation"]>[0]) {
    return this.db.transaction(async (tx) => {
      const [invitation] = await tx.select().from(organisationInvitations)
        .where(and(eq(organisationInvitations.tokenHash, input.tokenHash), eq(organisationInvitations.status, "pending"), gt(organisationInvitations.expiresAt, new Date())))
        .limit(1);
      if (!invitation || invitation.email !== input.accountEmail) {
        throw new AppError({ code: "INVITATION_INVALID", message: "This invitation is invalid or has expired.", status: 410 });
      }
      const [existing] = await tx.select().from(organisationMemberships)
        .where(and(eq(organisationMemberships.organisationId, invitation.organisationId), eq(organisationMemberships.accountProfileId, input.accountProfileId))).limit(1);
      const [membership] = existing
        ? await tx.update(organisationMemberships).set({ roleId: invitation.roleId, status: "active", assignedJobsOnly: invitation.assignedJobsOnly, financialDataAccess: invitation.financialDataAccess, updatedAt: new Date() }).where(eq(organisationMemberships.id, existing.id)).returning()
        : await tx.insert(organisationMemberships).values({ organisationId: invitation.organisationId, accountProfileId: input.accountProfileId, roleId: invitation.roleId, assignedJobsOnly: invitation.assignedJobsOnly, financialDataAccess: invitation.financialDataAccess }).returning();
      await tx.update(organisationInvitations).set({ status: "accepted", acceptedByAccountId: input.accountProfileId, acceptedAt: new Date(), updatedAt: new Date() }).where(eq(organisationInvitations.id, invitation.id));
      await tx.insert(organisationMembershipHistory).values({ membershipId: membership.id, organisationId: invitation.organisationId, fromStatus: existing?.status ?? null, toStatus: "active", actorAccountId: input.accountProfileId, reason: "Invitation accepted" });
      await tx.insert(organisationMembershipRoleHistory).values({ membershipId: membership.id, organisationId: invitation.organisationId, fromRoleId: existing?.roleId ?? null, toRoleId: invitation.roleId, actorAccountId: input.accountProfileId });
      await tx.insert(outboxEvents).values({ eventType: professionalTeamEvents.joined, eventVersion: 1, aggregateType: "organisation_membership", aggregateId: membership.id, organisationId: invitation.organisationId, actorAccountId: input.accountProfileId, correlationId: input.correlationId, payload: { invitationId: invitation.id } });
      return membership.id;
    });
  }

  async revokeInvitation(organisationId: string, invitationId: string) {
    const [updated] = await this.db.update(organisationInvitations).set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(organisationInvitations.id, invitationId), eq(organisationInvitations.organisationId, organisationId), eq(organisationInvitations.status, "pending"))).returning({ id: organisationInvitations.id });
    if (!updated) throw new AppError({ code: "INVITATION_NOT_FOUND", message: "The invitation was not found.", status: 404 });
  }

  async updateMember(input: Parameters<ProfessionalTeamStore["updateMember"]>[0]) {
    await this.db.transaction(async (tx) => {
      const [member] = await tx.select().from(organisationMemberships).where(and(eq(organisationMemberships.id, input.membershipId), eq(organisationMemberships.organisationId, input.organisationId))).limit(1);
      if (!member) throw new AppError({ code: "TEAM_MEMBER_NOT_FOUND", message: "The team member was not found.", status: 404 });
      let roleId = member.roleId;
      if (input.roleKey) {
        const [role] = await tx.select({ id: roles.id }).from(roles).where(and(eq(roles.scope, "organisation"), eq(roles.key, input.roleKey))).limit(1);
        if (!role) throw new AppError({ code: "INVALID_TEAM_ROLE", message: "The selected team role is unavailable.", status: 422 });
        roleId = role.id;
      }
      const nextStatus = input.status ?? member.status;
      await tx.update(organisationMemberships).set({ roleId, status: nextStatus, assignedJobsOnly: input.assignedJobsOnly ?? member.assignedJobsOnly, financialDataAccess: input.financialDataAccess ?? member.financialDataAccess, updatedAt: new Date() }).where(eq(organisationMemberships.id, member.id));
      if (roleId !== member.roleId) await tx.insert(organisationMembershipRoleHistory).values({ membershipId: member.id, organisationId: input.organisationId, fromRoleId: member.roleId, toRoleId: roleId, actorAccountId: input.actorAccountId });
      if (nextStatus !== member.status) await tx.insert(organisationMembershipHistory).values({ membershipId: member.id, organisationId: input.organisationId, fromStatus: member.status, toStatus: nextStatus, actorAccountId: input.actorAccountId });
      if (roleId !== member.roleId || nextStatus !== member.status) await tx.insert(outboxEvents).values({ eventType: nextStatus === "removed" ? professionalTeamEvents.removed : professionalTeamEvents.roleChanged, eventVersion: 1, aggregateType: "organisation_membership", aggregateId: member.id, organisationId: input.organisationId, actorAccountId: input.actorAccountId, correlationId: input.correlationId, payload: { roleKey: input.roleKey, status: nextStatus } });
    });
  }

  async transferOwnership(input: Parameters<ProfessionalTeamStore["transferOwnership"]>[0]) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.organisationId}))`);
      const members = await tx.select().from(organisationMemberships).where(and(eq(organisationMemberships.organisationId, input.organisationId), inArray(organisationMemberships.id, [input.actorMembershipId, input.targetMembershipId]), eq(organisationMemberships.status, "active")));
      const actor = members.find((item) => item.id === input.actorMembershipId);
      const target = members.find((item) => item.id === input.targetMembershipId);
      const roleRows = await tx.select({ id: roles.id, key: roles.key }).from(roles).where(and(eq(roles.scope, "organisation"), or(eq(roles.key, "owner"), eq(roles.key, "manager"))));
      const ownerRole = roleRows.find((item) => item.key === "owner");
      const managerRole = roleRows.find((item) => item.key === "manager");
      if (!actor || !target || actor.roleId !== ownerRole?.id || !managerRole) throw new AppError({ code: "OWNERSHIP_TRANSFER_INVALID", message: "Ownership can only be transferred by the current owner to an active team member.", status: 409 });
      await tx.update(organisationMemberships).set({ roleId: managerRole.id, financialDataAccess: false, updatedAt: new Date() }).where(eq(organisationMemberships.id, actor.id));
      await tx.update(organisationMemberships).set({ roleId: ownerRole.id, assignedJobsOnly: false, financialDataAccess: true, updatedAt: new Date() }).where(eq(organisationMemberships.id, target.id));
      await tx.insert(organisationMembershipRoleHistory).values([
        { membershipId: actor.id, organisationId: input.organisationId, fromRoleId: ownerRole.id, toRoleId: managerRole.id, actorAccountId: input.actorAccountId },
        { membershipId: target.id, organisationId: input.organisationId, fromRoleId: target.roleId, toRoleId: ownerRole.id, actorAccountId: input.actorAccountId },
      ]);
      await tx.insert(outboxEvents).values({ eventType: professionalTeamEvents.roleChanged, eventVersion: 1, aggregateType: "organisation_membership", aggregateId: target.id, organisationId: input.organisationId, actorAccountId: input.actorAccountId, correlationId: input.correlationId, payload: { ownershipTransferredFrom: actor.id, ownershipTransferredTo: target.id } });
    });
  }
}
