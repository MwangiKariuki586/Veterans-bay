# Phase 01 — Establish the Professional Marketplace

## Outcome

Allow professionals to create approved operational organisations, manage teams and services, publish trustworthy profiles, and allow clients to discover eligible services and professionals.

## Completion Criteria

- Professional onboarding is resumable and reviewable.
- Team access is permission-limited.
- Approved organisations can publish complete service listings.
- Public profiles expose safe verified information.
- Marketplace search, filtering, sorting, pagination, saving, and detail navigation work.
- Administrators can review professional applications and moderate marketplace publication.

## Ordered Features

1. Feature 01.01 — Professional Organisation Onboarding
2. Feature 01.02 — Team and Permission Management
3. Feature 01.03 — Professional Profile and Service Catalogue
4. Feature 01.04 — Marketplace Discovery
5. Feature 01.05 — Professional Review and Marketplace Moderation

---

## Feature 01.01 — Professional Organisation Onboarding

### Purpose

Allow an independent professional or service business to create an operational organisation and submit it for review.

### Prerequisites

- Phase 00 complete.
- Identity, workspace, database, and storage foundations verified.

### Routes

- `/professional/onboarding`
- `/professional/onboarding/review`
- `/professional/settings/profile`

### Personas

- Professional owner
- Platform administrator for review readiness

### Required Work

- Collect business/professional name, type, primary category, description, phone, email, operating location, service areas, working hours, logo/profile image, verification information, and terms acceptance.
- Support save-and-resume onboarding.
- Create one organisation, owner membership, and professional profile for an independent professional.
- Implement statuses: DRAFT, PENDING_REVIEW, ACTIVE, REQUIRES_CHANGES, SUSPENDED, DEACTIVATED.
- Store verification status separately from organisation status.
- Implement submission eligibility, history, and review-readiness summaries.
- Use private storage for verification evidence.

### Business and Security Rules

- Only active approved organisations may publish publicly.
- The owner retains ownership access.
- Suspended organisations cannot accept new work.
- Verification does not imply a service-quality guarantee.
- Organisation and evidence access are tenant-scoped.

### Required States

- First-time empty
- Draft saved
- Incomplete
- Uploading evidence
- Pending review
- Changes required
- Approved
- Suspended
- Error

### Domain Events

- professional.onboarding_started
- professional.profile_submitted
- professional.profile_approved
- professional.profile_rejected
- professional.profile_suspended

### Acceptance Criteria

- A professional can save and resume.
- A valid profile can be submitted.
- Incomplete profiles cannot be submitted.
- Private evidence is protected.
- Submission history and reasons are preserved.
- Approved profiles become eligible for publication.

### Verification

- Test draft persistence, validation, submission, retries, status transitions, tenant isolation, private files, and suspension.
- Perform responsive and accessibility checks.

---

## Feature 01.02 — Team and Permission Management

### Purpose

Allow professional organisations to involve staff safely without granting universal access.

### Prerequisites

- Feature 01.01 provides an organisation and owner.
- Phase 00 permission foundation verified.

### Routes

- `/professional/team`
- `/professional/team/invitations`
- `/professional/team/[memberId]`

### Personas

- Professional owner
- Authorised manager
- Invited team member

### Required Work

- Implement standard roles: Owner, Manager, Dispatcher, Technician, Receptionist, Accountant.
- Implement permissions covering services, enquiries, quotations, bookings, assignments, jobs, customers, payments, reports, and team management.
- Allow authorised users to invite, activate/deactivate, assign/change roles, review activity, restrict financial data, and restrict members to assigned jobs.
- Implement invitation acceptance and expiry.
- Preserve membership and role history.

### Business and Security Rules

- Hono enforces every permission.
- Hidden buttons are not access control.
- Technicians see only assigned jobs unless granted broader access.
- The final owner cannot remove ownership without transfer.
- Removed members immediately lose access.
- Financial reports require explicit permission.

### Required States

- No team
- Invitation pending
- Invitation expired
- Active member
- Deactivated member
- Permission denied
- Transfer ownership confirmation

### Domain Events

- organization.member_invited
- organization.member_joined
- organization.member_role_changed
- organization.member_removed

### Acceptance Criteria

- Invitation and membership lifecycle works.
- Role and permission changes take effect immediately.
- Assignment restrictions are enforced server-side.
- Ownership cannot be orphaned.
- Team activity is traceable.

### Verification

- Test invitation retries, expiry, role changes, removal, ownership transfer, permission matrix, cross-tenant access, and stale sessions.

---

## Feature 01.03 — Professional Profile and Service Catalogue

### Purpose

Allow approved professionals to present their capabilities and define what clients can request or book.

### Prerequisites

- Features 01.01 and 01.02 complete as required.
- Organisation is eligible for publication.

### Routes

- `/professional/profile`
- `/professional/services`
- `/professional/services/new`
- `/professional/services/[serviceId]`
- `/professionals/[slug]`
- `/services/[slug]`

### Personas

