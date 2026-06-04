# OP-T146 Task/Deadline Review Surface Proof

Date: 2026-06-04 PDT

## Scope

OP-T146 shipped the first task list and deadline review surface from the core-suite Clio parity
backlog. The slice keeps the staff Queues dashboard read-only and builds only on existing
matter-scoped task/deadline records, visible matter labels, and OP-T131 calendar scheduling request
records.

Runtime changes:

- `GET /api/tasks/workbench` now returns a read-only `taskReview` projection alongside the existing
  task projections, counters, and focus queues.
- The domain projection derives review-list priority, tone, assignment scope, matter label,
  staff/matter-team privacy visibility, scheduling request counts, and scheduling-review posture
  from authorized records only.
- Scheduling context is joined by same-matter task/source identifiers, so hidden cross-matter
  scheduling request details do not leak into another task review row.
- The Queues dashboard renders compact task/deadline review counters and matter-linked review rows
  using only the redacted `taskReview` projection.

## Boundaries

This slice did not add database migrations, new dependencies, route-manifest changes, new public
routes, task mutation routes, deadline calculation, court-rule automation, provider sync, automatic
deadline mutation, automatic reminder changes, queue delivery, automatic time-entry creation,
client-visible deadline views, or calendar scheduling request mutation.

The API/domain/web tests use synthetic task and scheduling records and assert that the review
projection exposes matter-scoped labels and staff review cues without leaking cross-matter scheduling
sources, contact identifiers, trust balances, raw request details, or automation claims. The review
projection includes explicit false boundary flags for automation-sensitive capabilities so future
slices must widen them intentionally.

## Changed Paths

This branch currently carries the earlier OP-T144 and OP-T145 parity slices plus OP-T146. The
selector and final validation are run against the full changed-path set:

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/client-portal-workspace.test.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/queues-section.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/README.md`
- `docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`

## Validation

Initial targeted implementation checks:

```sh
pnpm --filter @open-practice/domain test -- src/tasks.test.ts
pnpm --filter @open-practice/web test -- dashboard-client.test.ts
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test -- tasks.test.ts
```

Results:

- Pass: Domain task tests completed with 24 files and 167 tests passing.
- Pass: Web dashboard tests completed with 19 files and 137 tests passing.
- Pass: Domain build completed successfully.
- Pass: API task route tests completed with 41 files and 469 tests passing after rebuilding the
  domain package. An earlier API run before the build used the stale local domain artifact and failed
  to see the newly exported `taskReview` field.

Final validation command selection:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.tsx apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/queues-section.tsx apps/web/app/page.tsx apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/validation/README.md packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts apps/web/app/client-portal-workspace.test.tsx docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md
```

Selector recommended:

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

Additional rendered-browser check:

- `pnpm e2e:host`

Final validation results:

- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain test` (24 files, 167 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/api test` (41 files, 469 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (7 files, 18 tests)
- Pass: `pnpm --filter @open-practice/worker test` (3 files, 34 tests)
- Pass: `pnpm --filter @open-practice/web test` (19 files, 137 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build` (6 successful packages)
- Pass: `pnpm e2e:host` (33 Playwright checks passed, 3 skipped)
- Pass: `git diff --check`
