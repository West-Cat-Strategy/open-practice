# OP-T115 Trust Statement Import Batches Proof

Date: 2026-05-22

## Scope

Added the first persistent, metadata-only trust statement import batch slice.

The new firm-wide API records statement import batch metadata for an existing trust asset account:
source label, checksum, row count, duplicate count, status, optional matching profile ID, creator,
and timestamp. It stores no statement rows, statement evidence, posting payloads, or private matter
details.

This slice keeps posting separate. It does not post trust ledger entries, create reconciliation
records, approve transactions, move funds, or add dashboard UI.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts packages/database/src/schema.ts packages/database/src/repository/contracts.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/drizzle-mappers.ts packages/database/test/repository.ledger.test.ts packages/database/test/schema.test.ts packages/database/migrations/0037_trust_statement_import_batches.sql packages/database/migrations/meta/_journal.json apps/api/src/routes/ledger.ts apps/api/src/routes/ledger.test.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs docs/api-and-state-machines.md docs/trust-funds-caveats.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T115_TRUST_STATEMENT_IMPORT_BATCHES_PROOF_2026-05-22.md
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
pnpm --filter @open-practice/api build
pnpm --filter @open-practice/database exec vitest run test/repository.ledger.test.ts test/schema.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm format:check
git diff --check
```

Results:

- Focused domain ledger and audit-taxonomy tests passed: 2 files, 24 tests.
- Focused database repository/schema tests passed: 2 files, 32 tests.
- Focused API ledger route tests passed: 1 file, 23 tests.
- Providers tests passed: 5 files, 15 tests.
- Worker tests passed: 3 files, 21 tests.
- Domain, database, and API builds/typechecks passed.
- Database schema, migration parity, docs, policy, formatting, and diff whitespace checks passed.

Skipped checks: root `pnpm test` and full package test sweeps were not run; OP-T115 changed only the
domain/database/API ledger seam and docs, and the focused tests plus provider/worker smoke covered
the selector-recommended impacted surfaces.
