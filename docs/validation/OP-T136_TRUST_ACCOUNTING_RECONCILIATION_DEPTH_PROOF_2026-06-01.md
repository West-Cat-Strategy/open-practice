# OP-T136 Trust Accounting Reconciliation Depth Proof

Date: 2026-06-01 PDT

## Scope

Implemented the first review-only OP-T136 trust/accounting reconciliation-depth slice:

- Persisted statement match-rule profiles for trust asset accounts with reference/description
  strategy, date-window tolerance, amount tolerance, variance categories, reviewer explanation
  posture, timestamps, and review-only enforcement.
- Persisted accounting review profiles for ledger accounts with operating-vs-trust/expense boundary
  posture, protected-funds cues, metadata-only bank-feed import posture with automatic matching
  forced off, and vendor/expense/client-matter dimension posture.
- Added API routes for creating and listing both profile families, with firm-wide
  `trust_ledger:approve` authorization and safe audit metadata only.
- Seeded synthetic profile data and exposed summary counts plus profile rows in the existing Funds
  dashboard trust-controls surface.
- Updated route authorization/boundary scripts, API docs, trust/funds caveats, planning status, and
  validation indexes.

Out of scope: live bank feeds, automatic transaction matching, automatic disbursement, trust posting
automation, settlement records, statement evidence storage, jurisdiction-specific compliance
claims, and certified accounting language.

## Clean-Room Posture

The Clio parity review and official Clio public pages were used only as planning inputs for feature
category and gap ranking. No Clio prose, schemas, examples, screenshots, UI structure, assets,
private tenant data, or code were copied into Open Practice.

## Changed Paths

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/conversation-threads.test.ts`
- `apps/api/src/routes/intake-forms.test.ts`
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
- `docs/validation/OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md`
- `docs/validation/OP-T136_TRUST_ACCOUNTING_RECONCILIATION_DEPTH_PROOF_2026-06-01.md`
- `docs/validation/OP_CLIO_PARITY_AUDIT_PROOF_2026-06-01.md`
- `docs/validation/README.md`
- `packages/database/migrations/0045_accounting_review_profiles.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/test/repository.ledger.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`
- `packages/domain/src/sample-data.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/validate-open-practice-boundaries.mjs`

## Closeout Drift

The closeout pass found date-sensitive API tests that had expired after the 2026-06-01 parity audit:
Stripe Checkout Session reuse used a fixed same-day expiry, client portal/intake action links used
near-term fixed expiries, and conversation-thread creation used a fixed retention boundary that had
become past-tense in PDT. Those assertions are now future-relative while preserving the same
behavioral coverage.

## Validation

- `pnpm verify:select -- --files $(git diff --name-only main)`
  passed and selected format, docs, policy, root/package tests, package typechecks, database checks,
  migration parity, and build.
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm --filter @open-practice/domain test` passed: 22 files, 153 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database test` passed: 16 files, 89 tests.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed: 46 SQL files match 46 journal entries.
- `pnpm --filter @open-practice/database typecheck` passed.
- Targeted API drift rerun passed for `src/routes/billing.test.ts`,
  `src/routes/client-portal.test.ts`, `src/routes/conversation-threads.test.ts`, and
  `src/routes/intake-forms.test.ts`: 4 files, 56 tests.
- `pnpm --filter @open-practice/api test` passed: 39 files, 430 tests.
- `pnpm --filter @open-practice/api typecheck` passed after rebuilding local package artifacts with
  `pnpm --filter @open-practice/domain build`, `pnpm --filter @open-practice/database build`, and
  `pnpm --filter @open-practice/providers build`.
- `pnpm --filter @open-practice/providers test` passed: 7 files, 17 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 27 tests.
- `pnpm --filter @open-practice/web test` passed: 16 files, 128 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm test` passed, including package tests and 38 script contract tests.
- `pnpm build` passed.
- `git diff --check` passed.
- `rg -n "Clio|clio" apps packages scripts` returned no matches.

No validation checks were skipped.
