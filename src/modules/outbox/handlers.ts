import { createDatabaseClient } from "../../platform/database/client";
import { logError, logInfo } from "../../platform/logging/logger";
import type { ApiBindings } from "../../workers/api/types";
import { OutboxProofConsumer } from "./consumer";
import { OutboxPublisher } from "./publisher";
import { OutboxRepository } from "./repository";
import { OutboxService } from "./service";

export async function handleDomainEventsQueue(
  batch: MessageBatch<unknown>,
  env: ApiBindings,
): Promise<void> {
  const client = createDatabaseClient(env.DATABASE_URL);

  try {
    const consumer = new OutboxProofConsumer(new OutboxRepository(client.db));

    for (const message of batch.messages) {
      const attempts = message.attempts ?? 1;
      const result = await consumer.handleMessage(message.body, attempts);

      if (result === "ack") {
        message.ack();
        continue;
      }

      if (result === "dead_letter") {
        message.ack();
        logError({
          event: "outbox.consumer.dead_lettered",
          errorCategory: "dead_letter",
        });
        continue;
      }

      message.retry();
    }
  } finally {
    await client.close();
  }
}

export async function handleOutboxScheduled(
  env: ApiBindings,
): Promise<void> {
  if (!env.DOMAIN_EVENTS_QUEUE) {
    logError({
      event: "outbox.scheduled.queue_missing",
      errorCategory: "configuration",
    });
    return;
  }

  const client = createDatabaseClient(env.DATABASE_URL);

  try {
    const repository = new OutboxRepository(client.db);
    const publisher = new OutboxPublisher(
      repository,
      {
        send: async (message) => env.DOMAIN_EVENTS_QUEUE!.send(message),
      },
      "cron:outbox-recovery",
    );
    const service = new OutboxService(repository, publisher);
    const result = await service.runScheduledMaintenance();

    logInfo({
      event: "outbox.scheduled.completed",
      status: 200,
      issues: [
        { path: "recovered", code: String(result.recovered) },
        { path: "published", code: String(result.published) },
        { path: "failed", code: String(result.failed) },
      ],
    });
  } finally {
    await client.close();
  }
}
