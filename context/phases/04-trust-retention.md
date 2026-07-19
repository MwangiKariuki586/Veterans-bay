# Phase 04 — Establish Trust and Retention

## Outcome

Preserve clear financial records, provide structured warranty support, generate verified reputation, manage professional-owned customers, and enable repeat work.

## Completion Criteria

- Invoices, payments, allocations, balances, and reversals are accurate and auditable.
- Completed eligible work can create a warranty and structured claim.
- Eligible clients can submit one verified review.
- Reputation metrics are derived asynchronously and remain recalculable.
- Professionals manage marketplace, invited, imported, referred, and repeat customers without losing acquisition source.
- Repeat bookings use current commercial rules.
- Notifications cover post-service actions.

## Ordered Features

1. Feature 04.01 — Invoices and Manual Payment Records
2. Feature 04.02 — Warranty and Follow-Up
3. Feature 04.03 — Reviews and Professional Reputation
4. Feature 04.04 — Professional Customer Management
5. Feature 04.05 — Repeat Booking and Service Reminders
6. Feature 04.06 — Post-Service Notification Coverage

---

## Feature 04.01 — Invoices and Manual Payment Records

### Purpose

Give clients and professionals a clear financial record without requiring live payment-provider integration.

### Prerequisites

- Phase 03 completion flow verified.
- Database transaction and storage evidence foundations verified.

### Routes

- `/professional/invoices`
- `/professional/invoices/[invoiceId]`
- `/professional/payments`
- `/client/invoices`
- `/client/invoices/[invoiceId]`

### Personas

- Client
- Professional owner
- Accountant or member with financial permission

### Required Work

- Implement invoice, invoice item, payment, payment allocation, reversal/refund record, and optional platform-fee record foundations.
- Implement statuses: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED, REFUNDED.
- Allow authorised users to record amount, date, method, transaction reference, notes, and supporting evidence.
- Allocate one payment across eligible invoice items.
- Calculate balances server-side and preserve financial history.
- Present manual records clearly as manually recorded rather than provider-confirmed.

### Business and Security Rules

- Do not use a single paid boolean.
- Allocations cannot exceed payable balance without explicit overpayment handling.
- Only authorised members record or reverse payments.
- Reversals preserve original records.
- Money uses integer minor units and explicit currency.
- Live M-Pesa/card flows remain deferred.

### Required States

- No invoices
- Draft
- Issued
- Partially paid
- Paid
- Overdue
- Recording payment
- Allocation error
- Reversed
- Evidence unavailable

### Domain Events

- invoice.issued
- payment.recorded
- payment.allocated
- invoice.paid
- payment.reversed
- refund.recorded

### Acceptance Criteria

- Invoices and balances are accurate.
- Payments allocate transactionally and idempotently.
- Reversals retain audit history.
- Clients see understandable financial records.
- Permission-restricted financial data remains private.

### Verification

- Test money calculations, allocations, overpayment handling, concurrent recording, permissions, reversals, evidence, rollback, outbox atomicity, and public/private projections.

---

## Feature 04.02 — Warranty and Follow-Up

### Purpose

Create structured post-service protection for eligible recorded work.

### Prerequisites

- Completed eligible job exists.
- Financial/service records and storage evidence foundations verified.

### Routes

- `/client/warranties`
- `/client/warranties/[warrantyId]`
- `/professional/warranties`
- `/professional/warranties/[warrantyId]`

### Personas

- Client
- Professional owner
- Authorised team member
- Administrator for escalations

### Required Work

- Create warranty records with covered service, start/end dates, terms, exclusions, responsible professional, and claim history.
- Implement claim statuses: SUBMITTED, UNDER_REVIEW, ACCEPTED, RETURN_VISIT_SCHEDULED, RESOLVED, REJECTED, ESCALATED.
- Allow claim submission with evidence, professional review, reasoned rejection, acceptance, return-visit scheduling, resolution, and escalation.
- Derive warranty duration from service/category or accepted quotation terms.
- Connect claims to engagement timeline and notifications.

### Business and Security Rules

- Coverage applies only to eligible platform-recorded jobs.
- Claim access is participant-scoped.
- Rejection requires a reason.
- Repeated unresolved issues may contribute to reputation signals.
- The platform does not promise financial compensation during MVP.
- History and evidence are preserved.

### Required States

- No warranties
- Active
- Expired
- Submitting claim
- Under review
- Accepted
- Return visit scheduled
- Resolved
- Rejected
- Escalated
- Error

### Domain Events

- warranty.created
- warranty.claim_submitted
- warranty.claim_accepted
- warranty.return_visit_scheduled
- warranty.resolved

### Acceptance Criteria

- Eligible completion creates or enables the correct warranty.
- Clients can submit and track claims.
- Professionals respond with traceable decisions.
- Return visits connect to scheduling/job history.
- Unauthorized or out-of-coverage claims are rejected safely.

### Verification

- Test eligibility, terms, expiry, participant access, evidence, decisions, return visits, escalation, history, and duplicate event processing.

---

## Feature 04.03 — Reviews and Professional Reputation

### Purpose

Create trusted reputation records based on verified completed work.

### Prerequisites

- Completed eligible job exists.
- Review and Queue foundations verified.

### Routes

- Review action within completed job
- `/professional/reviews`
- Public review sections on professional profile
- Reported-review administration completed in Phase 05

### Personas

- Eligible client
- Professional owner
- Public visitor
- Administrator for moderation

### Required Work

- Allow one eligible review with overall satisfaction, service quality, communication, timeliness, professionalism, value, and written feedback.
- Allow one professional public response.
- Implement reporting hooks and moderation state.
- Derive verified completed jobs, average rating, response rate, completion rate, repeat rate, cancellation rate, warranty-resolution rate, and dispute rate from source records.
- Process reputation recalculation asynchronously and make it rebuildable.

