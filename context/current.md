# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/01-marketplace-foundation.md`

## Active Feature

Feature 01.03 — Professional Profile and Service Catalogue

## Status

`IN PROGRESS`

## Current Step

Feature 01.03 prerequisite verification passes. Features 01.01 and 01.02 are complete, and the live `Digital Qatalyst` organisation is publication-eligible with organisation status `active` and verification status `verified`.

## Next Step

Inspect the existing `/professional/profile`, `/professional/services`, public profile, and service-detail implementations against Feature 01.03, then continue with the first incomplete requirement without pulling Feature 01.04 or 01.05 work forward.

## Completed Phases

- `Phase 00 — Establish the Platform Foundation`

## Completed Features in Active Phase

- Feature 01.01 — Professional Organisation Onboarding
- Feature 01.02 — Team and Permission Management

## Dependencies

- Phase 00 identity, workspace, database, and private-storage foundations verified
- Dedicated `Veterans bay` Neon database configured and migrated through `0005_restrict-owner-platform-permission`
- Feature 01.01 organisation and owner-membership lifecycle verified

## Design Reference

Expected at:

```txt
public/design-reference/homepage.png
```

## Blockers

None.

## Review Gate

None currently identified for the Feature 01.03 prerequisite gate.

## Verification State

Features 01.01 and 01.02 are complete. `admin@gmail.com` has an active audited `platform_admin` assignment and is not a member of `Digital Qatalyst`. Approval executed through the authorised review service and live database verification confirms the organisation transitioned from `pending_review` to `active`, verification transitioned to `verified`, and the reasoned history, administrator actor, audit record, and pending `professional.profile_approved` outbox event persisted. Review decisions enforce active account and `platform.admin` permission, forbid self-review, and validate state-specific approve/request-changes/reject/suspend transitions. Full lint, typecheck, 104 tests including database atomicity and invalid-repeat rollback, Next.js production build, and Cloudflare Worker dry-run build pass. Development migrations are applied through `0005_restrict-owner-platform-permission`. The broader review queue, evidence-review interface, category management, listing moderation, and administration UI remain in Feature 01.05.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
