# OP-MOD-001 Modularization Foundation Proof - 2026-06-06

## Summary

OP-MOD-001 is review-ready with the repository capability extraction, dashboard shell state
extraction, and validation-tooling guardrail addenda in scope. The broad modularization commit was
preserved at
`codex/op-modularization-2026-06-06-broad-backup-20260607`, the active
`codex/op-modularization-2026-06-06` branch was reset to `main` at `ad25b758`, and only the
repository-focused files were restored.

This slice keeps focused repository capability contracts and Drizzle/memory helper modules under
`packages/database/src/repository/**`, keeps the aggregate `OpenPracticeRepository` compatibility
surface, keeps the aggregate Drizzle and in-memory repository facade classes, adds the database
package root export, and updates the schema hardening test so its duplicate-document advisory-lock
source assertions point at the moved document and inbound-email repository helper files.

The 2026-06-07 validation-tooling addendum keeps product behavior unchanged while tightening the
OP-MOD-001 guardrails for the current layout: API child route ownership is derived from
`apps/api/src/routes/<family>/`, route-declaring child modules must still be wired by their parent
registrar, database repository capability folders with Drizzle/memory implementations must keep
matching contracts plus aggregate facade imports, and selector coverage explicitly routes child
route and repository implementation paths through the expected focused gates.

## Scope Boundary

Included paths:

- `packages/database/src/repository/**`
- `packages/database/package.json`
- `packages/database/test/schema.test.ts`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
- `scripts/validate-open-practice-boundaries.mjs`
- `scripts/validate-open-practice-boundaries.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`
- `scripts/security-hot-path-rescan.test.mjs`

Explicitly excluded from this slice:

- API route-family splits
- web/dashboard component, model, server-resource, or shell-state extraction
- worker processor splits
- database schema-module splits outside `packages/database/src/repository/**`
- domain/provider package export changes
- product route-family splits, security-helper changes, or validation-script changes outside the
  listed validation-tooling guardrail files
- broad repo-guide/testing-doc updates from the larger OP-MOD wave

## Mainline Check

- `main` and `origin/main` were verified before the carve-out as the current base at `ad25b758`
  (`Record code review remediation mainline proof`).
- The broad OP-MOD work was preserved at backup branch
  `codex/op-modularization-2026-06-06-broad-backup-20260607`.
- After reset and restore, the active branch contained the repository slice plus this
  proof/workboard/index update. The 2026-06-07 addendum adds the requested dashboard shell state
  extraction without reintroducing the broader route, worker, schema-module, script, or unrelated
  docs changes.

## Dashboard Shell State Extraction Addendum

- `apps/web/app/dashboard-client.tsx` now delegates active-section state, URL/popstate hydration,
  history pushes, detail-panel focus handoff, review-rail sessionStorage persistence, and review-rail
  toggle focus restoration to `apps/web/app/_features/dashboard/dashboard-shell-state.ts`.
- `apps/web/app/_features/dashboard/dashboard-shell-state.test.ts` locks the storage key plus pure
  requested-section/history helper behavior.
- Feature mutation and data state stays in `dashboard-client.tsx`: share create/revoke, client
  account setup, contact data-quality resolution state, matter-selection reset behavior, and feature
  callbacks are unchanged.

## Validation Tooling Guardrail Addendum

- `scripts/validate-open-practice-boundaries.mjs` now derives registrar-owned child route files
  from each parent route registrar directory, preserving failures for unowned or duplicate
  route-declaring files plus missing parent imports/calls.
- The same boundary validator now recognizes database repository capability folders that contain
  `drizzle.ts` or `memory.ts`, requires the current Drizzle/memory pair plus matching contract file,
  and treats helper-only repository subdirectories as support modules.
- `scripts/select-validation.mjs` now explicitly routes `apps/api/src/routes/*/*.ts` and
  `packages/database/src/repository/*/{drizzle,memory}.ts` through the focused API/database checks,
  including the database package build.

## Validation

Selector command:

```bash
{ git diff --name-only; git ls-files --others --exclude-standard; } | sort -u | xargs pnpm verify:select -- --files
```

