# OP Refund And Chargeback Review Cues Proof - 2026-06-28

Date: 2026-06-28/2026-06-29
Branch: `feat/deposit-match-review-command-boundary-20260627`
Base: local `main` at `9cb1f25e`
Status: Implemented as metadata-only payment import review cues. Final mainline publication remains
tracked by the 2026-06-28/2026-06-29 branch-integration draft.

## Scope

This slice adds safe review cues for refund and chargeback observations already normalized as
payment import review records.

- Domain payment import status accepts `refund_observed` and `chargeback_observed` as review-only
  event statuses.
- Payment import review boundaries mark refund and chargeback handling as `review_only` while
  preserving no provider command, no invoice mutation, no reconciliation mutation, and no trust
  posting.
- Billing API dashboard payloads expose additive cue counts and optional row cue metadata for staff
  review.
- Billing UI summaries surface refund and chargeback counts plus row-local review copy.
- Payment import review creation rejects dispute-packet/private payload fields.

## Boundary

- No payment provider calls, refund execution, chargeback/dispute packet handling, ledger reversal,
  invoice mutation, allocation mutation, trust transfer, trust posting, client notification,
  settlement automation, or automatic reconciliation.
- No raw provider payloads, webhook headers, card/customer data, dispute packets, refund artifacts,
  chargeback payloads, provider private metadata, object keys, or reviewer free text are accepted,
  retained, returned, or audited by this cue surface.
- Deposit-match review commands remain unsupported for refund and chargeback event statuses.
- Synthetic data only.

## Final Changed Paths

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/web/app/_features/billing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP_REFUND_CHARGEBACK_REVIEW_CUES_PROOF_2026-06-28.md
docs/validation/README.md
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
```

## Validation

| Command                                                                                                                                                                                                                                                                                        | Status | Notes                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain exec vitest run src/operational-actions.test.ts src/billing.test.ts --pool forks --fileParallelism=false`                                                                                                                                                 | Pass   | Focused domain coverage passed: 2 files, 28 tests, including refund/chargeback cue derivation and boundaries.   |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts --pool forks --fileParallelism=false`                                                                                                                                                                             | Pass   | Focused Billing API coverage passed: 1 file, 32 tests.                                                          |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx app/dashboard/research-section.test.tsx app/dashboard/appointment-booking-panel.test.tsx app/calendar-dashboard.test.ts app/dashboard/calendar-section.test.tsx --pool forks --fileParallelism=false` | Pass   | Focused web coverage passed: 4 files, 13 tests, including Billing section cue counts and row-local review copy. |

## Notes

Refund and chargeback observations remain review cues only. This proof deliberately does not claim
refund processing, chargeback response packets, ledger reversals, automatic trust accounting, or
certified accounting behavior.
