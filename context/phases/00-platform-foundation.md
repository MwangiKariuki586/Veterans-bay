# Phase 00 — Establish the Platform Foundation

## Outcome

Create the technical, visual, identity, data, storage, and event foundations required for fast and reliable delivery of Veterans Bay workflows.

## Completion Criteria

- The approved runtime works locally and in Cloudflare preview.
- Shared visual tokens and components are established from the homepage reference.
- The public homepage and shell are implemented and reviewed.
- The Hono modular API foundation exists.
- Neon and Drizzle migrations work.
- Better Auth and protected access foundations work.
- Workspace and permission resolution is server-enforced.
- Cloudinary upload and private-asset foundations work.
- The transactional outbox and Queue proof of concept work idempotently.
- Shared validation, errors, logging, feedback, tests, and operational checks pass.

## Ordered Features

1. Feature 00.01 — Repository and Runtime Setup
2. Feature 00.02 — UI System and Global Styles
3. Feature 00.03 — Public Shell and Homepage
4. Feature 00.04 — Hono API and Domain Module Foundation
5. Feature 00.05 — Database and Migration Foundation
6. Feature 00.06 — Identity and Account Management
7. Feature 00.07 — Workspace and Permission Foundation
8. Feature 00.08 — File Storage Foundation
9. Feature 00.09 — Transactional Outbox and Queue Proof of Concept
10. Feature 00.10 — Shared Feedback and Operational Guardrails

---

## Feature 00.01 — Repository and Runtime Setup

### Purpose

Prepare a reproducible repository and supported runtime for all later work.

### Prerequisites

- None. Inspect and preserve valid existing implementation before changing configuration.

### Routes

- No user-facing route is required.

### Personas

- Developer and deployment environments.

### Required Work

- Configure Next.js App Router with TypeScript strict mode.
- Use npm as the package manager of record and retain one authoritative lockfile.
- Configure import aliases, linting, Vitest, build, and verification scripts.
- Configure Cloudflare-compatible local and preview execution for the web and Hono Worker.
- Add validated environment access and an accurate `.env.example` without secrets.
- Establish safe request correlation and baseline structured logging.
- Create only the folders required by the active architecture.

### Business and Security Rules

- Do not delete valid repository work without proving it obsolete.
- Do not introduce paid infrastructure.
- Do not rely on writable filesystem state in deployed Workers.
- Server-only configuration must never enter client bundles.

### Required States

- Successful startup
- Safe configuration error
- Unsupported runtime or missing binding

### Domain Events

- None.

### Acceptance Criteria

- Fresh installation succeeds.
- Web and API development environments start.
- TypeScript strict mode is active.
- Production build and Cloudflare preview succeed.
- Environment failures are explicit and do not expose secrets.

### Verification

- Install from the committed lockfile.
- Run typecheck, lint, tests, production build, and Cloudflare preview.
- Inspect client output for secret leakage.

### Out of Scope

- Business-domain implementation
- Authentication flows
- Domain schemas beyond tool bootstrap

---

## Feature 00.02 — UI System and Global Styles

### Purpose

Establish the shared Veterans Bay visual system before implementing additional pages.

### Prerequisites

- Feature 00.01 complete.
- `context/design-reference/homepage.png` exists and is readable.

### Routes

- Shared foundation; no standalone route required.

### Personas

- All personas.

### Required Work

- Inspect the homepage reference for typography, colour, spacing, surfaces, controls, radii, shadows, navigation, and responsive patterns.
- Configure Inter using the supported Next.js font approach.
- Implement semantic tokens in `src/app/globals.css` or the actual authoritative global stylesheet.
- Implement or configure shared button, field, status, surface, dialog, sheet, dropdown, tooltip, skeleton, spinner, empty, error, and pagination primitives as needed.
- Create shared semantic status mapping and accessible focus behaviour.
- Verify desktop, tablet, and mobile primitive behaviour.
- Remove duplicated token documentation only after the executable theme is verified.

### Business and Security Rules

- Do not hardcode hex colours or raw palette colours when a semantic token exists.
- Do not add page-specific styling to the global stylesheet.
- Do not copy the homepage composition onto operational pages.
- Reuse suitable primitives before creating new ones.
- Status must not depend on colour alone.

### Required States

- Default
- Hover
- Focus-visible
- Disabled
- Loading
- Error
- Success
- Reduced motion

### Domain Events

- None.

### Acceptance Criteria

