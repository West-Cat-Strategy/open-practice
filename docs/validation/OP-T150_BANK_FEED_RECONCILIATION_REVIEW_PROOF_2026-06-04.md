# OP-T150 Bank Feed Reconciliation Review Proof

Date: 2026-06-04 PDT

## Scope

OP-T150 shipped the first metadata-only bank-feed import and reconciliation review slice on the
active core-suite Clio parity branch. The slice extends the existing trust controls/accounting
review workspace instead of adding live bank-feed integrations, provider credentials, automatic
matching, ledger posting, reconciliation automation, operating-bank account taxonomy, disbursement
automation, or certified accounting/compliance claims.

The runtime change is additive:

- `packages/domain/src/ledger.ts` now derives a `bankFeedReviewSummary` from existing accounting
  profiles, statement import batch metadata, reconciliation records, and trust controls diagnostics.
- `GET /api/ledger/controls` now includes firm-wide `accountingReview.importBatches` metadata and
  `accountingReview.bankFeedReviewSummary` for firm-wide ledger reviewers.
- Matter-scoped ledger-control reads still require `matterId` and still receive empty firm-wide
  reconciliation/import-batch/profile arrays.
- The Funds dashboard renders bank-feed shell, import-batch, pending-account, exception, protected
  feed, and no-automation cues using the trust controls payload.

## Boundaries Preserved

- No live bank-feed connection, provider credential storage, provider payload storage, statement-row
  persistence expansion, statement evidence storage, account/routing number storage, check-image
  storage, raw statement body storage, automatic matching, automatic ledger posting, automatic
  reconciliation, deposit matching, trust disbursement automation, invoice/payment mutation, or
  certified accounting/compliance claims.
- Import batches remain metadata-only records with source label, checksum, row counts, duplicate
  counts, status, optional matching profile ID, creator, and timestamp.
- The new summary keeps these flags hard-disabled: `automaticMatching`, `automaticLedgerPosting`,
  `automaticReconciliation`, `liveBankFeedConnection`, and `trustDisbursementAutomation`.
- OP-T150 builds on OP-T104 statement preview, OP-T107 exception resolutions, OP-T118 import-batch
  metadata, and OP-T136 accounting review profiles without duplicating those slices or widening
  persistence.

## OP-T150-Owned Runtime Paths

- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`

## Current Accumulated Branch Path Set

This branch currently carries OP-T144, OP-T145, OP-T146, OP-T147, OP-T148, OP-T149, and OP-T150
together. Final validation is selected from the full branch path set below rather than only the
OP-T150-owned subset.

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace.test.tsx`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/queues-section.tsx`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `apps/web/app/intake-pipeline-dashboard.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/reporting-dashboard.ts`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md`
- `docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md`
- `docs/validation/OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md`
- `docs/validation/OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing.ts apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/billing-dashboard.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.test.tsx apps/web/app/client-portal-workspace.tsx apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/page.tsx apps/web/app/reporting-dashboard.ts apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/trust-controls-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/trust-funds-caveats.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md docs/validation/OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md docs/validation/OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md docs/validation/README.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts packages/domain/src/ledger.test.ts packages/domain/src/ledger.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
```

Selector output:

```text
Selected:
- pnpm format:check
- pnpm docs:check
- pnpm policy:check
- pnpm test
- pnpm --filter @open-practice/domain test
- pnpm --filter @open-practice/domain typecheck
- pnpm --filter @open-practice/api test
- pnpm --filter @open-practice/api typecheck
- pnpm --filter @open-practice/providers test
- pnpm --filter @open-practice/worker test
- pnpm --filter @open-practice/web test
- pnpm --filter @open-practice/web typecheck
- pnpm build
```

## Validation Results

Targeted implementation checks run before final selector validation:

- `pnpm --filter @open-practice/domain test -- --runInBand`
  - 24 files / 170 tests passed.
- `pnpm --filter @open-practice/domain build`
  - Package freshness prerequisite so downstream API/web checks use the updated ledger exports.
- `pnpm --filter @open-practice/api test -- src/routes/ledger.test.ts`
  - 41 files / 470 tests passed after the domain build refreshed package exports.
- `pnpm --filter @open-practice/web test -- app/dashboard-client.test.ts`
  - 20 files / 139 tests passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.

Selector-based closeout validation:

- `pnpm verify:select -- --files <current accumulated branch path set above>`
  - Passed and selected the format, docs, policy, repo test, package test/typecheck, and build
    gates listed above.
- `pnpm format:check`
  - Initially reported formatting drift in the OP-T150 ledger/web/doc edits; targeted Prettier was
    run on the reported files and the rerun passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed after formatting, keeping downstream package exports fresh for API and web validation.
- `pnpm test`
  - Passed: domain 24 files / 170 tests, database 18 files / 101 tests, providers 7 files / 18
    tests, web 20 files / 139 tests, worker 3 files / 34 tests, API 41 files / 470 tests, and 38
    script tests.
- `pnpm --filter @open-practice/domain test`
  - 24 files / 170 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - 41 files / 470 tests passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - 7 files / 18 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 3 files / 34 tests passed.
- `pnpm --filter @open-practice/web test`
  - 20 files / 139 tests passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed across all six packages.
- `git diff --check`
  - Passed.
