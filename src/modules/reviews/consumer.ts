import { domainEventEnvelopeSchema } from "../../platform/events/contracts";
import type { ReviewsRepository } from "./repository";

export class ReputationConsumer {
  constructor(private readonly repository: ReviewsRepository) {}
  async handleMessage(raw: unknown, attemptCount = 1): Promise<"ack" | "retry" | "dead_letter"> {
    const parsed = domainEventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) return "dead_letter";
    if (parsed.data.eventType !== "reputation.recalculation_requested") return "ack";
    if (parsed.data.eventVersion !== 1) return "dead_letter";
    try { await this.repository.consumeRecalculation(parsed.data); return "ack"; }
    catch { return attemptCount < 5 ? "retry" : "dead_letter"; }
  }
}
