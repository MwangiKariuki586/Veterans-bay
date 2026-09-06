# Client workspace production readiness — 6 September 2026

**Verdict: NOT READY for public production release.** This assessment tests the current working tree, including existing uncommitted catalogue changes. No application fixes, deployment, reseeding, or commercial workflow mutations were performed. Local browser traffic used the existing web/API processes and their configured Neon database; this is not production deployment verification.

## Release blockers

### 1. Saved presents illustrative data as the client's records

`src/components/workspace/client-saved-professionals-page.tsx:57`, `:111`, `:249`, `:322`, `:331`, `:341`.

- Three hard-coded services and a fixed quotation are rendered for clients independently of authoritative saved records. The API returned one saved professional; the screen also displayed these services and the quotation.
- Metrics display hard-coded 18 saved services, 5 ready-to-book items, and 6 recently added items. Empty professional results substitute illustrative providers and a count of 12.
- Reproduction: open `/client/saved`, remove Electrical Installation, reload. The successful removal toast appears, but the item returns. Browser reproduction confirmed this.
- The fixed quotation destination is not derived from the current client's ownership or quotation eligibility. This is misleading presentation; the tested detail APIs still enforce ownership.

Release requirement: show authoritative records and counts, truthful empty states, and persisted removals. Unsupported saving/shortlisting capabilities must not look functional.

### 2. Client support has invented case history and broken primary actions

`src/components/support/support-page.tsx:23`, `:67`, `:168`, `:178`, `:482`, `:502`.

- `/client/support` presents hard-coded booking, warranty, and support-case records as recent client activity.
- Chat with us and Start a conversation link to `#chat`; Report an issue links to `#report`. Neither target exists in the rendered DOM.
- Case links and helpful articles use `href="#"`. Track a case reaches the static case list, not a case workflow.
- Browser inspection found 11 fragment links without a destination element.

Release requirement: connect supported actions and client-scoped records, or clearly state availability and provide a working support route. Do not imply a report was filed or a case exists.

### 3. Authenticated accessibility checks fail

Ran axe WCAG 2 A/AA and 2.1 A/AA checks on ten routes at 1440×900 and 390×900. Fifteen of twenty route/viewport combinations contain serious violations. Automated checks are not a complete accessibility certification.

| Route | Desktop | Mobile |
| --- | --- | --- |
| `/client` | No serious/critical findings | No serious/critical findings |
| `/client/requests` | Contrast | Contrast; nested interactive controls |
| `/client/quotations` | Contrast | Contrast |
| `/client/bookings` | Contrast | Contrast; nested interactive controls |
| `/client/invoices` | Contrast | Contrast |
| `/client/warranties` | No serious/critical findings | No serious/critical findings |
| `/client/saved` | Contrast | No serious/critical findings |
| `/account/profile` | Contrast; definition-list structure | Same |
| `/notifications` | Contrast | Contrast |
| `/client/support` | Contrast | Contrast |

Examples: the small green section label has 3.04:1 contrast against its background, below the checker-required 4.5:1; request-row metadata measures 4.21:1. `src/components/profile/profile-field.tsx:13` nests term/description pairs beneath extra wrappers that axe flags. Mobile request/booking cards contain nested interactive descendants.

Raw selectors, ratios, and node details: `artifacts/client-readiness/results.json`. Viewport screenshots are in the same directory; the workspace uses an internal scrolling region, so screenshots do not necessarily capture all offscreen content.

### 4. Required repository gates are red

