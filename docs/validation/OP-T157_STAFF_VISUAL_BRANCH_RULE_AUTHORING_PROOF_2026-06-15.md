# OP-T157 Staff Visual Branch-Rule Authoring Proof - 2026-06-15

## Scope

OP-T157 ships the first clean-room staff visual branch-rule authoring slice for structured intake
forms. Staff can add, edit, remove, and review existing embedded intake branch rules from the
structured builder without using Advanced JSON for normal rule work.

The runtime change is staff-authoring only:

- `apps/web/app/intake-forms-dashboard.ts` adds typed staff helpers for branch-rule defaults,
  trigger summaries, draft preview path summaries, and path count formatting.
- `apps/web/app/intake-forms/StructuredIntakeBuilder.tsx` adds a compact Branch rules panel for
  source question, operator, typed value, shown-question targets, eligible-package targets, and
  per-rule local preview summaries.
- `apps/web/app/intake-forms/IntakeFormRenderer.test.ts` keeps regression coverage around public
  runner branch visibility for the same authored definitions.

## Boundaries Preserved

- No public runner behavior changes, public URL changes, API route changes, database schema,
  migrations, provider adapters, worker behavior, dependency changes, schema-version changes, item
  kind changes, or response-shape changes.
- Preview path summaries are local staff-authoring summaries derived from the existing domain
  resolution semantics; server-backed preview checks remain on the existing preview endpoint.
- Advanced JSON remains available for edge cases.
- SurveyJS and Form.io remain reference-only for this slice; no snippets, schemas, UI, tests,
  assets, or distinctive prose were copied.
- Implementation was isolated in the sibling worktree
  `/Users/bryan/projects/open-practice-branch-rule-authoring` so unrelated docs edits in
  `/Users/bryan/projects/open-practice` were not touched.

## Changed Paths

```text
apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.tsx
apps/web/app/styles/30-feature-surfaces.css
apps/web/app/styles/90-responsive-motion.css
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T157_STAFF_VISUAL_BRANCH_RULE_AUTHORING_PROOF_2026-06-15.md
docs/validation/README.md
```

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/web/app/intake-forms-dashboard.ts apps/web/app/intake-forms/IntakeFormRenderer.test.ts apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts apps/web/app/intake-forms/StructuredIntakeBuilder.tsx apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T157_STAFF_VISUAL_BRANCH_RULE_AUTHORING_PROOF_2026-06-15.md docs/validation/README.md
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Pre-selector focused checks:

- Initial `pnpm --filter @open-practice/web test -- StructuredIntakeBuilder.test.ts
IntakeFormRenderer.test.ts dashboard-client.test.ts` failed in the fresh sibling worktree because
  web could not resolve built `@open-practice/domain` package exports.
- Initial `pnpm --filter @open-practice/web typecheck` failed for the same unresolved
  `@open-practice/domain` package export hydration issue.
- Pass: `pnpm --filter @open-practice/domain build`.
- Pass after domain build hydration: `pnpm --filter @open-practice/web test --
StructuredIntakeBuilder.test.ts IntakeFormRenderer.test.ts dashboard-client.test.ts` (35 files,
  190 tests).
- Pass after domain build hydration: `pnpm --filter @open-practice/web typecheck`.
- Initial `pnpm build` failed after the first implementation because a client-imported staff helper
  imported `resolveEmbeddedIntakeAnswers` as a runtime value from `@open-practice/domain`, which
  pulled `node:crypto` into the Next.js client bundle through the domain root export. The helper now
  keeps local browser-safe branch summary logic aligned to the existing branch visibility semantics.
- A rerun of the focused web test briefly failed because the browser-safe helper was missing its own
  local `answerIsPresent` predicate. The predicate was added, and the focused lane passed again.

Final selector-based validation:

- Pass: `pnpm verify:select -- --files apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.test.ts
apps/web/app/intake-forms/StructuredIntakeBuilder.tsx
apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css
docs/improvement-opportunities.md docs/planning-and-progress.md
docs/validation/OP-T157_STAFF_VISUAL_BRANCH_RULE_AUTHORING_PROOF_2026-06-15.md
docs/validation/README.md`
- Pass: `pnpm --filter @open-practice/web test -- StructuredIntakeBuilder.test.ts
IntakeFormRenderer.test.ts dashboard-client.test.ts` (35 files, 190 tests) after the final helper
  fix.
- Pass: `pnpm --filter @open-practice/web test` (35 files, 190 tests).
- Pass: `pnpm --filter @open-practice/web typecheck`.
- Pass: `pnpm format:check`.
- Pass: `pnpm docs:check`.
- Pass: `pnpm policy:check`.
- Pass: `pnpm build` (6 successful Turbo build tasks).

Skipped checks: none.
