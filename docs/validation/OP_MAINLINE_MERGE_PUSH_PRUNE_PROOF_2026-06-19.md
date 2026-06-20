# OP Mainline Merge Push Prune Proof - 2026-06-19

This proof records the 2026-06-19 Open Practice active-lane consolidation from base
`e680c230` (`origin/main`) into integration branch
`merge/open-practice-active-lanes-2026-06-19`.

## Scope

Before integration, each dirty lane was committed on its own branch from its own worktree. Patch
backups for dirty worktrees were captured under ignored `.tmp/mainline-closeout-2026-06-19/`.
Initial stash count was `42`.

| Branch                                              | Commit     | Scope                                     |
| --------------------------------------------------- | ---------- | ----------------------------------------- |
| `chore/gitignore-refactor-20260619`                 | `7d0b68a5` | Local ignore-rule tightening.             |
| `chore/dependency-refresh-20260619`                 | `1e34e2fa` | Dependency and lockfile refresh posture.  |
| `chore/local-tooling-ratchets-20260619`             | `8a103bdc` | Local security/tooling ratchets.          |
| `chore/local-tooling-upgrade-20260619`              | `e5cd6f20` | Local development tooling upgrades.       |
| `chore/self-hosting-optimization-20260619`          | `a1d6fe7b` | Focused self-host profile and checks.     |
| `chore/dev-stack-rebuild-20260619`                  | `d9e4df20` | Docker-dev same-origin browser API route. |
| `security/e680c230-remediation-20260619`            | `fc88d79f` | Public-token/provider/security hardening. |
| `refactor/filtered-audit-repository-reads-20260619` | `7f21cdb4` | Filtered audit repository reads.          |
| `codex/matter-lifecycle-commands-2026-06-19`        | `d431a92c` | Review-gated matter lifecycle commands.   |
| `feat/payment-import-review-records-20260619`       | `92ba20b1` | Payment import review records.            |
| `remediate/ops-efficiency-20260619`                 | `94321cf6` | Operations efficiency remediation.        |
| `fix/review-remediation-20260619`                   | `316bf6e4` | Focused review remediation.               |
| `refactor/staff-ui-ux-page-overhaul-20260619`       | `cfbb641d` | Staff page split and shell navigation.    |
| `refactor/ui-overlap-resilience-20260619`           | `67f8a69f` | UI overlap resilience coverage and CSS.   |

## Merge Reconciliation

- The self-hosting same-origin browser API mode was kept as the superset of the Docker-local web API
  routing changes; the narrower Docker-dev changes now rely on the same `OPEN_PRACTICE_BROWSER_API_MODE=same-origin`
  behavior.
- Filtered audit work was deduplicated into `0067_filtered_audit_read_indexes.sql`, which keeps the
  action/resource sequence indexes and the operations lane's metadata GIN index.
- Migration collisions were resolved into unique consecutive migrations after `0065_hot_path_access_indexes`:
  `0066_trust_transfer_ledger_transaction_single_use`,
  `0067_filtered_audit_read_indexes`,
  `0068_payment_import_review_records`, and
  `0069_inbound_attachment_message_index`. The Drizzle journal now has matching `idx` values `66`
  through `69`.
- The review-remediation billing route authorization extraction was kept, with the already-merged
  payment import review routes added to `scripts/route-authorization/billing.mjs` and the
  matter lifecycle command route kept in the root manifest.
- The staff page split was kept while preserving the operations lane's parallel server-resource
  loading path in `apps/web/app/open-practice-home.tsx`.
- Proof/index/workboard conflicts were resolved by preserving each lane-local proof note and adding
  this mainline closeout note as the integration-level proof.

## Selector Output

The integrated diff currently has 269 paths against `origin/main` before this proof note is added.
The final selector command is:

```bash
pnpm verify:select -- --base origin/main
```

Selector output and selected validation results will be recorded below before `main` is updated.

## Validation

| Command                                                                                             | Result  | Notes                                                                                      |
| --------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `node --test scripts/select-validation.test.mjs scripts/validate-open-practice-boundaries.test.mjs` | Passed  | Focused review-remediation merge check: 36 tests passed.                                   |
| `pnpm --filter @open-practice/domain build`                                                         | Passed  | Rebuilt domain package so web typecheck could resolve newly exported billing types.        |
| `pnpm --filter @open-practice/web test`                                                             | Passed  | Staff/overlap focused reruns passed: 41 files, 217 tests.                                  |
| `pnpm --filter @open-practice/web typecheck`                                                        | Passed  | Passed after removing ignored stale `apps/web/.next` output from prior public-token pages. |
| `pnpm verify:select -- --base origin/main`                                                          | Pending | Must run after this proof/index/workboard reconciliation.                                  |
| `pnpm ci:local`                                                                                     | Pending | Hard gate.                                                                                 |
| `pnpm deps:audit`                                                                                   | Pending | Hard gate.                                                                                 |
| `pnpm deps:licenses`                                                                                | Pending | Hard gate.                                                                                 |
| `pnpm docker:residual-watch`                                                                        | Pending | Hard gate.                                                                                 |
| `pnpm docker:app-smoke`                                                                             | Pending | Hard gate; stop before push/prune if Docker blocks.                                        |
| `pnpm e2e:host`                                                                                     | Pending | Hard gate.                                                                                 |
| `pnpm e2e:docker`                                                                                   | Pending | Hard gate; stop before push/prune if Docker blocks.                                        |
| `node scripts/run-e2e.mjs first-run`                                                                | Pending | Hard gate.                                                                                 |
| `pnpm e2e:matterless`                                                                               | Pending | Hard gate.                                                                                 |
| `pnpm e2e:client-portal`                                                                            | Pending | Hard gate.                                                                                 |
| `pnpm migrations:replay`                                                                            | Pending | Required migration replay.                                                                 |
| `pnpm migrations:lint`                                                                              | Pending | Required migration lint.                                                                   |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`           | Pending | Required self-host profile render check.                                                   |
| `git diff --check`                                                                                  | Pending | Required before merge/push.                                                                |

## Publish And Prune Plan

After all required validation passes, `main` will be fast-forwarded to the validated integration
branch and pushed to `origin/main`. Post-push parity will compare local `main`, `origin/main`, and
`git ls-remote origin refs/heads/main`.

Only after parity, clean worktrees whose branches are ancestors of `main` will be removed, merged
local branches will be deleted with `git branch -d`, `git worktree prune` and
`git remote prune origin` will run, and all stashes will remain untouched. Final stash count must
remain `42`.
