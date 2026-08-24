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

## Local Work

`COMPLETE` — The guarded local dashboard seed now creates an idempotent pagination-ready catalogue: 29 seed-owned published services across plumbing, electrical, carpentry, cleaning, and appliance categories; fixed, starting-from, and custom-quote pricing; direct-booking and enquiry-only paths; four verified providers with varied reputation metrics; immutable service snapshots; two saved professionals; three active warranties with different expiry windows; and credentials for both dashboard personas. Marketplace pages use a canonical nine-item size, giving the live local catalogue of 31 services four pages (9/9/9/4). Recommendations retain one service per provider despite the expanded catalogues. Two consecutive development-database seed runs pass. Repeated page ordering is stable without cross-page duplicates, Cleaning filters to seven results, the expected short-lived public cache headers are present, and newly seeded service detail routes return HTTP 200. URL-state pagination, page bounds, total-page calculation, cache policy, focused marketplace persistence, script syntax, changed-file lint, typecheck, and whitespace checks pass.

`VERIFICATION PENDING` — The user-directed dashboard alignment pass preserves the new authoritative client data flow and shared authenticated shell while tightening the supplied mockup composition: a simplified client header with service/request actions anchored at the end; uniform 128px client summary cards; a single five-column professional summary row with equal-width 136px KPI and profile-visibility cards; aligned label, value, and helper rows; compact brand-coloured dashboard action links; a clear professional-card hierarchy with quiet Message actions and lime Book again actions; denser internal spacing; a compact action/activity/professional row; a reference-aligned protection and payments card with stacked metrics, compact payment details, and a wider warranty panel; and a responsive, image-led recommendation section with four equal desktop cards and platform-coloured actions. Upcoming bookings now render only authoritative dashboard records, expose accessible links to the existing booking detail workflow, and provide a truthful empty state instead of demo rows. Recommendation cards likewise use authoritative services, ratings, reviews, prices, images, and detail routes, with a truthful empty state instead of demo content; each complete card is now the service-detail link with hover and keyboard-focus feedback. Dashboard service and professional links now follow the existing `/services/[slug]` and `/professionals/[slug]` route contracts instead of nonexistent nested marketplace routes. Focused dashboard tests, changed-file lint, typecheck, the 82-route production build, and whitespace checks pass. Browser-rendered comparison remains pending because no browser surface is connected.

`COMPLETE` — The browser and Apple icon metadata now uses a square, transparent emblem-only crop of the approved Veterans Bay artwork. The horizontal wordmark remains unchanged across the application. The 512×512 asset validation, focused lint, typecheck, 82-route production build, generated metadata inspection, and whitespace checks pass.

`VERIFICATION PENDING` — The professional workspace page-header consistency pass adds established eyebrow, title, and supporting-description hierarchy to the customers list, customer creation, professional booking creation, and reviews routes without changing the shared authenticated shell. Booking and review headers persist across loading, empty, error, and blocked states, and a focused semantic-heading contract covers all four routes. All 134 UI tests across 37 files, changed-file lint, typecheck through the 82-route production build, the production build itself, and whitespace checks pass. Responsive browser review remains pending because no browser surface is connected.

`VERIFICATION PENDING` — The user-directed typography consistency pass replaces all 231 bold and extra-bold utilities across 60 rendered component files with the established semibold hierarchy, caps semantic strong text at weight 600, limits the Poppins payload to weights 400–600, and adds a source-level regression contract. The focused contract tests, all 130 UI tests across 36 files, typecheck, the 82-route production build, and whitespace checks pass. Repository-wide lint reaches the same two pre-existing `react-hooks/set-state-in-effect` errors in `invoice-list.tsx` and `professional-dashboard-context.tsx`; no new lint error is reported. Responsive visual sampling remains pending because no browser surface is connected.

