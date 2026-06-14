# Open Practice Mainline Merge, Push, And Prune Proof - 2026-06-14

## Scope

This proof records the branch-first integration of six dirty Open Practice lanes on top of
`origin/main` at `47c5db97`.

Integrated lane commits:

| Lane                                 | Branch commit | Integration commit | Disposition |
| ------------------------------------ | ------------- | ------------------ | ----------- |
| Dependency refresh                   | `da2bec7`     | `9f1486a`          | Integrated  |
| Dead-code prune                      | `b539d97`     | `fdf7197`          | Integrated  |
| Matter workspace duplicate-id parity | `d8da13a`     | `9f4bd22`          | Integrated  |
| Dashboard deeplink fallback          | `ed547ca`     | `a216119`          | Integrated  |
| OP-T155 intake widget registry       | `cbbdf9a`     | `3bc4026`          | Integrated  |
| OP-T156 client portal workspace V2   | `0452690`     | `6c64c1a`          | Integrated  |

The integration branch is `chore/open-practice-mainline-merge-2026-06-14`. The final merge commit
also records this proof, validation-index updates, planning-board status reconciliation,
`pnpm-lock.yaml` reconciliation, and the stale dashboard unavailable-route E2E assertion update.

## Reconciliation Notes

- `package.json` keeps the dependency-refresh versions for ESLint/Turbo and includes the dead-code
  lane's Knip dependency.
- `pnpm-lock.yaml` was regenerated with `pnpm install --lockfile-only` after package overlap
  resolution, then formatted with Prettier.
- `docs/validation/README.md` preserves every lane proof entry and adds this mainline integration
  proof.
- `docs/planning-and-progress.md` moves the six-lane batch from active validation to merge/push/prune
  closeout, with OP-T156 no longer parked.
- `apps/web/app/page.tsx`, `apps/web/app/dashboard-client.tsx`, and
  `apps/web/app/dashboard-client.test.ts` keep the UIUX dashboard route-selection behavior and the
  OP-T156 portal workspace/document-access helpers.
- `e2e/ui-ux.spec.ts` was reconciled so the older unavailable-route browser assertion matches the
  integrated privacy-preserving behavior: unknown dashboard query values are not echoed, and users
  see an unavailable-state panel with an explicit `Open Matters` fallback button.

## OP-T156 Disposition

OP-T156 was previously documented as not merge-ready because broad host, Docker, first-run,
matterless, and client-portal E2E could not complete in the branch-local runtime. The mainline
integration rerun cleared those gates, so OP-T156 is included in this merge instead of being parked.

## Validation

| Command                                    | Result                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main` | Passed; selected broad package, policy, build, dependency, and E2E gates for the integrated path set.                                           |
| `pnpm ci:local`                            | Passed; includes format, lint, typecheck, package tests, script tests, database migration checks, policy checks, build, and `git diff --check`. |
| `pnpm deps:audit`                          | Passed; no known prod/dev vulnerabilities reported.                                                                                             |
| `pnpm deps:licenses`                       | Passed; license inventory completed with existing review-required groups unchanged.                                                             |
| `pnpm e2e:host`                            | First run exposed the stale unavailable-route browser assertion; after E2E reconciliation, rerun passed 35 checks.                              |
| `pnpm e2e:docker`                          | Passed 3 Docker-backed checks; containers, network, and volumes were cleaned up.                                                                |
| `node scripts/run-e2e.mjs first-run`       | Passed 1 first-run setup check.                                                                                                                 |
| `pnpm e2e:matterless`                      | Passed 1 matterless dashboard deep-link check.                                                                                                  |
| `pnpm e2e:client-portal`                   | Passed 2 client-portal checks.                                                                                                                  |

## Push And Prune Gate

The branch is ready to fast-forward local `main`, push `main` to `origin`, confirm `main` and
`origin/main` match, confirm the remote still advertises only `refs/heads/main`, and prune only
clean worktrees/branches whose commits are included in `main`. Historical stashes are intentionally
left untouched.
