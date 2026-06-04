# OP-T152 Scoped Developer API/Webhook Replay Proof

Date: 2026-06-04 PDT

## Scope

OP-T152 shipped the final active core-suite Clio parity candidate slice on the active parity branch.
The slice deepens the existing OP-T140 integration developer boundary and OP-T119 connector outbox
recovery controls without adding marketplace behavior, broad external API coverage, live payment
links, custom-action execution, raw webhook replay, provider-specific recovery tools, or public
developer surfaces.

The runtime change is additive:

- Developer app responses now include `apiEnforcement`, an explicit registered-scope,
  subset-credential, reserved-rate-limit, and reserved-custom-action posture summary.
- `POST /api/connectors/developer/apps/:appId/webhook-subscriptions` now requires the app's
  registered `webhook.deliver` scope before accepting webhook subscription posture.
- `POST /api/connectors/developer/apps/:appId/webhook-replays` adds an owner-only app-scoped
  replay boundary over existing connector outbox rows.
- App-scoped replay requires an active app, registered `webhook.deliver`, an active matching
  webhook subscription for the outbox event type, current-status confirmation, an enabled connector,
  and a configured connector queue.
- Accepted replays reuse the existing confirmed connector retry transition and enqueue one redacted
  `deliver_connectors` job.

## Boundaries Preserved

- No raw webhook bodies, destination URLs, signing secret references, raw idempotency keys, provider
  payloads, private attempt metadata, client/matter private content, or free-form operator details
  are returned, queued, or audited by the new app-scoped replay boundary.
- Rate limits remain documented/reserved posture only; OP-T152 does not add a public API gateway,
  token authentication flow, OAuth exchange, request throttler, usage metering, or third-party app
  marketplace.
- Webhook replay is a recovery control over existing provider-neutral connector outbox rows. It
  does not implement inbound webhook recovery, raw provider payload replay, custom action execution,
  payment-link creation, external schema/model coverage, or provider-specific replay tools.
- Existing owner-admin connector authorization remains the enforcement boundary; UI visibility is
  unchanged.

## OP-T152-Owned Runtime Paths

- `apps/api/src/routes/connectors.test.ts`
- `apps/api/src/routes/connectors.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T152_SCOPED_DEVELOPER_API_WEBHOOK_REPLAY_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `scripts/route-authorization-manifest.mjs`

## Current Accumulated Branch Path Set

This branch carries OP-T144 through OP-T152 together. Final validation is selected from the full
branch path set below rather than only the OP-T152-owned subset.

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/connectors.test.ts`
- `apps/api/src/routes/connectors.ts`
- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger.ts`
- `apps/api/src/routes/legal-research.test.ts`
- `apps/api/src/routes/legal-research.ts`
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
- `apps/web/app/dashboard/research-section.test.tsx`
- `apps/web/app/dashboard/research-section.tsx`
- `apps/web/app/intake-pipeline-dashboard.ts`
- `apps/web/app/legal-research-dashboard.test.ts`
- `apps/web/app/legal-research-dashboard.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/reporting-dashboard.ts`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors.ts`
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
- `docs/validation/OP-T151_LEGAL_RESEARCH_PROVIDER_JOB_BOUNDARY_PROOF_2026-06-04.md`
- `docs/validation/OP-T152_SCOPED_DEVELOPER_API_WEBHOOK_REPLAY_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`
- `packages/domain/src/legal-research.test.ts`
- `packages/domain/src/legal-research.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files <current accumulated branch path set>
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
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Focused implementation checks run before final selector validation:

- `pnpm --filter @open-practice/api test -- src/routes/connectors.test.ts`
  - Passed: 41 files / 473 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.

Selector-based closeout validation:

- `pnpm verify:select -- --files <current accumulated branch path set>`
  - Passed and selected the format, docs, policy, repo test, package test/typecheck, worker build,
    and full build gates listed above.
- `pnpm format:check`
  - Initially reported formatting drift in `apps/api/src/routes/connectors.ts`,
    `docs/api-and-state-machines.md`, `docs/planning-and-progress.md`, and
    `docs/validation/README.md`; targeted Prettier was run on those files and the rerun passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm test`
  - Passed: domain 24 files / 172 tests, database 18 files / 101 tests, providers 7 files / 18
    tests, web 20 files / 139 tests, worker 3 files / 35 tests, API 41 files / 473 tests, and 38
    script tests.
- `pnpm --filter @open-practice/domain test`
  - 24 files / 172 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - 41 files / 473 tests passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - 7 files / 18 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 3 files / 35 tests passed.
- `pnpm --filter @open-practice/worker typecheck`
  - Passed.
- `pnpm --filter @open-practice/worker build`
  - Passed.
- `pnpm --filter @open-practice/web test`
  - 20 files / 139 tests passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed across all six packages.
- `git diff --check`
  - Passed.
