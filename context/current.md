# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/03-service-fulfilment.md`

## Active Feature

Feature 03.01 — Job Creation and Assignment

## Status

`NOT STARTED`

## Current Step

Verify Feature 03.01 prerequisites against the completed booking, team-permission, event, and database foundations.

## Next Step

Inspect the existing booking snapshots and team assignment patterns, then begin the idempotent job-creation schema and workflow.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`
- `Phase 01 — Establish the Professional Marketplace`
- `Phase 02 — Enable Request-to-Booking Commerce`

## Completed Features in Active Phase

None.

## Dependencies

- Phase 00 identity, workspace, database, and private-storage foundations verified
- Dedicated `Veterans bay` Neon database configured and migrated through `0021_cool_northstar`
- Phase 01 marketplace, organisation, service catalogue, moderation, and discovery foundations verified
- Feature 02.01 request context, participant authorization, private attachments, transactional history, outbox events, and expiry lifecycle verified
- Feature 02.02 participant-derived conversations, role-sensitive unread state, immutable engagement activity, and private attachment authorization verified
- Feature 02.03 immutable quotation versions, participant-scoped decisions, server-authoritative totals, transactional acceptance, booking/payment foundations, and quotation expiry verified
- Feature 02.04 conflict-safe reservations, working hours, unavailable periods, all five booking origins, assignments, lifecycle history, participant views, direct/repeat booking entry, calendars, and deposit-gated confirmation verified
- Feature 02.05 idempotent Queue consumption, permission-derived recipient resolution, safe internal targets, unread state, retry/dead-letter handling, and client/professional notification-centre integration verified
- Phase 03 can build jobs from confirmed booking snapshots and the existing organisation membership and permission foundations

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for Feature 03.01.

## Verification State

Phase 02 is complete. Requests, contextual conversations, immutable quotation versions, transactional acceptance, all five booking origins, conflict-safe scheduling, and asynchronous in-app notifications are verified end to end. Migrations through `0021_cool_northstar` are applied and replay cleanly. Typecheck, lint, Drizzle validation, 68 UI tests, 131 Worker tests, and 27 database tests pass; the full database run had one transient Neon disconnect during an unchanged rollback assertion, and that exact test passed immediately on isolated rerun. Next.js production build, Cloudflare Worker dry-run, notification consumer retry/dead-letter tests, concurrent notification idempotency, and authenticated desktop/mobile browser review pass.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
