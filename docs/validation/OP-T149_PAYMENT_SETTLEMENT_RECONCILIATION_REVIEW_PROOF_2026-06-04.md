# OP-T149 Payment Settlement Reconciliation Review Proof

Date: 2026-06-04 PDT

## Scope

OP-T149 shipped the first payment settlement/reconciliation review slice on the active core-suite
Clio parity branch. The slice extends the existing hosted payment-request shell instead of adding a
production provider webhook, settlement engine, payment-application workflow, reconciliation
automation, card vault, or trust-posting path.

The runtime change is additive:

- `packages/domain/src/billing.ts` now defines normalized payment settlement review posture and
  helper defaults with explicit false mutation boundaries.
- `POST /api/billing/payment-requests/:id/settlement-events` records one authenticated staff-side
  normalized settlement event against an existing hosted payment request.
- The route stores safe provider/event/session/status/amount cues under processor settlement review
  posture plus bounded evidence/audit metadata.
- The Billing dashboard renders read-only settlement webhook review counts and per-request manual
  reconciliation cues.

## Boundaries Preserved

- No public provider webhook endpoint, raw webhook-body persistence, signing-header persistence,
  replay recovery, production Stripe enablement, provider-specific refund/chargeback handling,
  card/customer detail storage, checkout URL exposure, or card vaulting.
- No automatic manual payment creation, invoice `paidCents`/`balanceDueCents`/status mutation,
  automatic reconciliation, reconciliation-record creation, deposit matching, trust ledger posting,
  payment plan enforcement, refund application, or chargeback mutation.
- Settlement event review is staff reconciliation evidence only. Manual payment entry remains the
  explicit `POST /api/payments` workflow, and follow-up 2026-06-16 hardening requires
  `POST /api/payments/:paymentId/reconcile` reviewer evidence before allocations affect invoice
  paid/balance status.
- The slice builds on OP-T135 hosted payment request and Stripe Checkout Session shell proof without
  claiming full payment processing or production webhook readiness.

## OP-T149-Owned Runtime Paths

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `scripts/route-authorization-manifest.mjs`

## Current Accumulated Branch Path Set

This branch currently carries OP-T144, OP-T145, OP-T146, OP-T147, OP-T148, and OP-T149 together.
Final validation is selected from the full branch path set below rather than only the OP-T149-owned
subset.

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/intake-pipeline.test.ts`
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
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing.ts apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/billing-dashboard.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.test.tsx apps/web/app/client-portal-workspace.tsx apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/page.tsx apps/web/app/reporting-dashboard.ts apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/trust-funds-caveats.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md docs/validation/OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md docs/validation/README.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
```

Selector output:

```text
Recommended validation commands:
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Passed:

- `pnpm format:check`
  - First run found Prettier drift in `apps/web/app/billing-dashboard.ts`,
    `docs/api-and-state-machines.md`, `docs/planning-and-progress.md`, and
    `docs/validation/README.md`.
  - Ran
    `pnpm exec prettier --write apps/web/app/billing-dashboard.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md`.
  - Re-run passed.
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain build`
  - Package freshness prerequisite so downstream API/web checks use the updated billing exports.
- `pnpm test`
  - Turbo package tests plus script contract tests passed.
- `pnpm --filter @open-practice/domain test`
  - 24 files / 169 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api test`
  - 41 files / 470 tests passed.
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
  - 7 files / 18 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 3 files / 34 tests passed.
- `pnpm --filter @open-practice/web test`
  - 20 files / 139 tests passed.
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
  - Turbo build passed for API, database, domain, providers, web, and worker packages.
- `git diff --check`
