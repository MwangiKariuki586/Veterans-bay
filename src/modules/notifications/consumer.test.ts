import { describe, expect, it, vi } from "vitest";

import type { DomainEventEnvelope } from "../../platform/events/contracts";
import { NotificationConsumer } from "./consumer";
import { NOTIFICATION_CONSUMER } from "./repository";

function envelope(
  overrides: Partial<DomainEventEnvelope> = {},
): DomainEventEnvelope {
  return {
    eventId: "00000000-0000-4000-8000-000000000050",
    eventType: "booking.confirmed",
    eventVersion: 1,
    aggregateType: "booking",
    aggregateId: "00000000-0000-4000-8000-000000000051",
    organisationId: "00000000-0000-4000-8000-000000000052",
    actorAccountId: "00000000-0000-4000-8000-000000000053",
    correlationId: "notification-test",
    occurredAt: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

describe("notification consumer", () => {
  it("acknowledges supported events after the idempotent store commits", async () => {
    const repository = {
      consume: vi.fn().mockResolvedValue({ created: 1, duplicate: false }),
      recordFailureEvent: vi.fn(),
    };
    const outbox = { recordDeadLetter: vi.fn() };
    const consumer = new NotificationConsumer(repository, outbox);

    await expect(consumer.handleMessage(envelope())).resolves.toBe("ack");
    expect(repository.consume).toHaveBeenCalledOnce();
    expect(outbox.recordDeadLetter).not.toHaveBeenCalled();
  });

  it("ignores unrelated events without creating side effects", async () => {
    const repository = {
      consume: vi.fn(),
      recordFailureEvent: vi.fn(),
    };
    const outbox = { recordDeadLetter: vi.fn() };
    const consumer = new NotificationConsumer(repository, outbox);

    await expect(
      consumer.handleMessage(
        envelope({ eventType: "engagement.activity_recorded" }),
      ),
    ).resolves.toBe("ack");
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it("retries transient failure and records the terminal failure once", async () => {
    const repository = {
      consume: vi.fn().mockRejectedValue(new Error("temporary database error")),
      recordFailureEvent: vi.fn().mockResolvedValue(undefined),
    };
    const outbox = {
      recordDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const consumer = new NotificationConsumer(repository, outbox);

    await expect(consumer.handleMessage(envelope(), 4)).resolves.toBe("retry");
    await expect(consumer.handleMessage(envelope(), 5)).resolves.toBe(
      "dead_letter",
    );
    expect(outbox.recordDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerName: NOTIFICATION_CONSUMER,
        failureCategory: "consumer_failed",
        attemptCount: 5,
      }),
    );
    expect(repository.recordFailureEvent).toHaveBeenCalledOnce();
  });

  it("dead-letters an unsupported version without attempting its effect", async () => {
    const repository = {
      consume: vi.fn(),
      recordFailureEvent: vi.fn().mockResolvedValue(undefined),
    };
    const outbox = {
      recordDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const consumer = new NotificationConsumer(repository, outbox);

    await expect(
      consumer.handleMessage(envelope({ eventVersion: 2 }), 1),
    ).resolves.toBe("dead_letter");
    expect(repository.consume).not.toHaveBeenCalled();
    expect(outbox.recordDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCategory: "unsupported_event_version",
      }),
    );
  });

  it("rejects an invalid envelope without trusting its payload", async () => {
    const repository = {
      consume: vi.fn(),
      recordFailureEvent: vi.fn(),
    };
    const outbox = { recordDeadLetter: vi.fn() };
    const consumer = new NotificationConsumer(repository, outbox);

    await expect(
      consumer.handleMessage({ eventType: "booking.confirmed" }),
    ).resolves.toBe("dead_letter");
    expect(repository.consume).not.toHaveBeenCalled();
    expect(outbox.recordDeadLetter).not.toHaveBeenCalled();
  });
});
