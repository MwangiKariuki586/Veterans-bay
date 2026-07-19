# Phase 03 — Enable Service Fulfilment

## Outcome

Allow authorised professionals and team members to execute work, document progress and evidence, obtain approval for changes, and complete the service with client confirmation.

## Completion Criteria

- Accepted bookings create actionable jobs.
- Team assignment and access are permission-safe.
- Job status changes follow permitted transitions and preserve history.
- Required checklists and evidence are retained.
- Additional work uses structured variations and client approval.
- Completion requires the correct evidence and client response path.
- Job communication and notifications remain connected to the engagement.

## Ordered Features

1. Feature 03.01 — Job Creation and Assignment
2. Feature 03.02 — Job Execution, Checklists, and Evidence
3. Feature 03.03 — Variations and Additional Work Approval
4. Feature 03.04 — Completion Confirmation and Unresolved Work
5. Feature 03.05 — Fulfilment Timeline and Notification Coverage

---

## Feature 03.01 — Job Creation and Assignment

### Purpose

Create an operational job from an eligible booking and assign authorised team members.

### Prerequisites

- Phase 02 complete.
- Team permissions and booking confirmation verified.

### Routes

- `/professional/jobs`
- `/professional/jobs/[jobId]`
- Assignment control within the job detail
- `/client/jobs/[jobId]`

### Personas

- Client
- Professional owner
- Dispatcher/manager
- Assigned team member

### Required Work

- Create jobs from confirmed eligible bookings using accepted service and commercial snapshots.
- Implement statuses: CREATED, SCHEDULED, TEAM_ASSIGNED, EN_ROUTE, IN_PROGRESS, ON_HOLD, AWAITING_CLIENT_CONFIRMATION, COMPLETED, RETURN_VISIT_REQUIRED, CANCELLED, DISPUTED.
- Allow authorised assignment and reassignment with history.
- Show requirements, client-safe assigned-professional details, schedule, scope, and engagement links.
- Create category-appropriate checklist foundations.

### Business and Security Rules

- Only authorised organisation members assign work.
- Team members access assigned jobs unless broader permission exists.
- Clients see only engagement-safe team information.
- Job creation is idempotent for the booking.
- Accepted scope and pricing snapshots are not overwritten by later service changes.

### Required States

- No jobs
- Unassigned
- Assigned
- Assignment conflict
- Permission denied
- Cancelled
- Error

### Domain Events

- job.created
- job.assigned

### Acceptance Criteria

- One job is created per eligible booking.
- Assignments and reassignments are traceable.
- Assigned members gain only appropriate access.
- Client and professional job records are consistent.

### Verification

- Test creation idempotency, assignment permissions, cross-tenant access, commercial snapshots, cancellation, and history.

---

## Feature 03.02 — Job Execution, Checklists, and Evidence

### Purpose

Enable authorised workers to perform and document the actual service.

### Prerequisites

- Feature 03.01 complete.
- Storage and conversation foundations verified.

### Routes

- `/professional/jobs/[jobId]`
- Checklist and evidence sections within the job detail
- `/client/jobs/[jobId]`

### Personas

- Assigned team member
- Professional owner/manager
- Client

### Required Work

- Allow check-in, start work, checklist completion, notes, materials used, expenses, before/after evidence, progress updates, hold/resume, and ready-for-confirmation submission.
- Show client-safe progress and updates.
- Create explicit server-controlled workflow actions for each transition.
- Record actor, timestamp, previous state, new state, and reason where applicable.
- Preserve completion evidence and checklist results.

### Business and Security Rules

- Required checklist items must be satisfied before ready-for-confirmation.
- Only assigned or otherwise authorised members update the job.
- Client-visible and private professional content remain separated.
- Evidence remains linked and access-controlled.
- Status changes follow permitted transitions.

### Required States

- Scheduled
- En route
- In progress
- On hold
- Uploading evidence
- Checklist incomplete
- Ready for confirmation
- Return visit required
- Error

### Domain Events

- job.started
- job.progress_updated
- job.awaiting_confirmation
- attachment.added

### Acceptance Criteria

- Authorised workers can execute and document a job.
- Invalid transitions and incomplete completion attempts are rejected.
- Clients can understand progress without seeing private records.
- History and evidence remain intact.

### Verification

- Test transition matrix, assignment access, checklist enforcement, evidence access, private/public content, retries, and responsive field workflow.

---

## Feature 03.03 — Variations and Additional Work Approval

### Purpose

Handle additional scope, price, and schedule impact through formal client approval.

### Prerequisites

