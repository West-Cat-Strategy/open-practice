# Open Practice Mainline Merge Push Prune Proof 2026-06-12

## Scope

This proof records the 2026-06-12 integration of all current Open Practice local branches and
sibling worktrees into a branch-first mainline closeout lane:

- Integration branch:
  `chore/open-practice-mainline-merge-prune-2026-06-12`.
- Starting point: clean `main` / `origin/main` at `47ca3625`.
- Open PR inventory: empty before integration.
- Remote inventory: `origin` advertised only `main`; `git remote prune origin --dry-run` had no
  refs to prune before integration.
- Pre-proof integrated delta: 109 source, config, docs, test, migration, route-manifest, package,
  and lockfile paths before this proof note and index update.

No client, matter, credential, payment, private deployment, or private provider-account data was
added. Runtime proof artifacts under `/tmp` remain local-only evidence.

## Integrated Branches And Worktrees

Dirty sibling worktree deltas were validated before commit, then merged into the integration
branch:

| Lane                     | Commit     | Message                                           | Pre-commit validation                                                                                                                                                                   |
| ------------------------ | ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs review              | `a4e55fcc` | `docs: refresh maintenance handoff docs`          | `pnpm verify:select -- --dirty`, `pnpm format:check`, `pnpm docs:check`, `git diff --check` passed; `pnpm policy:check` hit the known old-base OSS reference-lock drift.                |
| Validation-index cleanup | `8a31e42b` | `docs: archive historical validation proof index` | Same selector/docs/format/diff proof passed; `pnpm policy:check` hit the known old-base OSS reference-lock drift.                                                                       |
| Whole-application review | `35a22805` | `docs: record whole-app review proof`             | Same selector/docs/format/diff proof passed; `pnpm policy:check` hit the known old-base OSS reference-lock drift.                                                                       |
| Test-suite pruning       | `1945f63d` | `test: prune redundant Open Practice coverage`    | `pnpm verify:select -- --dirty`, selected docs/format/policy/diff proof; `pnpm policy:check` hit the known old-base OSS reference-lock drift before dependency-refresh mainline replay. |

Committed branch tips merged afterward:

- `codex/op-task-system-v2-2026-06-10` via `a493dfda`.
- `codex/email-settings-smtp-imap-2026-06-10` via `d0bf0e70`.

## Conflict Resolution Notes

- `docs/planning-and-progress.md` keeps the current dependency-refresh/mainline context and adds
  merged-work handoff notes without resurrecting stale "merge this branch next" language.
- `docs/validation/README.md` keeps the validation-index cleanup's proof-inventory structure while
  retaining active links for dependency refresh, whole-app review, test pruning, OP-T153,
  matterless workflow, and SMTP/IMAP provider settings proof.
- `packages/providers/package.json` keeps the current main patch versions for existing
  `mailparser` and `nodemailer` dependencies and adds `imapflow`.
- `pnpm-lock.yaml` was regenerated with `pnpm install --lockfile-only`, then formatted by
  Prettier as part of the integrated validation cleanup.
- Route authorization and runtime manifests preserve both OP-T153 task-system routes and SMTP/IMAP
  email/provider settings routes.
- Shared API/web/database/domain/provider conflicts were combined so task lifecycle behavior,
  provider SMTP/IMAP settings, IMAP polling, first-run provider capture, dashboard/admin settings,
  and current mainline dependency/config posture all remain present.

## Integrated Validation

The final integrated tree selected broad validation with:

```bash
git diff --name-only origin/main...HEAD | xargs pnpm verify:select -- --files
```

The selector included broad local CI, dependency checks, Docker residual watch, Docker app smoke,
host E2E, Docker E2E, docs/format/policy gates, package tests/typechecks/builds, and `pnpm build`.

Passing checks:

| Command                                        | Result |
| ---------------------------------------------- | ------ |
| `pnpm --filter @open-practice/domain build`    | Pass   |
| `pnpm --filter @open-practice/database build`  | Pass   |
| `pnpm --filter @open-practice/providers build` | Pass   |
| `pnpm ci:local`                                | Pass   |
| `pnpm e2e:host`                                | Pass   |
| `pnpm e2e:docker`                              | Pass   |
| `pnpm docker:residual-watch`                   | Pass   |
| `pnpm deps:audit`                              | Pass   |
| `pnpm deps:licenses`                           | Pass   |
| `pnpm docker:app-smoke`                        | Pass   |
| `git diff --check`                             | Pass   |

`pnpm ci:local` passed after formatting `docs/validation/README.md` and `pnpm-lock.yaml`. The pass
covered format, lint, typecheck, unit tests across API/database/domain/providers/web/worker/scripts,
database migration integrity, policy checks, and the full build.

`pnpm e2e:host` passed; `test-results/e2e/.last-run.json` reported `"status": "passed"` with no
failed tests. `pnpm e2e:docker` passed the Docker-backed Playwright slice and cleaned down its
temporary Compose project.

`pnpm docker:app-smoke` had one transient first attempt where `postgres-ready` timed out after the
fresh image build. A manual debug Compose project using the same smoke ports and the same
`open-practice-postgres:18-alpine-su-exec` image came up healthy, exposed
`127.0.0.1:45432->5432`, and showed normal PostgreSQL initialization logs. The official
`pnpm docker:app-smoke` rerun then passed, confirming PostgreSQL-backed API `/health` at
`http://127.0.0.1:44000/health` and the web root at `http://127.0.0.1:43000/`.

`pnpm docker:residual-watch` passed and wrote local evidence under
`/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-12T07-38-14Z`.

## Push And Prune Plan

After this proof commit, local `main` should fast-forward to
`chore/open-practice-mainline-merge-prune-2026-06-12`, push to `origin/main`, then prune only refs
and worktrees whose tips are ancestors of the pushed `main`.

Final state checks:

```bash
git status --short --branch
git worktree list
git branch --format='%(refname:short)'
git remote prune origin
git worktree prune
```
