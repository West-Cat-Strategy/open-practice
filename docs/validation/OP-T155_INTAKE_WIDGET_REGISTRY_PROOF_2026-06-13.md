# OP-T155 Intake Widget Registry Proof - 2026-06-13

## Scope

OP-T155 ships the first clean-room intake widget registry and validator adapter slice. The slice adds
original Open Practice adapter registries for the existing intake form item kinds and rewires the
current domain/web seams through those registries without changing public runner behavior.

The runtime change is additive:

- `packages/domain/src/intake.ts` exposes registry adapters for `display`, `question`, `upload`,
  and `signature` items across validation, visibility, required-completion preview, preview checks,
  QA issue collection, and unsupported-kind rejection.
- `apps/web/app/intake-forms/widget-registry.tsx` maps the same four item kinds to the existing
  public renderer markup, upload button behavior, signature consent behavior, and question controls.
- `apps/web/app/intake-forms-dashboard.ts` exposes a builder item registry for the current staff
  builder item-kind list and default item creation.

## Boundaries Preserved

- No new intake item kinds, schema versions, API routes, database schema, migrations, provider
  adapters, worker behavior, dependency changes, or public/client response shape changes.
- Public runner behavior is unchanged: visible item filtering, upload actions, signature actions,
  draft answer coercion, and unsupported schema locking remain on the existing paths.
- All code, tests, and wording are original Open Practice work. RJSF, SurveyJS, and Form.io remain
  reference-only for this slice; no snippets, schemas, UI, tests, assets, or distinctive prose were
  copied.
- The implementation was made in the sibling worktree
  `/Users/bryan/projects/open-practice-op-t155-intake-widget-registry` so unrelated OP-T156 client
  portal edits in `/Users/bryan/projects/open-practice` were not touched.

## Changed Paths

```text
apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/IntakeFormRenderer.tsx
apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts
apps/web/app/intake-forms/widget-registry.tsx
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md
docs/validation/README.md
packages/domain/src/intake.test.ts
packages/domain/src/intake.ts
```

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts apps/web/app/intake-forms/IntakeFormRenderer.tsx apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts apps/web/app/intake-forms/widget-registry.tsx docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md docs/validation/README.md packages/domain/src/intake.test.ts packages/domain/src/intake.ts
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
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Pre-selector targeted checks:

- Pass: `pnpm --filter @open-practice/domain test -- intake.test.ts` (27 files, 169 tests)
- Pass: `pnpm --filter @open-practice/web test -- IntakeFormRenderer.test.ts StructuredIntakeBuilder.test.ts` (35 files, 181 tests)
- Pass: `pnpm exec prettier --check apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts apps/web/app/intake-forms/IntakeFormRenderer.tsx apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts apps/web/app/intake-forms/widget-registry.tsx docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md docs/validation/README.md packages/domain/src/intake.test.ts packages/domain/src/intake.ts`

Final selector-based validation:

- Pass: `pnpm verify:select -- --files apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts apps/web/app/intake-forms/IntakeFormRenderer.tsx apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts apps/web/app/intake-forms/widget-registry.tsx docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md docs/validation/README.md packages/domain/src/intake.test.ts packages/domain/src/intake.ts`
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain test` (27 files, 169 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Initial `pnpm --filter @open-practice/api test` timed out in six unrelated API tests
  (`server.test.ts`, `ai-operational-proposals.test.ts`, `caldav.test.ts`, and
  `external-uploads.test.ts`) while 498 of 504 tests passed; the failures were 5s timeout
  failures outside the OP-T155 intake registry path.
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/providers build`
- Pass after package build hydration: `pnpm --filter @open-practice/api test` (41 files, 504 tests)
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests)
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 40 tests)
- Pass: `pnpm --filter @open-practice/web test` (35 files, 181 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
- Pass: `git diff --check`

Skipped checks: none.
