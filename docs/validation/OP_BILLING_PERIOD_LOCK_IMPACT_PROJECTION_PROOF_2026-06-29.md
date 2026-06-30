# Billing Period Lock Impact Projection Proof - 2026-06-29

## Summary

Added an additive, read-only billing period lock impact projection over existing billing locks,
time entries, expense entries, invoices, and authorized visible matters:

- `packages/domain/src/reports.ts` now exposes the `billing_period_lock_impact` saved report
  definition with `lock`, `status`, `matter`, and `source_type` groupings.
- `GET /api/reports/workspace` and existing staff report export downloads can project lock impact
  counts and sorted safe IDs without storing report bodies or adding new routes.
- `GET /api/billing/dashboard` includes a `billingPeriodLockImpact` read-only block built from the
  same domain helper, and the Billing dashboard renders the row summary under existing controls.
- The Reports dashboard renders lock/source/status/matter details and safe ID samples for the new
  report rows.

## Boundaries

- All implementation and tests use synthetic data only, preserving privacy boundaries for client,
  matter, credential, payment, provider, and deployment details.
- The projection filters source records to visible matter IDs before building rows.
- Rows aggregate by lock ID, source type, status, and matter ID, and expose counts, lock dates,
  matter number, source type, status, and sorted safe IDs only.
- Time entries use `performedAt`; expense entries use `incurredAt`; invoices are included when an
  invoice lifecycle date falls inside a lock or the invoice links to locked visible time/expense
  source lines.
- No unlock, override, bypass, mutation, enforcement, migration, dependency, provider, settlement,
  trust-posting, custom SQL, BI embed, scheduler, or raw report-body behavior was added.
- No narratives, descriptions, memos, client identifiers, payment details, private metadata, raw
  report bodies, or provider payloads are included in the projection.

## Final Changed Paths

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing/dashboard.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/reports.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/_features/billing/server-resources.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/billing-section.test.tsx`
- `apps/web/app/dashboard/billing-section.tsx`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_BILLING_PERIOD_LOCK_IMPACT_PROJECTION_PROOF_2026-06-29.md`
- `docs/validation/README.md`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`

## Validation Selection

```sh
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/_features/billing/models.ts apps/web/app/_features/billing/server-resources.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts docs/validation/OP_BILLING_PERIOD_LOCK_IMPACT_PROJECTION_PROOF_2026-06-29.md
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

Focused implementation checks already run during development:

- Pass: `pnpm --filter @open-practice/domain test -- reports.test.ts`
  - 33 files and 280 tests passed.
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/providers build`
- Interrupted: `pnpm --filter @open-practice/api test -- reports.test.ts billing.test.ts --reporter=dot`
  - This command format forwarded `--` to Vitest and pulled in unrelated API suites, including an
    unrelated `src/routes/e2e-support.test.ts` failure before the run was stopped.
- Pass: `pnpm --filter @open-practice/api exec vitest run src/routes/reports.test.ts src/routes/billing.test.ts --reporter=dot`
  - 2 files and 45 tests passed.
- Pass: `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx app/dashboard/reports-section.test.tsx --reporter=dot`
  - 2 files and 2 tests passed.
- Initial failure, then pass: `pnpm --filter @open-practice/web typecheck`
  - Initial failure identified two existing `dashboard-client.test.ts` billing fixtures missing
    the new `billingPeriodLockImpact` response field. The fixtures were updated with the same empty
    projection contract used by Billing fallback resources.
- Pass: `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/dashboard/billing-section.test.tsx app/dashboard/reports-section.test.tsx --reporter=dot`
  - 3 files and 78 tests passed.

Selector-based final validation:

- Pass: `pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/_features/billing/models.ts apps/web/app/_features/billing/server-resources.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts docs/validation/OP_BILLING_PERIOD_LOCK_IMPACT_PROJECTION_PROOF_2026-06-29.md`
- Pass: `pnpm architecture:check`
  - `Architecture import policy passed: 466 workspace import edges reviewed.`
- Pass: `pnpm api:contract`
  - Wrote `.tmp/api-contract/openapi.json` with 346 paths.
- Pass: `pnpm format:check`
  - `All matched files use Prettier code style!`
- Pass: `pnpm docs:check`
  - `Documentation link validation passed.`
- Blocked by unrelated reference-index drift: `pnpm policy:check`
  - Passed tracked-secret scan, package manifest policy, lockfile supply-chain policy, toolchain
    policy, environment surface, architecture graph, dead-code check, migration integrity, and
    migration lint.
  - Failed at `node scripts/validate-oss-reuse.mjs` because existing reference locks do not match
    the central reference index for `activepieces__activepieces`, `apache__fineract`,
    `calcom__cal.diy`, `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`, `ledgersmb__ledgersmb`,
    `lerianstudio__midaz`, `nextcloud__server`, `open-source-legal__opencontracts`,
    `opencollective__opencollective`, `opencollective__opencollective-api`,
    `opencollective__opencollective-frontend`, `openfga__openfga`, `paperless-ngx__paperless-ngx`,
    `temporalio__temporal`, `unstructured-io__unstructured`, and `zulip__zulip`.
  - The blocker is outside the final changed paths; this branch added no dependencies, vendored
    assets, copied excerpts, or reference-derived source.
- Pass: `pnpm --filter @open-practice/domain test`
  - 33 files and 280 tests passed.
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/api test`
  - 43 files and 632 tests passed.
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test`
  - 13 files and 37 tests passed.
- Pass: `pnpm --filter @open-practice/worker test`
  - 6 files and 54 tests passed.
- Pass: `pnpm --filter @open-practice/web test`
  - 46 files and 245 tests passed.
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
  - Turbo reported 6 successful build tasks.
