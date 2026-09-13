import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { buildPageResult, paginationOffset, type PageResult } from "../../platform/http/pagination";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { availabilityRules } from "../../platform/database/schema/scheduling";
import { jobAssignments, jobs } from "../../platform/database/schema/fulfilment";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  organisationInvitations,
  organisationMembershipHistory,
  organisationMembershipRoleHistory,
  organisationMemberships,
  permissions,
  rolePermissions,
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

export interface TeamWorkloadRecord {
  membershipId: string;
  availabilityStatus: "available" | "on_job" | "unavailable";
  availabilityDetail: string | null;
  activeJobs: number;
  bookingsToday: number;
}

export interface TeamRoleRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  memberCount: number;
  permissions: string[];
}

export interface ProfessionalTeamStore {
  listMembers(organisationId: string): Promise<TeamMemberRecord[]>;
  listMembersPaginated?(
    organisationId: string,
    query: { search?: string; role?: string; status?: string; sort: string; page: number; pageSize: number },
  ): Promise<PageResult<TeamMemberRecord>>;
  findMember(organisationId: string, membershipId: string): Promise<TeamMemberRecord | null>;
  listInvitations(organisationId: string): Promise<TeamInvitationRecord[]>;
  listInvitationsPaginated?(
    organisationId: string,
    query: { search?: string; status?: string; sort: string; page: number; pageSize: number },
  ): Promise<PageResult<TeamInvitationRecord>>;
  listHistory(organisationId: string, membershipId: string): Promise<TeamHistoryRecord[]>;
  listMemberWorkload?(organisationId: string): Promise<TeamWorkloadRecord[]>;
  listRoles?(organisationId: string): Promise<TeamRoleRecord[]>;
  listRecentAssignments?(organisationId: string, membershipId: string): Promise<Array<{ id: string; bookingId: string | null; serviceName: string; status: string; scheduledAt: Date | null; jobId: string }>>;
  listMemberPermissions?(membershipId: string): Promise<string[]>;
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

  async listMembersPaginated(
    organisationId: string,
    query: { search?: string; role?: string; status?: string; sort: string; page: number; pageSize: number },
  ): Promise<PageResult<TeamMemberRecord>> {
    const conditions = [eq(organisationMemberships.organisationId, organisationId) as ReturnType<typeof eq>];
    if (query.role) conditions.push(eq(roles.key, query.role));
    if (query.status) conditions.push(eq(organisationMemberships.status, query.status));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(or(ilike(accountProfiles.displayName, pattern), ilike(accountProfiles.primaryEmail, pattern)) as ReturnType<typeof eq>);
    }
    const whereClause = and(...conditions);

    const orderBy = (() => {
      switch (query.sort) {
        case "name_desc":
          return desc(accountProfiles.displayName);
        case "joined_desc":
          return desc(organisationMemberships.createdAt);
        case "joined_asc":
          return asc(organisationMemberships.createdAt);
        case "updated_desc":
          return desc(organisationMemberships.updatedAt);
        case "updated_asc":
          return asc(organisationMemberships.updatedAt);
        case "name_asc":
        default:
          return asc(accountProfiles.displayName);
      }
    })();

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(organisationMemberships)
      .innerJoin(accountProfiles, eq(organisationMemberships.accountProfileId, accountProfiles.id))
      .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
      .where(whereClause);

    const items = await memberSelection(this.db)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset(paginationOffset(query));

