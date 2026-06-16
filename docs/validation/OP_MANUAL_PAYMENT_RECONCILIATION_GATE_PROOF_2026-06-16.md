# Manual Payment Reconciliation Gate Proof

Date: 2026-06-16 PDT

## Scope

Implemented the manual-payment reconciliation gate as a follow-up to OP-T135 and OP-T149:

- New manual payments created through `POST /api/payments` start as `pending_reconciliation`
  evidence and do not create effective payment allocations.
- `POST /api/payments/:paymentId/reconcile` records reviewer evidence, verifies current
  matter/invoice balance, creates the effective allocation, and recalculates invoice paid/balance
  status.
- Billing dashboard payloads and rendering distinguish pending reconciliation evidence from
  reconciled/applied manual payments.
- Manual payment audit metadata stays bounded to safe IDs, status, amount, allocation count, and
  evidence-present cues.

## Boundaries Preserved

- No live payment settlement, provider webhook, automatic deposit reconciliation, refund or
  chargeback handling, payment-plan enforcement, card vaulting, or checkout change.
- No automatic trust-ledger posting or trust-transfer ledger mutation from manual payment creation or
  reconciliation.
- Pending payment evidence does not change invoice `paidCents`, `balanceDueCents`, or lifecycle
  status.
- Reviewer evidence is metadata-only in synthetic tests; no private receipt files, client data,
  credentials, settlement payloads, or deployment details are added.

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files <final changed paths>
```

## Expected Focused Validation

- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/database test`
- `pnpm --dir apps/api exec vitest run src/routes/billing.test.ts`
- `pnpm --filter @open-practice/web test`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database db:check`
