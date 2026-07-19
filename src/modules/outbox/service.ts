import type { OutboxPublisher } from "./publisher";
import type { OutboxRepository } from "./repository";

export class OutboxService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: OutboxPublisher,
  ) {}

  async createProofAndPublish(input: {
    marker?: string;
    correlationId: string;
    actorAccountId?: string | null;
  }) {
    const marker = input.marker ?? `proof-${crypto.randomUUID()}`;
    const { event } = await this.repository.insertProofWithOutbox({
      marker,
      correlationId: input.correlationId,
      actorAccountId: input.actorAccountId,
    });

    const publication = await this.publisher.publishPending();

    return {
      eventId: event.id,
      marker,
      publication,
    };
  }

  async runScheduledMaintenance() {
    const recovered = await this.publisher.recoverAbandonedClaims();
    const publication = await this.publisher.publishPending();
    return { ...recovered, ...publication };
  }
}
