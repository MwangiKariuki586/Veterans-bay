import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { organisations } from "../../platform/database/schema/organisations";
import {
  organisationMemberships,
  permissions,
  platformRoleAssignments,
  rolePermissions,
  roles,
} from "../../platform/database/schema/roles";

export interface MembershipRecord {
  membershipId: string;
  organisationId: string;
  organisationName: string;
  organisationSlug: string;
  organisationStatus: string;
  membershipStatus: string;
  roleId: string;
  roleKey: string;
}

export interface PlatformAssignmentRecord {
  assignmentId: string;
  roleId: string;
  roleKey: string;
  status: string;
}

export class WorkspaceRepository {
  constructor(private readonly db: Database) {}

  async listActiveOrganisationMemberships(
    accountProfileId: string,
  ): Promise<MembershipRecord[]> {
    return this.db
      .select({
        membershipId: organisationMemberships.id,
        organisationId: organisations.id,
        organisationName: organisations.name,
        organisationSlug: organisations.slug,
        organisationStatus: organisations.status,
        membershipStatus: organisationMemberships.status,
        roleId: roles.id,
        roleKey: roles.key,
      })
      .from(organisationMemberships)
      .innerJoin(
        organisations,
        eq(organisationMemberships.organisationId, organisations.id),
      )
      .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
      .where(
        and(
          eq(organisationMemberships.accountProfileId, accountProfileId),
          eq(organisationMemberships.status, "active"),
          eq(roles.scope, "organisation"),
        ),
      );
  }

  async listActivePlatformAssignments(
    accountProfileId: string,
  ): Promise<PlatformAssignmentRecord[]> {
    return this.db
      .select({
        assignmentId: platformRoleAssignments.id,
        roleId: roles.id,
        roleKey: roles.key,
        status: platformRoleAssignments.status,
      })
      .from(platformRoleAssignments)
      .innerJoin(roles, eq(platformRoleAssignments.roleId, roles.id))
      .where(
        and(
          eq(platformRoleAssignments.accountProfileId, accountProfileId),
          eq(platformRoleAssignments.status, "active"),
          eq(roles.scope, "platform"),
        ),
      );
  }

  async listPermissionKeysForRoleIds(roleIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    if (roleIds.length === 0) {
      return result;
    }

    const rows = await this.db
      .select({
        roleId: rolePermissions.roleId,
        permissionKey: permissions.key,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    for (const row of rows) {
      const current = result.get(row.roleId) ?? [];
      current.push(row.permissionKey);
      result.set(row.roleId, current);
    }

    return result;
  }

  async countActiveOwners(organisationId: string): Promise<number> {
    const rows = await this.db
      .select({
        membershipId: organisationMemberships.id,
        roleKey: roles.key,
      })
      .from(organisationMemberships)
      .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
      .where(
        and(
          eq(organisationMemberships.organisationId, organisationId),
          eq(organisationMemberships.status, "active"),
          eq(roles.key, "owner"),
          eq(roles.scope, "organisation"),
        ),
      );

    return rows.length;
  }

  async findActiveMembership(
    accountProfileId: string,
    organisationId: string,
  ): Promise<MembershipRecord | null> {
    const [membership] = await this.db
      .select({
        membershipId: organisationMemberships.id,
        organisationId: organisations.id,
        organisationName: organisations.name,
        organisationSlug: organisations.slug,
        organisationStatus: organisations.status,
        membershipStatus: organisationMemberships.status,
        roleId: roles.id,
        roleKey: roles.key,
      })
      .from(organisationMemberships)
      .innerJoin(
        organisations,
        eq(organisationMemberships.organisationId, organisations.id),
      )
      .innerJoin(roles, eq(organisationMemberships.roleId, roles.id))
      .where(
        and(
          eq(organisationMemberships.accountProfileId, accountProfileId),
          eq(organisationMemberships.organisationId, organisationId),
          eq(organisationMemberships.status, "active"),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  async markMembershipRemoved(membershipId: string): Promise<void> {
    await this.db
      .update(organisationMemberships)
      .set({
        status: "removed",
        updatedAt: new Date(),
      })
      .where(eq(organisationMemberships.id, membershipId));
  }

  async updateMembershipRole(membershipId: string, roleId: string): Promise<void> {
    await this.db
      .update(organisationMemberships)
      .set({
        roleId,
        updatedAt: new Date(),
      })
      .where(eq(organisationMemberships.id, membershipId));
  }

  async findOrganisationRoleByKey(roleKey: string) {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.scope, "organisation"), eq(roles.key, roleKey)))
      .limit(1);

    return role ?? null;
  }
}
