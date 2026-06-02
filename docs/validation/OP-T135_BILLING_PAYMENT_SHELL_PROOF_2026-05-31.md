# OP-T135 Billing Payment Shell Proof

## Scope

Implemented the smallest coherent OP-T135 first slice:

- Added hosted payment-request/link shell records tied to issued or partially paid invoices with an
  outstanding balance.
- Recorded bill delivery state, reminder state, payment-plan placeholders, credit/write-off review
  posture, and evidence-present cues without storing card details.
- Added optional Stripe Checkout Session creation for open hosted payment-request shells, recording
  provider/session posture and evidence without applying payment status, settlement, reconciliation,
  invoice-balance mutation, or trust-ledger posting.
- Kept production Stripe enablement gated: `STRIPE_SECRET_KEY` is rejected in production until
  webhook, settlement reconciliation, refund, and chargeback gates exist.
- Surfaced payment request shells and manual-payment evidence flags in billing dashboard and billing
  export payloads.

## Closeout

Status is now Done as the billing/payment shell, not as full Clio-class payments. The shell records
operational payment-request posture, optional provider-session posture, reminder/delivery state, and
evidence-present cues, while settlement, public payment-page UX, live reconciliation, refunds,
chargebacks, card storage, payment-plan enforcement, tap-to-pay, and trust-ledger posting remain
future scoped work.

The Clio parity review stayed clean-room planning input only. No Clio prose, schemas, examples,
screenshots, UI structure, assets, private tenant data, or code were copied into Open Practice.

## Closeout Reconciliation - 2026-06-01

`main` contains the OP-T135 merge commit `acdc724` and implementation commit `b971e72`. The merged
state includes the hosted payment-request API routes, repository methods, migration and seed data,
Stripe Checkout Session shell provider, dashboard/export payloads, route-authorization manifest
entries, deployment caveats, and focused tests described below.

No implementation blocker remains beyond the status/proof loop that kept OP-T135 in `Review`.
Production Stripe enablement, public payment-page UX, processor settlement, automatic reconciliation,
invoice-balance mutation from hosted payment requests, and trust posting remain intentionally out of
scope for later rows.

The closeout diff is limited to:

- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md`

## Changed Paths

- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/types.ts`
- `apps/api/src/server.ts`
- `apps/api/src/server.test.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md`
- `packages/database/migrations/0044_hosted_payment_requests.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `packages/domain/src/sample-data.ts`
- `packages/providers/package.json`
- `packages/providers/src/index.ts`
- `packages/providers/src/operations.ts`
- `packages/providers/src/payments/stripe.test.ts`
- `packages/providers/src/payments/stripe.ts`
- `pnpm-lock.yaml`
- `scripts/route-authorization-manifest.mjs`

## Validation

2026-06-01 closeout selector:

- `pnpm verify:select -- --files <merged implementation paths>` matched the implementation proof
  selection below.
- `pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md` selected docs and policy checks for
  the closeout diff.

2026-06-01 closeout validation:

- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/database test`
- `pnpm --dir apps/api exec vitest run src/routes/billing.test.ts src/server.test.ts`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/web test`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database db:check`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `git diff --check`

The package-wide `pnpm --filter @open-practice/api test` was also attempted after the fresh-worktree
build setup. It failed in `src/routes/client-portal.test.ts` because the expected client portal
action statuses (`secure_share` `verification_required`, `external_upload` `active`) no longer match
the merged sample-data response (`secure_share` `expired`, `external_upload` `expired`). The focused
OP-T135 billing/server API tests passed and no OP-T135 implementation blocker was found.

2026-05-31 implementation validation:

- `pnpm verify:select -- --files <changed paths>` selected `pnpm ci:local`,
  `pnpm deps:audit`, `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`,
  `pnpm policy:check`, `pnpm test`, focused domain/database/API/providers/worker/web
  tests and typechecks, database checks, migration parity, provider build, and production build.
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm deps:licenses`
- `pnpm deps:audit`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/providers typecheck`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
- `pnpm ci:local`

All commands passed. `pnpm deps:licenses` reported the existing review-required license groups and
did not add a blocked license; `pnpm deps:audit` reported no known vulnerabilities.

## Out Of Scope

- Card storage, processor settlement, tap-to-pay, automatic reconciliation, trust posting,
  payment-plan enforcement, public payment-page implementation, and automatic invoice-balance
  changes from hosted payment request shells.
- Production Stripe enablement, Stripe webhook ingestion, settlement reconciliation, refunds,
  chargebacks, card vaulting, and PaymentIntents-first custom checkout handling.
