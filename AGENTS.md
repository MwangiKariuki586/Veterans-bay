# AGENTS.md — Veterans Bay

## Purpose

This file defines stable project-wide execution rules for AI agents working in the Veterans Bay repository.

It must remain concise and rarely change. Current progress, page requirements, feature prerequisites, and implementation details belong elsewhere.

## Project Identity

Veterans Bay is a service marketplace and professional operations platform for home repair and maintenance services.

The source specification used the working title **ServiceLink**. The live implementation name is **Veterans Bay**.

The product supports:

```txt
Discovery
→ Request
→ Quotation
→ Acceptance
→ Booking
→ Service fulfilment
→ Completion
→ Payment record
→ Warranty
→ Review
→ Repeat booking
```

It must remain useful to professionals managing customers they already have, not only marketplace-acquired customers.

## Approved Foundation

- Next.js App Router
- TypeScript strict mode
- Hono
- Cloudflare Workers
- Better Auth
- Neon PostgreSQL
- Drizzle ORM
- Neon Serverless Driver
- Cloudflare Queues
- PostgreSQL transactional outbox
- Cloudflare Cron Triggers
- Cloudinary
- Zod
- Tailwind CSS
- shadcn/ui and Radix
- Sonner
- Vitest
- Playwright when end-to-end testing is introduced
- npm

Do not replace an approved core technology, add paid infrastructure, or introduce a distributed architecture without explicit approval and an accepted ADR.

## Context Loading

Always read:

1. `AGENTS.md`
2. `context/current.md`
3. Files directly affected by the task

Then load only what the active task requires:

| Concern | Load |
|---|---|
| Product behaviour, personas, scope, workflow | `context/product.md` |
| Architecture, API, security, tenancy, transactions, deployment | `context/architecture.md` |
| UI, layout, responsive behaviour, accessibility | `context/ui-system.md` |
| Delivery sequence | `context/roadmap.md` only when changing or advancing phases |
| Feature implementation | Active file under `context/phases/` |
| Better Auth | `context/recipes/auth.md` |
| Neon, Drizzle, migrations, transactions | `context/recipes/database.md` |
| Outbox, Queues, retries, Cron | `context/recipes/queues.md` |
| Cloudinary, files, uploads | `context/recipes/storage.md` |
| Major architectural decision | Relevant file under `context/decisions/` |

Do not load every phase, every recipe, the archive, or the source specification by default.

## Authority Order

```txt
Explicit user instruction
→ AGENTS.md
→ context/current.md
→ active phase specification
→ accepted architecture decisions
→ product, architecture, and UI context
→ relevant technical recipe
→ existing tested implementation
→ installed package types and runtime behaviour
→ current official documentation for the installed version
→ general knowledge
```

When documentation and implementation disagree, determine which is stale before changing either.

## Autonomous Work Selection

When the user says `Proceed`, `Continue`, or gives no new feature name:

1. Read `context/current.md`.
2. Open the active phase file.
3. Locate the active feature and current step.
4. Verify the feature's prerequisites against the actual repository.
5. Continue the recorded step.
6. When the feature is complete, update `context/current.md`.
7. Advance to the next ordered eligible feature unless a review gate, blocker, approval, or credential is required.
8. When all required features in the phase are complete, advance to the next phase in `context/roadmap.md`.

Do not select unrelated work from the roadmap.

Ask for clarification only when:

- A specification conflicts with another authority.
- A required product decision is missing.
- Required credentials or a required design asset are unavailable.
- A destructive or high-risk change requires approval.
- The user identifies a visual or functional misalignment.
- Proceeding would require unsupported assumptions.

Clarification must be concise and targeted.

## Prerequisite Gate

Before implementing a feature:

1. Read its prerequisites and required repository conditions.
2. Inspect the repository rather than trusting status text alone.
3. Run the relevant preflight checks.
4. Automatically complete a missing prerequisite only when it is already specified, in scope, safe, and does not require a user decision.
5. Otherwise mark the work `BLOCKED` in `context/current.md` and ask one focused question.

Never bypass a prerequisite or partially implement a dependent feature as if it were complete.