- Feature 03.02 provides an active job.

### Routes

- Variation section or drawer within client and professional job details

### Personas

- Client
- Assigned or authorised professional member

### Required Work

- Create variation drafts with description, reason, additional amount, schedule impact, supporting evidence, and withdrawal/expiry where needed.
- Allow professional submission and client acceptance or rejection.
- Copy accepted variation terms into immutable job commercial history.
- Recalculate approved job totals server-side.
- Create activity and notification events.

### Business and Security Rules

- Additional charges require explicit structured client approval.
- Chat messages are not approval.
- Accepted variations are immutable.
- Only the engagement client may accept.
- Stale or superseded variations cannot be accepted.
- Acceptance is transactional and idempotent.

### Required States

- No variation
- Draft
- Submitted
- Accepted
- Rejected
- Withdrawn
- Stale conflict
- Error

### Domain Events

- job.variation_requested
- job.variation_approved
- engagement.activity_recorded

### Acceptance Criteria

- Professionals can request additional work clearly.
- Clients understand amount and schedule impact.
- Only one eligible acceptance succeeds.
- Approved totals and history remain consistent.
- Notifications and timeline update asynchronously.

### Verification

- Test permissions, totals, stale/concurrent acceptance, evidence access, rollback, outbox atomicity, and history immutability.

---

## Feature 03.04 — Completion Confirmation and Unresolved Work

### Purpose

Allow a professional to submit work for confirmation and a client to confirm completion or report an unresolved issue.

### Prerequisites

- Features 03.02 and 03.03 complete.
- All required checklists and approved variations resolved.

### Routes

- Completion section within `/professional/jobs/[jobId]` and `/client/jobs/[jobId]`

### Personas

- Client
- Authorised professional member

### Required Work

- Allow the professional to mark work ready for confirmation with required evidence.
- Allow the client to confirm completion, report unresolved work, request clarification, or accept with comments.
- Implement return-visit and dispute/escalation entry paths without prematurely implementing full warranty/dispute workflows.
- Prepare configurable automatic completion after a review period through scheduled processing, but enable it only when the policy is approved and visible.
- Preserve completion history and comments.

### Business and Security Rules

- A job cannot complete before checklist and evidence requirements.
- Only the engagement client confirms completion.
- Completion is transactional and creates required downstream events.
- Automatic completion must be configured, disclosed, repeat-safe, and auditable.
- Unresolved reports do not silently mark work complete.

### Required States

- Awaiting confirmation
- Confirmed
- Unresolved issue
- Clarification requested
- Return visit required
- Review period pending
- Error

### Domain Events

- job.awaiting_confirmation
- completion.confirmed
- job.completed
- job.progress_updated

### Acceptance Criteria

- Completion paths are clear and safe.
- Confirmed jobs preserve actor, time, evidence, and commercial history.
- Unresolved work follows a visible path.
- Duplicate completion attempts do not duplicate effects.
- Payment, warranty, and review eligibility can rely on the completed record.

### Verification

- Test checklist/evidence gates, participation, concurrent completion, rollback, unresolved flow, scheduled repeat safety, history, and outbox atomicity.

---

## Feature 03.05 — Fulfilment Timeline and Notification Coverage

### Purpose

Keep job execution activity, communication, and attention signals connected throughout fulfilment.

### Prerequisites

- Features 03.01–03.04 complete.
- Conversation and notification foundations verified.

### Routes

- Existing job detail, activity, conversation, and notification surfaces

### Personas

- Client
- Professional owner
- Assigned team members

### Required Work

- Add assignment, start, progress, hold, variation, ready-for-confirmation, unresolved, completion, and return-visit events to timelines.
- Create notifications for assignment, status requiring attention, variation request/approval, completion confirmation, unresolved issues, and schedule impact.
- Keep recipients permission- and participation-aware.
- Ensure event processing remains idempotent and non-blocking.

### Business and Security Rules

- Private professional activity is not exposed to clients.
- Notification failure does not fail fulfilment actions.
- Duplicate events do not duplicate projections or notifications.
- Stale action targets show a safe unavailable state.

### Required States

- Timeline loading
- No activity
- Unread notification
- Read
- Stale target
- Processing failure

### Domain Events

- engagement.activity_recorded
- notification.created
- notification.read

### Acceptance Criteria

- Participants see a coherent service history.
- Required actions produce accurate notifications.
- Duplicate processing is harmless.
- Phase 03 success path works end to end.

### Verification

- Test projection idempotency, recipient resolution, visibility, stale targets, Queue failure, and timeline ordering.
