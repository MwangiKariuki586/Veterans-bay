# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/02-commercial-workflow.md`

## Active Feature

Feature 02.01 — Service Requests and Enquiries

## Status

`IN PROGRESS`

## Current Step

Feature 02.01 prerequisites are verified. Implementing the authoritative client request draft and submission lifecycle.

## Next Step

Implement and verify request persistence, client access, draft updates, submission history, outbox events, attachments, and client request routes.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`
- `Phase 01 — Establish the Professional Marketplace`

## Completed Features in Active Phase

None.

## Dependencies

- Phase 00 identity, workspace, database, and private-storage foundations verified
- Dedicated `Veterans bay` Neon database configured and migrated through `0009_kind_zombie`
- Phase 01 marketplace, organisation, service catalogue, moderation, and discovery foundations verified

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for Feature 02.01.

## Verification State

Phase 01 is complete. Platform administrators can review professional evidence, record approval and rejection decisions, suspend and restore organisations, manage discovery categories, and hide or restore published listings. Moderation state is preserved separately from professional publication state, hidden listings are excluded from marketplace, public catalogue, analytics, and saved-professional projections, inactive categories cannot receive new publications, and affected changes write audit and outbox evidence. Migration `0009_kind_zombie` is applied. Typecheck, lint, 172 tests, Drizzle schema validation, Next.js production build, Cloudflare Worker dry-run build, and diff checks pass. Rating and completed-job ordering remain explicitly deferred to Phases 03 and 04.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
