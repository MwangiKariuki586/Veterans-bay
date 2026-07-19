import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { OutboxProofConsumer } from "../../modules/outbox/consumer";
import { OutboxRepository } from "../../modules/outbox/repository";
import { outboxProofEffects } from "./schema/consumer-events";
import { withTestDatabase } from "./testing/helpers";

describe("outbox consumer foundation", () => {
  it("applies one proof effect for duplicate deliveries", async () => {
    await withTestDatabase(async ({ db }) => {
      const repository = new OutboxRepository(db);
      const consumer = new OutboxProofConsumer(repository);
      const eventId = crypto.randomUUID();
      const message = {
        eventId,
        eventType: "system.outbox_proof",
        eventVersion: 1,
        aggregateType: "system",
        aggregateId: "marker-db",
        occurredAt: new Date().toISOString(),
        payload: { marker: "marker-db" },
      };

      await expect(consumer.handleMessage(message)).resolves.toBe("ack");
      await expect(consumer.handleMessage(message)).resolves.toBe("ack");

      const effects = await db
        .select()
        .from(outboxProofEffects)
        .where(eq(outboxProofEffects.eventId, eventId));

      expect(effects).toHaveLength(1);
    });
  });
});
