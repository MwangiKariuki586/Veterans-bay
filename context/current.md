# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/01-marketplace-foundation.md`

## Active Feature

Feature 01.04 — Marketplace Discovery

## Status

`IN PROGRESS`

## Current Step

Feature 01.03 is complete. Feature 01.04 prerequisite and repository verification is now active.

## Next Step

Verify searchable indexes and public projections against the actual repository, inspect the existing `/marketplace` implementation, and continue with the first incomplete Feature 01.04 requirement.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`

## Completed Features in Active Phase

- Feature 01.01 — Professional Organisation Onboarding
- Feature 01.02 — Team and Permission Management
- Feature 01.03 — Professional Profile and Service Catalogue

## Dependencies

- Phase 00 identity, workspace, database, and private-storage foundations verified
- Dedicated `Veterans bay` Neon database configured and migrated through `0006_damp_naoko`
- Feature 01.01 organisation and owner-membership lifecycle verified

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for the Feature 01.04 prerequisite gate.

## Verification State

Features 01.01 through 01.03 are complete. Feature 01.03 provides authoritative organisation-scoped service persistence, authorised Hono contracts, professional profile and portfolio management, service-image management, publication snapshots, and bounded public projections. Chrome verified service creation, editing, publication, the public detail at desktop and mobile widths, and the final unavailable state after cleanup, plus profile, catalogue, public-profile, and unavailable states. Automated and database tests cover unpublication and its transaction-dependent event. The review found and resolved page-level unavailable heading semantics, canonical weekday ordering, and two visible encoding artifacts. The temporary review service remains unpublished. Development migrations are applied through `0006_damp_naoko`. Lint, typecheck, 136 tests, Next.js production build, Cloudflare Worker dry-run build, schema validation, and diff checks pass. Marketplace discovery is now active; moderation remains in Feature 01.05.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
