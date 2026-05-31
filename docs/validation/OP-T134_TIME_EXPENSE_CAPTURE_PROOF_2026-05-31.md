# OP-T134 Time And Expense Capture Proof

Date: 2026-05-31 PDT

## Scope

Implemented the smallest coherent OP-T134 first slice from the 2026-05-29 recovery trail:

- `POST /api/time-entries/timer-drafts` accepts local timer start/stop timestamps, resolves draft
  minutes and rate snapshots, rejects locked-period overlaps, and always creates `draft` time
  entries.
- `POST /api/expense-entries/review-drafts` applies OP-authored expense category/profile cues,
  rejects locked incurred dates, and always creates `draft` expense entries.
- `GET /api/billing/dashboard` now separates draft/submitted capture-review rows from approved
  unbilled invoice sources and includes review-only expense category profiles.
- The dashboard adds local timer and expense draft controls over the existing billing surface.
- The route authorization manifest covers both billing capture endpoints.

Out of scope: native mobile capture, automatic billing, external time-tool sync, lock bypasses,
payment processing, trust-ledger posting, tax/compliance certification, ReBAC authorization-matrix
leftovers, OP-T144 proof residue, and OP-T133/document-assembly stash residue.

## Recovery Trail

Used these 2026-05-29 OP-T134 stashes as recovery references:

- `stash@{6}` and `stash@{17}`: billing route/test coverage for timer and expense-profile drafts.
- `stash@{7}`, `stash@{18}`, and `stash@{28}`: domain timer/lock helpers and expense profile cues.
- `stash@{13}` and `stash@{15}`: billing capture styles and dashboard helper functions.
- `stash@{29}`: mixed web edits, used only to identify OP-T134 dashboard-control intent.

Left out of scope:

- `stash@{10}`, `stash@{11}`, `stash@{16}`, `stash@{20}` through `stash@{24}`, and related entries
  carrying ReBAC/authorization-matrix work.
- `stash@{12}` carrying mixed OP-T134 and OP-T144 proof residue.
- `stash@{29}` document-assembly and calendar-test residue.
- OP-T130 cleanup stashes from `stash@{0}` through `stash@{5}`.

## Validation

| Command                                                                                             | Result                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)` | Passed before validation and again after proof/docs updates; final selection included root `pnpm test`, format/docs/policy, package tests/typechecks, and build. |
| `pnpm --filter @open-practice/domain build`                                                         | Passed.                                                                                                                                                          |
| `pnpm --filter @open-practice/database build`                                                       | Passed after domain build output was present.                                                                                                                    |
| `pnpm --filter @open-practice/providers build`                                                      | Passed after domain build output was present.                                                                                                                    |
| `pnpm --filter @open-practice/domain test -- billing.test.ts`                                       | Passed: 22 files, 147 tests.                                                                                                                                     |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`                       | Passed: 1 file, 21 tests.                                                                                                                                        |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`                     | Passed: 1 file, 68 tests.                                                                                                                                        |
| `pnpm docs:check`                                                                                   | Passed.                                                                                                                                                          |
| `pnpm policy:check`                                                                                 | Passed after adding route authorization manifest entries.                                                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                     | Passed.                                                                                                                                                          |
| `pnpm --filter @open-practice/api typecheck`                                                        | Passed.                                                                                                                                                          |
| `pnpm --filter @open-practice/web typecheck`                                                        | Passed after adding capture-review fallback arrays and widening the local expense profile key state.                                                             |
| `pnpm --filter @open-practice/api test`                                                             | Passed: 39 files, 408 tests.                                                                                                                                     |
| `pnpm --filter @open-practice/web test`                                                             | Passed: 14 files, 122 tests.                                                                                                                                     |
| `pnpm --filter @open-practice/providers test`                                                       | Passed: 5 files, 15 tests.                                                                                                                                       |
| `pnpm --filter @open-practice/worker test`                                                          | Passed: 3 files, 23 tests.                                                                                                                                       |
| `pnpm test`                                                                                         | Passed: workspace package tests and script tests.                                                                                                                |
| `pnpm format:check`                                                                                 | Passed after formatting proof/workboard docs.                                                                                                                    |
| `git diff --check`                                                                                  | Passed.                                                                                                                                                          |
| `pnpm build`                                                                                        | Passed: 6 packages.                                                                                                                                              |

Skipped checks:

- Browser screenshot proof was not run in this recovery pass; `pnpm build`, web tests, and web
  typecheck covered the dashboard integration.
