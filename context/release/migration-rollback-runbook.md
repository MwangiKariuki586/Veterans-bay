# Migration and Rollback Runbook

## Migration rehearsal

1. Restore a recent production-shaped backup into an isolated Neon branch.
2. Point `DATABASE_URL` only at that branch.
3. Run `npm run db:check` and `npm run db:migrate`.
4. Run the database suite and representative query plans.
5. Record duration, locks, row counts, and the resulting Drizzle journal head.

## Forward-only database policy

Applied shared migrations are never renamed, edited, or removed. Corrective schema work uses a new migration.

## Application rollback

1. Pause promotion and preserve logs/correlation IDs.
2. Redeploy the last known-good API and web artifacts.
3. Do not reverse a compatible additive migration merely to roll back code.
4. If new code wrote incompatible data, disable the affected action and ship a reviewed forward correction.

## Database recovery

For destructive or incompatible failure, use the reviewed Neon point-in-time recovery/branch procedure. Validate record counts and the thirteen success criteria before redirecting production traffic. The operator must document recovery ownership and recovery-time expectations before launch.