### Business and Security Rules

- Only the engagement client reviews after completion and within the review period.
- One review per job.
- Professionals cannot delete negative reviews.
- Hidden reviews remain in moderation history.
- Reputation is not incremented blindly from duplicate events.
- Public metrics must not imply guarantees.

### Required States

- Eligible
- Not yet eligible
- Expired
- Already reviewed
- Submitting
- Published
- Response added
- Reported
- Hidden by moderation

### Domain Events

- review.requested
- review.submitted
- review.responded
- review.reported
- review.moderated
- reputation.recalculation_requested

### Acceptance Criteria

- Only eligible clients submit one review.
- Professional response rules work.
- Public reputation derives from verified records.
- Duplicate Queue delivery does not inflate metrics.
- Metrics can be recalculated from source data.

### Verification

- Test eligibility, review window, duplicate/concurrent submission, permissions, moderation state, response limit, recalculation idempotency, rebuild accuracy, and public projection.

---

## Feature 04.04 — Professional Customer Management

### Purpose

Provide professionals with a lightweight organisation-scoped customer workspace for marketplace and existing customers.

### Prerequisites

- Identity, organisation, service history, quotations, bookings, jobs, and payment records exist as applicable.

### Routes

- `/professional/customers`
- `/professional/customers/new`
- `/professional/customers/[customerId]`

### Personas

- Professional owner
- Authorised manager/receptionist/accountant according to permissions

### Required Work

- Allow viewing customers, adding existing customers, inviting customers, tags, private notes, service history, quotations, bookings, balances, repeat-booking entry, and service reminders.
- Preserve origins: MARKETPLACE_ACQUIRED, PROFESSIONAL_INVITED, PROFESSIONAL_IMPORTED, CLIENT_REFERRAL, REPEAT_CLIENT.
- Keep imported contacts separate from authenticated platform identities until invitation/registration reconciliation.
- Provide safe duplicate detection and organisation-scoped search, filters, and pagination.

### Business and Security Rules

- Acquisition source is preserved.
- One organisation cannot access another organisation’s notes or customers.
- Imported customers do not automatically become platform users.
- Professional-brought customers are not treated as marketplace-acquired.
- Contact details are used only for valid service purposes.
- Financial visibility requires permission.

### Required States

- No customers
- Imported contact
- Invitation pending
- Registered customer
- Duplicate candidate
- Permission restricted
- Search no result
- Error

### Domain Events

- customer.added
- customer.invited
- customer.tagged

### Acceptance Criteria

- Professionals can manage marketplace and existing customers.
- Origins and private notes are accurate.
- Imported and registered identities reconcile safely.
- Tenant isolation and permission-restricted balances are enforced.
- Lists are searchable and paginated.

### Verification

- Test origins, import/invite/reconciliation, duplicate handling, notes, permissioned finances, tenant isolation, pagination, and privacy.

---

## Feature 04.05 — Repeat Booking and Service Reminders

### Purpose

Allow professionals and clients to begin new work from an existing relationship without reusing stale commercial terms.

### Prerequisites

- Feature 04.04 complete.
- Current service catalogue and booking workflows available.

### Routes

- Repeat action within customer and service-history details
- Guided client repeat-booking flow

### Personas

- Client
- Professional owner
- Authorised staff

### Required Work

- Allow repeat booking from eligible completed service history.
- Pre-fill safe context such as customer, location, category, and previous service reference.
- Revalidate current service availability, fulfilment model, price, duration, and professional status.
- Allow professional-created repeat booking for valid customer records.
- Implement service reminders with due date, reason, recipient, cancellation, and scheduled event.

### Business and Security Rules

- Historical prices and terms are references, not current authority.
- Repeat work creates a new request/quotation/booking lifecycle as required.
- Customer origin remains traceable.
- Reminders are repeat-safe and respect account/contact status.
- Deferred SMS/email channels are not implied.

### Required States

- Repeat eligible
- Service unavailable
- Price changed
- Professional suspended
- Reminder scheduled
- Reminder cancelled
- Error

### Domain Events

- customer.repeat_booking_started
- service_reminder_scheduled

### Acceptance Criteria

- Repeat booking starts the correct current workflow.
- Old terms are not silently reused.
- Reminders create one in-app action at the correct time.
- Unavailable services produce a clear alternative path.

### Verification

- Test current-rule revalidation, origin, permissions, reminder repetition, cancellation, stale services, and notification idempotency.

---

## Feature 04.06 — Post-Service Notification Coverage

### Purpose

Notify participants about payment, completion, warranty, review, and repeat-service actions.

### Prerequisites

- Features 04.01–04.05 emit required events.
- Notification consumer verified.

### Routes

- Existing notification centre

### Personas

- Client
- Professional owner
- Authorised team member

### Required Work

- Add invoice/payment, completion, warranty, review, reputation-relevant, and service-reminder mappings.
- Create action targets that open the correct record and degrade safely if unavailable.
- Ensure recipient resolution respects permissions and participation.
- Add expiry/reminder scheduled actions where required.

### Business and Security Rules

- Notification failure does not affect authoritative actions.
- Duplicate events create one intended notification.
- Private financial or warranty data is not exposed in unsafe preview text.
- Stale or expired targets are handled safely.

### Required States

- Unread
- Read
- Action required
- Expired action
- Stale target
- Processing failure

### Domain Events

- notification.created
- notification.read
- notification.failed

### Acceptance Criteria

- Post-service actions generate accurate in-app attention signals.
- Duplicate processing is harmless.
- Sensitive preview content remains safe.
- Phase 04 success path works end to end.

### Verification

- Test event mapping, recipient scope, privacy, idempotency, scheduled timing, dead letters, and stale targets.
