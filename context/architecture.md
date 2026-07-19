# Architecture — Veterans Bay

## Style

Veterans Bay uses a modular monolith deployed on serverless infrastructure.

```txt
Next.js web
→ Hono API
→ domain services
→ repositories and integrations
→ Neon PostgreSQL
```

Asynchronous flow:

```txt
business transaction
→ PostgreSQL transactional outbox
→ publisher
→ Cloudflare Queue
→ idempotent consumers
```

Do not introduce microservices, Kafka, Kubernetes, or paid always-running infrastructure during the MVP.

## Approved Foundation

| Concern | Technology |
|---|---|
| Web | Next.js App Router |
| Language | TypeScript strict |
| API | Hono on Cloudflare Workers |
| Authentication | Better Auth |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod |
| Events | PostgreSQL outbox + Cloudflare Queues |
| Scheduling | Cloudflare Cron Triggers |
| Files | Cloudinary |
| UI | Tailwind, shadcn/ui, Radix |
| Testing | Vitest; Playwright when introduced |
| Package manager | npm |

Installed versions, types, configuration, and verified runtime behaviour are authoritative for exact APIs.

## Canonical Repository Direction

Use the repository's valid existing structure when present. For a new project, prefer:

```txt
src/
├── app/                     Next.js routes and layouts
├── components/              reusable UI and domain compositions
├── modules/
│   ├── identity/
│   ├── organizations/
│   ├── professionals/
│   ├── services/
│   ├── requests/
│   ├── quotations/
│   ├── bookings/
│   ├── jobs/
│   ├── conversations/
│   ├── payments/
│   ├── warranties/
│   ├── reviews/
│   ├── customers/
│   ├── notifications/
│   └── administration/
├── platform/
│   ├── auth/
│   ├── database/
│   ├── errors/
│   ├── events/
│   ├── logging/
│   ├── permissions/
│   └── storage/
└── workers/
    ├── api/
    ├── events/
    └── scheduled/
```

A domain module may contain routes, validation schemas, services, repositories, types, permission rules, domain events, and tests.

Avoid circular dependencies and generic dumping-ground folders.

## Runtime Responsibilities

### Next.js

Owns presentation, routing, rendering, interaction, feedback states, and calls to Hono.

It does not own authoritative business rules, direct protected database mutation, organisation authorization, financial calculation, workflow transitions, or queue publication.

### Hono API

Owns authentication, validation, access resolution, domain-service invocation, safe contracts, correlation IDs, and rate-limit integration.

```txt
authenticate
→ validate
→ resolve workspace and permission
→ invoke domain service
→ map safe response
```

### Domain Services

Own business rules, workflow transitions, calculations, transaction orchestration, history, and domain-event creation.

### Repositories

Own scoped persistence and mapping. Private queries require trusted account, organisation, participation, or assignment scope.

### Event Workers

Process notifications, reputation, analytics, reminders, and other secondary effects. They are not authoritative for primary business records.

### Scheduled Workers

Initiate bounded retries, expirations, reminders, recovery, and maintenance using database-backed coordination.

## Identity and Workspaces

Better Auth owns credentials, sessions, email verification, password reset, and authentication cookies.

Veterans Bay owns account restrictions, organisations, memberships, roles, permissions, professional status, marketplace access, participation, and assignments.

A user may simultaneously act as a client, own an organisation, belong to another organisation, and hold a platform role. Do not store one permanent application role on the user record.

Protected flow:

1. Resolve Better Auth session.
2. Check current account status.
3. Resolve requested workspace.
4. Load current membership or platform assignment.
5. Evaluate permission.
6. Verify record ownership, participation, or job assignment.
7. Execute the action.

UI visibility is not authorization.

## Route Experience Direction

```txt
/                              public homepage
/marketplace                   public discovery
/services/[slug]               service detail
/professionals/[slug]          professional profile
/login, /register              authentication
/client/...                    client portal
/professional/...              owner and permission-limited team workspace
/admin/...                     platform administration
```

A team member should normally use the professional workspace with permission-limited navigation rather than a duplicated application shell.

## Database Rules

Neon PostgreSQL is authoritative for relational business data.

- Use Drizzle schemas and committed migrations.
- Use foreign keys and meaningful constraints.
- Use timezone-aware timestamps.
- Store money as integer minor units plus currency.
- Use JSON only for bounded metadata or versioned event payloads.
- Preserve status history and actor traceability.
- Index actual tenant-scoped search and workflow queries.
- Paginate large lists.
- Never rewrite migrations already applied to shared environments.

## Transaction Rules

Dependent business changes complete atomically.

```txt
begin
→ load authoritative state
→ validate actor and transition
→ update records
→ create history/activity
→ insert outbox event
→ commit
```

Important transactions include quotation acceptance, booking confirmation, job completion, payment recording, warranty creation, and review submission.

Do not perform Cloudinary, email, Queue, or other external calls inside the database transaction.

## Workflow Integrity

Use intent-specific actions, not unrestricted status updates.

Each action must validate current state, actor, scope, transition, required fields, and duplicate protection; apply dependent changes atomically; preserve history; and create required events.

## Commercial Integrity

- Submitted quotation versions are immutable.
- Revisions create new versions.
- Only the current eligible version may be accepted.
- Accepted quotation data is copied into the resulting booking/job record.
- Server code calculates authoritative totals.
- Additional charges require a structured variation and client acceptance.
- Chat does not replace commercial approval.
- Payments use records, allocations, and reversals rather than a boolean paid field.

## Events and Reliability

Business events are inserted into `outbox_events` within the same transaction as the authoritative change.

Initial consumer concerns:

- Notifications
- Reputation
- Analytics
- Scheduled actions

Consumers record processed event IDs. Duplicate delivery must not duplicate notifications, reputation updates, payments, warranties, or analytics counts.

Failures must be retried, observable, and dead-lettered when repeatedly unsuccessful.

## File Storage

Cloudinary stores images and small documents. PostgreSQL stores the provider identifier, safe delivery metadata, MIME type, size, owner, related record, purpose, visibility, and timestamps.

Uploads are validated and authorized server-side. Private evidence requires authorized delivery.

## API Contracts

Return stable public contracts, not raw database rows.

Validate external input, pagination, filters, sorting, and search. Errors expose stable safe codes and messages without stack traces, SQL details, credentials, private file locations, or provider secrets.

## Search and Performance

The MVP uses PostgreSQL search and indexed filtering.

Search only active organisations and published services. Index location/category/status and other real query patterns. Use pagination and bounded dashboard aggregation. Deliver appropriately sized images.

## Caching

Public marketplace reads may use short-lived caching where correct.

Private, live, or rapidly changing data is uncached by default, including availability, reservations, job polling, conversations, unread counts, payment calculations, moderation queues, and outbox state.

## Logging and Audit

Log correlation IDs, safe identifiers, domains, event types, attempts, durations, and error categories.

Never log passwords, sessions, tokens, API keys, private documents, payment evidence, or raw sensitive provider responses.

High-risk administrative and financial actions require durable audit records.

## Deployment

Potential units:

```txt
Next.js web
Hono API Worker
Queue consumer Worker
Scheduled Worker
```

They may share packages but not runtime memory. Validate Cloudflare bindings and compatibility, separate environments, and avoid writable-filesystem assumptions.

## Architecture Decisions

Create an ADR when changing core technology, trust/tenancy boundaries, authentication authority, data ownership, event strategy, caching, deployment units, or modular-monolith boundaries.
