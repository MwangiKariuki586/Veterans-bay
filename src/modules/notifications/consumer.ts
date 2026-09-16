import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
} from "../../platform/events/contracts";
import type { OutboxRepository } from "../outbox/repository";
import {
  NOTIFICATION_CONSUMER,
  notificationSourceEvents,
} from "./repository";

export interface NotificationConsumerStore {
  consume(
    event: DomainEventEnvelope,
  ): Promise<{ created: number; duplicate: boolean }>;
  recordFailureEvent(input: {
    event: DomainEventEnvelope;
    failureCategory: string;
  }): Promise<void>;
}

export class NotificationConsumer {
  constructor(
    private readonly repository: NotificationConsumerStore,
    private readonly outboxRepository: Pick<
      OutboxRepository,
      "recordDeadLetter"
    >,
  ) {}

  async handleMessage(
    raw: unknown,
    attemptCount = 1,
  ): Promise<"ack" | "duplicate" | "retry" | "dead_letter"> {
    const parsed = domainEventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) return "dead_letter";
    const event = parsed.data;
    if (!isNotificationSourceEvent(event.eventType)) return "ack";
    if (event.eventVersion !== 1) {
      await this.deadLetter(
        event,
        attemptCount,
        "unsupported_event_version",
      );
      return "dead_letter";
    }
    try {
      const result = await this.repository.consume(event);
      return result.duplicate ? "duplicate" : "ack";
    } catch {
      if (attemptCount < 5) return "retry";
      await this.deadLetter(event, attemptCount, "consumer_failed");
      return "dead_letter";
    }
  }

  private async deadLetter(
    event: DomainEventEnvelope,
    attemptCount: number,
    failureCategory: string,
  ) {
    await this.outboxRepository.recordDeadLetter({
      eventId: event.eventId,
      consumerName: NOTIFICATION_CONSUMER,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      failureCategory,
      attemptCount,
      payload: event.payload,
    });
    await this.repository.recordFailureEvent({
      event,
      failureCategory,
    });
  }
}

export function isNotificationSourceEvent(eventType: string) {
  return (notificationSourceEvents as readonly string[]).includes(eventType);
}
