import { createDatabaseClient } from "../../platform/database/client";
import { logError, logInfo } from "../../platform/logging/logger";
import { domainEventEnvelopeSchema } from "../../platform/events/contracts";
import type { ApiBindings } from "../../workers/api/types";
import { ServiceRequestExpiryService } from "../service-requests/expiry";
import { ServiceRequestsRepository } from "../service-requests/repository";
import { QuotationExpiryService } from "../quotations/expiry";
import { QuotationsRepository } from "../quotations/repository";
import { NotificationConsumer } from "../notifications/consumer";
import { JobCompletionScheduledService } from "../jobs/completion-policy";
import { NotificationsRepository } from "../notifications/repository";
import { OutboxProofConsumer } from "./consumer";
import { OutboxPublisher } from "./publisher";
import { OutboxRepository } from "./repository";
import { OutboxService } from "./service";
import { ReputationConsumer } from "../reviews/consumer";
import { ReviewsRepository } from "../reviews/repository";
import { ServiceRemindersRepository } from "../service-reminders/repository";

export async function handleDomainEventsQueue(
  batch: MessageBatch<unknown>,
  env: ApiBindings,
): Promise<void> {
  const client = createDatabaseClient(env.DATABASE_URL);

  try {
    const outboxRepository = new OutboxRepository(client.db);
    const proofConsumer = new OutboxProofConsumer(outboxRepository);
    const notificationConsumer = new NotificationConsumer(
      new NotificationsRepository(client.db),
      outboxRepository,
    );
    const reputationConsumer = new ReputationConsumer(
      new ReviewsRepository(client.db),
    );

    for (const message of batch.messages) {
      const attempts = message.attempts ?? 1;
      const parsed = domainEventEnvelopeSchema.safeParse(message.body);
      const result =
        parsed.success && parsed.data.eventType === "system.outbox_proof"
          ? await proofConsumer.handleMessage(message.body, attempts)
          : parsed.success && parsed.data.eventType === "reputation.recalculation_requested"
            ? await reputationConsumer.handleMessage(message.body, attempts)
            : await notificationConsumer.handleMessage(message.body, attempts);

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
  const client = createDatabaseClient(env.DATABASE_URL);

  try {
    const expiryResult = await new ServiceRequestExpiryService(
      new ServiceRequestsRepository(client.db),
    ).runScheduledExpiry();
    logInfo({
      event: "service_request.expiry_scheduled.completed",
      status: 200,
      issues: [
        { path: "expired", code: String(expiryResult.expired) },
        { path: "batchSize", code: "50" },
      ],
    });
    const quotationExpiryResult = await new QuotationExpiryService(
      new QuotationsRepository(client.db),
    ).runScheduledExpiry();
    logInfo({
      event: "quotation.expiry_scheduled.completed",
      status: 200,
      issues: [
        { path: "expired", code: String(quotationExpiryResult.expired) },
        { path: "batchSize", code: "50" },
      ],
    });
    const completionResult = await new JobCompletionScheduledService().run();
    logInfo({
      event: "job.completion_scheduled.completed",
      status: 200,
      issues: [
        { path: "enabled", code: String(completionResult.enabled) },
        { path: "completed", code: String(completionResult.completed) },
      ],
    });
    const reminderCount = await new ServiceRemindersRepository(
      client.db,
    ).dispatchDue();
    logInfo({
      event: "service_reminder.scheduled.completed",
      status: 200,
      issues: [{ path: "dispatched", code: String(reminderCount) }],
    });

    if (!env.DOMAIN_EVENTS_QUEUE) {
      logError({
        event: "outbox.scheduled.queue_missing",
        errorCategory: "configuration",
      });
      return;
    }

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
