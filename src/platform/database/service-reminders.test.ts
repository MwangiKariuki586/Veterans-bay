import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { NotificationsRepository } from "../../modules/notifications/repository";
import { ServiceRemindersRepository } from "../../modules/service-reminders/repository";
import type { Database } from "./client";
import { accountProfiles } from "./schema/account-profiles";
import { customerRecords } from "./schema/customers";
import { notifications } from "./schema/notifications";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import { serviceReminders } from "./schema/service-reminders";
import { withRolledBackTransaction, withTestDatabase } from "./testing/helpers";

describe("service reminder persistence", () => {
  it("schedules, cancels, and dispatches exactly one in-app reminder", async () => {
    await withTestDatabase(async ({ db }) => {
      await withRolledBackTransaction(db, async (testDb) => {
        const fixture = await seed(testDb);
        const repository = new ServiceRemindersRepository(testDb);
        await expect(repository.schedule({
          ...fixture, reason: "Past reminder", dueAt: new Date(Date.now() - 1000),
        })).resolves.toBeNull();
        const cancelled = await repository.schedule({
          ...fixture, reason: "Cancelled annual inspection", dueAt: new Date(Date.now() + 86_400_000),
        });
        await expect(repository.cancel({
          reminderId: cancelled!.id, organisationId: fixture.organisationId, actorAccountId: fixture.actorAccountId,
        })).resolves.toMatchObject({ status: "CANCELLED" });
        const due = await repository.schedule({
          ...fixture, reason: "Annual safety inspection is due", dueAt: new Date(Date.now() + 86_400_000),
        });
        await testDb.update(serviceReminders).set({ dueAt: new Date(Date.now() - 1000) }).where(eq(serviceReminders.id, due!.id));
        await expect(repository.dispatchDue()).resolves.toBe(1);
        await expect(repository.dispatchDue()).resolves.toBe(0);
        const [event] = await testDb.select().from(outboxEvents).where(eq(outboxEvents.eventType, "service_reminder.due"));
        const envelope = {
          eventId: event.id, eventType: event.eventType, eventVersion: event.eventVersion,
          aggregateType: event.aggregateType, aggregateId: event.aggregateId,
          organisationId: event.organisationId, actorAccountId: event.actorAccountId,
          correlationId: event.correlationId, occurredAt: event.createdAt.toISOString(),
          payload: event.payload,
        };
        const notificationsRepository = new NotificationsRepository(testDb);
        await expect(notificationsRepository.consume(envelope)).resolves.toEqual({ created: 1, duplicate: false });
        await expect(notificationsRepository.consume(envelope)).resolves.toEqual({ created: 0, duplicate: true });
        const persistedNotifications = await testDb
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.sourceEventId, event.id),
              eq(notifications.recipientAccountId, fixture.clientId),
            ),
          );
        expect(persistedNotifications).toHaveLength(1);
        expect(persistedNotifications[0]).toMatchObject({
          recipientAccountId: fixture.clientId,
          title: "Service reminder",
          actionTarget: "/client/bookings",
        });
      });
    });
  });
});

async function seed(db: Database) {
  const marker = crypto.randomUUID();
  const [owner, client] = await db.insert(accountProfiles).values([
    { authUserId: `reminder-owner-${marker}`, displayName: "Reminder Owner", primaryEmail: `reminder-owner-${marker}@example.test` },
    { authUserId: `reminder-client-${marker}`, displayName: "Reminder Client", primaryEmail: `reminder-client-${marker}@example.test` },
  ]).returning();
  const [organisation] = await db.insert(organisations).values({ name: "Reminder Organisation", slug: `reminder-org-${marker}`, status: "active" }).returning();
  const [customer] = await db.insert(customerRecords).values({
    organisationId: organisation.id, accountProfileId: client.id, displayName: client.displayName,
    email: client.primaryEmail, acquisitionSource: "MARKETPLACE_ACQUIRED", status: "REGISTERED",
    createdByAccountId: owner.id, reconciledAt: new Date(),
  }).returning();
  return { customerId: customer.id, organisationId: organisation.id, actorAccountId: owner.id, clientId: client.id };
}
