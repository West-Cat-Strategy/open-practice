# Open Practice Mainline Consolidation Proof - 2026-06-03

## Scope

Consolidated the local Open Practice lanes onto `main`, validated the merged result, pushed
`origin/main`, and pruned only clean branches/worktrees proven represented in pushed `main`.

No dependencies, vendored assets, credentials, private deployment details, client data, matter data,
or payment data were added.

## Consolidated Branches

| Branch                                                      | Commit    | Result                                                                 |
| ----------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `codex/op-security-review-2026-06-02`                       | `a27a7fb` | Merged through `871d36d`; stale `54f84b0` base excluded during replay. |
| `codex/op-t143-provider-config-encryption-surviving-replay` | `2f20277` | Merged through `37e1ab8`.                                              |
| `codex/op-t143-provider-config-encryption-main-replay`      | `45b5ddd` | Merged through `92c0693`.                                              |
| `codex/inbound-email-mailgun-webhook`                       | `8a4917b` | Merged through `e2bbe29`.                                              |
| `codex/open-practice-mainline-consolidation-2026-06-03`     | `003bcae` | Final validated implementation tip before this proof note.             |

Final pushed implementation commit: `003bcae158ab521449724bb1d86ed9247392ceef`.

## Validation

Selector:

```sh
pnpm verify:select -- --base origin/main
```

Selected validation passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Additional final gates passed:

- `pnpm ci:local`
- `pnpm e2e:host` (`33 passed`, `3 skipped`)
- `pnpm e2e:docker` (`5 passed`)

Docker note: the first Docker e2e attempt found `127.0.0.1:35432` already bound by
`open-practice-dev-postgres-1`. The dev Postgres container was stopped, the partial
`open-practice-e2e` stack was removed, and the Docker e2e rerun passed with the isolated e2e stack.

## Push Result

Initial main push succeeded:

```text
877dd1b..003bcae  main -> main
```

The proof closeout commit is the commit containing this note, created after the prune record was
complete and before deleting the temporary consolidation branch.

## Prune Result

Removed clean merged worktrees after the successful `main` push:

- `/Users/bryan/projects/open-practice-inbound-mailgun-webhook`
- `/Users/bryan/projects/open-practice-op-t143-provider-config-encryption-replay`
- `/Users/bryan/projects/open-practice-security-review-2026-06-02`

Deleted merged local branches:

- `codex/inbound-email-mailgun-webhook`
- `codex/op-t143-provider-config-encryption-surviving-replay`
- `codex/op-security-review-2026-06-02`
- `codex/op-t143-provider-config-encryption-main-replay`

Prune commands completed:

- `git remote prune origin`
- `git worktree prune`

Preserved:

- `codex/op-t143-provider-config-encryption` because `git cherry main codex/op-t143-provider-config-encryption`
  reported unique commit `54f84b038646ffd3aca3099f77bb51d07ff1d027`, and
  `git diff --stat main...codex/op-t143-provider-config-encryption` showed material unique work.
- Existing stashes; no stash drop/pop/apply command was run.
