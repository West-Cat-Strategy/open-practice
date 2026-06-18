# Ledger Balance Snapshot Comparison Proof

Date: 2026-06-17 PDT

Branch: `feature/reviewer-ledger-balance-snapshot-comparison`

## Scope

Implemented the smallest reviewer-only ledger balance snapshot comparison:

- `packages/domain/src/ledger.ts` derives a `balanceSnapshotComparison` from current OP trust
  balances, latest posted transaction posture, latest statement import batch metadata as preview
  posture, and latest reconciliation snapshot cues.
- `GET /api/ledger/controls` includes the comparison inside the existing trust controls payload.
- The Funds trust controls dashboard renders compact current-balance, latest-posting,
  preview-metadata, reconciliation-variance, review-reason, and boundary cues.
- Matter-scoped controls remain matter-filtered and do not expose firm-wide reconciliation,
  import-batch, profile, or freshness arrays.

## Boundaries Preserved

- No new tables, migrations, dependencies, routes, route authorization entries, worker jobs, report
  jobs, audit read events, export bodies, or provider integrations.
- No statement preview rows are persisted; the latest preview posture is the latest stored statement
  import batch metadata only.
- No ledger posting, transaction matching, reconciliation creation, settlement, bank-feed
  connection, disbursement automation, invoice/payment mutation, or jurisdiction-certified
  accounting claim was added.
- Tests and docs use synthetic examples only.

## Changed Paths

- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger/read.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/trust-controls-section.test.tsx`
- `apps/web/app/dashboard/trust-controls-section.tsx`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md`
- `docs/validation/README.md`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger/read.ts apps/web/app/_features/billing/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/trust-controls-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/README.md docs/validation/OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md packages/domain/src/ledger.test.ts packages/domain/src/ledger.ts
```

Selector passed and recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation Results

Focused checks:

- `pnpm --filter @open-practice/domain test -- ledger.test.ts` passed: 30 files / 213
  tests.
- `pnpm --filter @open-practice/domain build` passed.
- `pnpm --filter @open-practice/database build` passed after the fresh sibling worktree
  needed package build output for API imports.
- `pnpm --filter @open-practice/providers build` passed.
- `pnpm --dir apps/api exec vitest run src/routes/ledger.test.ts` passed: 1 file / 29
  tests.
- `pnpm --dir apps/web exec vitest run app/dashboard/trust-controls-section.test.tsx app/dashboard-client.test.ts`
  passed: 2 files / 77 tests.

Selector-recommended checks:

- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm --filter @open-practice/domain test` passed: 30 files / 213 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/api test` passed: 42 files / 553 tests.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/providers test` passed: 9 files / 20 tests.
- `pnpm --filter @open-practice/worker test` passed: 5 files / 45 tests.
- `pnpm --filter @open-practice/web test` passed: 37 files / 201 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed.
- `git diff --check` passed.
