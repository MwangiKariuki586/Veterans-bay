import { z } from "zod";

export const OUTBOX_PROOF_EVENT_TYPE = "system.outbox_proof" as const;
export const OUTBOX_PROOF_EVENT_VERSION = 1 as const;
export const OUTBOX_PROOF_CONSUMER = "outbox-proof-consumer" as const;

export const domainEventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string().min(1).max(120),
  eventVersion: z.number().int().positive(),
  aggregateType: z.string().min(1).max(80),
  aggregateId: z.string().min(1).max(120),
  organisationId: z.uuid().nullable().optional(),
  actorAccountId: z.uuid().nullable().optional(),
  correlationId: z.string().min(1).max(120).nullable().optional(),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

export const outboxProofPayloadSchema = z.object({
  marker: z.string().min(1).max(120),
});

export type OutboxProofPayload = z.infer<typeof outboxProofPayloadSchema>;

export function isSupportedOutboxProofEvent(
  eventType: string,
  eventVersion: number,
): boolean {
  return (
    eventType === OUTBOX_PROOF_EVENT_TYPE &&
    eventVersion === OUTBOX_PROOF_EVENT_VERSION
  );
}
