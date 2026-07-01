# Deposit-Match Manual Payment Reconcile Command Proof - 2026-06-30

Date: 2026-06-30
Branch: `feat/deposit-match-manual-reconcile-command-20260630`; dashboard follow-up branch
`feat/deposit-match-dashboard-reconcile-20260701`
Base: `origin/main` at `17fa4098`
Status: Implemented with the 2026-07-01 staff Billing dashboard affordance follow-up recorded.

## Scope

This slice adds one staff-only API command:
`POST /api/billing/payment-import-review-records/:recordId/reconcile-manual-payment`.

The command consumes the latest existing `candidate_supported` deposit-match reviewer decision only
after rechecking current eligibility: linked manual payment, pending status, same matter scope,
amount match, CAD import/review currency posture, candidate invoice, no duplicate/conflict cue, and
invoice balance coverage. It delegates the effective allocation and invoice paid/balance update to
the existing manual-payment reconciliation repository path.

The 2026-07-01 follow-up adds one staff Billing dashboard row action for existing
`reconciliationReadiness.eligible` rows. The action posts an explicit empty JSON body `{}` to the
existing route, refreshes the existing Billing dashboard payload after success, and leaves the
route's server-side readiness recheck as the source of truth.

## Boundary

- The body accepts only optional `reconciledAt`; notes, free-form evidence, raw provider payloads,
  provider fields, and private review text are rejected by strict request validation.
- The command records safe derived reconciliation evidence: source label, payment import review
  record ID, deposit-match review ID, manual-payment candidate ID, invoice candidate ID, enum
  decision/reason, amount, currency, and readiness reason.
- The dashboard follow-up sends no browser timestamp, notes, free-form evidence, raw provider
  payloads, provider fields, or private review text.
- It adds no new route, provider call, live settlement, bank-feed connection, broad auto-matching,
  client notification, trust transfer, trust posting, migration, refund or chargeback command, or
  invoice mutation outside the existing manual-payment reconciliation semantics.
- Tests and docs use synthetic data only; no client, matter, credential, payment, private
  deployment, raw provider, card/customer, trust, object-storage, private audit, or provider-schema
  details were added.

## Final Changed Paths

```text
apps/api/src/routes/billing.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md
docs/validation/README.md
```

## Original Command Path Set

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/payment-import-review-records.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md
docs/validation/README.md
scripts/route-authorization/billing.mjs
```

## Focused Development Proof

```text
2026-07-01 dashboard affordance follow-up:
PASS pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md docs/validation/README.md
  - Selected architecture, API contract, format, docs, policy, API/web tests,
    API/web typechecks, and build.

BLOCKED because fresh sibling worktree package outputs were missing before upstream package
builds: pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts

PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/providers build

PASS pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts
  - Billing route suite reported 1 file and 44 tests passing, including the empty-body
    dashboard command call and existing derived reconciliation evidence.

PASS pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx
  - Billing section web test reported 1 file and 1 test passing, including the eligible-only
    dashboard affordance copy/status.

Original 2026-06-30 API command proof:
BLOCKED because fresh sibling worktree package outputs were not built yet:
pnpm --dir apps/api exec vitest run src/routes/billing.test.ts
  - Failed before collecting tests because @open-practice/database package entrypoint dist output
    was missing in the fresh worktree.

PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/providers build

PASS pnpm --dir apps/api exec vitest run src/routes/billing.test.ts
  - Billing route suite reported 1 file and 38 tests passing.

PASS pnpm --dir apps/api exec vitest run src/routes/billing.test.ts
  - Reran after adding the explicit import/review currency guard; 1 file and 38 tests passed.

PASS pnpm --filter @open-practice/domain test -- billing.test.ts
  - Domain suite reported 33 files and 279 tests passing.

PASS pnpm --filter @open-practice/database test -- repository.billing-invoices-payments.test.ts repository.payment-import-review-records.test.ts
  - Database suite reported 29 files and 167 tests passing.

PASS pnpm --dir apps/web exec vitest run app/dashboard/billing-section.test.tsx
  - Web billing section suite reported 1 file and 1 test passing.
```

## Selector Output

```text
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md docs/validation/README.md

Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status  | Notes                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Pass    | Built upstream package output for fresh-worktree API test resolution.                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Pass    | Built upstream package output for fresh-worktree API test resolution.                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/providers build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Pass    | Built upstream package output for fresh-worktree API test resolution.                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Pass    | Passed after the fresh-worktree package outputs were built; 1 file and 44 tests passed. The route accepts the dashboard's empty `{}` body and still records only existing derived deposit-match reconciliation evidence.                                                                                                                       |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Pass    | 1 file and 1 test passed, including the eligible-only dashboard action and status copy.                                                                                                                                                                                                                                                        |
| `pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md docs/validation/README.md`                                                                                                 | Pass    | Selected architecture, API contract, format, docs, policy, API/web tests, API/web typechecks, and build.                                                                                                                                                                                                                                       |
| `pnpm architecture:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Pass    | Architecture import policy passed with 469 workspace import edges reviewed.                                                                                                                                                                                                                                                                    |
| `pnpm api:contract`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 355 paths.                                                                                                                                                                                                                                                                  |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pass    | Initial run found formatting drift in two touched files; after `pnpm exec prettier --write apps/web/app/dashboard-client.tsx docs/api-and-state-machines.md`, the final run passed.                                                                                                                                                            |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Pass    | Documentation link validation passed.                                                                                                                                                                                                                                                                                                          |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Blocked | Blocked because the machine-local reference corpus file `/Users/bryan/projects/reference-repos/docs/index.json` is absent. Before that gate, tracked-secret scan, package manifest dependency policy, lockfile supply-chain policy, toolchain policy, env surface, architecture policy, deadcode, migration parity, and migration lint passed. |
| `node scripts/validate-doc-links.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Pass    | Supplemental tail check passed because `pnpm policy:check` was blocked before reaching this step.                                                                                                                                                                                                                                              |
| `node scripts/validate-validation-proof-index.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Pass    | Supplemental tail check passed because `pnpm policy:check` was blocked before reaching this step.                                                                                                                                                                                                                                              |
| `node scripts/validate-local-evidence-dockerignore.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Pass    | Supplemental tail check passed because `pnpm policy:check` was blocked before reaching this step.                                                                                                                                                                                                                                              |
| `node scripts/validate-open-practice-boundaries.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Pass    | Supplemental tail check passed because `pnpm policy:check` was blocked before reaching this step.                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api test -- --silent`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pass    | API package suite reported 43 files and 675 tests passing.                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Pass    | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Pass    | Web package suite reported 47 files and 256 tests passing.                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Pass    | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                                                                         |
| `pnpm build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Pass    | Turbo build reported 6 successful package build tasks.                                                                                                                                                                                                                                                                                         |
| `git diff --check -- apps/api/src/routes/billing.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md docs/validation/README.md`                                                                                                           | Pass    | No whitespace errors.                                                                                                                                                                                                                                                                                                                          |
| `pnpm proof:reconcile -- --proof docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md --files apps/api/src/routes/billing.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md docs/validation/README.md` | Pass    | Reconciliation passed for the 10-path dashboard follow-up set and selected command set.                                                                                                                                                                                                                                                        |
