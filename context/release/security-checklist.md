# Release Security Checklist

Status: `DEFERRED`

## Identity and access

- [x] Better Auth is the credential and session authority.
- [x] Protected Hono routes reject missing sessions.
- [x] Session middleware rejects deactivated and restricted accounts.
- [x] Organisation routes resolve the selected workspace on the server.
- [x] Permission, financial-data, participant, ownership, and assignment checks are covered by the domain suites.
- [x] Platform operations require a current `platform_admin` assignment and `platform.admin`.
- [x] Terms and privacy acceptance are required by the server during registration.

## Data and files

- [x] Private evidence uses authorised, time-limited Cloudinary delivery.
- [x] File purpose, MIME type, size, owner, workspace, and linked record are validated.
- [x] Accepted commercial, financial, warranty, dispute, moderation, and audit history is append-only or transition-controlled.
- [x] Account deactivation removes editable profile identifiers while retaining required history.
- [x] Logs use an allow-listed safe shape and do not include bodies, cookies, tokens, evidence, or provider responses.
- [x] Outbox and Queue payloads are minimal; invitation secrets and email addresses are excluded.

## Abuse and platform safety

- [x] Authentication, public submissions, and reports use the strict IP-scoped limiter.
- [x] General API traffic uses an IP-and-route-scoped limiter.
- [x] Request bodies are capped before route handling.
- [x] Browser origins are allow-listed and credentials use secure cookie attributes in preview/production.
- [x] Moderation, suspension, restoration, rules, dead-letter actions, and other high-risk decisions are audited.
- [x] Safe errors omit stack traces, SQL, provider details, and secrets.

## Dependency and source review

- [x] Next.js, Wrangler, Cloudflare Vitest, concurrency tooling, OpenNext, and image processing were updated to patched compatible releases.
- [x] Production dependency audit has no high or critical findings.
- [x] Controlled preview mode disables public registration and constrains payment records to explicit simulations without evidence.
- [ ] Development-only audit advisories are accepted by the release owner or resolved upstream.
- [ ] Operator legal identity, notice address, governing law, and dispute forum are approved.
- [ ] Production credentials, origins, bindings, and Cloudflare account access are verified.
- [ ] Post-deployment authorization and abuse smoke tests pass.

## Deferred production gate

- `npm audit --omit=dev` reports no high or critical findings; five moderate build-tool-chain advisories remain.
- The full audit reports thirteen high development-tool advisories in the ESLint/OpenNext dependency chains. These require release-owner acceptance or upstream resolution and do not ship as application runtime code.
- Wrangler OAuth authentication is verified with encrypted credential storage. Only the preview environment remains deployable from the committed Wrangler configuration; production resources and secrets remain deferred and unverified.
- The current preview is non-commercial and demonstration-only. Production deployment and post-deployment checks must not proceed until the delivery owner resumes the release and the unchecked items above are resolved.
- Preview API version `1b5956be-0ffb-449b-a695-fd2bf9410a67` and web version `e2b54326-6a3e-418b-9c90-841d95440c2b` pass deployed health, readiness, global-warning, and registration-rejection smoke checks.
