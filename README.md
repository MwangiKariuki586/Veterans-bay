# Veterans Bay

Veterans Bay is a service marketplace and professional operations platform for home repair and maintenance services.

## Requirements

- Node.js 22.x
- npm 10.x

## Setup

```powershell
Copy-Item .env.example .env
npm ci
```

The committed Wrangler configuration provides safe local defaults. Keep real credentials in ignored environment files and never commit them.

## Database

Neon PostgreSQL is the authoritative data store. Drizzle owns schema and migrations.

```powershell
Copy-Item .env.example .env
# Set DATABASE_URL, then mirror it into .dev.vars for Wrangler.
npm run db:migrate
```

Useful commands:

```powershell
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:studio
```

## Authentication

Better Auth runs on the API Worker at `/api/auth/*`, reached from the web app through the Next.js `/api` rewrite.

```powershell
# Add to .env and .dev.vars
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
```

Email verification and password reset stay disabled until outbound email delivery is configured.

## File storage

Cloudinary credentials are server-only and must also be mirrored into `.dev.vars` for the API Worker:

```powershell
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Domain events

The API Worker publishes to the `veterans-bay-domain-events` Queue (`DOMAIN_EVENTS_QUEUE`) and runs a Cron trigger every 5 minutes for abandoned-claim recovery. Local `wrangler dev` creates the queue binding automatically.

Authenticated proof endpoint: `POST /api/v1/system/outbox-proof`.

Public auth and `/api/v1/public/*` submissions use `PUBLIC_SUBMISSION_RATE_LIMITER` (stricter, IP-scoped). General API traffic uses `API_RATE_LIMITER`.

## Development

```powershell
npm run dev
```

The web application runs at `http://localhost:3000`. The Hono API Worker runs at `http://localhost:8787`, with health available at `http://localhost:8787/api/health` and through the web origin at `http://localhost:3000/api/health`.

Run either runtime independently with `npm run dev:web` or `npm run dev:api`.

## Verification

```powershell
npm run verify
```

Cloudflare runtime previews are intentionally separate because they remain running:

```powershell
npm run preview:api
npm run preview:web
```

These commands verify local Cloudflare compatibility. A remote Cloudflare deployment is not configured or claimed as verified.