- Professional owner
- Member with `services.manage`
- Public client/visitor

### Required Work

- Implement public profile content: business name, description, categories, service area, availability summary, verification status, portfolio, verified rating, completed jobs, response indicators, and active services.
- Implement service fields: name, category, description, fulfilment model, pricing model, estimated duration, service area, requirements, images, active status, warranty information, and direct-booking availability.
- Support draft, publish, unpublish, and suspension-aware visibility.
- Preserve the service snapshot used for historical bookings.
- Implement portfolio management with approved storage purposes.

### Business and Security Rules

- A service requires category, description, and fulfilment model before publication.
- Fixed-price services require an authoritative price.
- Custom-quotation services do not show misleading totals.
- Suspended or unpublished services do not appear publicly.
- Only approved active organisations publish.
- Public contracts exclude private organisation and verification details.

### Required States

- No services
- Draft
- Validation error
- Publishing
- Published
- Unpublished
- Suspended
- Image upload failure
- Public unavailable

### Domain Events

- service.created
- service.updated
- service.published
- service.unpublished
- portfolio.item_added

### Acceptance Criteria

- An authorised professional can create and publish a valid service.
- Invalid pricing/fulfilment combinations are rejected.
- Public profile and service pages align with the homepage design.
- Historical service snapshots are preserved.
- Private fields never enter public responses.

### Verification

- Test permissions, publication eligibility, pricing/fulfilment combinations, visibility, snapshots, files, public projections, responsive behaviour, and accessibility.

---

## Feature 01.04 — Marketplace Discovery

### Purpose

Allow clients to find suitable active professionals and published services using PostgreSQL search and indexed filtering.

### Prerequisites

- Feature 01.03 complete.
- Searchable indexes and public projections verified.

### Routes

- `/marketplace`
- Optional service/professional result tabs or sub-routes
- `/professionals/[slug]`
- `/services/[slug]`
- `/client/saved` for authenticated users

### Personas

- Public visitor
- Client

### Required Work

- Implement keyword search, category browsing, location, fulfilment model, price type, availability, and verification filters.
- Implement sorting by relevance, rating, or completed jobs without relying only on average rating.
- Use URL state for search, filters, sort, and pagination.
- Implement result cards, active filter chips, result count, pagination, and a mobile filter sheet.
- Allow authenticated clients to save professionals.
- Record safe asynchronous analytics events without delaying results.

### Business and Security Rules

- Only active organisations and published services appear.
- Unverified professionals may appear but are clearly identified.
- Future sponsored placement must be visibly labelled.
- Public data is safe and bounded.
- Changing search/filter resets pagination.
- Page size defaults to 10 unless approved otherwise.

### Required States

- Initial loading
- Results
- Empty marketplace
- Filtered no result
- Error
- Save requires authentication
- Saved
- Mobile filters

### Domain Events

- marketplace.search_performed
- professional.profile_viewed
- service.viewed
- professional.saved

### Acceptance Criteria

- Clients can search, filter, sort, paginate, open details, and save eligible professionals.
- URL state survives refresh and navigation.
- Public queries are indexed and bounded.
- Inactive or private records never appear.
- The page inherits the homepage visual system without copying its layout.

### Verification

- Test search/filter combinations, pagination, sorting, visibility, public projections, save authorization, analytics non-blocking behaviour, query performance, responsive layout, and accessibility.

---

## Feature 01.05 — Professional Review and Marketplace Moderation

### Purpose

Allow authorised administrators to review professional applications and control marketplace publication safely.

### Prerequisites

- Features 01.01 and 01.03 complete.
- Platform-role and audit foundations verified.

### Routes

- `/admin/professionals`
- `/admin/professionals/[organizationId]`
- `/admin/categories`
- `/admin/marketplace/listings`

### Personas

- Platform administrator

### Required Work

- Implement pending-review queues and application detail with authorized evidence access.
- Allow approval, request changes, rejection, suspension, restoration, category management, and listing moderation needed for marketplace operation.
- Require reasons for consequential decisions.
- Preserve evidence, decision history, actor, and timestamps.
- Notify affected users through the event foundation when notification delivery is available.

### Business and Security Rules

- Only current platform administrators may act.
- Administrators must not silently edit professional transactional records.
- High-risk actions are audit logged.
- Private verification evidence remains restricted.
- Approval and suspension rules are enforced server-side.

### Required States

- Empty queue
- Pending review
- Evidence loading
- Changes requested
- Approved
- Rejected
- Suspended
- Permission denied
- Error

### Domain Events

- professional.profile_approved
- professional.profile_rejected
- professional.profile_suspended
- content.hidden
- account.suspended
- account.restored

### Acceptance Criteria

- Administrators can reach traceable decisions.
- Approved organisations become publish-eligible.
- Suspended organisations disappear from discovery and cannot accept new work.
- Every decision has actor, reason, and history.

### Verification

- Test platform-role authorization, decision transitions, audit records, evidence access, marketplace visibility effects, and notification-event creation.
