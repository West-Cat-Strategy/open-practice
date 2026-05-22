# OP-T112 Billing Locks And Rate Rules Proof

Date: 2026-05-19

Branch: `codex/op-t112-billing-locks-rate-rules`

Commit: `e8efe80`

## Scope

This slice adds staff-only billing rate presets and period locks:

- rate presets can be applied when creating time entries, and the resulting `rateCents` snapshot is
  stored on the entry
- active matter or firm billing-period locks reject time and expense create/update attempts inside
  the locked date range
- submitted, approved, billed, and written-off time/expense entries reject mutable patch attempts
- invoice approval, issuing, payment, and trust-transfer behavior stay on the existing lifecycle

## Selector

Command:

```bash
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Result: pass. The selector recommended policy, domain/database/API/provider/worker tests and
typechecks, database migration checks, and route-boundary validation.

## Focused Validation

```bash
pnpm --filter @open-practice/domain test -- billing.test.ts audit-taxonomy.test.ts
```

Result:

```text
Test Files  16 passed (16)
Tests  118 passed (118)
```

```bash
pnpm migrations:check
pnpm --filter @open-practice/database db:check
```

Result:

```text
Migration parity passed: 39 SQL files match 39 journal entries.
Everything's fine
```

```bash
pnpm --filter @open-practice/database test -- repository.ledger.test.ts schema.test.ts
```

Result:

```text
Test Files  14 passed (14)
Tests  73 passed (73)
```

```bash
pnpm --filter @open-practice/api test -- src/routes/billing.test.ts
```

Result:

```text
Test Files  33 passed (33)
Tests  340 passed (340)
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

## Integration Closeout

The final improvement-batch closeout tightened period-lock enforcement so locked-period time and
expense status-transition routes are covered alongside create and patch routes. Submit, approve, and
write-off routes now recheck the active billing-period lock for the entry date before changing
`billingStatus`.

Focused follow-through passed:

```text
pnpm --filter @open-practice/api test -- src/routes/billing.test.ts
Test Files  33 passed (33)
Tests  340 passed (340)

pnpm --filter @open-practice/api typecheck
tsc -p tsconfig.json --noEmit
```
