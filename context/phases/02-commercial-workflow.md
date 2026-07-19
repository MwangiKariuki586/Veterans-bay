# Phase 02 — Enable Request-to-Booking Commerce

## Outcome

Allow a client and professional to progress from a service requirement through enquiry, contextual conversation, versioned quotation, acceptance, and confirmed booking.

## Completion Criteria

- Clients can create, submit, track, clarify, and cancel eligible requests.
- Professionals can review and respond to enquiries.
- Engagement communication stays attached to the relevant record.
- Submitted quotation versions are immutable and comparable.
- The current eligible quotation can be accepted transactionally.
- Bookings validate availability and prevent conflicts.
- Core in-app notifications are created asynchronously and idempotently.

## Ordered Features

1. Feature 02.01 — Service Requests and Enquiries
2. Feature 02.02 — Engagement Conversations and Activity Timeline
3. Feature 02.03 — Quotations and Versioning
4. Feature 02.04 — Booking and Scheduling
5. Feature 02.05 — Core In-App Notifications

---

## Feature 02.01 — Service Requests and Enquiries

### Purpose

Allow clients to submit requirements before a confirmed booking and professionals to qualify the enquiry.

### Prerequisites

- Phase 01 complete.
- Identity, storage, permissions, and marketplace context verified.

### Routes

- `/client/requests`
- `/client/requests/new`
- `/client/requests/[requestId]`
- `/professional/enquiries`
- `/professional/enquiries/[requestId]`

### Personas

- Client
- Professional owner
- Authorised professional member

### Required Work

- Capture category, preferred professional, description, location, preferred time, budget range, attachments, urgency, and contact preference.
- Support sources: MARKETPLACE_DISCOVERY, PROFESSIONAL_BOOKING_LINK, PROFESSIONAL_IMPORTED, REPEAT_CLIENT, DIRECT_SERVICE_PAGE.
- Implement statuses: DRAFT, SUBMITTED, UNDER_REVIEW, MORE_INFORMATION_REQUIRED, ASSESSMENT_REQUIRED, QUOTED, CONVERTED, DECLINED, CANCELLED, EXPIRED.
- Allow draft save, submission, supporting information, clarification, cancellation, progress viewing, professional review, follow-up questions, decline, assessment request, and conversion eligibility.
- Implement private professional notes separated from client-visible content.

### Business and Security Rules

- Only the client and authorised organisation members access a request.
- Cancelled or expired requests cannot be quoted.
- Acquisition source becomes immutable after submission.
- Private professional notes are never client-visible.
- Every transition is validated and recorded.
- Attachments follow purpose and participant authorization.

### Required States

- No requests
- Draft
- Submitting
- Submitted
- Under review
- More information required
- Assessment required
- Declined
- Cancelled
- Expired
- Error

### Domain Events

- service_request.submitted
- service_request.updated
- service_request.information_requested
- service_request.declined
- service_request.cancelled

### Acceptance Criteria

- A client can create and track a request.
- An eligible professional can qualify it.
- Clarification works without exposing private notes.
- Invalid transitions and cross-participant access are rejected.
- Origin and history are preserved.

### Verification

- Test validation, draft/submission retries, transitions, cancellation/expiry, access, private notes, attachments, origin immutability, responsive behaviour, and accessibility.

---

## Feature 02.02 — Engagement Conversations and Activity Timeline

### Purpose

Keep important service communication and system activity attached to the relevant engagement.

### Prerequisites

- Feature 02.01 provides a request context.
- Storage and permission foundations verified.

### Routes

- Conversation panels/pages within request, quotation, booking, job, warranty, and dispute details
- Optional `/client/messages` and `/professional/messages` consolidated views

### Personas

- Engagement client
- Authorised professional members
- Administrators only when moderation authority applies

### Required Work

- Create conversation contexts for service request, quotation, booking, job, warranty claim, and dispute.
- Allow text messages, approved attachments, unread state, and system-generated activity.
- Show a unified engagement timeline including quotation, booking, payment, job, variation, completion, and warranty events as they become available.
- Use polling or targeted refresh for the MVP.
- Preserve required transactional history when accounts are deactivated.

### Business and Security Rules

- Conversation access derives from current engagement participation.
- System activity cannot be edited by users.
- Messaging does not replace quotation acceptance, variation approval, completion confirmation, or other structured actions.
- Deactivated accounts do not erase required history.
- Attachments remain participant-authorized.

### Required States

- No messages
- Loading
- Sending
- Sent
- Send failed
- Unread
- Attachment failure
- Access denied

### Domain Events

- message.sent
- message.read
- attachment.added
- engagement.activity_recorded

### Acceptance Criteria

- Participants can communicate in context.
- Unread state is accurate.
- Activity and messages are visually distinguishable.
- Unauthorized users cannot access conversations.
- Duplicate submission does not duplicate a message.

### Verification

- Test participation, send retry/idempotency, unread changes, attachment authorization, deactivated accounts, activity immutability, polling, and accessibility.

---

## Feature 02.03 — Quotations and Versioning

### Purpose

Allow professionals to formally define scope, pricing, timing, warranty, and payment terms with immutable submitted versions.

### Prerequisites

- Features 02.01 and 02.02 complete.
- Database transaction and outbox foundations verified.

### Routes

- `/professional/quotations`
- `/professional/quotations/new`
- `/professional/quotations/[quotationId]`
- `/client/quotations`
- `/client/quotations/[quotationId]`

### Personas

- Client
- Professional owner
- Member with quotation permissions

### Required Work

