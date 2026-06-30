# Verify Run Plan Mode Proof

Date: 2026-06-30 PDT

Branch: `chore/verify-run-plan-mode-20260630`

Worktree: `/Users/bryan/projects/open-practice-verify-run-plan-mode`

## Scope

Added a print-only planner mode to the selected validation runner:

- `pnpm verify:run -- --plan --files <paths...>` reuses the existing selector and prints the
  commands normal `verify:run` would execute.
- Planner mode exits before command execution and before `.tmp/validation-runs` artifact creation.
- Existing `verify:select`, normal `verify:run`, and artifact-writing `verify:run -- --dry-run`
  semantics remain unchanged.
- Planner mode rejects `--dry-run` and explicit `--artifact-root` because both belong to
  artifact-writing runner paths.

No dependency, package script, selector-rule, runtime API, schema, migration, or product behavior
changes were made. The root checkout's unrelated billing/authorization work was preserved by doing
this slice in the clean sibling worktree above.

## Final Path Set

- `docs/testing/TESTING.md`
- `docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md`
- `docs/validation/README.md`
- `scripts/run-selected-validation.mjs`
- `scripts/run-selected-validation.test.mjs`

## Planner Output

Command:

```sh
pnpm verify:run -- --plan --files scripts/run-selected-validation.mjs scripts/run-selected-validation.test.mjs docs/testing/TESTING.md docs/validation/README.md docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md
```

Output:

```text
Selected validation plan (print-only; no commands run; no artifacts written):
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

## Side-Effect Proof

The before/after `git status --short --branch` output matched exactly around planner use:

```text
## chore/verify-run-plan-mode-20260630
 M docs/testing/TESTING.md
 M docs/validation/README.md
 M scripts/run-selected-validation.mjs
 M scripts/run-selected-validation.test.mjs
?? docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md
```

The before/after `.tmp/validation-runs` directory snapshot also matched exactly, proving planner
mode wrote no ignored validation-run artifacts.

## Validation

| Command                                                                                                                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:run -- --plan --files scripts/run-selected-validation.mjs scripts/run-selected-validation.test.mjs docs/testing/TESTING.md docs/validation/README.md docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md` | Passed; printed the four-command plan above without running selected commands or writing `.tmp/validation-runs` artifacts. The first `pnpm` invocation in this fresh sibling worktree hydrated ignored workspace dependencies before the script ran, but the selected-validation runner did not write validation-run artifacts.                                                                                   |
| `pnpm verify:select -- --files scripts/run-selected-validation.mjs scripts/run-selected-validation.test.mjs docs/testing/TESTING.md docs/validation/README.md docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md`     | Passed; selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `pnpm test`.                                                                                                                                                                                                                                                                                                                    |
| `node --test scripts/run-selected-validation.test.mjs scripts/select-validation.test.mjs`                                                                                                                                      | Passed; 33 focused script tests passed, covering runner parser behavior, planner formatting, no-artifact planner output, existing dry-run artifact behavior, and selector determinism.                                                                                                                                                                                                                            |
| `pnpm format:check`                                                                                                                                                                                                            | Passed after running Prettier on `docs/testing/TESTING.md` and `scripts/run-selected-validation.mjs`.                                                                                                                                                                                                                                                                                                             |
| `pnpm docs:check`                                                                                                                                                                                                              | Passed; documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm policy:check`                                                                                                                                                                                                            | Blocked by existing OSS reference lock/index drift: `scripts/validate-oss-reuse.mjs` reported central-reference commit mismatches for 21 reference entries. Earlier policy subchecks in the same run passed: tracked-secret scan, package manifest policy, lockfile supply-chain policy, toolchain policy, env-surface policy, architecture import policy, dead-code check, migration parity, and migration lint. |
| `node scripts/validate-doc-links.mjs`                                                                                                                                                                                          | Passed after the `policy:check` blocker to cover the remaining docs-policy subcheck directly.                                                                                                                                                                                                                                                                                                                     |
| `node scripts/validate-validation-proof-index.mjs`                                                                                                                                                                             | Passed after the `policy:check` blocker to cover the proof-index subcheck directly.                                                                                                                                                                                                                                                                                                                               |
| `node scripts/validate-local-evidence-dockerignore.mjs`                                                                                                                                                                        | Passed after the `policy:check` blocker to cover local-evidence ignore policy directly.                                                                                                                                                                                                                                                                                                                           |
| `node scripts/validate-open-practice-boundaries.mjs`                                                                                                                                                                           | Passed after the `policy:check` blocker to cover boundary policy directly.                                                                                                                                                                                                                                                                                                                                        |
| `pnpm test`                                                                                                                                                                                                                    | Passed; Turbo reported 9 successful package tasks, then `node --test scripts/*.test.mjs` reported 186 passing script tests.                                                                                                                                                                                                                                                                                       |

## Skips

No selected validation checks were intentionally skipped. `pnpm policy:check` is blocked by
reference-governance drift outside this slice; the remaining policy subchecks after the blocker were
run directly and passed.
