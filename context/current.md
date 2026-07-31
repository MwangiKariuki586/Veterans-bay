# Current Work

## Project

Veterans Bay

## Specification Source

`reference/ServiceLink Specification.docx`

The source document uses the working title ServiceLink. The implementation name is Veterans Bay.

## Active Phase

`context/phases/05-operational-maturity.md`

## Active Feature

Feature 05.07 — Production Readiness and Deployment

## Status

`BLOCKED`

## Current Step

Submit the completed Emkay Ltd preview job for client confirmation, then verify Alex Mwangi's completion response.

## Next Step

Resolve or explicitly accept the remaining release-owner items, then provision and deploy the deferred production environment when authorised.

## Completed Phases

- Phase 00 — Establish the Platform Foundation
- Phase 01 — Establish the Professional Marketplace
- Phase 02 — Enable Request-to-Booking Commerce
- Phase 03 — Enable Service Fulfilment
- Phase 04 — Establish Trust, Financial Records, and Retention

## Completed Features in Active Phase

- Feature 05.01 — Complete Platform Administration and Moderation
- Feature 05.02 — Basic Dashboards and Reporting
- Feature 05.03 — Async Reliability and Dead-Letter Operations
- Feature 05.04 — Audit, Privacy, and Security Hardening
- Feature 05.05 — Performance and Search Optimisation
- Feature 05.06 — Accessibility and UX Completion

## Dependencies

- Phase 00–04 identity, organisation, marketplace, commerce, fulfilment, trust, financial, warranty, review, customer, notification, and private-storage foundations are verified
- Migrations `0028_operational-administration` through `0034_dispute-job-uniqueness` are applied and validated
- Platform administration, scoped live dashboards, async diagnostics/recovery, privacy deactivation, consent enforcement, public caching, image delivery, reporting indexes, and accessibility automation are verified locally
- Cloudflare Wrangler OAuth authentication is verified with encrypted credential storage and deployment-resource permissions
- Launch addressing is approved: preview and initial production will use separate Cloudflare `workers.dev` URLs; a custom domain is deferred
- The Cloudflare account subdomain is confirmed and named preview/production web and API Worker configurations are defined
- The `veterans-bay-domain-events-preview` Cloudflare Queue is provisioned and its preview API binding passes dry-run validation
- The separate `veterans-bay-preview` Neon PostgreSQL 16 project is provisioned in AWS US East 2 (Ohio)
- All 35 committed migrations are applied to the preview database; Drizzle validation and authoritative core-table checks pass
- The preview API draft Worker exists with encrypted `DATABASE_URL` and independently generated `BETTER_AUTH_SECRET` bindings
- Further environment duplication is explicitly deferred: reuse the provisioned preview resources and existing Cloudinary product environment; do not create another database, Queue, or Cloudinary key
- The existing Cloudinary credential set is configured as encrypted secrets on the preview API Worker
- The reviewed preview API is deployed with version preview URLs disabled; health, readiness, CORS, Queue producer/consumer, Cron, rate limits, observability configuration, and encrypted secret bindings are verified
- The reviewed preview web Worker is deployed with version preview URLs disabled and a same-account service binding to the preview API
- Preview homepage, login, marketplace, static-brand asset, proxied health, and proxied readiness smoke checks return 200
- All 12 deployed-preview accessibility, keyboard, and viewport-overflow checks pass on desktop and mobile Chromium
- Separate Alex Mwangi client and Emkay Ltd professional preview accounts are active; Emkay Ltd has submitted a 14/14-complete application with private evidence
- The Alex Mwangi preview account has an active `platform_admin` assignment with the `platform.admin` permission
- Success criterion 1 passes in preview: Alex Mwangi approved Emkay Ltd with audited history, and Emkay Ltd published Emergency Plumbing Repair as a versioned KES 5,000 direct-booking service with an immutable publication snapshot and outbox event
- Success criterion 2 passes in preview: Alex Mwangi discovered the published service and submitted a direct service request that is now authoritatively `QUOTED`
- Success criterion 3 passes in preview: Emkay Ltd issued quotation version 1 for KES 5,000 with immutable submitted terms, request/conversation history, and one `quotation.submitted` outbox event
- Success criterion 4 passes in preview: Alex Mwangi accepted eligible quotation version 1, the request converted, and a KES 5,000 `PENDING_CONFIRMATION` booking foundation was created from the accepted immutable snapshot with one `quotation.accepted` outbox event
- Success criterion 5 passes in preview: Emkay Ltd's Monday–Friday 08:00–17:00 Africa/Nairobi working hours are persisted, Alex Mwangi requested Monday 3 August 2026 at 09:00, Emkay confirmed the booking and owner assignment, and the platform created a linked `TEAM_ASSIGNED` job for the authoritative 09:00–11:00 schedule
- Success criterion 6 passes in preview: Emkay checked in, started work, completed all three required plumbing checklist items, and persisted a client-visible progress update on the authoritative `IN_PROGRESS` job
- The quotation-eligible enquiry rendering regression is fixed, covered by a focused UI test, and deployed to preview web Worker version `967bdcfd-3d0f-4367-99dd-772c534797f9`