`VERIFICATION PENDING` — Authenticated workspace pages now mount their data loaders immediately while the shared shell validates the existing workspace concurrently. The validated `/workspaces/current` route is the common fast path; workspace listing and selection run only for missing or mismatched workspace state, and successful recovery remounts the page loader against the corrected HttpOnly workspace cookie. Interactive sign-in now keeps the existing login surface and submit-button progress visible until one authoritative workspace resolution completes, then performs one history-replacing redirect; the authenticated `/login` guard no longer races that transition or duplicates the workspace-entry request. All 128 UI tests across 35 files, focused changed-file lint, typecheck, the 82-route production build, and whitespace checks pass. Repository-wide lint reaches two pre-existing `react-hooks/set-state-in-effect` errors in `invoice-list.tsx` and `professional-dashboard-context.tsx`. Browser verification of both loading transitions remains pending because no browser surface is connected.

## Current Step

When a browser surface is connected, compare the client dashboard against the supplied desktop mockup and sample its mobile fallback; then sample the semibold hierarchy across representative public, authentication, client, professional, and administration routes and complete the pending sign-in loading-transition and public professional-page responsive checks. Do not deploy without explicit delivery-owner approval.

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
- Five synthetic UAT login personas and additive client, professional, technician, administrator, applicant, dashboard, quotation, booking, job, invoice, warranty, dispute, moderation, rule, and notification scenarios are seeded and authoritatively verified in the preview database

## Design Reference

`context/design-reference/homepage.png`

## Deferred Items

- Separate production resources and deployable Wrangler production environments are explicitly deferred, so the production deployment acceptance criteria are intentionally incomplete.
- Operator legal identity, notice address, governing law, and dispute forum require delivery-owner approval.
- Development-only dependency advisories require release-owner acceptance or upstream resolution.

## Review Gate

None for the controlled preview. A future public launch requires delivery-owner approval of the operator legal details and development-only advisories, followed by authorisation to provision production resources and run production smoke tests.

## Verification State

The current Phase 04 completion audit passes requirement mapping, Drizzle validation, regenerated Cloudflare type validation, typecheck, lint, 82 UI tests, 139 Worker/API tests, 41 live database tests across 20 files, the 81-route Next.js production build, the API Worker dry run, and `git diff --check`. Preview Neon independently confirms all five Phase 04 migrations (`0023`–`0027`) by content hash and all 15 required Phase 04 tables.

Features 05.01–05.06 are complete. Migration `0035_review-report-moderation-bridge` adds the legacy review-report upgrade path, and Drizzle validation passes. The current repository gates pass: 89 UI tests, 149 Worker/API tests, 41 live database tests across 20 files in 720.80 seconds, typecheck, lint, the 81-route Next.js/OpenNext production build, preview API dry-run, and `git diff --check`. Local sign-in now opens a role-aware start page; signed-in `/` routing opens the selected client, professional, onboarding, review, or administration home instead of the guest marketplace, and client plus draft-professional flows pass focused automated tests and browser verification. The time-dependent booking-origin fixture was anchored to stable UTC times after the first full rerun exposed a midnight-crossing expectation; its focused 4-test rerun and the subsequent complete 41-test database run pass. Preview API Worker version `60127dea-12bb-49ac-afe3-ec24cec004a3` enables environment-controlled self-service registration for synthetic UAT while consent validation, rate limiting, role restrictions, the global demonstration warning, and the simulated-payment policy remain enforced. Preview web Worker version `7c057267-e681-4108-b26c-8fa7fd40dc66` displays the global demonstration warning, removes active payment-processing claims, and maps disabled registration accurately. Deployed synthetic client registration, automatic sign-in, client-workspace routing, authoritative account-profile creation, registration outbox event, homepage, health, and readiness smoke checks pass. All thirteen authenticated MVP success criteria pass in preview. Feature 05.07 is intentionally deferred under the controlled, non-commercial preview decision.

The additive preview UAT seed passes all 15 authoritative data checks and an idempotent rerun without resetting workflow state. All five synthetic credentials authenticate against the deployed preview; client, professional-owner, technician, and administrator workspace/dashboard checks return 200, the applicant organisation workspace resolves correctly, and its 14/14-complete application plus protected synthetic evidence return 200 through the administrator review routes. Typecheck, lint, Drizzle validation, and `git diff --check` pass after the seed tooling change.

