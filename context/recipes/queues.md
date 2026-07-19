# Queues and Outbox Recipe — Veterans Bay

## Load When

Working on domain events, outbox publication, Cloudflare Queues, consumers, retries, dead letters, scheduled work, notifications, reputation, or analytics.

## Flow

```txt
authoritative business action
→ business records + outbox in one transaction
→ commit
→ bounded publisher
→ Cloudflare Queue
→ idempotent consumer
```

## Event Envelope

Use a stable event ID, type, version, aggregate ID and type, relevant organisation or actor context, occurred-at timestamp, correlation ID, and minimal typed payload.

Retries retain the same event ID. Incompatible payload changes require a new version.

## Publication

- Claim bounded batches using database coordination.
- Recover abandoned claims.
- Use bounded observable backoff.
- Do not use in-memory locks as authority.

## Consumer Pattern

```txt
validate event and version
→ begin transaction
→ check eventId + consumerName
→ perform secondary effect
→ record processing
→ commit
→ acknowledge
```

The effect and idempotency record should commit together.

## Scheduled Work

PostgreSQL determines whether work is due. Cron may be delayed or repeated. Every scheduled action must be bounded, revalidated, idempotent, and observable.

## Dead Letters

Preserve event ID, type, version, consumer, safe failure category, attempts, timestamps, bounded payload or reference, and resolution state. Manual retry is authorised, traceable, and preserves the original event ID.

## Verification

Test atomicity, rollback, concurrent claims, abandoned recovery, publication retry, unsupported versions, duplicate and concurrent duplicate delivery, tenant isolation, partial failure, dead letters, manual retry, repeated Cron, bounded batches, and primary success despite async failure.
