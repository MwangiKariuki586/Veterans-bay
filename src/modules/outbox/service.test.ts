import { describe, expect, it, vi } from "vitest";

import { OutboxProofConsumer } from "./consumer";
import { OutboxPublisher } from "./publisher";
import type { OutboxRepository } from "./repository";

describe("OutboxProofConsumer", () => {
  it("acks duplicate deliveries after one effect", async () => {
    const repository = {
      applyProofEffect: vi
        .fn()
        .mockResolvedValueOnce({ created: true })
        .mockResolvedValueOnce({ created: false }),
      recordDeadLetter: vi.fn(),
    } as unknown as OutboxRepository;
    const consumer = new OutboxProofConsumer(repository);

    const message = {
      eventId: "11111111-1111-4111-8111-111111111111",
      eventType: "system.outbox_proof",
      eventVersion: 1,
      aggregateType: "system",
      aggregateId: "marker-1",
      occurredAt: new Date().toISOString(),
      payload: { marker: "marker-1" },
    };

    await expect(consumer.handleMessage(message)).resolves.toBe("ack");
    await expect(consumer.handleMessage(message)).resolves.toBe("ack");
    expect(repository.applyProofEffect).toHaveBeenCalledTimes(2);
  });

  it("dead-letters unsupported proof event versions", async () => {
    const repository = {
      applyProofEffect: vi.fn(),
      recordDeadLetter: vi.fn(),
    } as unknown as OutboxRepository;
    const consumer = new OutboxProofConsumer(repository);

    await expect(
      consumer.handleMessage({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventType: "system.outbox_proof",
        eventVersion: 99,
        aggregateType: "system",
        aggregateId: "marker-1",
        occurredAt: new Date().toISOString(),
        payload: { marker: "marker-1" },
      }),
    ).resolves.toBe("dead_letter");

    expect(repository.recordDeadLetter).toHaveBeenCalled();
  });

  it("acks unrelated domain events without side effects", async () => {
    const repository = {
      applyProofEffect: vi.fn(),
      recordDeadLetter: vi.fn(),
    } as unknown as OutboxRepository;
    const consumer = new OutboxProofConsumer(repository);

    await expect(
      consumer.handleMessage({
        eventId: "11111111-1111-4111-8111-111111111111",
        eventType: "attachment.added",
        eventVersion: 1,
        aggregateType: "account_profile",
        aggregateId: "profile-1",
        occurredAt: new Date().toISOString(),
        payload: { assetId: "a" },
      }),
    ).resolves.toBe("ack");

    expect(repository.applyProofEffect).not.toHaveBeenCalled();
    expect(repository.recordDeadLetter).not.toHaveBeenCalled();
  });
});

describe("OutboxPublisher", () => {
  it("marks published events and records publish failures", async () => {
    const events = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        eventType: "system.outbox_proof",
        eventVersion: 1,
        aggregateType: "system",
        aggregateId: "a",
        organisationId: null,
        actorAccountId: null,
        correlationId: "c",
        payload: { marker: "a" },
        status: "claimed",
        attemptCount: 0,
        availableAt: new Date(),
        claimedAt: new Date(),
        claimedBy: "publisher",
        lastErrorCategory: null,
        lastErrorAt: null,
        createdAt: new Date(),
        publishedAt: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        eventType: "system.outbox_proof",
        eventVersion: 1,
        aggregateType: "system",
        aggregateId: "b",
        organisationId: null,
        actorAccountId: null,
        correlationId: "c",
        payload: { marker: "b" },
        status: "claimed",
        attemptCount: 0,
        availableAt: new Date(),
        claimedAt: new Date(),
        claimedBy: "publisher",
        lastErrorCategory: null,
        lastErrorAt: null,
        createdAt: new Date(),
        publishedAt: null,
      },
    ];

    const repository = {
      claimPendingBatch: vi.fn().mockResolvedValue(events),
      markPublished: vi.fn(),
      markPublishFailure: vi.fn(),
    } as unknown as OutboxRepository;

    const queue = {
      send: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("queue down")),
    };

    const publisher = new OutboxPublisher(repository, queue, "test-publisher");
    const result = await publisher.publishPending();

    expect(result).toEqual({ claimed: 2, published: 1, failed: 1 });
    expect(repository.markPublished).toHaveBeenCalledWith(events[0]!.id);
    expect(repository.markPublishFailure).toHaveBeenCalledWith(
      events[1]!.id,
      "queue_publish_failed",
    );
  });
});