Selector result:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
```

Additional package-export validation run because `packages/database/package.json` changed:

```bash
pnpm --filter @open-practice/database build
```

Dashboard shell selector command:

```bash
pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/_features/dashboard/dashboard-shell-state.ts apps/web/app/_features/dashboard/dashboard-shell-state.test.ts docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md
```

Dashboard shell selector result:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Validation-tooling selector command:

```bash
pnpm verify:select -- --files scripts/validate-open-practice-boundaries.mjs scripts/select-validation.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/select-validation.test.mjs scripts/security-hot-path-rescan.test.mjs docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md
```

Validation-tooling selector result:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

Validation results:

| Command                                                                                                  | Result                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/database test`                                                             | Passed: 18 test files, 107 tests.                                                                                                                        |
| `pnpm --filter @open-practice/database db:check`                                                         | Passed: `drizzle-kit check` reported `Everything's fine`.                                                                                                |
| `pnpm migrations:check`                                                                                  | Passed: 52 SQL files match 52 journal entries.                                                                                                           |
| `pnpm --filter @open-practice/database typecheck`                                                        | Passed.                                                                                                                                                  |
| `pnpm --filter @open-practice/database build`                                                            | Passed.                                                                                                                                                  |
| `pnpm --filter @open-practice/api test`                                                                  | Passed: 41 test files, 498 tests.                                                                                                                        |
| `pnpm docs:check`                                                                                        | Passed after the validation-tooling addendum.                                                                                                            |
| `pnpm deps:licenses`                                                                                     | Passed and produced the dependency license report. Existing review-required license groups remain reported for review; this slice added no dependencies. |
| `pnpm policy:check`                                                                                      | Passed after the validation-tooling addendum, including the tightened boundary validator.                                                                |
| `pnpm deps:audit`                                                                                        | Passed: no known vulnerabilities found for prod or dev audit.                                                                                            |
| `pnpm format:check`                                                                                      | Passed after the validation-tooling addendum.                                                                                                            |
| `pnpm test`                                                                                              | Passed after the validation-tooling addendum: Turbo reported 9 successful tasks; script tests reported 63 tests across 13 suites.                        |
| `pnpm ci:local`                                                                                          | Passed, including format, lint, typecheck, tests, database check, policy, build, and `git diff --check`.                                                 |
| `pnpm --filter @open-practice/web exec vitest run app/_features/dashboard/dashboard-shell-state.test.ts` | Passed: 1 test file, 4 tests.                                                                                                                            |
| `pnpm --filter @open-practice/web test`                                                                  | Passed: 21 test files, 145 tests.                                                                                                                        |
| `pnpm --filter @open-practice/web typecheck`                                                             | Passed.                                                                                                                                                  |
| `pnpm build`                                                                                             | Passed: 6 packages built; web production build compiled successfully.                                                                                    |
| `node --test scripts/validate-open-practice-boundaries.test.mjs scripts/select-validation.test.mjs`      | Passed after the validation-tooling addendum: 2 suites, 26 tests.                                                                                        |
| `node scripts/validate-open-practice-boundaries.mjs`                                                     | Passed after the validation-tooling addendum.                                                                                                            |
| `git diff --check`                                                                                       | Passed after the validation-tooling addendum and proof update.                                                                                           |

Skipped checks: none. Docker and browser gates were not selected by
`pnpm verify:select -- --files ...` for this validation-tooling slice.

During validation, out-of-scope broad modularization files briefly reappeared from another local
writer. Those files were restored to `HEAD`, temporarily guarded while validation ran, and are not
part of the final diff.

## Proof-vs-Diff Reconciliation

Final path-list command:

```bash
merge_base="$(git merge-base origin/main HEAD)"
{
  git diff --name-only "${merge_base}...HEAD"
  git diff --name-only
  git diff --cached --name-only
  git ls-files --others --exclude-standard
} | sort -u
```

Expected final path boundary:

- `packages/database/src/repository/**`
- `packages/database/package.json`
- `packages/database/test/schema.test.ts`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/_features/dashboard/dashboard-shell-state.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-state.test.ts`
- `scripts/validate-open-practice-boundaries.mjs`
- `scripts/validate-open-practice-boundaries.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`
- `scripts/security-hot-path-rescan.test.mjs`

Final count: 124 paths.
