# Incident, Queue Recovery, and Support Runbook

## Triage

1. Record start time, reporter, affected route/workflow, environment, correlation IDs, and visible impact.
2. Classify: security/privacy, authentication, database, file storage, Queue/Cron, external dependency, or user-support issue.
3. For suspected privacy or security exposure, restrict the affected operation, preserve evidence, and notify the designated incident owner.

## Queue recovery

1. Open `/admin/operations/async`.
2. Check backlog age, retries, consumer duration, duplicates, failures, and open dead letters.
3. Fix the underlying cause before retry.
4. Enter a reason and use manual retry; it preserves the original event ID and creates an audit record.
5. Discard only when the secondary effect is no longer valid or can be safely omitted. Primary transaction records are never edited as Queue recovery.
6. Confirm backlog returns to normal and no duplicate user effect was created.

## Common support checks

- Account access: session, profile status, restrictions, platform/organisation assignment, and permissions.
- Missing record: participant/tenant scope and authoritative database record before UI state.
- File issue: asset purpose, state, linked entity, owner/workspace, and Cloudinary binding.
- Notification issue: source outbox event, processing attempt, recipient derivation, and notification record.
- Financial issue: invoice items, payment allocations, adjustments, and preserved audit history.

## Communication

Give affected users clear status and next steps without exposing another user, internal evidence, credentials, provider details, or investigation strategy. Record resolution and follow-up ownership.
