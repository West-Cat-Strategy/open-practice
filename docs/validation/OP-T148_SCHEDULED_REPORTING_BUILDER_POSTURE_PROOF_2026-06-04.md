# OP-T148 Scheduled Reporting Builder Posture Proof

Date: 2026-06-04 PDT

## Scope

OP-T148 shipped the first scheduled-reporting/report-builder posture slice on the active core-suite
Clio parity branch. The slice extends the existing staff-only `GET /api/reports/workspace`
projection instead of adding a new route, schema, scheduler table, queue type, provider, BI embed,
or report execution engine.

The runtime change is additive:

- `packages/domain/src/reports.ts` now derives definition-level schedule readiness and builder
  posture for OP-authored saved report definitions.
- `buildStaffReportingWorkspace` now returns workspace-level schedule-readiness summary,
  report-builder posture, and export-job posture over existing definitions, manual export profiles,
  projections, and report export history.
- `GET /api/reports/workspace` returns the new metadata through the existing reporting route,
  authorization, matter filtering, and report-job history path.
- The Reports dashboard renders schedule-readiness and builder-posture cues inside the existing
  staff reporting surface.

## Boundaries Preserved

- No new route, schema, migration, scheduler table, queue name, provider integration, dependency,
  public/client reporting surface, or report-builder execution engine.
- No custom SQL, BI embeds, scheduled execution, scheduled email delivery, mutable report-builder
  execution, raw report-body storage, payment processor reporting, or accounting/compliance
  certification.
- Export requests still reuse the existing `reports` queue lifecycle, store bounded
  definition/profile/grouping/requester metadata, and regenerate projections for downloads instead
  of storing report bodies in job metadata.
- Web rendering adds posture text only; it does not add schedule buttons, toggles, auto-delivery
  handlers, or new request flows.
- The slice builds on OP-T137 staff reporting workspace proof without duplicating saved definitions,
  manual export profiles, first projections, or export-job redaction behavior.

## OP-T148-Owned Runtime Paths

- `apps/api/src/routes/reports.test.ts`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `apps/web/app/reporting-dashboard.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`

## Current Accumulated Branch Path Set

This branch currently carries OP-T144, OP-T145, OP-T146, OP-T147, and OP-T148 together. Final
validation is selected from the full branch path set below rather than only the OP-T148-owned
subset.

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
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
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md`
- `docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.test.tsx apps/web/app/client-portal-workspace.tsx apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/page.tsx apps/web/app/reporting-dashboard.ts apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md docs/validation/OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md docs/validation/README.md packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
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

Selector-based validation:

- Pass: `pnpm verify:select -- --files ...`
- Sandbox note: sandboxed `pnpm format:check`, `pnpm docs:check`, and
  `pnpm --filter @open-practice/providers test` each failed before running with `fetch failed`;
  the same selected commands were rerun outside the sandbox with user approval.
- Formatting note: the first real `pnpm format:check` flagged `docs/api-and-state-machines.md`,
  `docs/planning-and-progress.md`, and `docs/validation/README.md`; `pnpm exec prettier --write`
  was run on those three touched docs only.
- Pass after targeted Prettier: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain test` (24 files, 168 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Package freshness note: the first `pnpm --filter @open-practice/api test` run saw stale
  `@open-practice/domain` build output and failed to observe the new reporting workspace fields;
  `pnpm --filter @open-practice/domain build` refreshed the package output.
- Pass after domain rebuild: `pnpm --filter @open-practice/api test` (41 files, 469 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (7 files, 18 tests)
- Pass: `pnpm --filter @open-practice/worker test` (3 files, 34 tests)
- Pass: `pnpm --filter @open-practice/web test` (20 files, 138 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
- Pass: `git diff --check`

Post-build status check showed no generated-file drift beyond the intended accumulated branch path
set.
