import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { AdministrationRepository } from "../../modules/administration/repository";
import { accountProfiles } from "./schema/account-profiles";
import { publicEnquiries } from "./schema/administration";
import { auditEvents } from "./schema/audit-events";
import { outboxEvents } from "./schema/outbox-events";
import {
  withRolledBackTransaction,
  withTestDatabase,
} from "./testing/helpers";

const enquiry = (overrides: Record<string, unknown> = {}) => ({
  inquiryType: "BOOKING",
  name: "Enquiry Sender",
  email: "sender@example.com",
  phone: "+254700000001",
  message: "The booked professional has not arrived for two days running.",
  accountId: null,
  ...overrides,
});

describe("public enquiry persistence", () => {
  it("records a guest enquiry with a reference, audit, and outbox event", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const repository = new AdministrationRepository(testDb);
        const created = await repository.submitEnquiry({
          ...enquiry(),
          correlationId: "request-enquiry-1",
        });

        expect(created.reference).toMatch(/^ENQ-[A-Z2-9]{6}$/);
        expect(created.status).toBe("NEW");

        const [stored, audit, events] = await Promise.all([
          testDb
            .select()
            .from(publicEnquiries)
            .where(eq(publicEnquiries.id, created.id)),
          testDb
            .select()
            .from(auditEvents)
            .where(eq(auditEvents.entityId, created.id)),
          testDb
            .select()
            .from(outboxEvents)
            .where(eq(outboxEvents.aggregateId, created.id)),
        ]);
        expect(stored[0]).toMatchObject({
          inquiryType: "BOOKING",
          email: "sender@example.com",
          accountId: null,
        });
        expect(audit.map((item) => item.action)).toEqual([
          "enquiry.submitted",
        ]);
        expect(events.map((item) => item.eventType)).toEqual([
          "enquiry.received",
        ]);
        expect(events[0]?.payload).toMatchObject({
          reference: created.reference,
          inquiryType: "BOOKING",
        });
      });
    });
  });

  it("links a resolvable account and keeps references unique", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const [linked] = await testDb
          .insert(accountProfiles)
          .values([account("enquiry-link")])
          .returning();
        const repository = new AdministrationRepository(testDb);
        const first = await repository.submitEnquiry({
          ...enquiry(),
          accountId: linked.id,
        });
        const second = await repository.submitEnquiry(enquiry());

        expect(first.accountId).toBe(linked.id);
        expect(second.reference).not.toBe(first.reference);
      });
    });
  });

  it("rejects messages below the bounded length at the database", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const repository = new AdministrationRepository(testDb);
        await expect(
          repository.submitEnquiry(enquiry({ message: "short" })),
        ).rejects.toThrow();
      });
    });
  });

  it("lists enquiries by status with stable pagination", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const repository = new AdministrationRepository(testDb);
        const [administrator] = await testDb
          .insert(accountProfiles)
          .values([account("enquiry-admin")])
          .returning();
        const created = await Promise.all([
          repository.submitEnquiry(enquiry({ email: "one@example.com" })),
          repository.submitEnquiry(enquiry({ email: "two@example.com" })),
          repository.submitEnquiry(enquiry({ email: "three@example.com" })),
        ]);
        await repository.transitionEnquiry({
          enquiryId: created[0].id,
          actorAccountId: administrator.id,
          action: "RESOLVE",
          reason: "The booking record already answers this enquiry.",
        });

        const open = await repository.listEnquiries({
          status: "NEW",
          page: 1,
          pageSize: 10,
        });
        const all = await repository.listEnquiries({
          status: "all",
          page: 1,
          pageSize: 2,
        });
        expect(open.totalItems).toBe(2);
        expect(all.totalItems).toBe(3);
        expect(all.items).toHaveLength(2);
      });
    });
  });

  it("moves enquiries through review to a reasoned resolution", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const repository = new AdministrationRepository(testDb);
        const [administrator] = await testDb
          .insert(accountProfiles)
          .values([account("enquiry-admin")])
          .returning();
        const created = await repository.submitEnquiry(enquiry());

        const reviewing = await repository.transitionEnquiry({
          enquiryId: created.id,
          actorAccountId: administrator.id,
          action: "START_REVIEW",
          reason: "Checking the booking record for this sender.",
        });
        expect(reviewing.status).toBe("IN_REVIEW");
        expect(reviewing.resolution).toBeNull();

        const resolved = await repository.transitionEnquiry({
          enquiryId: created.id,
          actorAccountId: administrator.id,
          action: "RESOLVE",
          reason: "The professional confirmed a return visit for Friday.",
        });
        expect(resolved.status).toBe("RESOLVED");
        expect(resolved.resolution).toBe(
          "The professional confirmed a return visit for Friday.",
        );
        expect(resolved.resolvedAt).not.toBeNull();

        await expect(
          repository.transitionEnquiry({
            enquiryId: created.id,
            actorAccountId: administrator.id,
            action: "DISMISS",
            reason: "Attempting a second terminal transition here.",
          }),
        ).rejects.toMatchObject({ code: "STALE_OPERATION" });
      });
    });
  });
});

function account(suffix: string) {
  const id = crypto.randomUUID();
  return {
    authUserId: `enquiry-${suffix}-${id}`,
    displayName: `Enquiry ${suffix}`,
    primaryEmail: `enquiry-${suffix}-${id}@example.com`,
    phone: "+254700000000",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  };
}
