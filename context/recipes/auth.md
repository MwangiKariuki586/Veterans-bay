# Authentication Recipe — Veterans Bay

## Load When

Working on Better Auth, sessions, registration, verification, password reset, protected routes, account restrictions, workspace access, or authentication rate limiting.

## Authority

Inspect the installed Better Auth version, types, current implementation, Worker compatibility, and current official documentation before using an API.

## Boundary

Better Auth owns credentials, sessions, verification, reset tokens, and authentication cookies.

Veterans Bay owns profiles, restrictions, organisations, memberships, roles, permissions, professional status, workspaces, and platform assignments.

Do not store one permanent application role on the user.

## Protected Flow

```txt
resolve session
→ check current account status
→ resolve workspace
→ load membership or platform assignment
→ evaluate permission
→ verify record ownership, participation, or assignment
→ continue
```

## Rules

- Use validated server-only configuration.
- Configure explicit trusted origins and secure cookies.
- Validate internal callback and redirect destinations.
- Reconcile application profiles idempotently.
- Do not rely on stale session metadata for permission authority.
- Apply distributed rate limiting to authentication endpoints.
- Do not expose account-enumeration details.
- Do not present email verification or password reset as functional until delivery is configured and tested.

## Verification

Test registration retries, duplicate email, sign-in/out, invalid credentials, session expiry, restrictions, workspace access, stale membership, cross-tenant denial, platform-role access, redirect safety, cookies, trusted origins, rate limiting, secret exposure, and truthful email flows.
