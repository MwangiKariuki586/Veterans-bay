# Client User Journeys

## Purpose

This is the repository-grounded client journey map for Veterans Bay. It translates the product lifecycle into testable outcomes across the public marketplace, client workspace, professional hand-offs, and retained records.

The client promise is not just finding a professional. It is keeping discovery, requirements, commercial agreement, fulfilment, completion, financial records, warranty support, verified feedback, and repeat work connected to one engagement.

## Primary lifecycle

```txt
Discover
→ choose direct booking or a service request
→ agree scope and price
→ schedule
→ follow the work and decide on changes
→ confirm completion or report an issue
→ inspect invoice and payment records
→ use warranty support when needed
→ leave one verified review
→ book the professional again
```

Authentication is a continuation boundary, not the start of the journey. A signed-out visitor may explore public pages; an authenticated client is required for saved professionals, requests, bookings, messages, and private records.

## Journey catalogue

### CJ-01 — Discover and evaluate a professional

**Goal:** Find a trustworthy service and decide whether the provider is suitable.

1. Open `/`, `/categories`, or `/marketplace`.
2. Search or filter by category, location, price model, rating, or availability represented by the marketplace.
3. Open `/services/[slug]` to inspect service scope, requirements, price model, duration, warranty terms, provider reputation, and booking mode.
4. Open `/professionals/[slug]` to compare business details, services, completed-job reputation, and verified reviews.
5. Save or remove the professional. If signed out, authenticate and return to the public profile.
6. Choose the next path:
   - direct booking for a published, priced, direct-booking service;
   - request/quotation for custom, uncertain, or enquiry-only work.

**Success:** The client reaches the right commercial path without losing the selected provider/service.

**Seed coverage:** 29 seed-owned published services across five categories, four additional verified providers, multiple price and fulfilment models, reputation data, and two saved professionals.

### CJ-02 — Create and manage a service request

**Goal:** Give a professional enough information to assess non-standard work.

1. Start at `/client/requests/new`, normally prefilled from a service or professional page.
2. Select the receiving professional when the request was started from the generic client action. The selector includes only active professionals with a published, moderation-clear service in the chosen category.
3. Enter category, work description, location, preferred time, optional budget, urgency, and contact preference.
4. Save a draft and return later, or submit immediately.
5. Add permitted attachments after the draft has an authoritative ID.
6. Track the request at `/client/requests` and `/client/requests/[requestId]`.
7. Exchange engagement messages.
8. If the professional asks for more information, add the answer and supporting attachment.
9. Cancel while the request remains in an eligible pre-commercial state, or continue to quotation.

**Success:** The submitted requirements, selected professional, attachments, visible history, and communication remain attached to the request, and the enquiry is visible only to the selected organisation's authorised team.

**Seed coverage:** One submitted request, one request under review, three quoted requests, and visible request-history markers.

### CJ-03 — Review and decide on a quotation

**Goal:** Make an explicit decision against immutable commercial terms.

1. Open `/client/quotations` or follow a quotation notification.
2. Open `/client/quotations/[quotationId]`.
3. Review the selected version, scope, exclusions, line-item totals, duration, validity, warranty, and payment terms.
4. Compare version history when revisions exist.
5. Choose one action:
   - accept the current eligible version;
   - request a revision with a note;
   - decline.
6. Confirm the consequential action.
7. On acceptance, follow the preserved accepted terms into the created booking foundation.

**Success:** Only the current, unexpired, submitted version is accepted, the exact accepted terms remain immutable, and the request converts once.

**Seed coverage:** Two currently eligible submitted quotations plus one expired quotation for the ineligible/error state. A notification links directly to an eligible decision.

### CJ-04 — Book and schedule work

**Goal:** Reserve an eligible professional and time.

There are three client entry paths:

- **Direct booking:** from `/services/[slug]` or `/professionals/[slug]` to `/client/bookings/new`.
- **Accepted quotation:** acceptance creates the booking foundation from preserved quotation terms.
- **Repeat booking:** a completed booking links to `/client/bookings/new?sourceBookingId=...`.

Steps:

1. Review service/provider or source-booking details.
2. Load slots calculated from working hours, blocks, existing reservations, duration, and timezone.
3. Select a slot and acknowledge the cancellation policy.
4. Create the booking request.
5. At `/client/bookings/[bookingId]`, review requested and confirmed times, assignment, commercial terms, and payment requirements.
6. Confirm a professional-proposed schedule, request/resume rescheduling, or cancel while eligible.

**Success:** No overlapping reservation is created, scheduling history is retained, and cancellation/reschedule rules are explicit.

**Seed coverage:** Every seed-owned provider advertising direct booking has an active scheduler with weekday/Saturday availability. The primary professional also has one blocking period, a future confirmed booking, completed bookings for repeat booking, and service data supporting both direct-booking and request-only paths.

### CJ-05 — Track fulfilment and decide on additional work

**Goal:** Follow progress without allowing chat or UI state to change agreed commercial terms silently.

1. Open `/client/jobs` and `/client/jobs/[jobId]`.
2. Review schedule, assigned professional, agreed scope, checklist progress, client-visible updates, evidence, and engagement conversation.
3. If a professional submits a variation, review its description, reason, additional amount, and schedule impact.
4. Accept or reject the submitted variation explicitly.
5. Continue following job status and evidence.

**Success:** Only submitted, unexpired variations can be decided; acceptance updates authoritative totals and retains commercial history.

**Seed coverage:** One in-progress job with partial checklist progress, a client-visible update, and an unexpired submitted variation awaiting a client decision.

