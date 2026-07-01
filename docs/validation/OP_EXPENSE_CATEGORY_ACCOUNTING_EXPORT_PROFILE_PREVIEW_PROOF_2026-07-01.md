# Expense Category Accounting Export Profile Preview Proof - 2026-07-01

## Summary

Added a read-only staff Reports workspace preview for firm expense category accounting export
profile metadata:

- `GET /api/reports/workspace` now includes
  `expenseCategoryAccountingExportProfileSummary` derived from existing firm-managed expense
  category records.
- The summary maps existing category codes to OP-authored local accounting-export metadata using
  category labels, active/reimbursable posture, scope counts/booleans, review buckets/cues, bounded
  mapping rows, and fixed safeguard flags only.
- The Reports dashboard renders the preview as operational read-only metadata alongside the
  existing export-profile alignment section.

## Boundaries

- All examples and tests use synthetic data only; no client, matter, credential, payment,
  privileged document, private deployment, or private audit detail was added or exposed.
- No external accounting provider, export serialization change, route, schema, migration, job,
  audit event, invoice recalculation, payment mutation, trust posting, external chart-of-account
  mapping, provider identifier, raw export body, or certified-accounting claim was added.
- The preview does not change billing export downloads, invoice lifecycle behavior, payment
  reconciliation, trust-transfer review, trust-ledger posting, or financial field-profile
  serialization.

## Final Changed Paths

- apps/api/src/routes/reports.test.ts
- apps/api/src/routes/reports.ts
- apps/web/app/dashboard/reports-section.test.tsx
- apps/web/app/dashboard/reports-section.tsx
- apps/web/app/reporting-dashboard.ts
- docs/api-and-state-machines.md
- docs/planning-and-progress.md
- docs/validation/README.md
- packages/domain/src/billing.test.ts
- packages/domain/src/billing.ts
- packages/domain/src/reports.test.ts
- packages/domain/src/reports.ts
- docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md

## Selector Evidence

```bash
pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md
```

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation Results

- Pass: `pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md`
  selected the commands listed above for the exact final path set.
- Pass: `pnpm architecture:check`
  - `Architecture import policy passed: 468 workspace import edges reviewed.`
- Pass: `pnpm api:contract`
  - Wrote `.tmp/api-contract/openapi.json` with 353 paths.
- Pass after targeted Prettier write on touched files: `pnpm format:check`
  - Initial run flagged `apps/api/src/routes/reports.test.ts`,
    `apps/web/app/dashboard/reports-section.tsx`, `docs/api-and-state-machines.md`,
    `docs/validation/README.md`, `packages/domain/src/billing.ts`, and
    `packages/domain/src/reports.test.ts`.
  - Ran `pnpm exec prettier --write apps/api/src/routes/reports.test.ts apps/web/app/dashboard/reports-section.tsx docs/api-and-state-machines.md docs/validation/README.md packages/domain/src/billing.ts packages/domain/src/reports.test.ts`.
  - Rerun passed with `All matched files use Prettier code style!`.
- Pass: `pnpm docs:check`
  - `Documentation link validation passed.`
- Blocked by unrelated reference-index drift: `pnpm policy:check`
  - Passed tracked-secret scan, package manifest policy, lockfile supply-chain policy, toolchain
    policy, environment surface, architecture graph, dead-code check, migration parity, and
    migration lint.
  - Failed at `node scripts/validate-oss-reuse.mjs` because existing reference locks do not match
    the central reference index for multiple reference repos, including `activepieces__activepieces`,
    `apache__fineract`, `calcom__cal.diy`, `docusealco__docuseal`,
    `ledgersmb__ledgersmb`, `openfga__openfga`, `paperless-ngx__paperless-ngx`,
    `temporalio__temporal`, and `zulip__zulip`.
  - The blocker is outside this final changed path set; this branch added no dependency, vendored
    asset, copied source, or reference-derived code.
- Pass: `pnpm --filter @open-practice/domain test`
  - 33 files and 295 tests passed.
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass after fresh-worktree hydration: `pnpm --filter @open-practice/api test`
  - Initial run failed because `@open-practice/database` package entrypoints were not built in the
    fresh sibling worktree.
  - Ran hydration builds: `pnpm --filter @open-practice/database build` and
    `pnpm --filter @open-practice/providers build`.
  - Rerun passed with 43 files and 656 tests.
- Pass after fresh-worktree hydration: `pnpm --filter @open-practice/api typecheck`
  - Initial run failed on unresolved `@open-practice/database` and provider package entrypoints.
  - Rerun after database/provider builds passed.
- Pass: `pnpm --filter @open-practice/providers test`
  - 7 files and 21 tests passed.
- Pass after fresh-worktree hydration: `pnpm --filter @open-practice/worker test`
  - Initial run failed on unresolved `@open-practice/database` and provider package entrypoints.
  - Rerun after database/provider builds passed with 6 files and 54 tests.
- Pass: `pnpm --filter @open-practice/web test`
  - 46 files and 249 tests passed.
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
  - Turbo reported 6 successful build tasks.

## Closeout Checks

- Pass: `pnpm proof:reconcile -- --proof docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md --files apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md`
  - Reconciled 13 final paths with the selected validation commands and returned
    `Result: passed`.
- Pass: `git diff --check`
