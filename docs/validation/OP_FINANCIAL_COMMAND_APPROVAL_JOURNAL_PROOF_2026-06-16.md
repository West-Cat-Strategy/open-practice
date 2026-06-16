# Financial Command Approval Journal Proof

Date: 2026-06-16 PDT

## Scope

Implemented the smallest read-only financial command approval journal over existing audit metadata:

- `GET /api/ledger/controls?matterId=` now includes a `financialCommandJournal` projection.
- The domain-owned projection normalizes only existing audit events for trust-transfer
  approve/reject/link decisions, ledger transaction approval decisions, invoice approvals, ledger
  reconciliation creation, reconciliation exception resolutions, and manual-payment reconciliation.
- Matter-scoped trust controls requests receive only journal entries whose audit metadata touches the
  requested matter; account-level reconciliation audit events remain firm-wide review cues.
- The Trust Controls dashboard renders a compact journal list, empty state, and audit-chain-invalid
  warning without a new navigation entry or extra client fetch.

## Boundaries Preserved

- No schema, migration, repository persistence, command table, posting request table, or new route.
- No trust-ledger posting automation, invoice/payment settlement behavior, payment processor
  behavior, automatic reconciliation, public/client-portal exposure, or read-side audit event.
- Journal entries expose only allowlisted IDs, family/decision labels, status, amount/count,
  evidence-present, and audit-chain-validity cues.
- Raw audit metadata values, reviewer notes, evidence payloads, statement rows, settlement payloads,
  private receipt bodies, and invoice narratives stay out of the journal response and dashboard.

## Validation Selection

Run before choosing final validation with the actual changed path set:

```sh
pnpm verify:select -- --files apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger/read.ts apps/web/app/_features/billing/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/trust-controls-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/index.ts docs/validation/OP_FINANCIAL_COMMAND_APPROVAL_JOURNAL_PROOF_2026-06-16.md packages/domain/src/financial-command-journal.test.ts packages/domain/src/financial-command-journal.ts
```

Selector output:

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

- `pnpm format:check` -> pass.
- `pnpm docs:check` -> pass.
- `pnpm policy:check` -> pass, including proof index, local evidence ignore, and boundary policy.
- `pnpm --filter @open-practice/domain test` -> pass, 29 files / 190 tests.
- `pnpm --filter @open-practice/domain typecheck` -> pass.
- Domain build prerequisite for API import resolution: `pnpm --filter @open-practice/domain build`
  -> pass.
- `pnpm --filter @open-practice/api test` -> pass, 41 files / 538 tests.
- `pnpm --filter @open-practice/api typecheck` -> pass.
- `pnpm --filter @open-practice/providers test` -> pass, 9 files / 20 tests.
- `pnpm --filter @open-practice/worker test` -> pass, 5 files / 42 tests.
- `pnpm --filter @open-practice/web test` -> pass, 35 files / 194 tests.
- `pnpm --filter @open-practice/web typecheck` -> pass.
- `pnpm build` -> pass, 6 successful Turbo build tasks in 28.417s.
- Final closeout after proof reconciliation:
  - `pnpm verify:select -- --files ...` -> same selector recommendations.
  - `pnpm format:check` -> pass.
  - `pnpm docs:check` -> pass.
  - `pnpm policy:check` -> pass.
  - `git diff --check` -> pass.
