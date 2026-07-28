import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { customerRecords } from "../../platform/database/schema/customers";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { serviceReminders } from "../../platform/database/schema/service-reminders";

export interface ReminderItem {
  id: string;
  customerId: string;
  reason: string;
  dueAt: string;
  status: "SCHEDULED" | "CANCELLED" | "SENT";
  createdAt: string;
}
export class ServiceRemindersRepository {
  constructor(private readonly db: Database) {}
  async list(
    customerId: string,
    organisationId: string,
  ): Promise<ReminderItem[]> {
    const rows = await this.db
      .select()
      .from(serviceReminders)
      .where(
        and(
          eq(serviceReminders.customerId, customerId),
          eq(serviceReminders.organisationId, organisationId),
        ),
      )
      .orderBy(asc(serviceReminders.dueAt));
    return rows.map(mapReminder);
  }
  async schedule(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    reason: string;
    dueAt: Date;
    correlationId?: string;
  }) {
    if (input.dueAt <= new Date()) return null;
    return this.db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ accountProfileId: customerRecords.accountProfileId })
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.id, input.customerId),
            eq(customerRecords.organisationId, input.organisationId),
            eq(customerRecords.status, "REGISTERED"),
          ),
        )
        .limit(1);
      if (!customer?.accountProfileId) return null;
      const [recipient] = await tx
        .select({ id: accountProfiles.id })
        .from(accountProfiles)
        .where(
          and(
            eq(accountProfiles.id, customer.accountProfileId),
            eq(accountProfiles.status, "active"),
          ),
        )
        .limit(1);
      if (!recipient) return null;
      const [reminder] = await tx
        .insert(serviceReminders)
        .values({
          organisationId: input.organisationId,
          customerId: input.customerId,
          recipientAccountId: recipient.id,
          createdByAccountId: input.actorAccountId,
          reason: input.reason,
          dueAt: input.dueAt,
        })
        .returning();
      await tx
        .insert(outboxEvents)
        .values({
          eventType: "service_reminder_scheduled",
          eventVersion: 1,
          aggregateType: "service_reminder",
          aggregateId: reminder.id,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            reminderId: reminder.id,
            customerId: input.customerId,
            recipientAccountId: recipient.id,
            dueAt: input.dueAt.toISOString(),
            reason: input.reason,
          },
        });
      return mapReminder(reminder);
    });
  }
  async cancel(input: {
    reminderId: string;
    organisationId: string;
    actorAccountId: string;
  }) {
    const [updated] = await this.db
      .update(serviceReminders)
      .set({
        status: "CANCELLED",
        cancelledByAccountId: input.actorAccountId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceReminders.id, input.reminderId),
          eq(serviceReminders.organisationId, input.organisationId),
          eq(serviceReminders.status, "SCHEDULED"),
        ),
      )
      .returning();
    return updated ? mapReminder(updated) : null;
  }
  async dispatchDue(limit = 50) {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(serviceReminders)
        .where(
          and(
            eq(serviceReminders.status, "SCHEDULED"),
            lte(serviceReminders.dueAt, new Date()),
          ),
        )
        .orderBy(asc(serviceReminders.dueAt), asc(serviceReminders.id))
        .limit(limit)
        .for("update", { skipLocked: true });
      if (!due.length) return 0;
      await tx
        .update(serviceReminders)
        .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
        .where(
          inArray(
            serviceReminders.id,
            due.map((item) => item.id),
          ),
        );
      await tx.insert(outboxEvents).values(
        due.map((item) => ({
          eventType: "service_reminder.due",
          eventVersion: 1,
          aggregateType: "service_reminder",
          aggregateId: item.id,
          organisationId: item.organisationId,
          actorAccountId: null,
          payload: {
            reminderId: item.id,
            customerId: item.customerId,
            recipientAccountId: item.recipientAccountId,
            reason: item.reason,
          },
        })),
      );
      return due.length;
    });
  }
}
function mapReminder(row: typeof serviceReminders.$inferSelect): ReminderItem {
  return {
    id: row.id,
    customerId: row.customerId,
    reason: row.reason,
    dueAt: row.dueAt.toISOString(),
    status: row.status as ReminderItem["status"],
    createdAt: row.createdAt.toISOString(),
  };
}
