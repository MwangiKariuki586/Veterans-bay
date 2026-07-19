# Phase 05 — Achieve Operational Maturity and Release Readiness

## Outcome

Provide complete administration, reporting, reliable asynchronous processing, auditability, performance, accessibility, security, and production readiness for the launchable MVP.

## Completion Criteria

- Platform administrators can moderate required records with traceable decisions.
- Client, professional, and administrator dashboards provide useful scoped visibility.
- Queue consumers, retries, dead letters, recovery, and scheduled actions are observable.
- Audit, privacy, performance, accessibility, and security requirements are verified.
- The complete MVP success journey passes end to end.
- Deployment, migration, rollback, monitoring, and support procedures are documented and tested.

## Ordered Features

1. Feature 05.01 — Complete Platform Administration and Moderation
2. Feature 05.02 — Basic Dashboards and Reporting
3. Feature 05.03 — Async Reliability and Dead-Letter Operations
4. Feature 05.04 — Audit, Privacy, and Security Hardening
5. Feature 05.05 — Performance and Search Optimisation
6. Feature 05.06 — Accessibility and UX Completion
7. Feature 05.07 — Production Readiness and Deployment

---

## Feature 05.01 — Complete Platform Administration and Moderation

### Purpose

Give authorised platform operators the tools required to maintain marketplace safety, quality, and traceable governance.

### Prerequisites

- All relevant domain records and platform-role foundation exist.

### Routes

- `/admin`
- `/admin/professionals`
- `/admin/categories`
- `/admin/listings`
- `/admin/reports`
- `/admin/reports/[caseId]`
- `/admin/disputes`
- `/admin/warranties/escalated`
- `/admin/audit`
- `/admin/rules`

### Personas

- Platform administrator

### Required Work

- Complete professional application review, category management, listing/profile moderation, reported user/message/review handling, suspension/restoration, engagement inspection, warranty escalation, disputes, platform rules, and audit views.
- Support reports for misleading listings, abusive communication, fraud concerns, poor service conduct, payment disagreements, review manipulation, off-platform payment requests, and identity concerns.
- Require reasons and evidence for material decisions.
- Notify affected users of significant enforcement actions.
- Provide safe case history and linked records without enabling silent transaction edits.

### Business and Security Rules

- Only current platform administrators act.
- Moderation actions require reasons.
- Suspensions and restorations are recorded.
- Administrators do not silently edit transactional records.
- High-risk actions are audited.
- Private evidence access is purpose-limited.
- Affected users receive clear status without internal investigation details.

### Required States

- Empty queue
- Open case
- Evidence loading
- Awaiting decision
- Resolved
- Suspended
- Restored
- Permission denied
- Error

### Domain Events

- report.submitted
- moderation.case_opened
- content.hidden
- account.suspended
- account.restored
- dispute.opened
- dispute.resolved
- review.moderated

### Acceptance Criteria

- Administrators can investigate and resolve required case types.
- Decisions are reasoned, traceable, and permission-safe.
- Enforcement changes platform access and visibility correctly.
- Transactional history remains immutable.
- Users receive appropriate notifications.

### Verification

- Test role authorization, case transitions, evidence access, suspensions, restoration, visibility effects, immutable records, audit completeness, and notifications.

---

## Feature 05.02 — Basic Dashboards and Reporting

### Purpose

Give clients, professionals, and administrators meaningful scoped visibility without replacing source records.

### Prerequisites

- All dashboard source domains are complete enough for MVP reporting.

### Routes

- `/client`
- `/professional`
- `/admin`

### Personas

- Client
- Professional owner/authorised members
- Platform administrator

### Required Work

- Client dashboard: active requests, pending quotations, upcoming bookings, active jobs, outstanding completion confirmations, active warranties, and recent history.
- Professional dashboard: new enquiries, quotations awaiting response, upcoming bookings, jobs in progress, outstanding payments, warranty claims, recent reviews, monthly revenue, and service performance.
- Administrator dashboard: pending professional reviews, active professionals, new requests, completed jobs, open reports, active disputes, completion rate, and marketplace engagement trend.
- Add clear action links, scoped filters, bounded date ranges, feedback states, and eventual-consistency indicators where relevant.
- Use aggregated or paginated queries rather than large raw lists.

### Business and Security Rules

