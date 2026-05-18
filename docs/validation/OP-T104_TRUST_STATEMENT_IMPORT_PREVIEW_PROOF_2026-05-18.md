# OP-T104 Trust Statement Import Preview Proof

Date: 2026-05-18

## Scope

Added the smallest non-posting trust statement import preview slice.

The new `POST /api/ledger/reconciliations/preview` route is firm-wide and review-only. It accepts
synthetic statement rows for an existing trust asset account, dedupes repeated rows by normalized
date, amount, description, and reference, and proposes matches against existing trust-ledger entries
for that account.

The preview response carries `review_only_no_automatic_ledger_posting`. It does not post trust
ledger entries, create reconciliation records, approve transactions, move funds, or emit audit
events. Staff still need the existing reconciliation path to record reviewed matched or unmatched
statement rows.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts apps/api/src/routes/ledger.ts apps/api/src/routes/ledger.test.ts scripts/validate-open-practice-boundaries.mjs scripts/route-authorization-manifest.mjs docs/api-and-state-machines.md docs/trust-funds-caveats.md docs/validation/OP-T104_TRUST_STATEMENT_IMPORT_PREVIEW_PROOF_2026-05-18.md
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

Passed:

```sh
pnpm --filter @open-practice/domain exec vitest run src/ledger.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm docs:check
pnpm policy:check
pnpm format:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm test
```

Results:

- Focused domain ledger test: 1 file, 6 tests passed.
- Focused API ledger route test: 1 file, 17 tests passed.
- Full domain tests: 15 files, 100 tests passed.
- Full API tests: 33 files, 314 tests passed.
- Providers tests: 5 files, 15 tests passed.
- Worker tests: 3 files, 19 tests passed.
- Root `pnpm test`: Turbo test across API, database, domain, providers, web, and worker plus
  `node --test scripts/*.test.mjs` passed.
- API and domain typechecks passed.
- Docs, policy, and formatting checks passed.

Skipped checks: none for this row-local proof.
