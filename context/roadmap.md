# Outcome-Centred Roadmap — Veterans Bay

## Purpose

Each phase represents a meaningful product outcome. The ordered features inside the phase define everything required to achieve it.

The phase file—not a separate feature directory—is the implementation specification.

## Execution Model

```txt
current.md selects the active phase and feature
→ active phase defines ordered work, prerequisites, acceptance, and verification
→ relevant recipes define technical implementation rules
→ repository and tests prove readiness
```

## Phase 00 — Establish the Platform Foundation

**Outcome:** Create the technical, visual, identity, data, storage, and event foundations required for reliable feature delivery.

File: `context/phases/00-platform-foundation.md`

## Phase 01 — Establish the Professional Marketplace

**Outcome:** Allow professionals to establish approved operational profiles and allow clients to discover eligible services and professionals.

File: `context/phases/01-marketplace-foundation.md`

## Phase 02 — Enable Request-to-Booking Commerce

**Outcome:** Allow a client and professional to progress from a service requirement through enquiry, conversation, versioned quotation, acceptance, and confirmed booking.

File: `context/phases/02-commercial-workflow.md`

## Phase 03 — Enable Service Fulfilment

**Outcome:** Allow authorised professionals and team members to execute work, document progress, obtain approval for changes, and complete the service with client confirmation.

File: `context/phases/03-service-fulfilment.md`

## Phase 04 — Establish Trust and Retention

**Outcome:** Preserve financial records, provide warranty support, generate verified reputation, manage professional-owned customers, and enable repeat work.

File: `context/phases/04-trust-retention.md`

## Phase 05 — Achieve Operational Maturity and Release Readiness

**Outcome:** Provide complete administration, reporting, reliable async processing, auditability, performance, accessibility, security, and production readiness.

File: `context/phases/05-operational-maturity.md`

## Phase Advancement

A phase may advance only when:

- All required features are complete.
- Dependencies have been verified in the repository.
- Required user review gates are resolved.
- Acceptance criteria pass.
- Required automated checks pass.
- Deferred features are not represented as functional.
- `context/current.md` is updated to the next phase and first eligible feature.

## Status Handling

Progress is tracked in `context/current.md`, not by editing these phase definitions after every session.
