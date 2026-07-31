import { domainEventEnvelopeSchema } from "../../platform/events/contracts";
import { REPUTATION_CONSUMER, type ReviewsRepository } from "./repository";
import type { OutboxRepository } from "../outbox/repository";

export class ReputationConsumer {
  constructor(
    private readonly repository: ReviewsRepository,
    private readonly outboxRepository: Pick<OutboxRepository, "recordDeadLetter">,
  ) {}
  async handleMessage(raw: unknown, attemptCount = 1): Promise<"ack" | "duplicate" | "retry" | "dead_letter"> {
    const parsed = domainEventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) return "dead_letter";
    if (parsed.data.eventType !== "reputation.recalculation_requested") return "ack";
    if (parsed.data.eventVersion !== 1) {
      await this.outboxRepository.recordDeadLetter({
        eventId: parsed.data.eventId,
        consumerName: REPUTATION_CONSUMER,
        eventType: parsed.data.eventType,
        eventVersion: parsed.data.eventVersion,
        failureCategory: "unsupported_event_version",
        attemptCount,
        payload: parsed.data.payload,
      });
      return "dead_letter";
    }
    try {
      const result = await this.repository.consumeRecalculation(parsed.data);
      return result.duplicate ? "duplicate" : "ack";
    } catch {
      if (attemptCount < 5) return "retry";
      await this.outboxRepository.recordDeadLetter({
        eventId: parsed.data.eventId,
        consumerName: REPUTATION_CONSUMER,
        eventType: parsed.data.eventType,
        eventVersion: parsed.data.eventVersion,
        failureCategory: "consumer_failed",
        attemptCount,
        payload: parsed.data.payload,
      });
      return "dead_letter";
    }
  }
}
