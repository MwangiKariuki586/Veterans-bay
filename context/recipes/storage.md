# Storage Recipe — Veterans Bay

## Load When

Working on Cloudinary, images or documents, upload authorization, metadata, private delivery, asset linking, replacement, deletion, or cleanup.

## Boundary

Cloudinary stores file content. PostgreSQL stores provider identifiers, purpose, MIME type, size, visibility, owner, organisation, linked record, timestamps, and lifecycle state.

The browser never decides authoritative owner, organisation, folder, public ID, target record, visibility, transformation, or retention.

## Purpose Examples

```txt
AVATAR
PROFESSIONAL_LOGO
PORTFOLIO_IMAGE
SERVICE_IMAGE
REQUEST_ATTACHMENT
JOB_EVIDENCE
VERIFICATION_DOCUMENT
MESSAGE_ATTACHMENT
PAYMENT_EVIDENCE
WARRANTY_EVIDENCE
DISPUTE_EVIDENCE
```

Each purpose defines allowed types, maximum size, resource type, visibility, compatible records, replacement behaviour, and retention.

## Upload Flow

```txt
authenticate
→ validate purpose
→ resolve workspace and ownership
→ verify target permission
→ generate short-lived bounded authorization
→ upload directly
→ verify provider result
→ persist metadata
→ link to approved record
```

## Rules

- Validate purpose, MIME type, extension, provider resource type, size, dimensions where relevant, ownership, and scope.
- Do not rely on extension alone.
- Private assets require authorized delivery.
- Verify and link replacements before removing old presentation assets.
- Do not silently replace or delete historical evidence.
- Cleanup is bounded, age-aware, idempotent, and observable.
- Keep secrets and signatures out of browser bundles and logs.

## Verification

Test valid and invalid uploads, oversized files, expired authorization, folder and public-ID restriction, ignored browser ownership, tampered completion, metadata, cross-tenant linking, private delivery, replacement, retention, deletion, cleanup, provider failures, and secret exposure.
