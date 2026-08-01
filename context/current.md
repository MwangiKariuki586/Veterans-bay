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

`DEFERRED`

## Current Step

Maintain the verified deployment as a controlled, non-commercial preview with public registration disabled, simulated-only payment records, and prominent warnings against real activity or data.

## Next Step

Resume Feature 05.07 only when the delivery owner chooses a public production launch; then resolve the retained legal, dependency, infrastructure, deployment, and smoke-test gates.

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
- The Cloudflare account subdomain is confirmed and named preview/production web and API Worker configurations are defined; both web environments have explicit API service bindings
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
- Success criterion 7 passes in preview: Emkay attached client-visible `COMPLETION` evidence, submitted the job for confirmation, and Alex Mwangi confirmed completion, producing the authoritative `COMPLETED` job state and timeline history
- Success criterion 8 passes in preview: Emkay issued invoice `INV-2026-4462A4C3` for the immutable KES 5,000 job snapshot and recorded one clearly labelled simulated `OTHER` payment (`PREVIEW-NO-FUNDS-001`), producing a zero balance without representing provider-confirmed funds
- Success criterion 9 passes in preview: the completed job created active 30-day workmanship warranty `404d10c9-811c-41da-83b0-8aeac1bd97e8` with the recorded scope exclusion and no claim
- Success criterion 10 passes in preview: Alex Mwangi published one verified 5/5 review whose feedback explicitly states that it is preview workflow verification and that no real service was performed
- Success criterion 11 passes in preview: Emkay's registered Alex Mwangi customer record shows the completed job/booking/quotation history and opens a repeat-booking form prefilled with the current published service and current team assignment without creating a duplicate booking
- Success criterion 12 passes in preview: the async dashboard shows zero backlog, retries, and open dead letters; the notification consumer delivered the new-review notification, the reputation consumer projected the verified 5/5 review, and the repository duplicate-delivery suites remain passing
- Success criterion 13 passes in preview: the legacy professional review report was backfilled into the administrator queue, Alex Mwangi opened moderation case `1f6974cb-e953-4f78-9f60-84d48d9c75f0`, dismissed the explicitly simulated report with a recorded reason and evidence summary, and the verified 5/5 review returned to its published projection
- All thirteen MVP success criteria now pass end to end in the deployed preview environment
- The quotation-eligible enquiry rendering regression is fixed, covered by a focused UI test, and deployed to preview web Worker version `967bdcfd-3d0f-4367-99dd-772c534797f9`

## Design Reference

`public/design-reference/homepage.png`

## Deferred Items

- Separate production resources and deployable Wrangler production environments are explicitly deferred, so the production deployment acceptance criteria are intentionally incomplete.
- Operator legal identity, notice address, governing law, and dispute forum require delivery-owner approval.
- Development-only dependency advisories require release-owner acceptance or upstream resolution.

## Review Gate

None for the controlled preview. A future public launch requires delivery-owner approval of the operator legal details and development-only advisories, followed by authorisation to provision production resources and run production smoke tests.

## Verification State

The current Phase 04 completion audit passes requirement mapping, Drizzle validation, regenerated Cloudflare type validation, typecheck, lint, 82 UI tests, 139 Worker/API tests, 41 live database tests across 20 files, the 81-route Next.js production build, the API Worker dry run, and `git diff --check`. Preview Neon independently confirms all five Phase 04 migrations (`0023`–`0027`) by content hash and all 15 required Phase 04 tables.

Features 05.01–05.06 are complete. Migration `0035_review-report-moderation-bridge` adds the legacy review-report upgrade path, and Drizzle validation passes. The current repository gates pass: 84 UI tests, 145 Worker/API tests, 41 live database tests across 20 files in 720.80 seconds, typecheck, lint, the 81-route Next.js/OpenNext production build, preview API dry-run, and `git diff --check`. The time-dependent booking-origin fixture was anchored to stable UTC times after the first full rerun exposed a midnight-crossing expectation; its focused 4-test rerun and the subsequent complete 41-test database run pass. Preview API Worker version `1b5956be-0ffb-449b-a695-fd2bf9410a67` enforces controlled-preview registration and simulated-payment policy. Preview web Worker version `e2b54326-6a3e-418b-9c90-841d95440c2b` displays the global demonstration warning and removes active payment-processing claims. Deployed homepage, health, readiness, and registration-rejection smoke checks pass. All thirteen authenticated MVP success criteria pass in preview. Feature 05.07 is intentionally deferred under the controlled, non-commercial preview decision.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