## Design Reference

`public/design-reference/homepage.png`

## Blockers

- Separate production resources are explicitly deferred, so the production deployment acceptance criteria cannot be completed under the current single-environment decision.
- Operator legal identity, notice address, governing law, and dispute forum require delivery-owner approval.
- Development-only dependency advisories require release-owner acceptance or upstream resolution.
- The full preview live-database suite timed out after ten minutes and has not produced a passing result.
- Chrome-backed interactive review passes for the professional enquiry and quotation flow; the remaining client/admin steps require their signed-in browser sessions.
- The thirteen-step authenticated success journey is in progress; success criteria 1–6 pass and criterion 7 awaits the professional ready-for-confirmation transition and Alex Mwangi's client completion response.

## Review Gate

Confirm whether Emkay should mark the preview job ready for client confirmation and Alex Mwangi should then confirm the completed work. Delivery-owner approval and production access are required before production promotion.

## Verification State

The current Phase 04 completion audit passes requirement mapping, Drizzle validation, regenerated Cloudflare type validation, typecheck, lint, 82 UI tests, 139 Worker/API tests, 41 live database tests across 20 files, the 81-route Next.js production build, the API Worker dry run, and `git diff --check`. Preview Neon independently confirms all five Phase 04 migrations (`0023`–`0027`) by content hash and all 15 required Phase 04 tables.

Features 05.01–05.06 are complete. Migrations through `0034_dispute-job-uniqueness` are applied and Drizzle validation passes. The repository suites pass: 82 UI tests, 139 Worker/API tests, and 41 live database tests across 20 files. Typecheck, lint, the 81-route Next.js/OpenNext production build, Cloudflare Worker dry-runs, local health/readiness checks, repeated local Cron execution, tracked-secret scan, and all 12 local desktop/mobile accessibility checks pass. Production dependency audit has no high or critical findings. Wrangler OAuth authentication is verified. Named preview and production API/web configurations pass Wrangler dry-run validation. The preview Queue exists and its API binding is verified by dry run. The preview database has 35/35 migrations, 87 public tables, and verified core tables on PostgreSQL 16.14; its full live database suite timed out at ten minutes without a test result and remains to be rerun. The deployed preview API returns 200 for health/readiness, allows only the configured web origin, and has live Queue/Cron/rate-limit bindings. Preview web Worker version `967bdcfd-3d0f-4367-99dd-772c534797f9` passes the repaired professional enquiry/quotation flow with no new Chrome errors. Focused shared-UI tests (13/13), typecheck, lint, and the 81-route OpenNext build pass after the repair. Database verification confirms accepted quotation version 1, KES 5,000 authoritative snapshot, converted request, linked booking, five active weekday availability rules, `CONFIRMED` Monday 3 August 2026 09:00–11:00 Africa/Nairobi schedule, Emkay owner assignment, linked job `49f9ebc8-b26b-44c0-90bc-eb764b283951`, authoritative `CHECK_IN` and `START` transitions, `IN_PROGRESS` status, three completed required checklist items, one client-visible progress update, and all 16 resulting fulfilment/activity outbox events published. The client job UI independently shows the same in-progress state, completed checklist, assigned professional, and progress record, while the professional job UI exposes the next ready-for-confirmation transition. All 12 deployed-preview accessibility, keyboard, and viewport-overflow checks pass on desktop and mobile Chromium. Feature 05.07 remains blocked on the remaining authenticated success journey, release-owner decisions, and deferred production promotion.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