- Financial reporting requires permission.
- Professional data is organisation-scoped.
- Administrator data requires current platform authority.
- Analytical summaries may be eventually consistent.
- Transactional records remain authoritative.
- Do not fabricate unsupported metrics.

### Required States

- Loading
- No activity
- Partial data unavailable
- Permission-restricted metric
- Stale summary
- Error
- Normal dashboard

### Domain Events

- Analytics projections consume existing domain events without blocking the UI.

### Acceptance Criteria

- Each persona sees useful, accurate, actionable information.
- Permissions and tenant scope are enforced.
- Queries are bounded and performant.
- Eventually consistent summaries are identified appropriately.
- Dashboards inherit the platform design without becoming generic KPI templates.

### Verification

- Test scope, permissions, aggregation accuracy, empty/partial states, pagination, performance, responsive behaviour, and accessibility.

---

## Feature 05.03 — Async Reliability and Dead-Letter Operations

### Purpose

Complete reliable processing, observability, recovery, and operational controls for asynchronous work.

### Prerequisites

- All required domain events and consumers exist.
- Read `context/recipes/queues.md`.

### Routes

- Internal operational or admin diagnostics only where safe

### Personas

- Platform operator
- Runtime

### Required Work

- Complete notification, reputation, analytics, and scheduled-action consumers.
- Implement bounded claims, retry backoff, dead-letter handling, authorised manual retry, abandoned-claim recovery, and processing diagnostics.
- Add operational visibility for backlog, age, attempts, duration, duplicates, and failures.
- Version event contracts and reject unsupported versions safely.
- Ensure scheduled expirations, reminders, approved automatic completion, and maintenance are repeat-safe.

### Business and Security Rules

- Consumers remain idempotent and tenant-safe.
- Primary actions remain independent from async failure.
- Manual retry preserves original event ID and audit history.
- Payloads remain minimal and non-sensitive.
- Cron may be delayed or repeated.

### Required States

- Healthy
- Backlog
- Retrying
- Dead-lettered
- Manual retry pending
- Recovered
- Unsupported event version

### Domain Events

- notification.*
- reputation.recalculation_requested
- Domain-specific scheduled events

### Acceptance Criteria

- Every MVP event has a known producer and consumer or an explicit reason for no consumer.
- Duplicate delivery creates one effect.
- Failures are observable and recoverable.
- Dead-letter operations are authorised and traceable.
- Scheduled actions are repeat-safe.

### Verification

- Run duplicate, concurrent duplicate, retry, dead-letter, manual retry, abandoned claim, repeated Cron, tenant-isolation, and bounded-batch tests.

---

## Feature 05.04 — Audit, Privacy, and Security Hardening

### Purpose

Verify that the complete MVP protects identity, organisations, engagements, evidence, financial data, and administrative actions.

### Prerequisites

- All MVP workflows implemented.

### Routes

- Cross-cutting; admin audit route as defined in Feature 05.01

### Personas

- All personas

### Required Work

- Complete authorization review across protected routes and domain actions.
- Complete organisation, participation, assignment, and platform-role isolation tests.
- Complete audit coverage for high-risk admin, financial, permission, commercial, warranty, and dispute actions.
- Implement account-deactivation handling that distinguishes removable profile data from required transaction history.
- Review file validation, private delivery, logging, rate limiting, safe errors, terms/privacy acceptance, and data-use messaging.
- Create and resolve a release security checklist.

### Business and Security Rules

- Protected routes require authenticated sessions.
- Permissions are server-enforced.
- Sensitive data does not appear in logs.
- Administrative actions are audited.
- Users access only engagements they participate in.
- Private notes remain organisation-scoped.
- Required history survives account deactivation.

### Required States

- Permission denied
- Restricted account
- Deactivated account
- Private record unavailable
- Rate limited
- Audit unavailable

### Domain Events

- None.

### Acceptance Criteria

- No known cross-tenant or cross-participant exposure remains.
- High-risk actions are traceable.
- Account deactivation preserves required history correctly.
- Logs and client responses are non-sensitive.
- Rate limits protect authentication and public submissions.

### Verification

- Run the complete authorization matrix, tenant-isolation suite, privacy review, secret scan, log review, rate-limit tests, audit completeness tests, and abuse-path review.

---

## Feature 05.05 — Performance and Search Optimisation

### Purpose

Ensure marketplace, operational lists, dashboards, images, and event processing perform within acceptable MVP limits.

### Prerequisites

- Representative data and complete primary workflows exist.