- The visual system clearly reflects the homepage reference.
- Semantic utilities compile and are used by shared primitives.
- Core controls are keyboard-accessible.
- No competing visual direction is introduced.
- Shared components are ready for page composition.

### Verification

- Run typecheck, lint, component tests, and build.
- Inspect representative desktop, tablet, and mobile states.
- Verify focus, labels, contrast, and reduced motion.

---

## Feature 00.03 — Public Shell and Homepage

### Purpose

Implement the approved public experience and establish the reusable visual shell that guides later pages.

### Prerequisites

- Features 00.01 and 00.02 complete.
- Homepage reference exists.

### Routes

- `/`
- `/marketplace` destination
- `/how-it-works` destination
- `/become-a-professional` destination
- `/login` and `/register` destinations

### Personas

- Public visitor
- Client prospect
- Professional prospect

### Required Work

- Implement reusable public navigation, mobile navigation, page container, footer, and public search treatment.
- Reproduce the approved homepage hierarchy and composition without arbitrary redesign.
- Include clear client and professional entry points, service discovery, categories, trust/value messaging, service-lifecycle explanation, relevant featured content, and final calls to action as shown by the mockup.
- Use realistic typed fixtures only where real data is not yet available.
- Make all controls deliberate: navigate, show an honest unavailable state, or remain visibly non-interactive.
- Add image fallbacks and responsive behaviour.

### Business and Security Rules

- Do not fabricate platform statistics, guarantees, certifications, or live integrations.
- The homepage is the design authority for later pages.
- Navigation must be keyboard-accessible.
- Placeholder destinations must not pretend their workflows are complete.

### Required States

- Default
- Responsive mobile navigation
- Missing image fallback
- Unavailable destination
- Loading only when data is fetched

### Domain Events

- Do not emit marketplace analytics until real search/profile navigation exists.

### Acceptance Criteria

- The homepage closely follows the supplied mockup.
- The public shell is reusable.
- Desktop, tablet, and mobile layouts work.
- No dead or misleading controls remain.
- The homepage and shell receive user visual approval.

### Verification

- Run typecheck, lint, tests, and build.
- Perform keyboard and responsive checks.
- Provide `/` for explicit user browser review.

---

## Feature 00.04 — Hono API and Domain Module Foundation

### Purpose

Establish the authoritative API and modular-monolith boundaries used by all protected workflows.

### Prerequisites

- Feature 00.01 complete.

### Routes

- `/api/health` or equivalent health endpoint
- Versioned API base path if adopted by the repository

### Personas

- All API consumers.

### Required Work

- Create the Hono Worker application and route composition.
- Create shared middleware for correlation IDs, safe error mapping, request logging, CORS/trusted origins, request-size limits, and rate-limit integration.
- Establish the canonical module shape for routes, schemas, services, repositories, permissions, events, types, and tests.
- Create typed application errors, response contracts, and Zod boundary-validation patterns.
- Add a health/readiness endpoint that does not expose secrets.

### Business and Security Rules

- Routes remain thin.
- Domain services own business decisions.
- Raw database rows are not public contracts.
- Internal errors, stack traces, and credentials are never returned.
- Cloudflare runtime compatibility is required.

### Required States

- Healthy
- Dependency unavailable
- Validation error
- Unexpected internal error with correlation ID

### Domain Events

- None.

### Acceptance Criteria

- The API starts locally and in Cloudflare preview.
- Validation and safe error mapping work.
- A sample module follows approved boundaries.
- Health responses are useful but non-sensitive.

### Verification

- Run API unit/integration tests.
- Run build and Cloudflare preview.
- Test malformed input and unexpected error mapping.

---

## Feature 00.05 — Database and Migration Foundation

### Purpose

Establish Neon PostgreSQL and Drizzle as the reliable source of truth for application data.

### Prerequisites

- Features 00.01 and 00.04 complete.
- Read `context/recipes/database.md`.

### Routes

- No direct user-facing route.

### Personas

- All domains.

### Required Work

- Configure the Cloudflare-compatible Neon and Drizzle connection pattern.
- Establish schema, relation, migration, repository, and database-test locations.
- Create foundational account-profile, restriction, organisation, membership, role/permission, audit, file metadata, and outbox structures only as required by Phase 00.
- Add timezone-aware timestamps, stable identifiers, actor traceability, and tenant ownership.
- Create migration generation, apply, and verification commands.
- Add isolated repository-test helpers.

### Business and Security Rules

- Every schema change uses a committed migration.
- Applied shared migrations are not rewritten.
- Private records have a trusted access boundary.
- Money uses integer minor units and explicit currency.
- JSON is limited to bounded metadata and versioned payloads.

