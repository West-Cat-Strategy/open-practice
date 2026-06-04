# OP-T147 Intake Follow-up Source Attribution Proof

Date: 2026-06-04 PDT

## Scope

OP-T147 shipped the first review-first intake follow-up/source-attribution slice on the active
core-suite Clio parity branch. The slice extends the existing staff-only `GET /api/intake-pipeline`
projection instead of adding a new route, schema, provider, job, delivery channel, or conversion
workflow.

The runtime change is additive:

- `packages/domain/src/intake-pipeline.ts` derives `sourceAttribution.labelOrigin`,
  `followUpReview`, and `summary.followUpReview` from existing public consultation, intake session,
  intake form link/review, and calendar event records.
- `followUpReview` uses canned staff-review action, posture, priority, reason, source-quality, and
  last-activity cues; it does not expose raw request or answer material.
- `followUpReview.automationBoundary` and `summary.followUpReview.automationBoundary` explicitly
  keep automatic matter creation, campaign automation, SMS delivery, bulk delivery,
  ad-spend ingestion, and automatic client contact false.
- The existing Intake dashboard renders follow-up review counters and per-lead review cues from the
  safe pipeline payload.

## Boundaries Preserved

- No automatic matter creation, automatic conversion, marketing automation, campaign orchestration,
  SMS outreach, bulk delivery, ad-spend ingestion, automatic client contact, live reminder delivery,
  new provider integration, or job enqueueing.
- No schema, migration, repository-contract, route-manifest, dependency, or public/client surface
  changes.
- Redaction tests cover requester email, request bodies, raw source/interview URLs, intake token
  hashes, answer/review reason text, appointment titles, and true automation flags.
- The slice builds on OP-T119 public consultation intake, OP-T129 intake pipeline/source reporting,
  and submitted-intake follow-up link behavior without duplicating those workflows.

## OP-T147-Owned Runtime Paths

- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/intake-pipeline-dashboard.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`

## Current Accumulated Branch Path Set

This branch currently carries OP-T144, OP-T145, OP-T146, and OP-T147 together. Final validation was
selected from the full branch path set below rather than only the OP-T147-owned subset.

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace.test.tsx`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/queues-section.tsx`
- `apps/web/app/intake-pipeline-dashboard.ts`
- `apps/web/app/page.tsx`
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
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.test.tsx apps/web/app/client-portal-workspace.tsx apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/queues-section.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/page.tsx apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md docs/validation/OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md docs/validation/README.md packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts
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

Pre-selector targeted checks run during implementation:

- Pass: `pnpm --filter @open-practice/domain test -- intake-pipeline.test.ts`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/api test -- intake-pipeline.test.ts`
- Pass: `pnpm --filter @open-practice/web test -- dashboard-client.test.ts`

Final selector-based validation:

- Pass: `pnpm verify:select -- --files ...`
- Formatting note: the first `pnpm format:check` flagged
  `apps/api/src/routes/intake-pipeline.test.ts`, `docs/api-and-state-machines.md`,
  `docs/planning-and-progress.md`, `docs/validation/README.md`,
  `packages/domain/src/intake-pipeline.test.ts`, and
  `packages/domain/src/intake-pipeline.ts`; `pnpm exec prettier --write` was run on those six
  touched files only.
- Pass after targeted Prettier: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain test`
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/api test`
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test`
- Pass: `pnpm --filter @open-practice/worker test`
- Pass: `pnpm --filter @open-practice/web test`
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
- Pass: `git diff --check`

Post-build status check showed no generated-file drift beyond the intended accumulated branch path
set.
