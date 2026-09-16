import { sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import {
  analyticsDailyCounts,
  processedEvents,
} from "../../platform/database/schema/consumer-events";
import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
} from "../../platform/events/contracts";
import type { OutboxRepository } from "../outbox/repository";

export const ANALYTICS_CONSUMER = "analytics-projection-consumer";
export const analyticsSourceEvents = [
  "service_request.submitted",
  "quotation.accepted",
  "booking.confirmed",
  "job.completed",
  "review.submitted",
] as const;

export class AnalyticsConsumer {
  constructor(
    private readonly db: Database,
    private readonly outboxRepository: Pick<OutboxRepository, "recordDeadLetter">,
  ) {}

  async handleMessage(
    raw: unknown,
    attemptCount = 1,
  ): Promise<"ack" | "duplicate" | "retry" | "dead_letter"> {
    const parsed = domainEventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) return "dead_letter";
    const event = parsed.data;
    if (!isAnalyticsSourceEvent(event.eventType)) return "ack";
    if (event.eventVersion !== 1) {
      await this.deadLetter(event, attemptCount, "unsupported_event_version");
      return "dead_letter";
    }
    try {
      const duplicate = await this.consume(event);
      return duplicate ? "duplicate" : "ack";
    } catch {
      if (attemptCount < 5) return "retry";
      await this.deadLetter(event, attemptCount, "consumer_failed");
      return "dead_letter";
    }
  }

  private async consume(event: DomainEventEnvelope) {
    return this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .insert(processedEvents)
        .values({
          eventId: event.eventId,
          consumerName: ANALYTICS_CONSUMER,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
        })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });
      if (!claimed) return true;
      const day = event.occurredAt.slice(0, 10);
      const scopeKey = event.organisationId ?? "platform";
      await tx
        .insert(analyticsDailyCounts)
        .values({
          day,
          eventType: event.eventType,
          organisationId: event.organisationId ?? null,
          scopeKey,
          eventCount: 1,
        })
        .onConflictDoUpdate({
          target: [
            analyticsDailyCounts.day,
            analyticsDailyCounts.eventType,
            analyticsDailyCounts.scopeKey,
          ],
          set: {
            eventCount: sql`${analyticsDailyCounts.eventCount} + 1`,
            updatedAt: new Date(),
          },
        });
      return false;
    });
  }

  private async deadLetter(
    event: DomainEventEnvelope,
    attemptCount: number,
    failureCategory: string,
  ) {
    await this.outboxRepository.recordDeadLetter({
      eventId: event.eventId,
      consumerName: ANALYTICS_CONSUMER,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      failureCategory,
      attemptCount,
      payload: event.payload,
    });
  }
}

export function isAnalyticsSourceEvent(eventType: string) {
  return (analyticsSourceEvents as readonly string[]).includes(eventType);
}