### Required States

- Connected
- Configuration unavailable
- Migration failure
- Transaction rollback

### Domain Events

- None.

### Acceptance Criteria

- A clean database can be created from migrations.
- An upgrade path from the current repository state works.
- Foundational constraints and indexes exist.
- Cloudflare runtime database access works.
- Transaction rollback is proven.

### Verification

- Run clean and upgrade migration tests.
- Run constraint, repository, and rollback tests.
- Run Cloudflare preview database access.

---

## Feature 00.06 — Identity and Account Management

### Purpose

Allow users to securely register, authenticate, and maintain one identity that can participate in multiple contexts.

### Prerequisites

- Features 00.04 and 00.05 complete.
- Read `context/recipes/auth.md`.

### Routes

- `/register`
- `/login`
- `/forgot-password` when delivery is configured
- `/reset-password` when delivery is configured
- `/verify-email` when delivery is configured
- `/account/profile`
- `/account/sessions`

### Personas

- Client
- Professional owner
- Professional team member
- Platform administrator

### Required Work

- Configure Better Auth using the installed version and supported Worker pattern.
- Implement registration, sign-in, sign-out, session validation, profile update, session management, terms/privacy acceptance, and account deactivation.
- Implement email verification and password reset only when delivery is configured.
- Reconcile application profile records idempotently.
- Implement account restriction checks.
- Add distributed rate limiting to authentication endpoints.
- Support recent authentication for designated sensitive actions where required.

### Business and Security Rules

- Email addresses are unique.
- Do not store one permanent application role on the user.
- Suspended or deactivated users cannot perform protected actions.
- Email verification is required before professional publication.
- Authentication errors must not expose sensitive details or enable account enumeration.
- Backend session validation is authoritative.

### Required States

- Default form
- Submitting
- Field validation
- Invalid credentials
- Rate limited
- Verification required
- Restricted account
- Success

### Domain Events

- user.registered
- user.email_verified
- user.profile_updated
- user.suspended
- user.deactivated

### Acceptance Criteria

- A user can register and sign in.
- A user can hold client, organisation, membership, and platform contexts concurrently.
- Suspended accounts cannot use protected features.
- Session management and sign-out work.
- Email-dependent flows are truthful when enabled.

### Verification

- Test registration retries, duplicate email, sign-in/out, invalid credentials, session expiry, restrictions, and rate limiting.
- Test redirect safety, cookies, origins, and secret exposure.
- Run typecheck, lint, tests, build, and Worker preview.

---

## Feature 00.07 — Workspace and Permission Foundation

### Purpose

Allow one authenticated identity to operate safely in client, professional, team-member, and platform contexts.

### Prerequisites

- Features 00.05 and 00.06 complete.

### Routes

- `/workspace/select` when multiple contexts exist
- Protected client, professional, and admin shell guards

### Personas

- Client
- Professional owner
- Professional team member
- Platform administrator

### Required Work

- Implement workspace resolution from current server records.
- Implement organisation membership, standard roles, permissions, and platform-role assignments.
- Create reusable Hono authorization middleware and domain permission helpers.
- Implement route and navigation gating without treating hidden UI as access control.
- Ensure membership removal and suspension take effect without stale-session authority.
- Create shared authenticated shell foundations for client, professional/team, and admin experiences.

### Business and Security Rules

- Current membership and assignment are checked server-side.
- The final owner cannot lose ownership without approved transfer.
- Removed members immediately lose organisation access.
- Team members access only assigned work unless granted broader permission.
- Platform administration requires a current platform assignment.

### Required States

- Single workspace
- Multiple workspace selection
- No eligible workspace
- Permission denied
- Restricted account

### Domain Events

- organization.member_role_changed
- organization.member_removed

### Acceptance Criteria

- A multi-context user can select eligible workspaces.
- Cross-organisation access is rejected.
- Permission changes apply immediately.
- Authenticated shells inherit the approved design language.
- The first authenticated shell receives user review.

### Verification

- Test account, workspace, membership, platform-role, and assignment authorization.
- Test cross-tenant and stale-session behaviour.
- Perform responsive and keyboard checks on authenticated shells.

---

## Feature 00.08 — File Storage Foundation

### Purpose

Establish secure upload, metadata, linking, private delivery, replacement, and cleanup patterns.

### Prerequisites

- Features 00.04–00.07 complete.
- Read `context/recipes/storage.md`.

### Routes

