# Open Practice Mainline Push And Prune Follow-Up Proof - 2026-06-03

## Scope

Merged the remaining local security, Docker image CVE, and OP-T143 inbound raw-MIME SSE follow-up
lanes into `main`, pushed `origin/main`, and pruned only clean merged branches/worktrees.

No dependencies, vendored assets, credentials, private deployment details, client data, matter data,
or payment data were added.

## Consolidated Commits

| Commit    | Source branch                                  | Result                                                                                      |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ca962f2` | `codex/security-remediation-2026-06-03-stage1` | Already on local `main`; pushed as part of the final mainline update.                       |
| `e61df5b` | `codex/security-remediation-2026-06-03-stage2` | Already on local `main`; pushed as part of the final mainline update.                       |
| `703d46c` | `codex/op-t143-inbound-raw-mime-sse-followup`  | Merged through `b1dfebc`, preserving hardened inbound-email code plus configured SSE usage. |
| `5a5cbee` | `codex/security-image-cve-followup-2026-06-04` | Merged through `9cb6523`, recording the Docker image CVE follow-up proof.                   |
| `b1dfebc` | `main` merge commit                            | Merge commit for the inbound raw-MIME SSE follow-up.                                        |
| `9cb6523` | `main` merge commit                            | Final pushed merge tip for this follow-up before this proof note.                           |

## Validation

Selector run against the final merged delta before the first push:

```sh
pnpm verify:select -- --base origin/main
```

The selector recommended format, docs, policy, repo tests, package tests/typechecks, database
checks, provider and worker builds, web checks, and `pnpm build`. I chose the broader local gate:

```sh
pnpm ci:local
git diff --check origin/main..HEAD
```

Results:

- `pnpm ci:local` passed. That gate ran `pnpm verify && git diff --check`, including
  `pnpm format:check`, lint, typecheck, tests, database `db:check`, `pnpm policy:check`, and
  `pnpm build`.
- API tests passed with 41 files and 469 tests.
- Migration parity passed with 51 SQL files and 51 journal entries.
- `git diff --check origin/main..HEAD` passed.

Browser e2e was not run for this follow-up because the selector did not include `e2e/**`,
Playwright, or browser-rendered route changes; the final gate was the broad local CI lane.

## Push Result

Initial main push succeeded:

```text
16c8061..9cb6523  main -> main
```

## Prune Result

Removed clean merged worktree:

- `/Users/bryan/projects/open-practice-security-remediation-2026-06-03`

Deleted clean merged local branches:

- `codex/security-image-cve-followup-2026-06-04`
- `codex/op-t143-inbound-raw-mime-sse-followup`
- `codex/security-remediation-2026-06-03-stage1`
- `codex/security-remediation-2026-06-03-stage2`

Prune commands completed:

- `git remote prune origin`
- `git worktree prune`

Preserved:

- `op-inmail-replay-recovery` because its sibling worktree is dirty with uncommitted replay-recovery
  edits across inbound email, job tests, audit taxonomy, route manifest, and proof docs.
- `codex/op-t143-provider-config-encryption` because `git cherry main
codex/op-t143-provider-config-encryption` still reports unique commit
  `54f84b038646ffd3aca3099f77bb51d07ff1d027`, and `git diff --stat
main...codex/op-t143-provider-config-encryption` shows a material 19-file diff.
- Existing stashes; no stash drop/pop/apply command was run.

Final local branch/worktree inventory after prune:

- `main`
- `op-inmail-replay-recovery` at `/Users/bryan/projects/open-practice-op-inmail-replay-recovery`
- `codex/op-t143-provider-config-encryption`
