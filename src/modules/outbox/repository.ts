import { and, eq, lt, lte, or, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import {
  deadLetterEvents,
  outboxProofEffects,
  processedEvents,
} from "../../platform/database/schema/consumer-events";
import { outboxEvents } from "../../platform/database/schema/outbox-events";

export type OutboxEventRecord = typeof outboxEvents.$inferSelect;

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_CLAIM_BATCH_SIZE = 20;
export const OUTBOX_ABANDONED_CLAIM_MS = 5 * 60 * 1000;

function backoffMs(attemptCount: number): number {
  const minutes = [1, 5, 15, 30, 60][Math.min(attemptCount, 4)] ?? 60;
  return minutes * 60 * 1000;
}

export class OutboxRepository {
  constructor(private readonly db: Database) {}

  async insertProofWithOutbox(input: {
    marker: string;
    correlationId: string;
    actorAccountId?: string | null;
  }): Promise<{ event: OutboxEventRecord }> {
    return this.db.transaction(async (tx) => {
      const eventId = crypto.randomUUID();
      const [event] = await tx
        .insert(outboxEvents)
        .values({
          id: eventId,
          eventType: "system.outbox_proof",
          eventVersion: 1,
          aggregateType: "system",
          aggregateId: input.marker,
          actorAccountId: input.actorAccountId ?? null,
          correlationId: input.correlationId,
          payload: { marker: input.marker },
          status: "pending",
        })
        .returning();

      return { event };
    });
  }

  async claimPendingBatch(
    claimedBy: string,
    limit = OUTBOX_CLAIM_BATCH_SIZE,
  ): Promise<OutboxEventRecord[]> {
    const now = new Date();
    const result = await this.db.execute(sql`
      update outbox_events as o
      set
        status = 'claimed',
        claimed_at = ${now},
        claimed_by = ${claimedBy}
      from (
        select id
        from outbox_events
        where status in ('pending', 'failed')
          and available_at <= ${now}
        order by available_at asc
        limit ${limit}
        for update skip locked
      ) as sub
      where o.id = sub.id
      returning
        o.id,
        o.event_type,
        o.event_version,
        o.aggregate_type,
        o.aggregate_id,
        o.organisation_id,
        o.actor_account_id,
        o.correlation_id,
        o.payload,
        o.status,
        o.attempt_count,
        o.available_at,
        o.claimed_at,
        o.claimed_by,
        o.last_error_category,
        o.last_error_at,
        o.created_at,
        o.published_at
    `);

    const rows = result.rows as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      eventVersion: Number(row.event_version),
      aggregateType: String(row.aggregate_type),
      aggregateId: String(row.aggregate_id),
      organisationId: (row.organisation_id as string | null) ?? null,
      actorAccountId: (row.actor_account_id as string | null) ?? null,
      correlationId: (row.correlation_id as string | null) ?? null,
      payload: (row.payload as Record<string, unknown>) ?? {},
      status: String(row.status),
      attemptCount: Number(row.attempt_count),
      availableAt: new Date(String(row.available_at)),
      claimedAt: row.claimed_at ? new Date(String(row.claimed_at)) : null,
      claimedBy: (row.claimed_by as string | null) ?? null,
      lastErrorCategory: (row.last_error_category as string | null) ?? null,
      lastErrorAt: row.last_error_at
        ? new Date(String(row.last_error_at))
        : null,
      createdAt: new Date(String(row.created_at)),
      publishedAt: row.published_at
        ? new Date(String(row.published_at))
        : null,
    }));
  }

  async markPublished(eventId: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: "published",
        publishedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        lastErrorCategory: null,
        lastErrorAt: null,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async markPublishFailure(eventId: string, category: string): Promise<void> {
    const [current] = await this.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, eventId))
      .limit(1);

    if (!current) {
      return;
    }

    const attemptCount = current.attemptCount + 1;
    if (attemptCount >= OUTBOX_MAX_ATTEMPTS) {
      await this.db
        .update(outboxEvents)
        .set({
          status: "dead_lettered",
          attemptCount,
          lastErrorCategory: category,
          lastErrorAt: new Date(),
          claimedAt: null,
          claimedBy: null,
        })
        .where(eq(outboxEvents.id, eventId));
      return;
    }

    await this.db
      .update(outboxEvents)
      .set({
        status: "failed",
        attemptCount,
        availableAt: new Date(Date.now() + backoffMs(attemptCount)),
        lastErrorCategory: category,
        lastErrorAt: new Date(),
        claimedAt: null,
        claimedBy: null,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async recoverAbandonedClaims(
    olderThan = new Date(Date.now() - OUTBOX_ABANDONED_CLAIM_MS),
  ): Promise<number> {
    const result = await this.db
      .update(outboxEvents)
      .set({
        status: "pending",
        claimedAt: null,
        claimedBy: null,
        availableAt: new Date(),
      })
      .where(
        and(
          eq(outboxEvents.status, "claimed"),
          lt(outboxEvents.claimedAt, olderThan),
        ),
      )
      .returning({ id: outboxEvents.id });

    return result.length;
  }

  async findById(eventId: string): Promise<OutboxEventRecord | null> {
    const [event] = await this.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, eventId))
      .limit(1);
    return event ?? null;
  }

  async hasProcessed(eventId: string, consumerName: string): Promise<boolean> {
    const [row] = await this.db
      .select({ eventId: processedEvents.eventId })
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async applyProofEffect(input: {
    eventId: string;
    consumerName: string;
    eventType: string;
    eventVersion: number;
    marker: string;
  }): Promise<{ created: boolean }> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ eventId: processedEvents.eventId })
        .from(processedEvents)
        .where(
          and(
            eq(processedEvents.eventId, input.eventId),
            eq(processedEvents.consumerName, input.consumerName),
          ),
        )
        .limit(1);

      if (existing) {
        return { created: false };
      }

      await tx.insert(outboxProofEffects).values({
        eventId: input.eventId,
        marker: input.marker,
      });

      await tx.insert(processedEvents).values({
        eventId: input.eventId,
        consumerName: input.consumerName,
        eventType: input.eventType,
        eventVersion: input.eventVersion,
      });

      return { created: true };
    });
  }

  async recordDeadLetter(input: {
    eventId: string;
    consumerName: string;
    eventType: string;
    eventVersion: number;
    failureCategory: string;
    attemptCount: number;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(deadLetterEvents).values({
      eventId: input.eventId,
      consumerName: input.consumerName,
      eventType: input.eventType,
      eventVersion: input.eventVersion,
      failureCategory: input.failureCategory,
      attemptCount: input.attemptCount,
      payload: input.payload ?? null,
      resolutionState: "open",
    });
  }

  async countProofEffects(eventId: string): Promise<number> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(outboxProofEffects)
      .where(eq(outboxProofEffects.eventId, eventId));
    return row?.count ?? 0;
  }

  async listOpenDeadLetters(limit = 20) {
    return this.db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.resolutionState, "open"))
      .limit(limit);
  }

  async listDueEvents(limit = 5) {
    return this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          or(
            eq(outboxEvents.status, "pending"),
            eq(outboxEvents.status, "failed"),
          ),
          lte(outboxEvents.availableAt, new Date()),
        ),
      )
      .limit(limit);
  }
}
