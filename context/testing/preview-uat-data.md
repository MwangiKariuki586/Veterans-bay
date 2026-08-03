# Controlled Preview UAT Data

## Boundary

This dataset is synthetic and belongs only in the existing controlled-preview database. Self-service registration is enabled for controlled UAT, but testers must use synthetic identities and must not enter real personal, service, evidence, or payment information. Do not provision another environment for this dataset.

## Personas

| Persona | Login email | Prepared scope |
|---|---|---|
| Client | `uat.client@veterans-bay.invalid` | Discovery, requests, quotation acceptance, bookings, active work, invoice, warranty, review readiness, and notifications |
| Professional owner | `uat.owner@veterans-bay.invalid` | Approved organisation, published service, new enquiry, scheduling, financial access, customers, warranties, and notifications |
| Team member | `uat.technician@veterans-bay.invalid` | Assigned-jobs-only membership, future assignment, active job, checklist, progress update, and notifications |
| Platform administrator | `uat.admin@veterans-bay.invalid` | Active `platform_admin` assignment, pending professional application, open report, open dispute, escalated warranty, platform rule, and notifications |
| Professional applicant | `uat.applicant@veterans-bay.invalid` | Pending organisation and 14/14-complete onboarding profile with synthetic logo and private verification evidence |

All five accounts use the password supplied through `UAT_SEED_PASSWORD` when the seed is first run. The password is deliberately not committed.

## Prepared scenarios

- Published, versioned `UAT Plumbing Maintenance` marketplace service.
- One submitted request ready for the professional to quote.
- One quoted request with a current eligible quotation ready for client acceptance.
- One future confirmed booking and team-assigned job.
- One in-progress assigned job with a partially completed checklist and client-visible update.
- One completed job with an issued unpaid invoice, active warranty, escalated claim, and no review so the client can test verified-review submission.
- One registered organisation-scoped UAT customer record backed by completed booking history for customer-history and repeat-booking testing.
- One disputed job with an open administrator dispute.
- One open misleading-listing report ready for case investigation.
- One complete pending professional application whose protected synthetic evidence opens through the administrator-only delivery route.
- One active controlled-preview platform rule.
- One actionable notification for each primary testing persona.
- The previously verified Alex Mwangi and Emkay Ltd journey remains untouched for completed-state and async/idempotency confirmation.

## Commands

PowerShell seed:

```powershell
$env:UAT_SEED_PASSWORD='<choose-at-least-16-characters>'
npm.cmd run db:seed:preview-uat
Remove-Item Env:UAT_SEED_PASSWORD
```

Read-only verification:

```powershell
npm.cmd run db:verify:preview-uat
```

The seed is additive and idempotent. If its marker accounts already exist, it preserves their current workflow state rather than resetting user testing progress.
