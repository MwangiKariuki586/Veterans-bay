# Database Recipe — Veterans Bay

## Load When

Working on Neon, Drizzle, schemas, migrations, repositories, transactions, indexes, constraints, tenant isolation, financial records, or outbox persistence.

## Boundary

PostgreSQL is authoritative. Drizzle owns schema, query, and migration mechanics. Domain services own business rules and transaction orchestration. Repositories own scoped persistence.

## Rules

- Use a Cloudflare-compatible Neon and Drizzle pattern.
- Keep credentials server-only.
- Use committed reviewed migrations.
- Never rewrite migrations applied to shared environments.
- Use foreign keys, deliberate deletion behaviour, unique constraints, and stable indexes.
- Require verified tenant or participant scope in private repository methods.
- Use timezone-aware timestamps.
- Use integer minor units and explicit currency for money.
- Keep JSON bounded and justified.
- Preserve quotation, variation, financial, warranty, review, moderation, and dispute history.
- Paginate large lists with stable sorting and a unique tiebreaker.

## Transaction Pattern

```txt
begin
→ load authoritative state
→ validate actor and transition
→ apply dependent records
→ create history/activity
→ insert outbox event
→ commit
```

Do not make external provider calls inside the transaction.

## Verification

Test clean and upgrade migrations, constraints, indexes, tenant isolation, public projection, pagination, rollback, concurrency, duplicate protection, outbox atomicity, money calculations, and Cloudflare runtime access.
