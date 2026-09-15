import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ProfessionalTeamRepository } from "../../modules/professional-team/repository";
import { accountProfiles } from "./schema/account-profiles";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import {
  organisationInvitations,
  organisationMembershipHistory,
  organisationMembershipRoleHistory,
  organisationMemberships,
  roles,
} from "./schema/roles";
import { withTestDatabase } from "./testing/helpers";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("professional team persistence", () => {
  it("retries invitations, accepts only the matching email, and writes history plus outbox atomically", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [owner, invitee] = await db.insert(accountProfiles).values([
        { authUserId: `owner-${marker}`, displayName: "Owner", primaryEmail: `owner-${marker}@example.com` },
        { authUserId: `invitee-${marker}`, displayName: "Invitee", primaryEmail: `invitee-${marker}@example.com` },
      ]).returning();
      const [organisation] = await db.insert(organisations).values({ name: "Team Test", slug: `team-test-${marker}`, status: "active" }).returning();
      const repository = new ProfessionalTeamRepository(db);

      try {
        const firstToken = `first-${marker}`;
        const secondToken = `second-${marker}`;
        const base = {
          organisationId: organisation.id,
          actorAccountId: owner.id,
          actorName: owner.displayName,
          email: invitee.primaryEmail,
          roleKey: "technician",
          expiresAt: new Date(Date.now() - 1_000),
          assignedJobsOnly: true,
          financialDataAccess: false,
        };
        const first = await repository.createInvitation({ ...base, token: firstToken, tokenHash: await sha256(firstToken) });
        await expect(repository.acceptInvitation({ tokenHash: await sha256(firstToken), accountProfileId: invitee.id, accountEmail: invitee.primaryEmail })).rejects.toMatchObject({ code: "INVITATION_INVALID" });
        const second = await repository.createInvitation({ ...base, expiresAt: new Date(Date.now() + 60_000), token: secondToken, tokenHash: await sha256(secondToken) });

        const invitations = await repository.listInvitations(organisation.id);
        expect(invitations.find((item) => item.id === first.id)?.status).toBe("revoked");
        expect(invitations.find((item) => item.id === second.id)?.status).toBe("pending");

        await expect(repository.acceptInvitation({ tokenHash: await sha256(secondToken), accountProfileId: owner.id, accountEmail: owner.primaryEmail })).rejects.toMatchObject({ code: "INVITATION_INVALID" });
        const membershipId = await repository.acceptInvitation({ tokenHash: await sha256(secondToken), accountProfileId: invitee.id, accountEmail: invitee.primaryEmail });
        const [membership] = await db.select().from(organisationMemberships).where(eq(organisationMemberships.id, membershipId));
        expect(membership).toMatchObject({ assignedJobsOnly: true, financialDataAccess: false, status: "active" });

        const [statusHistory, roleHistory, joinedEvent] = await Promise.all([
          db.select().from(organisationMembershipHistory).where(eq(organisationMembershipHistory.membershipId, membershipId)),
          db.select().from(organisationMembershipRoleHistory).where(eq(organisationMembershipRoleHistory.membershipId, membershipId)),
          db.select().from(outboxEvents).where(and(eq(outboxEvents.aggregateId, membershipId), eq(outboxEvents.eventType, "organization.member_joined"))),
        ]);
        expect(statusHistory).toHaveLength(1);
        expect(roleHistory).toHaveLength(1);
        expect(joinedEvent).toHaveLength(1);
        expect(await repository.listHistory(organisation.id, membershipId)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ kind: "membership", to: "active" }),
            expect.objectContaining({ kind: "role", to: "technician" }),
          ]),
        );
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(organisationMembershipRoleHistory).where(eq(organisationMembershipRoleHistory.organisationId, organisation.id));
        await db.delete(organisationMembershipHistory).where(eq(organisationMembershipHistory.organisationId, organisation.id));
        await db.delete(organisationInvitations).where(eq(organisationInvitations.organisationId, organisation.id));
        await db.delete(organisationMemberships).where(eq(organisationMemberships.organisationId, organisation.id));
        await db.delete(organisations).where(eq(organisations.id, organisation.id));
        await db.delete(accountProfiles).where(inArray(accountProfiles.id, [owner.id, invitee.id]));
      }
    });
  });

  it("enforces tenant scope and rolls back an invalid ownership transfer", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [owner, target] = await db.insert(accountProfiles).values([
        { authUserId: `transfer-owner-${marker}`, displayName: "Owner", primaryEmail: `transfer-owner-${marker}@example.com` },
        { authUserId: `transfer-target-${marker}`, displayName: "Target", primaryEmail: `transfer-target-${marker}@example.com` },
      ]).returning();
      const [organisation, otherOrganisation] = await db.insert(organisations).values([
        { name: "Transfer Test", slug: `transfer-test-${marker}`, status: "active" },
        { name: "Other Tenant", slug: `other-tenant-${marker}`, status: "active" },
      ]).returning();
      const roleRows = await db.select({ id: roles.id, key: roles.key }).from(roles).where(and(eq(roles.scope, "organisation"), inArray(roles.key, ["owner", "technician"])));
      const ownerRole = roleRows.find((role) => role.key === "owner")!;
      const technicianRole = roleRows.find((role) => role.key === "technician")!;
      const [ownerMembership, targetMembership] = await db.insert(organisationMemberships).values([
        { organisationId: organisation.id, accountProfileId: owner.id, roleId: ownerRole.id, financialDataAccess: true },
        { organisationId: organisation.id, accountProfileId: target.id, roleId: technicianRole.id, assignedJobsOnly: true },
      ]).returning();
      const repository = new ProfessionalTeamRepository(db);

      try {
        expect(await repository.findMember(otherOrganisation.id, targetMembership.id)).toBeNull();
        await repository.updateMember({ organisationId: organisation.id, membershipId: targetMembership.id, actorAccountId: owner.id, roleKey: "dispatcher", assignedJobsOnly: false });
        expect(await repository.findMember(organisation.id, targetMembership.id)).toMatchObject({ roleKey: "dispatcher", assignedJobsOnly: false });
        await repository.updateMember({ organisationId: organisation.id, membershipId: targetMembership.id, actorAccountId: owner.id, status: "removed" });
        expect((await repository.findMember(organisation.id, targetMembership.id))?.status).toBe("removed");
        await repository.updateMember({ organisationId: organisation.id, membershipId: targetMembership.id, actorAccountId: owner.id, status: "active" });
        await expect(repository.transferOwnership({ organisationId: organisation.id, actorMembershipId: targetMembership.id, targetMembershipId: ownerMembership.id, actorAccountId: target.id })).rejects.toMatchObject({ code: "OWNERSHIP_TRANSFER_INVALID" });
        const unchanged = await repository.findMember(organisation.id, ownerMembership.id);
        expect(unchanged?.roleKey).toBe("owner");

        await repository.transferOwnership({ organisationId: organisation.id, actorMembershipId: ownerMembership.id, targetMembershipId: targetMembership.id, actorAccountId: owner.id });
        expect((await repository.findMember(organisation.id, targetMembership.id))?.roleKey).toBe("owner");
        expect((await repository.findMember(organisation.id, ownerMembership.id))?.roleKey).toBe("manager");
      } finally {
        await db.delete(outboxEvents).where(eq(outboxEvents.organisationId, organisation.id));
        await db.delete(organisationMembershipRoleHistory).where(eq(organisationMembershipRoleHistory.organisationId, organisation.id));
        await db.delete(organisationMembershipHistory).where(eq(organisationMembershipHistory.organisationId, organisation.id));
        await db.delete(organisationInvitations).where(eq(organisationInvitations.organisationId, organisation.id));
        await db.delete(organisationMemberships).where(eq(organisationMemberships.organisationId, organisation.id));
        await db.delete(organisations).where(inArray(organisations.id, [organisation.id, otherOrganisation.id]));
        await db.delete(accountProfiles).where(inArray(accountProfiles.id, [owner.id, target.id]));
      }
    });
  });
});
