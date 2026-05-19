# OP-T107 Reconciliation Exception Resolution Records Proof

Date: 2026-05-19

## Scope

Added the first review-only reconciliation exception resolution record slice.

The new staff API records resolution notes and variance decisions for unmatched trust statement
preview rows on an existing trust asset account. The server computes the statement-row duplicate key
from normalized date, amount, description, and reference values, records reviewer metadata, and emits
redacted audit metadata only.

This slice does not mutate posted ledger entries, create reconciliation records, approve
transactions, move funds, store arbitrary evidence JSON, or add accounting-certification language.
No web dashboard UI was added.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md docs/improvement-opportunities.md packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts packages/database/src/schema.ts packages/database/src/repository/contracts.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/drizzle-mappers.ts packages/database/test/repository.ledger.test.ts packages/database/test/schema.test.ts packages/database/migrations/0035_reconciliation_exception_resolutions.sql packages/database/migrations/meta/_journal.json apps/api/src/routes/ledger.ts apps/api/src/routes/ledger.test.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs docs/api-and-state-machines.md docs/trust-funds-caveats.md docs/validation/README.md docs/validation/OP-T107_RECONCILIATION_EXCEPTION_RESOLUTIONS_PROOF_2026-05-19.md
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

Passed:

```sh
pnpm --filter @open-practice/domain exec vitest run src/ledger.test.ts src/audit-taxonomy.test.ts
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/database exec vitest run test/repository.ledger.test.ts test/schema.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api typecheck
pnpm format:check
pnpm docs:check
pnpm migrations:check
pnpm --filter @open-practice/database db:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm test
pnpm policy:check
pnpm ci:local
```

Results:

- Focused domain ledger and audit-taxonomy tests: 2 files, 21 tests passed.
- Focused database repository/schema tests: 2 files, 32 tests passed.
- Focused API ledger route test: 1 file, 19 tests passed.
- Full domain tests: 16 files, 112 tests passed.
- Full database tests: 14 files, 69 tests passed.
- Full API tests: 33 files, 329 tests passed.
- Providers tests: 5 files, 15 tests passed.
- Worker tests: 3 files, 20 tests passed.
- Root `pnpm test`: Turbo package tests, including web package tests, plus
  `node --test scripts/*.test.mjs` passed.
- `pnpm ci:local` passed, including format, lint, typecheck, root tests, database schema check,
  policy checks, build, and `git diff --check`.

Skipped checks: none.
