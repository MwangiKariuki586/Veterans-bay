import { createDatabaseClient } from "../../platform/database/client";
import { logError, logInfo } from "../../platform/logging/logger";
import { domainEventEnvelopeSchema } from "../../platform/events/contracts";
import { OUTBOX_PROOF_CONSUMER } from "../../platform/events/contracts";
import type { ApiBindings } from "../../workers/api/types";
import { ServiceRequestExpiryService } from "../service-requests/expiry";
import { ServiceRequestsRepository } from "../service-requests/repository";
import { QuotationExpiryService } from "../quotations/expiry";
import { QuotationsRepository } from "../quotations/repository";
import { NotificationConsumer } from "../notifications/consumer";
import { NOTIFICATION_CONSUMER } from "../notifications/repository";
import { JobCompletionScheduledService } from "../jobs/completion-policy";
import { NotificationsRepository } from "../notifications/repository";
import { OutboxProofConsumer } from "./consumer";
import { OutboxPublisher } from "./publisher";
import { OutboxRepository } from "./repository";
import { OutboxService } from "./service";
import { ReputationConsumer } from "../reviews/consumer";
import {
  REPUTATION_CONSUMER,
  ReviewsRepository,
} from "../reviews/repository";
import { ServiceRemindersRepository } from "../service-reminders/repository";
import {
  ANALYTICS_CONSUMER,
  AnalyticsConsumer,
  isAnalyticsSourceEvent,
} from "../analytics/consumer";

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
      outboxRepository,
    );
    const analyticsConsumer = new AnalyticsConsumer(
      client.db,
      outboxRepository,
    );

    for (const message of batch.messages) {
      const startedAt = Date.now();
      const attempts = message.attempts ?? 1;
      const parsed = domainEventEnvelopeSchema.safeParse(message.body);
      const consumerName =
        parsed.success && parsed.data.eventType === "system.outbox_proof"
          ? OUTBOX_PROOF_CONSUMER
          : parsed.success &&
              parsed.data.eventType === "reputation.recalculation_requested"
            ? REPUTATION_CONSUMER
            : NOTIFICATION_CONSUMER;
      const result =
        consumerName === OUTBOX_PROOF_CONSUMER
          ? await proofConsumer.handleMessage(message.body, attempts)
          : consumerName === REPUTATION_CONSUMER
            ? await reputationConsumer.handleMessage(message.body, attempts)
            : await notificationConsumer.handleMessage(message.body, attempts);

      if (parsed.success) {
        await outboxRepository.recordProcessingAttempt({
          eventId: parsed.data.eventId,
          consumerName,
          eventType: parsed.data.eventType,
          attemptNumber: attempts,
          outcome: result,
          durationMs: Date.now() - startedAt,
        });
      }

      let analyticsResult:
        | "ack"
        | "duplicate"
        | "retry"
        | "dead_letter"
        | null = null;
      if (parsed.success && isAnalyticsSourceEvent(parsed.data.eventType)) {
        const analyticsStartedAt = Date.now();
        analyticsResult = await analyticsConsumer.handleMessage(
          message.body,
          attempts,
        );
        await outboxRepository.recordProcessingAttempt({
          eventId: parsed.data.eventId,
          consumerName: ANALYTICS_CONSUMER,
          eventType: parsed.data.eventType,
          attemptNumber: attempts,
          outcome: analyticsResult,
          durationMs: Date.now() - analyticsStartedAt,
        });
      }

      if (result === "retry" || analyticsResult === "retry") {
        message.retry();
        continue;
      }

      if (
        result === "ack" ||
        result === "duplicate" ||
        result === "dead_letter"
      ) {
        message.ack();
        if (result === "dead_letter" || analyticsResult === "dead_letter") {
          logError({
            event: "outbox.consumer.dead_lettered",
            errorCategory: "dead_letter",
          });
        }
        continue;
      }
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
