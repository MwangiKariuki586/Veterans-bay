# Deployment Runbook

Current status: `DEFERRED` after successful preview deployment and verification. The delivery owner has chosen a controlled, non-commercial demonstration rather than a public production launch. Production bindings, legal/operator approval, dependency-advisory disposition, deployment, and smoke tests remain future release gates.

Environment decision: use only the already-provisioned preview database, Queue, API Worker, web Worker, and existing Cloudinary product environment. Public registration is disabled, payment records must be explicitly simulated, and the UI warns against real personal, service, or payment information. Do not provision an additional database, Queue, Worker, or Cloudinary API key. Deployable production environment blocks are intentionally absent from the Wrangler configuration.

Configured application origins:

- Preview web: `https://veterans-bay-web-preview.mwangialex268.workers.dev`
- Preview API: `https://veterans-bay-api-preview.mwangialex268.workers.dev`
- Reserved future production web: `https://veterans-bay-web-production.mwangialex268.workers.dev`
- Reserved future production API: `https://veterans-bay-api-production.mwangialex268.workers.dev`

## Preconditions

1. Confirm the release commit is clean, reviewed, and tagged.
2. Confirm Node 22 and npm 10.
3. Confirm operator legal identity and production support ownership.
4. Confirm separate preview and production Neon databases, Cloudflare environments and `workers.dev` origins, Queues, Cron triggers, rate-limit namespaces, Better Auth secrets/origins, and Cloudinary credentials.
5. Run `npm ci`, `npm run db:check`, `npm run verify`, and `npm run test:e2e`.
6. Confirm `npm audit --omit=dev` has no high or critical findings.

## Preview

Provisioned Queue: `veterans-bay-domain-events-preview`.
Provisioned database: `veterans-bay-preview`, PostgreSQL 16 in AWS US East 2 (Ohio), with all 35 reviewed migrations applied.
Configured preview API secrets: encrypted `DATABASE_URL`, an environment-specific `BETTER_AUTH_SECRET`, and the existing Cloudinary cloud name, API key, and API secret.
Deployed preview API: `https://veterans-bay-api-preview.mwangialex268.workers.dev`; health and readiness return 200, configured CORS is verified, and per-version preview URLs are disabled.
Deployed preview web: `https://veterans-bay-web-preview.mwangialex268.workers.dev`; public route and asset smoke checks return 200, per-version preview URLs are disabled, and `/api/*` reaches the preview API through the `API` service binding.
Deployed accessibility verification: all 12 serious/critical accessibility, keyboard-navigation, and viewport-overflow checks pass on desktop and mobile Chromium.

1. Configure preview secrets with `wrangler secret put` against the preview environment. Never paste values into a committed file.
2. Apply migrations to the preview database with `DATABASE_URL` set explicitly: `npm run db:migrate`.
3. Build the API with `npm run build:api`.
4. Build the web worker with `npx opennextjs-cloudflare build`.
5. Deploy the API Worker, then the web Worker, to preview.
6. Verify `/api/health`, `/api/ready`, authentication cookies/origins, public marketplace cache headers, private file delivery, Queue publication/consumption, Cron, rate limits, and the complete success journey.
7. Inspect async diagnostics and Cloudflare logs before promotion.

## Production

Production is intentionally unavailable from the committed Wrangler environments. Before restoring a production environment, obtain release-owner approval for the legal/operator details and dependency advisories, provision isolated resources and secrets, restore reviewed `production` blocks to both Wrangler configurations, and rerun every precondition.

1. Record the migration journal head and Neon recovery point.
2. Apply the reviewed forward migrations once.
3. Deploy the API Worker before the web Worker when API contracts are backward compatible.
4. Deploy the saved web build from the same release commit.
5. Run post-deployment smoke tests from the production origin.
6. Confirm Queue backlog, dead letters, error rate, request latency, and database connections remain healthy for at least 30 minutes.

## Stop conditions

Stop or roll back when a migration fails, authentication origin/cookie behaviour fails, private data is exposed, authorisation isolation fails, error rates materially increase, or Queue backlog grows without recovery.