### CJ-06 — Confirm completion or report an unresolved outcome

**Goal:** Close work only after the client can inspect the completion record.

1. Open the job marked `AWAITING_CLIENT_CONFIRMATION`.
2. Review scope, checklist, updates, and completion evidence.
3. Choose one response:
   - confirm completion;
   - request clarification;
   - report unresolved work.
4. If confirmed, the job becomes completed and downstream invoice, warranty, and review eligibility can proceed.
5. If unresolved, the engagement stays traceable and can move into follow-up/dispute handling rather than being silently completed.

**Success:** The response is idempotent, recorded in history, and produces the correct next state.

**Seed coverage:** One dedicated `AWAITING_CLIENT_CONFIRMATION` job plus a completion-action notification.

### CJ-07 — Inspect invoices and payment records

**Goal:** Understand what was charged, what an authorised professional recorded as paid, and what remains.

1. Open `/client/invoices` and `/client/invoices/[invoiceId]`.
2. Review immutable job-linked line items, total, issue/due dates, payment terms, recorded allocations, adjustments, and remaining balance.
3. Treat records as manual financial evidence; Veterans Bay does not process M-Pesa or card payments in the MVP.
4. Raise a dispute through the supported issue path when the service or financial record is contested.

**Success:** Financial history is append-only and payment records are not presented as provider-confirmed transactions.

**Seed coverage:** Three issued/overdue invoices with line items, three partially allocated manual payment records, and outstanding balances.

### CJ-08 — Use warranty support

**Goal:** Raise and follow a workmanship concern within active coverage.

1. Open `/client/warranties` and `/client/warranties/[warrantyId]`.
2. Review service snapshot, terms, exclusions, and coverage dates.
3. On an active warranty with no open claim, submit the issue, detail, preferred resolution, and optional evidence.
4. Track professional review, acceptance/rejection, return visit, resolution, or escalation.
5. Escalate an eligible unresolved/rejected claim for platform review.

**Success:** Only covered work is claimable, one open claim is enforced, and every decision and evidence item remains traceable.

**Seed coverage:** Three active warranties: two with no open claim for submission testing and one with a submitted claim for professional response/escalation testing.

### CJ-09 — Publish a verified review

**Goal:** Share feedback that contributes to trustworthy marketplace reputation.

1. Open a completed job at `/client/jobs/[jobId]`.
2. If eligible and within the review window, rate the six dimensions and add written feedback.
3. Publish once.
4. Later inspect the professional response, or report the review for moderation when necessary.

**Success:** One review exists per completed platform job and reputation is recalculated from eligible records.

**Seed coverage:** One completed, review-eligible job with no review plus three historical published reviews for reputation display.

### CJ-10 — Return, communicate, and book again

**Goal:** Continue the relationship without starting from an unconnected lead.

1. Use `/client`, `/notifications`, `/messages`, or `/client/saved` to recover current engagements and professionals.
2. Open a completed booking and choose **Book again**.
3. Select a new eligible slot using the prior booking as the source.
4. Confirm the cancellation policy and create a `REPEAT_BOOKING` record.
5. Verify the new booking points back to its source and the professional retains the client as a repeat customer.

**Success:** Repeat work is connected to history and preserves customer origin rather than becoming an unrelated marketplace lead.

**Seed coverage:** Completed source bookings, availability, saved professionals, and three actionable client notifications.

## Local test data

Run the guarded, idempotent local seed:

```powershell
npm.cmd run db:seed:local-client-journeys
```

Local persona logins (the seed resets these passwords and clears existing local sessions):

```txt
mwas@gmail.com
LocalClientMwas!2026

local.dashboard.client@veterans-bay.invalid
LocalClientPeter!2026

emkay@gmail.com
LocalProfessionalEmkay!2026

local.dashboard.team@veterans-bay.invalid
LocalProfessionalGrace!2026

admin@gmail.com
LocalAdministrator!2026
```

The accounts are two clients, two professionals, and one platform administrator. The script consolidates local user-owned records onto those five account profiles, gives every retained profile a credential account, and assigns published provider organisations to one of the two professional accounts. Its local-environment guard rejects non-local database targets.

## Controlled preview data

The existing controlled-preview UAT dataset remains the cross-persona environment for client, professional owner, assigned technician, administrator, and professional applicant testing. Its credentials are intentionally supplied at seed time through `UAT_SEED_PASSWORD`; see `context/testing/preview-uat-data.md`.

## Known journey seams

- The public professional-page **Message** CTA is implemented as a provider-prefilled service request, not real-time chat. Real-time chat is deferred.
- The professional-page booking explainer currently says **Confirm & pay**, but the MVP only creates/records commercial and manual payment records; it does not process payment. Testers must not interpret this as an online payment step.
- Email, Queue delivery, Cloudinary uploads, and browser geometry still require their configured environments. Seeded relational records do not prove those external integrations.
- Mutating a prepared action state consumes that scenario. Rerun the local seed before a fresh journey pass; the controlled-preview seed intentionally preserves existing tester progress.

## Exit criteria for a client journey pass

- The public choice survives authentication and reaches the intended client destination.
- Every private list and detail is scoped to the authenticated client.
- Each consequential action has a clear confirmation or explicit decision.
- Invalid, stale, duplicate, expired, and unauthorised actions fail safely.
- Accepted terms, histories, financial records, warranty activity, and review eligibility remain connected to the engagement.
- Mobile and desktop expose the required action before secondary statistics or decoration.