### Routes

- Cross-cutting

### Personas

- All personas

### Required Work

- Review query plans and indexes for marketplace search, tenant-scoped lists, status queues, schedules, dashboards, outbox, and unread notifications.
- Enforce bounded pagination and stable sorting.
- Optimise public projections and avoid over-fetching.
- Use appropriate image transformations and sizes.
- Add safe short-lived caching only to suitable public reads.
- Measure and resolve major loading, bundle, and Worker-runtime bottlenecks.

### Business and Security Rules

- Do not cache live availability, reservations, conversations, unread counts, financial calculations, moderation queues, or outbox state without an approved safe strategy.
- Optimisation must not weaken authorization, correctness, or history.
- PostgreSQL search remains the MVP search approach.

### Required States

- Normal
- Large result set
- Slow dependency
- Partial analytical delay
- Cache miss

### Domain Events

- None.

### Acceptance Criteria

- Marketplace search and filters are indexed and bounded.
- Large lists and dashboards do not return unbounded records.
- Images are appropriately delivered.
- Critical workflows meet agreed performance expectations.
- No correctness regression is introduced.

### Verification

- Inspect query plans, run representative-data performance tests, review bundles, test cache isolation/invalidation, and re-run workflow correctness suites.

---

## Feature 05.06 — Accessibility and UX Completion

### Purpose

Complete the MVP with accessible, understandable, responsive, and consistent user experiences.

### Prerequisites

- All MVP pages and workflows implemented.

### Routes

- All public and authenticated routes

### Personas

- All personas

### Required Work

- Audit forms, headings, landmarks, labels, errors, keyboard access, focus, dialogs/sheets, tables, status announcements, contrast, touch targets, reduced motion, and responsive layouts.
- Complete loading, empty, no-result, error, permission, stale-conflict, unavailable, and success states.
- Remove dead controls, misleading placeholders, clipped content, horizontal overflow, and inconsistent shared patterns.
- Validate the complete application against the homepage-established visual language.

### Business and Security Rules

- Status never depends on colour alone.
- Important updates are assistive-technology readable.
- Consequential actions remain clear and confirmed.
- Disabled controls explain why where necessary.
- No page introduces an unrelated visual system.

### Required States

- All required application states

### Domain Events

- None.

### Acceptance Criteria

- Critical workflows are keyboard-operable.
- Forms expose labels and associated errors.
- Layouts work on desktop, tablet, and mobile.
- Visual language remains consistent.
- Known accessibility defects are resolved or explicitly accepted before release.

### Verification

- Run automated accessibility checks, keyboard walkthroughs, focus tests, responsive review, contrast review, screen-reader spot checks, and complete-state review.

---

## Feature 05.07 — Production Readiness and Deployment

### Purpose

Verify the complete MVP and deploy it through a controlled, documented, reversible process.

### Prerequisites

- Features 05.01–05.06 complete.
- All required credentials and production bindings available.

### Routes

- Production application and operational endpoints

### Personas

- All personas
- Platform operator

### Required Work

- Run the complete MVP success journey end to end.
- Validate production migrations, Cloudflare bindings, Better Auth origins/cookies, Cloudinary configuration, Queues, Cron, rate limits, logging, and environment separation.
- Create deployment, migration, rollback, incident, Queue recovery, and support runbooks.
- Create release notes and a known-limitations list that accurately reflects deferred features.
- Verify backup/recovery expectations and operational ownership.
- Deploy through preview/staging before production and perform post-deployment smoke tests.

### Business and Security Rules

- Do not release with hidden critical blockers or failed required checks.
- Do not represent deferred integrations as active.
- Production secrets remain server-only.
- Migrations and rollback strategy are reviewed before release.
- Async failure is observable after deployment.

### Required States

- Pre-deployment
- Deploying
- Migration failure
- Rollback
- Post-deployment verification
- Operational degradation

### Domain Events

- None.

### Acceptance Criteria

- All thirteen MVP success criteria pass.
- Critical security, privacy, accessibility, and reliability checks pass.
- Deployment and rollback are documented and tested.
- Production smoke tests pass.
- Known limitations are truthful and visible to the delivery team.

### Verification

- Run full typecheck, lint, unit/integration/end-to-end tests, build, preview, migration rehearsal, security/authorization suite, accessibility review, Queue/Cron verification, deployment, and post-deployment smoke tests.
