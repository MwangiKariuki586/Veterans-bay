import type { DomainEventEnvelope } from "../../platform/events/contracts";
import type { OutboxEventRecord, OutboxRepository } from "./repository";

export interface DomainEventsQueue {
  send(message: DomainEventEnvelope): Promise<unknown>;
}

export function toDomainEventEnvelope(
  event: OutboxEventRecord,
): DomainEventEnvelope {
  return {
    eventId: event.id,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    organisationId: event.organisationId,
    actorAccountId: event.actorAccountId,
    correlationId: event.correlationId,
    occurredAt: event.createdAt.toISOString(),
    payload: event.payload,
  };
}

export class OutboxPublisher {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly queue: DomainEventsQueue,
    private readonly publisherId: string,
  ) {}

  async publishPending(): Promise<{ claimed: number; published: number; failed: number }> {
    const claimed = await this.repository.claimPendingBatch(this.publisherId);
    let published = 0;
    let failed = 0;

    for (const event of claimed) {
      try {
        await this.queue.send(toDomainEventEnvelope(event));
        await this.repository.markPublished(event.id);
        published += 1;
      } catch {
        await this.repository.markPublishFailure(event.id, "queue_publish_failed");
        failed += 1;
      }
    }

    return { claimed: claimed.length, published, failed };
  }

  async recoverAbandonedClaims(): Promise<{ recovered: number }> {
    const recovered = await this.repository.recoverAbandonedClaims();
    return { recovered };
  }
}