- Authenticated upload-intent and upload-registration API endpoints
- Authorized asset-delivery endpoint where required

### Personas

- Authenticated clients, professionals, team members, and administrators

### Required Work

- Configure Cloudinary using server-only bindings.
- Define purpose-specific upload policies for avatar, logo, portfolio, service image, request attachment, job evidence, verification document, message attachment, payment evidence, warranty evidence, and dispute evidence.
- Implement short-lived bounded upload authorization.
- Verify completed uploads before persisting metadata.
- Implement authorized linking, public/private visibility, signed delivery, replacement, deletion restrictions, and orphan cleanup.
- Limit the MVP to approved images and small documents.

### Business and Security Rules

- The browser never decides authoritative owner, organisation, folder, public ID, target record, visibility, or retention.
- Private evidence requires authorization on every access.
- Historical evidence is not silently replaced or deleted.
- Provider failures do not corrupt valid business records.
- Secrets and signatures never enter client bundles or logs.

### Required States

- Selecting
- Uploading
- Processing
- Unsupported type
- Oversized file
- Expired authorization
- Access denied
- Upload success

### Domain Events

- attachment.added when linked to an engagement

### Acceptance Criteria

- Approved uploads work.
- Invalid, expired, tampered, or cross-tenant uploads are rejected.
- Private delivery is authorized.
- Replacement and cleanup are idempotent and safe.
- Metadata supports ownership and audit.

### Verification

- Test valid/invalid uploads, expiry, tampered completion, private delivery, cross-tenant linking, replacement, deletion, cleanup, and provider failure.
- Inspect client output and logs for secrets.

---

## Feature 00.09 — Transactional Outbox and Queue Proof of Concept

### Purpose

Prove reliable secondary processing without coupling business success to background delivery.

### Prerequisites

- Features 00.04 and 00.05 complete.
- Read `context/recipes/queues.md`.

### Routes

- Internal publisher/consumer endpoints or Worker bindings only.

### Personas

- Platform runtime.

### Required Work

- Create versioned event contracts and the `outbox_events` model.
- Insert a sample event in the same transaction as a sample authoritative change.
- Implement bounded outbox claiming and Queue publication.
- Implement an idempotent sample consumer with processed-event recording.
- Implement retries, safe failure metadata, abandoned-claim recovery, and dead-letter foundations.
- Add a scheduled-trigger proof of concept for bounded recovery.

### Business and Security Rules

- Queue delivery is at least once.
- Retries retain the original event ID.
- The primary transaction succeeds independently from later Queue processing.
- Consumers validate event type and version.
- Duplicate delivery creates one secondary effect.

### Required States

- Pending publication
- Published
- Retry scheduled
- Processing
- Processed
- Dead-lettered

### Domain Events

- A safe internal proof event only; domain events are added by their features.

### Acceptance Criteria

- Business change and outbox insertion are atomic.
- Duplicate and concurrent duplicate delivery create one effect.
- Failures retry and remain observable.
- Cron repetition is safe.
- Cloudflare preview bindings work.

### Verification

- Test atomicity, rollback, claims, abandoned recovery, duplicate delivery, retries, dead letters, and repeated Cron.
- Run Worker preview with Queue bindings.

---

## Feature 00.10 — Shared Feedback and Operational Guardrails

### Purpose

Provide reusable feedback, safety, and quality controls used by later features.

### Prerequisites

- Features 00.01–00.09 complete as applicable.

### Routes

- Shared foundation.

### Personas

- All personas.

### Required Work

- Implement standard loading, empty, filtered no-result, error, permission, stale-conflict, unavailable, success, confirmation, and processing patterns.
- Implement shared pagination and bounded-list conventions.
- Implement safe error codes, correlation IDs, structured logs, and baseline audit helpers.
- Add rate-limit foundations for public submissions.
- Add repeatable typecheck, lint, test, build, and preview verification scripts.
- Document only actual required environment categories in `.env.example`.

### Business and Security Rules

- Critical errors appear inline rather than only in toasts.
- Success is shown only after authoritative success.
- Consequential actions require confirmation.
- Logs exclude secrets and private content.
- Large lists are paginated.

### Required States

- All shared feedback states

### Domain Events

- None.

### Acceptance Criteria

- Later features can reuse complete feedback patterns.
- Errors are safe and traceable.
- Verification commands are repeatable.
- Phase 00 completion criteria are satisfied.

### Verification

- Run full typecheck, lint, test, build, preview, responsive, accessibility, authorization, storage, database, and Queue foundation checks.
