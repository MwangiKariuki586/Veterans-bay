import {
  domainEventEnvelopeSchema,
  isSupportedOutboxProofEvent,
  OUTBOX_PROOF_CONSUMER,
  outboxProofPayloadSchema,
} from "../../platform/events/contracts";
import type { OutboxRepository } from "./repository";

export class OutboxProofConsumer {
  constructor(private readonly repository: OutboxRepository) {}

  async handleMessage(
    raw: unknown,
    attemptCount = 1,
  ): Promise<"ack" | "duplicate" | "retry" | "dead_letter"> {
    const parsed = domainEventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      return "dead_letter";
    }

    const envelope = parsed.data;

    if (
      envelope.eventType !== "system.outbox_proof"
    ) {
      // Other domain events are published on the same queue; this PoC consumer
      // acknowledges them without side effects so feature consumers can own them later.
      return "ack";
    }

    if (!isSupportedOutboxProofEvent(envelope.eventType, envelope.eventVersion)) {
      await this.repository.recordDeadLetter({
        eventId: envelope.eventId,
        consumerName: OUTBOX_PROOF_CONSUMER,
        eventType: envelope.eventType,
        eventVersion: envelope.eventVersion,
        failureCategory: "unsupported_event_version",
        attemptCount,
        payload: envelope.payload,
      });
      return "dead_letter";
    }

    const payload = outboxProofPayloadSchema.safeParse(envelope.payload);
    if (!payload.success) {
      await this.repository.recordDeadLetter({
        eventId: envelope.eventId,
        consumerName: OUTBOX_PROOF_CONSUMER,
        eventType: envelope.eventType,
        eventVersion: envelope.eventVersion,
        failureCategory: "invalid_payload",
        attemptCount,
        payload: envelope.payload,
      });
      return "dead_letter";
    }

    try {
      const result = await this.repository.applyProofEffect({
        eventId: envelope.eventId,
        consumerName: OUTBOX_PROOF_CONSUMER,
        eventType: envelope.eventType,
        eventVersion: envelope.eventVersion,
        marker: payload.data.marker,
      });
      return result.created ? "ack" : "duplicate";
    } catch {
      if (attemptCount >= 5) {
        await this.repository.recordDeadLetter({
          eventId: envelope.eventId,
          consumerName: OUTBOX_PROOF_CONSUMER,
          eventType: envelope.eventType,
          eventVersion: envelope.eventVersion,
          failureCategory: "consumer_failed",
          attemptCount,
          payload: envelope.payload,
        });
        return "dead_letter";
      }
      return "retry";
    }
  }
}
