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

## OP-SEC And OP-T155 Closeout Addendum

This addendum records the user-requested closeout of the two dirty worktrees that remained after
the earlier mainline proof:

- Current integration branch: `codex/op-t155-intake-widget-registry-ready`.
- Starting point: clean `main` / `origin/main` at `4a005ad9`.
- Sibling worktree branch:
  `codex/op-sec-001-production-setup-gate-2026-06-12`.
- Remote inventory before final push/prune: `origin` advertised only `main`.

Preserved commits:

| Lane                              | Commit     | Scope                                                                                                                                                                               |
| --------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production setup gate hardening   | `e250298e` | Blocks remote/proxy production setup status, WebAuthn options, and setup completion while allowing empty-production setup only from operator-local loopback host/origin context.    |
| Focused E2E validation lanes      | `7bd0b6f7` | Adds `pnpm e2e:matterless`, `pnpm e2e:client-portal`, explicit `scripts/run-e2e.mjs` modes, and routes specialized Playwright projects out of the default host suite.               |
| Sibling branch merge              | `46059e3d` | Merges the OP-SEC lane into the current branch; keeps the fuller first-run Email and Security step assertions while preserving the OP-SEC remediation proof narrative.              |
| Esbuild audit remediation cleanup | `d35b7e3`  | Adds a workspace override for `esbuild@0.28.1`, updates the existing `@esbuild-kit/core-utils>esbuild` override to `0.28.1`, and refreshes `pnpm-lock.yaml` after audit validation. |

Conflict and proof reconciliation choices:

- `e2e/first-run.spec.ts` keeps the current Email heading assertion, the SMTP helper text
  assertion, the Email-step navigation, and the Security heading assertion.
- `docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md` retains the OSS policy follow-up,
  OP-SEC remediation follow-up, and original review-diff reconciliation sections.
- The setup route remains keyless for empty production setup, but only for operator-local loopback
  requests without proxy client headers.

Dependency-audit follow-up:

- `pnpm deps:audit` initially failed on vulnerable transitive `esbuild` versions below `0.28.1`
  through the existing `tsx` / `drizzle-kit` toolchain.
- Before changing dependency policy, `pnpm view` confirmed the relevant packages remain MIT:
  `esbuild@0.28.1`, `tsx@4.22.4`, and `drizzle-kit@0.31.10`.
- `pnpm-workspace.yaml` now overrides both direct `esbuild` resolution and
  `@esbuild-kit/core-utils>esbuild` to `0.28.1`; `pnpm-lock.yaml` was refreshed with
  `pnpm install --lockfile-only` and formatted.

Final selector path set:

```text
apps/api/src/routes/setup.ts
apps/api/src/server.test.ts
docs/api-and-state-machines.md
docs/deployment-hardening.md
docs/development/getting-started.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-12.md
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
e2e/first-run.spec.ts
e2e/helpers/e2e-fixtures.ts
e2e/host.spec.ts
e2e/ui-ux.spec.ts
package.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/run-e2e.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
```

Selector-chosen validation for the combined lane:

| Command                                      | Result                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files ...`          | Pass; selected broad local CI, dependency, E2E, docs, policy, test, API test, and API typecheck.            |
| `pnpm ci:local`                              | Pass after the esbuild override and refreshed lockfile.                                                     |
| `pnpm deps:audit`                            | Initial fail on transitive `esbuild`; pass after overriding to `0.28.1`.                                    |
| `pnpm deps:licenses`                         | Pass; existing review-required groups remained reported without blocking.                                   |
| `pnpm e2e:host`                              | Pass.                                                                                                       |
| `pnpm e2e:docker`                            | First attempt hit a stale local Next dev server from host E2E; Docker project was cleaned and retry passed. |
| `node scripts/run-e2e.mjs first-run`         | Pass; 1 first-run Chromium test.                                                                            |
| `pnpm e2e:matterless`                        | Pass; 1 matterless Chromium test.                                                                           |
| `pnpm e2e:client-portal`                     | Pass; 1 client-portal Chromium test.                                                                        |
| `pnpm format:check`                          | Pass.                                                                                                       |
| `pnpm docs:check`                            | Pass.                                                                                                       |
| `pnpm policy:check`                          | Pass.                                                                                                       |
| `pnpm test`                                  | Pass; Turbo package tests and 63 script tests completed successfully.                                       |
| `pnpm --filter @open-practice/api test`      | Pass; 504 API tests.                                                                                        |
| `pnpm --filter @open-practice/api typecheck` | Pass.                                                                                                       |
| `git diff --check`                           | Pass.                                                                                                       |

After this addendum and the dependency-audit cleanup commit, local `main` can fast-forward to
`codex/op-t155-intake-widget-registry-ready`, push to `origin/main`, and prune only branches and
worktrees whose tips are ancestors of the pushed `main`.

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
