# Specification Traceability

This file maps the 17 canonical features and cross-cutting requirements from the ServiceLink specification to the Veterans Bay outcome-centred phase architecture.

It is for audit and reference. Do not load it during routine implementation.

## Feature Mapping

| Source Feature | Phase Specification |
|---|---|
| 01 Identity and Account Management | Phase 00 — Feature 00.06 |
| 02 Professional Organisation Onboarding | Phase 01 — Feature 01.01 |
| 03 Team and Permission Management | Phase 01 — Feature 01.02 |
| 04 Professional Profile and Service Catalogue | Phase 01 — Feature 01.03 |
| 05 Marketplace Discovery | Phase 01 — Feature 01.04 |
| 06 Service Requests and Enquiries | Phase 02 — Feature 02.01 |
| 07 Quotations | Phase 02 — Feature 02.03 |
| 08 Booking and Scheduling | Phase 02 — Feature 02.04 |
| 09 Job Fulfilment | Phase 03 — Features 03.01–03.03 |
| 10 Conversations and Activity Timeline | Phase 02 — Feature 02.02; extended in Phase 03 — Feature 03.05 |
| 11 Invoices and Payment Records | Phase 04 — Feature 04.01 |
| 12 Completion, Warranty and Follow-Up | Phase 03 — Feature 03.04; Phase 04 — Feature 04.02 |
| 13 Reviews and Professional Reputation | Phase 04 — Feature 04.03 |
| 14 Professional Customer Management | Phase 04 — Features 04.04–04.05 |
| 15 Notifications | Phase 02 — Feature 02.05; Phase 04 — Feature 04.06; reliability in Phase 05 — Feature 05.03 |
| 16 Platform Administration and Moderation | Phase 01 — Feature 01.05; completed in Phase 05 — Feature 05.01 |
| 17 Basic Dashboards and Reporting | Phase 05 — Feature 05.02 |

## Architecture Coverage

| Source Requirement | Coverage |
|---|---|
| Hono modular API | `context/architecture.md`, Phase 00 Feature 00.04 |
| Neon PostgreSQL and Drizzle | Database recipe, Phase 00 Feature 00.05 |
| Better Auth | Auth recipe, Phase 00 Feature 00.06 |
| Organisations, roles, permissions | Phase 00 Feature 00.07; Phase 01 Feature 01.02 |
| Cloudflare Queues | Queue recipe, Phase 00 Feature 00.09, Phase 05 Feature 05.03 |
| Transactional outbox | Architecture, database and queue recipes, domain transaction features |
| Idempotency | Queue recipe and async feature acceptance criteria |
| External file storage | Storage recipe, Phase 00 Feature 00.08 |

## Non-Functional Coverage

| Area | Coverage |
|---|---|
| Security and tenant isolation | AGENTS, architecture, every phase, Phase 05 Feature 05.04 |
| Reliability and atomicity | Architecture, recipes, transaction features, Phase 05 Feature 05.03 |
| Performance and pagination | UI and architecture context, feature specs, Phase 05 Feature 05.05 |
| Accessibility | UI context, page features, Phase 05 Feature 05.06 |
| Privacy | Architecture, storage and auth rules, Phase 05 Feature 05.04 |
| Production readiness | Phase 05 Feature 05.07 |

## Deferred Scope

Deferred items are recorded in `context/product.md` and explicitly excluded from feature specifications where confusion is likely.

## MVP Success

The complete source MVP success journey is verified in Phase 05 Feature 05.07 after all preceding phases complete.
