# OP-T111 Delivery Receipt Tokens Proof

Date: 2026-05-19

Branch: `codex/op-t111-delivery-receipt-tokens`

Commit: `1220073`

## Scope

This slice adds staff-created, purpose-scoped public receipt links for selected outbound emails.
Receipt tokens are hashed before storage, and public endpoints return only status, purpose, expiry,
and acknowledgement timing.

The public receipt responses do not expose sessions, recipient lists, message bodies, token hashes,
email content, or private outbound-email metadata.

## Selector

Command:

```bash
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Result: pass. The selector recommended policy, domain/database/API/provider/worker tests and
typechecks, database migration checks, and route-boundary validation.

## Focused Validation

```bash
pnpm --filter @open-practice/domain test -- audit-taxonomy.test.ts
```

Result:

```text
Test Files  16 passed (16)
Tests  116 passed (116)
```

```bash
pnpm migrations:check
pnpm --filter @open-practice/database db:check
```

Result:

```text
Migration parity passed: 38 SQL files match 38 journal entries.
Everything's fine
```

```bash
pnpm --filter @open-practice/database test -- repository.providers-jobs-email.test.ts schema.test.ts
```

Result:

```text
Test Files  14 passed (14)
Tests  72 passed (72)
```

```bash
pnpm --filter @open-practice/api test -- src/routes/email.test.ts src/http/http.test.ts
```

Result:

```text
Test Files  33 passed (33)
Tests  338 passed (338)
```

## Follow-Through Checks

```bash
pnpm format:check
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm policy:check
git diff --check
```

Result: pass. The fresh worktree needed local package builds before database/API tests could resolve
workspace package entrypoints; after those builds, the same focused checks passed.