The supplied horizontal Veterans Bay logo is the application brand asset across shared public headers and footers, authenticated workspace footers, workspace support navigation, and browser/app icon metadata; dark surfaces give the unchanged navy-and-lime artwork a restrained light backing for legibility. The sign-in and registration trust panel uses a compact centred emblem-only crop from that approved artwork so the wordmark is not repeated or oversized. The local auth pages retain their compact zoom-resilient two-column desktop layout: the former promotional column is not rendered, its illustrated lime/navy background is reused beneath the left trust panel, forms remain centred and readable, the trust headline aligns with the corresponding form headline in both sign-in and registration states, focused text fields use only the rounded wrapper treatment, each account-type icon is vertically aligned with its title, and the sign-in/signup switcher uses the approved 64px rounded segmented-control treatment with a raised white active state. A shared focused guest header provides the Veterans Bay brand and How It Works without restoring the space-heavy marketplace navigation; the landing page uses Log In as its trailing action because support is already available in the footer, while auth and public feature-status pages retain desktop support access. Its mobile treatment keeps the logo and primary guest actions visible while collapsing support copy. Redundant account prompts, Apple, Microsoft, and the unavailable forgot-password affordance are removed; Remember me is wired to Better Auth, while Google routes to a reusable feature-status page until provider credentials and configuration exist. The feature-status system supports coming-soon, maintenance, and temporary-unavailability variants; configurable content, actions, preview, icon, assurance, and benefits; and public, client, professional, or admin shells without shared Google-specific copy. Auth input and consent validation now renders compact accessible feedback directly beneath the relevant control, while Better Auth and profile-setup failures use Sonner toasts instead of large inline alert cards. Active Better Auth sessions keep the shared login and registration UI hidden while the session resolves and redirect directly to the workspace-selection flow; both routes pass authenticated browser verification without exposing their auth headings. Authoritative phone-profile persistence and Better Auth journeys remain intact; focused brand, guest-header, landing, auth, and feature-status tests, typecheck, lint, the 82-route production build, and desktop/mobile browser verification pass without horizontal overflow. Preview deployment remains subject to explicit delivery-owner approval.

The local professional dashboard and navigation now match the approved professional operations mockup with live scoped dashboard, profile, team, review, and calendar data; truthful empty states; responsive desktop and mobile layouts; and passing focused component tests, typecheck, lint, production build, and visual comparison QA. Repository asset hygiene is verified: `public/images/` contains only the 12 source-referenced runtime images, the permanent homepage design authority is stored under `context/design-reference/`, legacy duplicate and unreferenced mockups are removed, generated visual-QA output is ignored, and the 82-route production build passes. No preview deployment was performed.

The landing-page professional-growth experience uses a masked hero image for a continuous backdrop transition and shares the public-shell gutter with the navigation. Its "Built for professionals who want to grow" and How It Works sections use the same 1340px content rail and 26px desktop gutter as the shared navigation and footer. The growth cards' View all leads and View Dashboard controls are keyboard-focusable links to `/professional/enquiries` and `/professional`; their rendered hrefs are verified. The former standalone community stats band and separate testimonial card are removed; their content is combined in one contained 22px navy community-proof section after How It Works. The user-selected composition uses two equal-height primary columns: community heading, icon-led metrics, and avatar proof on the left, with the Mark D. Plumbing testimonial on the right. At desktop widths, both columns start on the same top line and their final proof rows are bottom-aligned. The compact 42 completed jobs and Top Rated evidence row sits directly beneath Mark's profile and rating so it supports the testimonial instead of competing as an isolated third column. Mobile retains the same evidence hierarchy. The rejected CTA composition and final professional-account action are not rendered in this section. The growth section retains its three role-specific editorial images, inherited page backdrop, rail-aligned outer floating panels, shallow dashboard-panel overhang, compact typography, and lime icon medallions. Changed-file lint, typecheck, the current 82-route production build, local route/link checks, and whitespace checks pass. Responsive after-screenshot review remains pending because no browser surface is connected. No preview deployment was performed.

Authenticated workspace routes now share persistent layouts (`professional/(workspace)`, `client`, `admin`) so the shell no longer remounts on every navigation. Layout-matched skeletons cover the dashboard, lists, and key details; session-scoped client caches keep workspace labels, dashboard, bookings, jobs, invoices, services, customers, and enquiries available on revisit. Typecheck and focused dashboard tests pass. No preview deployment was performed.

## Update Rule

Keep this file concise. Replace changed fields instead of appending a progress diary.
