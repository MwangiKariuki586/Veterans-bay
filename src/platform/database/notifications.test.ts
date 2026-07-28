import { and, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { NotificationsRepository } from "../../modules/notifications/repository";
import type { DomainEventEnvelope } from "../events/contracts";
import type { Database } from "./client";
import {
  deadLetterEvents,
  processedEvents,
} from "./schema/consumer-events";
import { notifications } from "./schema/notifications";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { accountProfiles } from "./schema/account-profiles";
import { organisationMemberships, roles } from "./schema/roles";
import { serviceRequests } from "./schema/service-requests";
import { withTestDatabase } from "./testing/helpers";

describe("notification persistence", () => {
  it("resolves recipients, isolates accounts, and handles concurrent duplicate delivery and read state", async () => {
    await withTestDatabase(async ({ db }) => {
      const fixture = await seedNotificationFixture(db);
      const event = notificationEvent(fixture);
      const repository = new NotificationsRepository(db);

      try {
        const [first, duplicate] = await Promise.all([
          repository.consume(event),
          repository.consume(event),
        ]);
        expect([first, duplicate]).toEqual(
          expect.arrayContaining([
            { created: 1, duplicate: false },
            { created: 0, duplicate: true },
          ]),
        );

        const ownerList = await repository.list({
          recipientAccountId: fixture.ownerId,
          unreadOnly: false,
          page: 1,
          pageSize: 20,
        });
        expect(ownerList.items).toHaveLength(1);
        expect(ownerList.unreadCount).toBe(1);
        expect(ownerList.items[0]).toMatchObject({
          sourceEventType: "service_request.submitted",
          title: "New service request",
          actionTarget: `/professional/enquiries/${fixture.requestId}`,
          readAt: null,
        });
        await expect(
          repository.unreadCount(fixture.otherOwnerId),
        ).resolves.toBe(0);
        await expect(
          repository.markRead({
            recipientAccountId: fixture.otherOwnerId,
            notificationId: ownerList.items[0]!.id,
          }),
        ).resolves.toBe(false);
        await expect(
          repository.markRead({
            recipientAccountId: fixture.ownerId,
            notificationId: ownerList.items[0]!.id,
            correlationId: "notification-read-test",
          }),
        ).resolves.toBe(true);
        await expect(
          repository.unreadCount(fixture.ownerId),
        ).resolves.toBe(0);

        const persisted = await db
          .select()
          .from(notifications)
          .where(eq(notifications.sourceEventId, event.eventId));
        expect(persisted).toHaveLength(1);
        expect(persisted[0]?.readAt).toBeInstanceOf(Date);

        const effects = await db
          .select({ eventType: outboxEvents.eventType })
          .from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, persisted[0]!.id));
        expect(effects.map(({ eventType }) => eventType)).toEqual(
          expect.arrayContaining([
            "notification.created",
            "notification.delivered",
            "notification.read",
          ]),
        );

        await expect(
          db.insert(notifications).values({
            recipientAccountId: fixture.ownerId,
            organisationId: fixture.organisationId,
            sourceEventId: crypto.randomUUID(),
            sourceEventType: "test.unsafe_target",
            sourceAggregateType: "test",
            sourceAggregateId: crypto.randomUUID(),
            title: "Unsafe target",
            body: "This record must be rejected by the database constraint.",
            actionTarget: "https://example.com/phishing",
          }),
        ).rejects.toThrow();
      } finally {
        await cleanupNotificationFixture(db, fixture, event.eventId);
      }
    });
  });
});

async function seedNotificationFixture(db: Database) {
  const marker = crypto.randomUUID();
  const [client, owner, otherOwner] = await db
    .insert(accountProfiles)
    .values([
      {
        authUserId: `notification-client-${marker}`,
        displayName: "Notification Client",
        primaryEmail: `notification-client-${marker}@example.com`,
      },
      {
        authUserId: `notification-owner-${marker}`,
        displayName: "Notification Owner",
        primaryEmail: `notification-owner-${marker}@example.com`,
      },
      {
        authUserId: `notification-other-owner-${marker}`,
        displayName: "Other Notification Owner",
        primaryEmail: `notification-other-owner-${marker}@example.com`,
      },
    ])
    .returning();
  const [organisation, otherOrganisation] = await db
    .insert(organisations)
    .values([
      {
        name: "Notification Provider",
        slug: `notification-provider-${marker}`,
        status: "active",
      },
      {
        name: "Other Notification Provider",
        slug: `other-notification-provider-${marker}`,
        status: "active",
      },
    ])
    .returning();
  const [ownerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.scope, "organisation"), eq(roles.key, "owner")))
    .limit(1);
  const memberships = await db
    .insert(organisationMemberships)
    .values([
      {
        organisationId: organisation.id,
        accountProfileId: owner.id,
        roleId: ownerRole!.id,
        status: "active",
      },
      {
        organisationId: otherOrganisation.id,
        accountProfileId: otherOwner.id,
        roleId: ownerRole!.id,
        status: "active",
      },
    ])
    .returning({ id: organisationMemberships.id });
  const [request] = await db
    .insert(serviceRequests)
    .values({
      clientAccountId: client.id,
      organisationId: organisation.id,
      idempotencyKey: crypto.randomUUID(),
      source: "MARKETPLACE_DISCOVERY",
      category: "Plumbing",
      status: "SUBMITTED",
      submittedAt: new Date(),
    })
    .returning({ id: serviceRequests.id });
  return {
    clientId: client.id,
    ownerId: owner.id,
    otherOwnerId: otherOwner.id,
    organisationId: organisation.id,
    otherOrganisationId: otherOrganisation.id,
    membershipIds: memberships.map(({ id }) => id),
    requestId: request.id,
  };
}

function notificationEvent(
  fixture: Awaited<ReturnType<typeof seedNotificationFixture>>,
): DomainEventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    eventType: "service_request.submitted",
    eventVersion: 1,
    aggregateType: "service_request",
    aggregateId: fixture.requestId,
    organisationId: fixture.organisationId,
    actorAccountId: fixture.clientId,
    correlationId: "notification-database-test",
    occurredAt: new Date().toISOString(),
    payload: {},
  };
}

async function cleanupNotificationFixture(
  db: Database,
  fixture: Awaited<ReturnType<typeof seedNotificationFixture>>,
  eventId: string,
) {
  const notificationRows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.sourceEventId, eventId));
  const notificationIds = notificationRows.map(({ id }) => id);
  if (notificationIds.length > 0) {
    await db
      .delete(outboxEvents)
      .where(inArray(outboxEvents.aggregateId, notificationIds));
  }
  await db
    .delete(notifications)
    .where(eq(notifications.sourceEventId, eventId));
  await db.delete(processedEvents).where(eq(processedEvents.eventId, eventId));
  await db
    .delete(deadLetterEvents)
    .where(eq(deadLetterEvents.eventId, eventId));
  await db
    .delete(serviceRequests)
    .where(eq(serviceRequests.id, fixture.requestId));
  await db
    .delete(organisationMemberships)
    .where(inArray(organisationMemberships.id, fixture.membershipIds));
  await db.execute(
    sql`delete from organisations where id in (${fixture.organisationId}, ${fixture.otherOrganisationId})`,
  );
  await db.execute(
    sql`delete from account_profiles where id in (${fixture.clientId}, ${fixture.ownerId}, ${fixture.otherOwnerId})`,
  );
}
