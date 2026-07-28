# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/05-operational-maturity.md`

## Active Feature

Feature 05.01 — Complete Platform Administration and Moderation

## Status

`NOT STARTED`

## Current Step

Verify platform-role authority, existing moderation records, report/evidence foundations, and immutable transaction boundaries.

## Next Step

Inspect existing administration and marketplace-moderation implementations, then identify the first missing prerequisite for Feature 05.01.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`
- `Phase 01 — Establish the Professional Marketplace`
- `Phase 02 — Enable Request-to-Booking Commerce`
- `Phase 03 — Enable Service Fulfilment`
- `Phase 04 — Establish Trust, Financial Records, and Retention`

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
- Feature 04.01 provides auditable invoice items, manual payments, item allocations, balances, private evidence, preserved reversals/refunds, financial permissions, and transactional financial events
- Feature 04.02 provides completion-derived warranty coverage, structured participant-scoped claims, private evidence, reasoned decisions, escalation, return-visit job history, resolution, and notification events
- Feature 04.03 provides completed-job review eligibility, one verified review and response per job, report/moderation preservation, public review projections, rebuildable reputation metrics, and idempotent Queue recalculation
- Feature 04.04 provides organisation-scoped imported and registered customer records, preserved origins, duplicate candidates, invitation/reconciliation, private notes and tags, paginated search, service history, and permissioned balances
- Feature 04.05 revalidates current service and professional rules for client/professional repeat work, preserves source history without stale commercial reuse, and provides cancellable repeat-safe scheduled in-app reminders
- Feature 04.06 provides permission/participant-derived post-service notifications for invoices, payments, completion, warranties, reviews, and service reminders with private preview text, safe targets, and idempotent delivery

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for Feature 05.01.

## Verification State

Phase 04 is complete. Migrations `0023_real_marten_broadcloak` through `0027_dusty_old_lace` are applied and Drizzle validation passes. The full repository suite passes: 81 UI tests, 135 Worker/API tests, and 38 live database tests. Typecheck, lint, the 74-route Next.js production build, and the Cloudflare Worker dry-run pass. Phase 05 Feature 05.01 has not started.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