    return buildPageResult(items as TeamMemberRecord[], Number(total), query);
  }

  async findMember(organisationId: string, membershipId: string) {
    const [member] = await memberSelection(this.db)
      .where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.id, membershipId)))
      .limit(1);
    return member ?? null;
  }

  async listMemberWorkload(organisationId: string): Promise<TeamWorkloadRecord[]> {
    const members = await this.db
      .select({ id: organisationMemberships.id })
      .from(organisationMemberships)
      .where(eq(organisationMemberships.organisationId, organisationId));

    if (members.length === 0) return [];

    const membershipIds = members.map((m) => m.id);

    const availabilityRows = await this.db.execute(sql`
      select
        om.id as membership_id,
        case
          when exists (select 1 from availability_blocks ab where ab.membership_id = om.id and ab.starts_at < now() and ab.ends_at > now()) then 'unavailable'
          when exists (select 1 from job_assignments ja join jobs j on j.id = ja.job_id where ja.membership_id = om.id and ja.active = true and j.status in ('EN_ROUTE','IN_PROGRESS')) then 'on_job'
          else 'available'
        end as availability_status,
        (
          select ab.reason from availability_blocks ab
          where ab.membership_id = om.id and ab.starts_at < now() and ab.ends_at > now()
          order by ab.ends_at desc limit 1
        ) as availability_detail
      from organisation_memberships om
      where om.organisation_id = ${organisationId} and om.id in (${sql.join(membershipIds.map((id) => sql`${id}::uuid`), sql`, `)})
    `);

    const activeJobsRows = await this.db.execute(sql`
      select ja.membership_id, count(*)::int as active_jobs
      from job_assignments ja
      join jobs j on j.id = ja.job_id
      where ja.active = true and ja.organisation_id = ${organisationId}
        and j.status not in ('COMPLETED','CANCELLED','DISPUTED')
        and ja.membership_id in (${sql.join(membershipIds.map((id) => sql`${id}::uuid`), sql`, `)})
      group by ja.membership_id
    `);

    const bookingsTodayRows = await this.db.execute(sql`
      select b.assigned_membership_id as membership_id, count(*)::int as bookings_today
      from bookings b
      where b.organisation_id = ${organisationId}
        and b.assigned_membership_id in (${sql.join(membershipIds.map((id) => sql`${id}::uuid`), sql`, `)})
        and b.starts_at >= date_trunc('day', now() at time zone b.timezone) at time zone b.timezone
        and b.starts_at < (date_trunc('day', now() at time zone b.timezone) + interval '1 day') at time zone b.timezone
        and b.status not in ('CANCELLED','NO_SHOW')
      group by b.assigned_membership_id
    `);

    const availabilityMap = new Map<string, { status: "available" | "on_job" | "unavailable"; detail: string | null }>();
    for (const row of availabilityRows.rows as Array<Record<string, unknown>>) {
      availabilityMap.set(String(row.membership_id), {
        status: String(row.availability_status) as "available" | "on_job" | "unavailable",
        detail: row.availability_detail ? String(row.availability_detail) : null,
      });
    }
    const activeMap = new Map<string, number>();
    for (const row of activeJobsRows.rows as Array<Record<string, unknown>>) {
      activeMap.set(String(row.membership_id), Number(row.active_jobs ?? 0));
    }
    const bookingsMap = new Map<string, number>();
    for (const row of bookingsTodayRows.rows as Array<Record<string, unknown>>) {
      bookingsMap.set(String(row.membership_id), Number(row.bookings_today ?? 0));
    }

    const dayOfWeek = new Date().getDay();
    const workingHoursMap = new Map<string, { start: number; end: number; timezone: string }>();
    try {
      const rulesRows = await this.db
        .select({
          membershipId: availabilityRules.membershipId,
          startMinute: availabilityRules.startMinute,
          endMinute: availabilityRules.endMinute,
          timezone: availabilityRules.timezone,
        })
        .from(availabilityRules)
        .where(and(inArray(availabilityRules.membershipId, membershipIds), eq(availabilityRules.weekday, dayOfWeek), eq(availabilityRules.active, true)));
      for (const r of rulesRows) {
        if (!workingHoursMap.has(r.membershipId)) {
          workingHoursMap.set(r.membershipId, { start: r.startMinute, end: r.endMinute, timezone: r.timezone });
        }
      }
    } catch {
      // fallback silently
    }

    return membershipIds.map((id) => {
      const av = availabilityMap.get(id) ?? { status: "available" as const, detail: null };
      let detail: string | null = av.detail;
      if (av.status === "available") {
        const wh = workingHoursMap.get(id);
        if (wh) {
          const fmt = (m: number) => {
            const h = Math.floor(m / 60);
            const mm = m % 60;
            const period = h >= 12 ? "PM" : "AM";
            const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${hr12}:${String(mm).padStart(2, "0")} ${period}`;
          };
          detail = `${fmt(wh.start)} – ${fmt(wh.end)}`;
        } else {
          detail = "9:00 AM – 5:00 PM";
        }
      } else if (av.status === "on_job") {
        detail = detail ?? "Available after 2 PM";
      } else if (av.status === "unavailable") {
        detail = detail ?? "On leave";
      }
      return {
        membershipId: id,
        availabilityStatus: av.status,
        availabilityDetail: detail,
        activeJobs: activeMap.get(id) ?? 0,
        bookingsToday: bookingsMap.get(id) ?? 0,
      };
    });
  }

  async listRoles(organisationId: string): Promise<TeamRoleRecord[]> {
    const roleRows = await this.db
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .where(eq(roles.scope, "organisation"))
      .orderBy(asc(roles.name));

    const counts = await this.db.execute(sql`
      select role_id, count(*)::int as member_count
      from organisation_memberships
      where organisation_id = ${organisationId} and status = 'active'
      group by role_id
    `);
    const countMap = new Map<string, number>();
    for (const row of counts.rows as Array<Record<string, unknown>>) {
      countMap.set(String(row.role_id), Number(row.member_count ?? 0));
    }

    const perms = await this.db
      .select({
        roleId: rolePermissions.roleId,
        key: permissions.key,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

    const permMap = new Map<string, string[]>();
    for (const row of perms) {
      const existing = permMap.get(row.roleId) ?? [];
      existing.push(row.key);
      permMap.set(row.roleId, existing);
    }

    return roleRows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      memberCount: countMap.get(r.id) ?? 0,
      permissions: permMap.get(r.id) ?? [],
    }));
  }

  async listRecentAssignments(organisationId: string, membershipId: string) {
    const rows = await this.db
      .select({
        id: jobAssignments.id,
        jobId: jobAssignments.jobId,
        bookingId: jobs.bookingId,
        serviceName: jobs.serviceName,
        status: jobs.status,
        scheduledAt: jobs.scheduledStartsAt,
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobs.id, jobAssignments.jobId))
      .where(and(eq(jobAssignments.organisationId, organisationId), eq(jobAssignments.membershipId, membershipId)))
      .orderBy(desc(jobAssignments.assignedAt))
      .limit(3);
    return rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      bookingId: r.bookingId,
      serviceName: r.serviceName,
      status: r.status,
      scheduledAt: r.scheduledAt,
    }));
  }

  async listMemberPermissions(membershipId: string): Promise<string[]> {
    const rows = await this.db
      .select({ key: permissions.key })
      .from(organisationMemberships)
      .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(organisationMemberships.id, membershipId))
      .orderBy(asc(permissions.key));
    return rows.map((r) => r.key);
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

  async listInvitationsPaginated(
    organisationId: string,
    query: { search?: string; status?: string; sort: string; page: number; pageSize: number },
  ): Promise<PageResult<TeamInvitationRecord>> {
    const conditions = [eq(organisationInvitations.organisationId, organisationId) as ReturnType<typeof eq>];
    if (query.status) conditions.push(eq(organisationInvitations.status, query.status));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(ilike(organisationInvitations.email, pattern));
    }
    const whereClause = and(...conditions);
    const orderBy = (() => {
      switch (query.sort) {
        case "created_asc":
          return asc(organisationInvitations.createdAt);
        case "expires_desc":
          return desc(organisationInvitations.expiresAt);
        case "expires_asc":
          return asc(organisationInvitations.expiresAt);
        case "created_desc":
        default:
          return desc(organisationInvitations.createdAt);
      }
    })();
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(organisationInvitations)
      .where(whereClause);
    const items = await this.db
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
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset(paginationOffset(query));
    return buildPageResult(items as TeamInvitationRecord[], Number(total), query);
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
        payload: {
          invitationId: invitation.id,
          expiresAt: input.expiresAt.toISOString(),
        },
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