- Implement labour, materials, transport, additional charges, discounts, tax, deposit, expected duration, proposed start, validity, scope, exclusions, warranty terms, and payment terms.
- Implement statuses: DRAFT, SUBMITTED, VIEWED, ACCEPTED, DECLINED, REVISION_REQUESTED, REPLACED, EXPIRED, CANCELLED.
- Create immutable submitted versions and a clear comparison between versions.
- Allow client view, accept, decline, revision request, printable/downloadable representation, questions, and version history.
- Calculate totals server-side.
- Implement acceptance transaction that records actor/version/time, creates booking and payment-requirement foundations where applicable, copies accepted terms, creates history, and inserts `quotation.accepted` in the outbox.

### Business and Security Rules

- Only the current active eligible version may be accepted.
- Expired, replaced, declined, cancelled, or stale versions cannot be accepted.
- Submitted versions cannot be edited.
- Acceptance is idempotent and transactional.
- Copied commercial terms remain historically stable.
- Only current participants may act.

### Required States

- No quotations
- Draft
- Submitting
- Submitted
- Viewed
- Revision requested
- Version comparison
- Expired
- Accepted
- Declined
- Stale conflict
- Error

### Domain Events

- quotation.submitted
- quotation.viewed
- quotation.revision_requested
- quotation.accepted
- quotation.declined
- quotation.expired

### Acceptance Criteria

- Professionals can create and revise quotations.
- Clients understand totals, terms, exclusions, and version changes.
- Only one eligible acceptance succeeds under concurrency.
- Acceptance creates consistent booking/payment foundations and outbox event.
- History remains immutable.

### Verification

- Test totals, permissions, immutable submissions, revisions, expiry, stale acceptance, concurrent duplicate acceptance, rollback, copied terms, outbox atomicity, printable output, responsive behaviour, and accessibility.

---

## Feature 02.04 — Booking and Scheduling

### Purpose

Convert an accepted or directly bookable service arrangement into a conflict-safe scheduled engagement.

### Prerequisites

- Feature 02.03 complete for quotation-origin bookings.
- Service fulfilment models and professional availability foundations exist.

### Routes

- `/client/bookings`
- `/client/bookings/[bookingId]`
- `/professional/bookings`
- `/professional/calendar`
- `/professional/availability`

### Personas

- Client
- Professional owner
- Dispatcher/manager
- Assigned team member where relevant

### Required Work

- Support booking origins: direct service, accepted quotation, approved assessment, repeat booking, and professional-created customer booking.
- Implement statuses: PENDING_CONFIRMATION, PENDING_DEPOSIT, CONFIRMED, RESCHEDULE_REQUESTED, RESCHEDULED, CANCELLED, COMPLETED, NO_SHOW.
- Allow working hours, unavailable dates, service duration, team assignment, rescheduling, individual/team calendars, and conflict prevention.
- Allow clients to choose eligible times, request rescheduling, cancel under policy, and view assigned professional details.
- Preserve schedule history and cancellation-policy acknowledgement.
- Use transactions and constraints to prevent duplicate reservations.

### Business and Security Rules

- Server authority validates availability.
- Concurrent attempts cannot create duplicate reservations.
- Confirmation may depend on deposit status without pretending live payment integration exists.
- Cancellation policy and consequences appear before confirmation.
- Schedule changes are recorded.
- Assigned-member access follows permissions.

### Required States

- No bookings
- Availability loading
- No slots
- Pending confirmation
- Pending deposit
- Confirmed
- Reschedule requested
- Cancelled
- No-show
- Conflict
- Error

### Domain Events

- booking.created
- booking.confirmed
- booking.reschedule_requested
- booking.rescheduled
- booking.cancelled
- booking.no_show_recorded

### Acceptance Criteria

- Eligible bookings can be created and confirmed.
- Conflicts are prevented under concurrency.
- Reschedules and cancellations preserve history.
- Client and professional views remain consistent.
- Calendars are usable on desktop and mobile.

### Verification

- Test availability, time zones, conflict constraints, concurrent attempts, confirmation, deposit dependency, reschedule/cancel policy, assignments, history, and responsive calendar behaviour.

---

## Feature 02.05 — Core In-App Notifications

### Purpose

Notify users about important request, quotation, conversation, and booking actions without coupling notification success to the original transaction.

### Prerequisites

- Features 02.01–02.04 produce versioned domain events.
- Queue foundation verified.

### Routes

- `/notifications`
- Authenticated notification centre in client and professional shells

### Personas

- Client
- Professional owner
- Professional team member

### Required Work

- Create notification records from Queue-consumed domain events.
- Cover new requests, responses, quotation submitted/viewed/accepted, clarification, booking confirmation, and schedule changes.
- Implement unread count, list, mark read, mark all read where appropriate, and safe internal action targets.
- Create unique source-event protection and idempotent consumers.
- Implement retry and dead-letter behaviour.

### Business and Security Rules

- Notification failure never fails the original action.
- Duplicate delivery creates one notification per intended recipient.
- Action targets cannot redirect outside approved internal routes.
- Organisation and engagement privacy remain enforced.
- Email is not represented as available unless configured.

### Required States

- No notifications
- Loading
- Unread
- Read
- Marking read
- Failure
- Stale target unavailable

### Domain Events

- notification.created
- notification.delivered
- notification.read
- notification.failed

### Acceptance Criteria

- Relevant participants receive one actionable notification.
- Unread counts remain accurate.
- Duplicate events do not duplicate notifications.
- Primary workflows succeed when notification processing fails.
- Failed processing remains observable.

### Verification

- Test event mapping, recipient resolution, idempotency, retries, dead letters, unread state, target safety, tenant isolation, and primary-action independence.
