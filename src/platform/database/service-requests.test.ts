import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ServiceRequestsRepository } from "../../modules/service-requests/repository";
import { accountProfiles } from "./schema/account-profiles";
import {
  engagementActivities,
  engagementConversations,
} from "./schema/engagement-conversations";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { professionalServices } from "./schema/professional-services";
import {
  serviceRequestHistory,
  serviceRequests,
} from "./schema/service-requests";
import { withTestDatabase } from "./testing/helpers";

describe("service request persistence", () => {
  it("isolates participants and commits submission history with its outbox event", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const accounts = await db
        .insert(accountProfiles)
        .values([
          {
            authUserId: `request-client-${marker}`,
            displayName: "Request Client",
            primaryEmail: `request-client-${marker}@example.com`,
          },
          {
            authUserId: `request-other-${marker}`,
            displayName: "Other Client",
            primaryEmail: `request-other-${marker}@example.com`,
          },
          {
            authUserId: `request-pro-${marker}`,
            displayName: "Request Professional",
            primaryEmail: `request-pro-${marker}@example.com`,
          },
        ])
        .returning();
      const [client, otherClient, professional] = accounts;
      const [organisation] = await db
        .insert(organisations)
        .values({
          name: "Request Test Provider",
          slug: `request-provider-${marker}`,
          status: "active",
        })
        .returning();
      await db.insert(professionalServices).values({
        organisationId: organisation.id,
        slug: `request-service-${marker}`,
        name: "Request Test Plumbing",
        category: "Plumbing",
        status: "published",
        moderationStatus: "clear",
      });
      const repository = new ServiceRequestsRepository(db);

      try {
        await expect(repository.listRequestProfessionals()).resolves.toEqual(
          expect.arrayContaining([
            {
              slug: organisation.slug,
              name: organisation.name,
              categories: ["Plumbing"],
            },
          ]),
        );
        const values = {
          source: "PROFESSIONAL_BOOKING_LINK" as const,
          category: "Plumbing",
          preferredProfessionalSlug: organisation.slug,
          preferredServiceSlug: null,
          description: "Repair the leaking kitchen sink and inspect nearby pipework.",
          location: "Westlands, Nairobi",
          preferredTime: "Weekday morning",
          budgetMinMinor: 5_000_00,
          budgetMaxMinor: 15_000_00,
          urgency: "SOON" as const,
          contactPreference: "IN_APP" as const,
        };
        const idempotencyKey = crypto.randomUUID();
        const draft = await repository.createDraft({
          clientAccountId: client.id,
          idempotencyKey,
          values,
        });
        const retry = await repository.createDraft({
          clientAccountId: client.id,
          idempotencyKey,
          values,
        });
        expect(retry.id).toBe(draft.id);
        expect(draft.organisationId).toBe(organisation.id);
        const filteredList = await repository.listClient({
          clientAccountId: client.id,
          bucket: "draft",
          category: "Plumbing",
          preferredTime: "morning",
          urgency: "SOON",
          search: "leaking",
          sort: "updated_desc",
          page: 1,
          pageSize: 10,
        });
        expect(filteredList.items.map((item) => item.id)).toEqual([draft.id]);
        expect(filteredList.summary).toMatchObject({
          total: 1,
          active: 0,
          needsAction: 0,
          drafts: 1,
          closed: 0,
        });
        await expect(
          repository.getClient(otherClient.id, draft.id),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessional(organisation.id, draft.id),
        ).resolves.toBeNull();

        const submitted = await repository.submit({
          clientAccountId: client.id,
          requestId: draft.id,
          actorAccountId: client.id,
          expectedVersion: 1,
          correlationId: `request-${marker}`,
        });
        expect(submitted).toMatchObject({ status: "SUBMITTED", version: 2 });
        expect(submitted?.expiresAt).toBeInstanceOf(Date);

        const events = await db
          .select()
          .from(outboxEvents)
          .where(
            and(
              eq(outboxEvents.aggregateId, draft.id),
              eq(outboxEvents.eventType, "service_request.submitted"),
            ),
          );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          organisationId: organisation.id,
          actorAccountId: client.id,
        });
        const [conversation] = await db
          .select()
          .from(engagementConversations)
          .where(
            and(
              eq(engagementConversations.contextType, "SERVICE_REQUEST"),
              eq(engagementConversations.contextId, draft.id),
            ),
          );
        expect(conversation).toBeDefined();
        const activities = await db
          .select()
          .from(engagementActivities)
          .where(eq(engagementActivities.conversationId, conversation.id));
        expect(activities).toHaveLength(1);
        expect(activities[0]).toMatchObject({
          activityType: "SUBMITTED",
          actorAccountId: client.id,
          sourceType: "SERVICE_REQUEST_HISTORY",
        });
        const activityEvents = await db
          .select()
          .from(outboxEvents)
          .where(
            and(
              eq(outboxEvents.aggregateId, draft.id),
              eq(outboxEvents.eventType, "engagement.activity_recorded"),
            ),
          );
        expect(activityEvents).toHaveLength(1);

        const professionalView = await repository.getProfessional(
          organisation.id,
          draft.id,
        );
        expect(professionalView).toMatchObject({
          clientDisplayName: "Request Client",
          clientPrimaryEmail: client.primaryEmail,
        });
        await repository.addPrivateNote({
          organisationId: organisation.id,
          requestId: draft.id,
          actorAccountId: professional.id,
          note: "Confirm access before preparing a quotation.",
        });
        const afterPrivateNote = await repository.getProfessional(
          organisation.id,
          draft.id,
        );
        expect(afterPrivateNote?.expiresAt).toEqual(submitted?.expiresAt);
        const history = await db
          .select()
          .from(serviceRequestHistory)
          .where(eq(serviceRequestHistory.requestId, draft.id));
        expect(history).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "SUBMITTED",
              fromStatus: "DRAFT",
              toStatus: "SUBMITTED",
              privateProfessionalNote: null,
            }),
            expect.objectContaining({
              action: "PRIVATE_NOTE_ADDED",
              privateProfessionalNote:
                "Confirm access before preparing a quotation.",
            }),
          ]),
        );

        const reviewing = await repository.professionalTransition({
          organisationId: organisation.id,
          requestId: draft.id,
          actorAccountId: professional.id,
          expectedVersion: 2,
          fromStatuses: ["SUBMITTED"],
          toStatus: "UNDER_REVIEW",
          action: "REVIEW_STARTED",
          eventType: "service_request.updated",
        });
        expect(reviewing).toMatchObject({
          status: "UNDER_REVIEW",
          version: 3,
        });
        expect(reviewing?.expiresAt).toBeInstanceOf(Date);
        const cancelled = await repository.cancel({
          clientAccountId: client.id,
          requestId: draft.id,
          actorAccountId: client.id,
          expectedVersion: 3,
        });
        expect(cancelled).toMatchObject({
          status: "CANCELLED",
          version: 4,
          expiresAt: null,
        });
        expect(cancelled?.history.at(-1)).toMatchObject({
          action: "CANCELLED",
          fromStatus: "UNDER_REVIEW",
          toStatus: "CANCELLED",
        });
      } finally {
        const requests = await db
          .select({ id: serviceRequests.id })
          .from(serviceRequests)
          .where(eq(serviceRequests.clientAccountId, client.id));
        const requestIds = requests.map((item) => item.id);
        if (requestIds.length > 0) {
          await db
            .delete(outboxEvents)
            .where(inArray(outboxEvents.aggregateId, requestIds));
          await db
            .delete(serviceRequestHistory)
            .where(inArray(serviceRequestHistory.requestId, requestIds));
          const conversations = await db
            .select({ id: engagementConversations.id })
            .from(engagementConversations)
            .where(inArray(engagementConversations.contextId, requestIds));
          if (conversations.length > 0) {
            await db
              .delete(engagementActivities)
              .where(
                inArray(
                  engagementActivities.conversationId,
                  conversations.map((item) => item.id),
                ),
              );
          }
          await db
            .delete(engagementConversations)
            .where(inArray(engagementConversations.contextId, requestIds));
          await db
            .delete(serviceRequests)
            .where(inArray(serviceRequests.id, requestIds));
        }
        await db.delete(organisations).where(eq(organisations.id, organisation.id));
        await db
          .delete(accountProfiles)
          .where(inArray(accountProfiles.id, accounts.map((item) => item.id)));
      }
    });
  }, 180_000);

  it("expires only due pre-quotation requests in bounded, repeat-safe batches", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [client] = await db
        .insert(accountProfiles)
        .values({
          authUserId: `expiry-client-${marker}`,
          displayName: "Expiry Client",
          primaryEmail: `expiry-client-${marker}@example.com`,
        })
        .returning();
      const now = new Date("2026-08-27T12:00:00.000Z");
      const dueAt = new Date("2026-08-27T11:59:59.000Z");
      const futureAt = new Date("2026-08-28T12:00:00.000Z");
      const inserted = await db
        .insert(serviceRequests)
        .values([
          {
            clientAccountId: client.id,
            idempotencyKey: crypto.randomUUID(),
            source: "MARKETPLACE_DISCOVERY",
            status: "SUBMITTED",
            expiresAt: dueAt,
          },
          {
            clientAccountId: client.id,
            idempotencyKey: crypto.randomUUID(),
            source: "MARKETPLACE_DISCOVERY",
            status: "UNDER_REVIEW",
            expiresAt: dueAt,
          },
          {
            clientAccountId: client.id,
            idempotencyKey: crypto.randomUUID(),
            source: "MARKETPLACE_DISCOVERY",
            status: "MORE_INFORMATION_REQUIRED",
            expiresAt: futureAt,
          },
          {
            clientAccountId: client.id,
            idempotencyKey: crypto.randomUUID(),
            source: "MARKETPLACE_DISCOVERY",
            status: "QUOTED",
            expiresAt: dueAt,
          },
          {
            clientAccountId: client.id,
            idempotencyKey: crypto.randomUUID(),
            source: "MARKETPLACE_DISCOVERY",
            status: "CANCELLED",
            expiresAt: dueAt,
          },
        ])
        .returning({ id: serviceRequests.id, status: serviceRequests.status });
      const requestIds = inserted.map((request) => request.id);
      const dueIds = inserted
        .filter(
          (request) =>
            request.status === "SUBMITTED" || request.status === "UNDER_REVIEW",
        )
        .map((request) => request.id);
      const repository = new ServiceRequestsRepository(db);

      try {
        const first = await repository.expireDue({ now, limit: 1 });
        const second = await repository.expireDue({ now, limit: 1 });
        const repeated = await repository.expireDue({ now, limit: 50 });

        expect(first.expired).toBe(1);
        expect(second.expired).toBe(1);
        expect(new Set([...first.requestIds, ...second.requestIds])).toEqual(
          new Set(dueIds),
        );
        expect(repeated).toEqual({ expired: 0, requestIds: [] });

        const persisted = await db
          .select({
            id: serviceRequests.id,
            status: serviceRequests.status,
            version: serviceRequests.version,
          })
          .from(serviceRequests)
          .where(inArray(serviceRequests.id, requestIds));
        expect(
          persisted
            .filter((request) => dueIds.includes(request.id))
            .every(
              (request) =>
                request.status === "EXPIRED" && request.version === 2,
            ),
        ).toBe(true);
        expect(
          persisted
            .filter((request) => !dueIds.includes(request.id))
            .map((request) => request.status)
            .sort(),
        ).toEqual(["CANCELLED", "MORE_INFORMATION_REQUIRED", "QUOTED"]);

        const expiryHistory = await db
          .select()
          .from(serviceRequestHistory)
          .where(inArray(serviceRequestHistory.requestId, dueIds));
        expect(expiryHistory).toHaveLength(2);
        expect(
          expiryHistory.every(
            (item) =>
              item.action === "EXPIRED" &&
              item.toStatus === "EXPIRED" &&
              item.actorAccountId === null,
          ),
        ).toBe(true);

        const expiryEvents = await db
          .select()
          .from(outboxEvents)
          .where(
            and(
              inArray(outboxEvents.aggregateId, dueIds),
              eq(outboxEvents.eventType, "service_request.expired"),
            ),
          );
        expect(expiryEvents).toHaveLength(2);
        expect(
          expiryEvents.every(
            (event) =>
              event.actorAccountId === null &&
              event.correlationId === "cron:service-request-expiry",
          ),
        ).toBe(true);
      } finally {
        await db
          .delete(outboxEvents)
          .where(inArray(outboxEvents.aggregateId, requestIds));
        await db
          .delete(serviceRequestHistory)
          .where(inArray(serviceRequestHistory.requestId, requestIds));
        await db
          .delete(serviceRequests)
          .where(inArray(serviceRequests.id, requestIds));
        await db.delete(accountProfiles).where(eq(accountProfiles.id, client.id));
      }
    });
  });
});
