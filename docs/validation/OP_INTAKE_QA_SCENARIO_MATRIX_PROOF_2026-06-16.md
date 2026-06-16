# Staff Intake QA Scenario Matrix Proof - 2026-06-16

## Scope

This branch adds the smallest staff-only saved intake QA scenario matrix slice on top of the
shipped OP-T157 visual branch-rule authoring work and the immutable intake template-version work.

Staff can save named QA scenarios inside existing embedded V2 intake template definitions. Each
scenario records staff-authored synthetic answers and optional selected package IDs, then the
staff-only QA report resolves the scenario through the existing branch-rule and package eligibility
semantics.

The runtime change is intentionally narrow:

- `packages/domain/src/intake.ts` adds optional V2 `qaScenarios`, validates scenario IDs, names,
  question answer references, and selected package references, and includes saved scenarios in
  non-mutating staff QA previews using the existing preview `id` and `label` shape.
- The existing staff-only `GET /api/intake-templates/:id/qa-preview` route returns saved scenario
  preview summaries through the existing preview `id`/`label` shape without returning scenario
  answer bodies or adding a new response envelope.
- `apps/api/src/routes/intake-forms/public.ts` strips `qaScenarios` from public intake form
  template payloads.
- `apps/web/app/intake-forms/StructuredIntakeBuilder.tsx` adds a staff-only QA scenarios panel for
  scenario IDs, names, answers, package selections, and local branch/package summaries.

## Boundaries Preserved

- No public runner behavior changes, public URL changes, new public scenario exposure, approval
  automation, template approval history, API route additions, database schema, migrations, worker
  behavior, provider behavior, dependency changes, schema-version changes, item kind changes, or
  response-envelope additions.
- Saved scenarios remain staff QA metadata in the existing template definition JSON. They do not
  create intake sessions, submit forms, publish templates, approve templates, mutate matters,
  generate documents, or change public answer resolution semantics.
- Staff QA preview responses include scenario preview IDs/names and resolved path/package summaries
  only; saved scenario answer bodies are omitted.
- OP-T157 staff visual branch-rule authoring and the immutable intake template-version proof remain
  historical inputs for this follow-up; their validation records are not rewritten.
- SurveyJS and Form.io remain reference-only for this slice; no snippets, schemas, UI, tests,
  assets, or distinctive prose were copied.

## Changed Paths

```text
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms/public.ts
apps/web/app/dashboard/intake-section.test.tsx
apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.tsx
apps/web/app/intake-forms/structured-builder-diagnostics.ts
apps/web/app/styles/30-feature-surfaces.css
apps/web/app/styles/90-responsive-motion.css
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md
docs/validation/README.md
packages/domain/src/intake.test.ts
packages/domain/src/intake.ts
```

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/intake-forms.test.ts apps/api/src/routes/intake-forms/public.ts apps/web/app/dashboard/intake-section.test.tsx apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts apps/web/app/intake-forms/StructuredIntakeBuilder.tsx apps/web/app/intake-forms/structured-builder-diagnostics.ts apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md docs/validation/README.md packages/domain/src/intake.test.ts packages/domain/src/intake.ts
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

Final selector-based validation:

- Pass: `pnpm verify:select -- --files apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms/public.ts apps/web/app/dashboard/intake-section.test.tsx
apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.tsx
apps/web/app/intake-forms/structured-builder-diagnostics.ts
apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css
docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md
docs/validation/OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md docs/validation/README.md
packages/domain/src/intake.test.ts packages/domain/src/intake.ts`.
- Pass: `pnpm --filter @open-practice/domain build`.
- Pass: `pnpm --filter @open-practice/domain test` (28 files, 190 tests).
- Pass: `pnpm --filter @open-practice/domain typecheck`.
- Pass: `pnpm --filter @open-practice/api test` (41 files, 537 tests).
- Pass: `pnpm --filter @open-practice/api typecheck`.
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests).
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 42 tests).
- Pass: `pnpm --filter @open-practice/web test` (35 files, 195 tests).
- Pass: `pnpm --filter @open-practice/web typecheck`.
- Pass: `pnpm build` (6 successful Turbo build tasks).
- Pass: `pnpm format:check`.
- Pass: `pnpm docs:check`.
- Pass: `pnpm policy:check`.
- Pass: `git diff --check`.

Skipped checks: none.
