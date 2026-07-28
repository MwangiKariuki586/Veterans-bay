# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/04-trust-retention.md`

## Active Feature

Feature 04.01 — Invoices and Manual Payment Records

## Status

`NOT STARTED`

## Current Step

Verify the completed-job, transaction, financial-permission, and private-evidence foundations required for auditable invoices and manual payment records.

## Next Step

Inspect the completed job commercial snapshots and existing money/permission patterns, then begin the invoice and payment schema.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`
- `Phase 01 — Establish the Professional Marketplace`
- `Phase 02 — Enable Request-to-Booking Commerce`
- `Phase 03 — Enable Service Fulfilment`

## Completed Features in Active Phase

None.

## Dependencies

- Phase 00 identity, workspace, database, and private-storage foundations verified
- Dedicated `Veterans bay` Neon database configured and migrated through `0022_omniscient_squadron_supreme`
- Phase 01 marketplace, organisation, service catalogue, moderation, and discovery foundations verified
- Feature 02.01 request context, participant authorization, private attachments, transactional history, outbox events, and expiry lifecycle verified
- Feature 02.02 participant-derived conversations, role-sensitive unread state, immutable engagement activity, and private attachment authorization verified
- Feature 02.03 immutable quotation versions, participant-scoped decisions, server-authoritative totals, transactional acceptance, booking/payment foundations, and quotation expiry verified
- Feature 02.04 conflict-safe reservations, working hours, unavailable periods, all five booking origins, assignments, lifecycle history, participant views, direct/repeat booking entry, calendars, and deposit-gated confirmation verified
- Feature 02.05 idempotent Queue consumption, permission-derived recipient resolution, safe internal targets, unread state, retry/dead-letter handling, and client/professional notification-centre integration verified
- Phase 03 idempotent job creation, assignment history, field execution, checklists, evidence, variations, commercial snapshots, client completion, unresolved-work handling, conversations, timeline, and notification coverage verified
- Phase 04 can build invoices from completed job commercial snapshots and the existing transaction, permission, outbox, and private-evidence foundations

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for Feature 04.01.

## Verification State

Phase 03 is complete. Confirmed bookings create idempotent jobs with assignment history and immutable commercial snapshots; authorised field execution, checklists, evidence, variations, client completion, unresolved-work handling, job conversations, timeline, and notifications are verified. Automatic completion remains intentionally disabled pending an approved visible policy. Migration `0022_omniscient_squadron_supreme` is applied and Drizzle validation passes. Typecheck, lint, 71 UI tests, 134 Worker tests, and all 29 database tests are covered; the initial full database run exposed one cleanup dependency and one timeout threshold, and both affected files passed after correction. Next.js production build, Cloudflare Worker dry-run, and authenticated professional/client desktop/mobile browser review pass without page-level horizontal overflow.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