## Implementation Discipline

Build one complete, testable feature at a time.

For features containing new UI:

```txt
Inspect the homepage design reference and existing components
→ implement the complete UI and required states with typed fixtures where useful
→ verify visual and interaction alignment
→ add validation, authorization, and domain behaviour
→ connect authoritative persistence
→ verify the complete workflow
```

Before creating a component, service, repository, schema pattern, utility, or abstraction:

1. Search the repository.
2. Reuse a suitable implementation.
3. Extend it for a legitimate shared variant.
4. Create new only when existing patterns do not fit.

Prefer direct readable code over premature abstraction.

## Non-Negotiable Rules

1. Work only within the active feature and required prerequisites.
2. Do not implement deferred or speculative capability.
3. Do not make unrelated changes.
4. Never trust client-provided identity, organisation scope, permissions, prices, balances, or workflow status.
5. Resolve authenticated identity from Better Auth on the server.
6. Validate current restrictions, workspace, membership, role, permission, ownership, participation, and assignment.
7. Preserve organisation isolation.
8. Hono is the authoritative application API.
9. Keep routes thin; domain services own business decisions and transitions.
10. Validate external input with Zod.
11. Use Drizzle and Neon for relational data.
12. Use transactions for dependent business changes.
13. Preserve quotation versions, accepted terms, financial records, status history, warranties, disputes, and audit evidence.
14. Insert transaction-dependent events into the PostgreSQL outbox before commit.
15. Treat Queue delivery as at least once and make consumers idempotent.
16. Store file content in Cloudinary and metadata in PostgreSQL.
17. Keep secrets, sessions, private assets, internal errors, and sensitive logs out of the browser.
18. Do not claim an integration works until it is configured and verified.
19. Do not mark placeholders, incomplete workflows, or unverified work complete.
20. Do not change the platform's established design language without explicit approval.

## Design Authority

The primary design reference is:

```txt
public/design-reference/homepage.png
```

The homepage controls the shared visual language. New pages must inherit its typography, colour hierarchy, spacing rhythm, surfaces, radii, shadows, controls, navigation treatment, imagery quality, and responsive standard.

Pages may use layouts suited to their workflow but must not introduce a competing visual direction.

`src/app/globals.css` or the repository's actual global stylesheet is authoritative for shared tokens and global styles. Page-specific and component-specific styling does not belong there.

## Progress Updates

The agent must update `context/current.md` when implementation changes the active state:

- Work starts
- The current step changes
- A dependency is completed
- A blocker appears or is resolved
- Verification changes
- Work becomes ready for review
- A feature completes
- The next feature or phase becomes active

Update only the fields that changed. Do not append session history.

Do not routinely edit `AGENTS.md`, phase specifications, product context, architecture, UI context, or recipes.

## Status Rules

```txt
NOT STARTED
IN PROGRESS
BLOCKED
READY FOR REVIEW
VERIFICATION PENDING
COMPLETE
DEFERRED
```

- `READY FOR REVIEW`: implementation is complete but an explicit user or stakeholder review gate remains.
- `VERIFICATION PENDING`: implementation exists but required technical checks remain.
- `BLOCKED`: a dependency, credential, asset, decision, or approval prevents progress.
- `COMPLETE`: all requirements, verification, and required review are complete.

## Verification

Run checks appropriate to the feature, including as relevant:

- Typecheck
- Lint
- Focused tests
- Migration validation
- Production build
- Cloudflare preview
- Authorization tests
- Organisation-isolation tests
- Workflow-transition tests
- Transaction rollback tests
- Queue duplicate-delivery tests
- Responsive checks
- Accessibility checks
- Browser review when the phase explicitly requires it

Never report a command as passing unless it was actually executed successfully.

If verification cannot be completed, state what remains and set the correct status.

## Delivery Report

After implementation, provide one concise report:

```md
## Delivered
- What was implemented

## Files Changed
- `path` — purpose

## Verification
- Check — result

## Review
- Exact route or workflow, only when review is required

## Remaining
- Outstanding item or `None`
```

Do not repeat unchanged project context or describe planned work as delivered.