| Command | Result |
| --- | --- |
| `npm.cmd run runtime:check` | PASS — Node 22.20.0 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run db:check` | PASS — migration metadata validation only |
| `npm.cmd run cf:typecheck` | PASS |
| `npm.cmd run build` | PASS — Next.js production build |
| `npm.cmd run build:api -- --env preview` | PASS — preview Worker dry run; no deployment |
| `npm.cmd run lint` | FAIL — 86 errors / 2,562 warnings, including generated Playwright report assets |
| `npx.cmd eslint src scripts --quiet` | Three source errors confirmed independently of generated reports |
| `npx.cmd vitest run --config vitest.config.ts` | FAIL — 196 passed / 2 failed; one unhandled exception |
| `npx.cmd vitest run --config vitest.worker.config.ts` | FAIL — 173 passed / 1 failed |
| Financial database suite, verbose focused run | PASS — 2 tests, 38.26 seconds |
| Full database suite | FAIL — 34 passed / 7 failed; 2 unhandled errors; 19 files reported and an additional file failed to start |
| Retry of five affected/unstarted database files | PASS — 10 tests, 5 files, 88.44 seconds |

The full database run encountered DNS resolution/connection failures, a failed rollback after connection loss, and a Vitest worker startup timeout. All five affected/unstarted files passed on retry: customers, marketplace, notifications, operational maturity, and professional onboarding review. A separate financial rerun also passed. No reproducible domain assertion failure remains from this database run; a single uninterrupted green full-suite run was not obtained.

Specific failures:

- `src/components/marketplace/marketplace-page.test.tsx`: desktop filter test cannot find the expected Search textbox.
- `src/components/public/site-header.test.tsx:97`: signed-in header test cannot find the expected Dashboard link.
- `src/components/professional-services/professional-profile-manager.tsx:149`: jsdom lacks `scrollIntoView`, causing an unhandled test exception. This does not establish a browser runtime failure.
- `src/modules/invoices/invoice-pdf.test.ts:13`: expects `Balance due: KES 150.00`; generated PDF contains `Balance due: Ksh 150.00`. The asserted amount agrees; this failure is a currency-label contract mismatch, not evidence of an incorrect balance.
- `src/components/professional-services/professional-profile-manager.test.tsx:37` and `:100`: explicit `any` lint errors.
- `src/components/workspace/professional-dashboard-context.tsx:62`: synchronous state update in an effect.
- `eslint.config.mjs` does not exclude generated Playwright reports, making the normal lint gate depend on local test artifacts.

### 5. Dependency audit requires renewed triage

`npm.cmd audit --omit=dev --json` returned 9 affected package entries: 1 high and 8 moderate. These are dependency-graph findings, not nine demonstrated exploitable application paths.

- The high entry is `nanoid@3.3.16`, reached through `next@16.2.12 → postcss@8.5.19`. Audit reports GHSA-2v37-7h3g-55p8 for custom generators with zero size. Application exploitability was not demonstrated.
- Hono 4.12.30 and overridden PostCSS 8.5.19 also appear. Better Auth's tooling dependency chain appears despite `--omit=dev`.
- The [Hono maintainer advisory](https://github.com/honojs/hono/security/advisories/GHSA-8j4g-w8fx-2239) affects default CORS header parsing before 4.12.34. This app uses custom trusted-origin middleware with explicit allowed headers; the affected `hono/cors` path was not found in that middleware. Other advisory paths still require triage.

Release requirement: resolve affected dependencies or document reviewed applicability and accepted residual risk. Do not infer production exploitability solely from audit severity or run a forced dependency downgrade.

## Confirmed working

- Two documented synthetic client accounts signed in successfully.
- All ten tested routes loaded at both widths without observed HTTP errors, residual loading labels at capture time, or document-level horizontal overflow.
- Local `/api/health` and `/api/ready` returned 200.
- Requests, quotations, bookings, invoices, and warranties list endpoints returned 200 for a signed-in client.
- Six private list endpoints (the five above plus saved professionals) returned 401 without a session.
- For one existing record in each of requests, bookings, quotations, invoices, and warranties, its owner received 200 and the other client received 404. Quotations, invoices, and warranties were checked using the second client as owner because the first account had no fixtures. This is sampled read isolation, not exhaustive authorization coverage.
- New-request drawer opens, focuses a form control, displays required-field errors on empty submission, and closes with Escape while restoring the list URL.
- Booking-row selection opens the matching summary drawer and updates the selection URL.
- Focused financial database tests verify tenant projections, immutable completed-job totals, idempotent allocations, overpayment rollback, and reversal history.
- Passing Worker tests include unauthenticated route protection, origin rejection, permission checks, safe errors, rate limits, and domain rules. They do not replace authenticated production verification.

## Verification boundaries and release requirements

- The committed `e2e/accessibility.spec.ts` only targets public pages. This audit used `.tmp/client-readiness.mjs` for authenticated page, axe, guest-denial, and sampled isolation checks. Promote reliable coverage into the maintained suite after fixing findings.
- No fresh browser pass completed request submission → quotation decision → scheduling → fulfilment/variation → completion → invoice → warranty claim → verified review → repeat booking. The original client has empty quotation/invoice/warranty lists; fuller workflow fixtures need deliberate preparation. Existing records were not reset.
- Upload delivery, email, deployed Queue/Cron behavior, production cookies/origins, backup recovery, migration rehearsal, rollback, and production smoke tests remain separate release gates.
- Private JSON list responses observed locally lacked an explicit Cache-Control header. Review private response caching policy; this observation alone does not prove caching or disclosure.
- `context/current.md` still intentionally defers production resources and public launch approval. Historical preview success is not current production evidence.

## Next work

Fix Saved and Support truthfulness, the accessibility findings, and failing test/lint contracts; triage dependencies; then run maintained authenticated lifecycle tests and the outstanding deployment/operations gates. Keep public production release blocked until these are resolved.
