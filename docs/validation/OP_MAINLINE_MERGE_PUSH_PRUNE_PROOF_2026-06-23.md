# OP Mainline Merge Push Prune Proof - 2026-06-23

This proof records the 2026-06-23 Open Practice active-lane consolidation from base
`4a73d46ad07fd349085d7a48ae706db0a7e690bd` (`origin/main`) into integration branch
`merge/open-practice-mainline-20260623`.

## Scope

Six dirty Open Practice lanes were committed on their existing branches before integration. The
clean `verify/communications-inbox-bulk-reads-20260621` worktree was already merged by ancestry and
had no file changes. Initial stash count was `42`; stashes were intentionally preserved.

| Branch                                                           | Commit     | Scope                                                   |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `hardening/ai-proposal-authz-matrix-20260620`                    | `0667a4c9` | AI proposal authorization proof refinement.             |
| `docs/api-docs-route-inventory-reconciliation-followup-20260620` | `49c03955` | API route inventory documentation reconciliation.       |
| `codex/matter-lifecycle-close-command-20260620`                  | `c163421e` | Lifecycle close-command proof update.                   |
| `feat/document-retention-hold-action-descriptor-20260621`        | `33cd1f86` | Documents retention/hold action descriptor.             |
| `feat/matter-lifecycle-archive-command-20260621`                 | `16117925` | Status-only lifecycle archive command.                  |
| `chore/dependency-refresh-20260621`                              | `2503e47c` | Conservative patch/minor JavaScript dependency refresh. |

## Merge Reconciliation

- Docs/proof conflicts in `docs/planning-and-progress.md` and `docs/validation/README.md` were
  resolved additively so the dependency refresh, document retention/hold descriptor, lifecycle
  archive, lifecycle close proof, AI proposal proof, and API route inventory entries all survived.
- No SQL migration files changed in this closeout. Migration parity stayed at 71 SQL files and 71
  journal entries.
- Dependency updates stayed limited to JavaScript package manifests and `pnpm-lock.yaml`; no
  Dockerfile, Compose, schema, runtime provider, or copied-source change was introduced.
- Boundary posture remains synthetic-data-only, matter-scoped, no live settlement, no automatic
  trust posting, no destructive lifecycle cleanup, no raw provider payload retention, and no private
  client, matter, credential, payment, or deployment details.

## Selector Output

The initial integrated selector command was:

```bash
pnpm verify:select -- --base origin/main
```

It emitted:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                            | Result  | Notes                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main`         | Passed  | Selected the broad integrated command set after the lane merges.                                                                                                                                                                                                                        |
| `pnpm deps:audit`                                  | Passed  | Production and development audits found no known vulnerabilities.                                                                                                                                                                                                                       |
| `pnpm deps:licenses`                               | Passed  | Dependency license report covered 557 packages and 584 versions; review-required groups were reported without failing the command.                                                                                                                                                      |
| `pnpm deps:supply-chain`                           | Passed  | Lockfile supply-chain policy passed with 5 native-build approval entries reviewed.                                                                                                                                                                                                      |
| `pnpm deps:osv`                                    | Skipped | Reason: `osv-scanner` is not installed locally; wrapper wrote `.tmp/security/osv/2026-06-23T20-48-01Z`.                                                                                                                                                                                 |
| `pnpm license:scan`                                | Skipped | Reason: ScanCode is not installed locally; wrapper wrote `.tmp/license/scancode/2026-06-23T20-48-08Z`.                                                                                                                                                                                  |
| `pnpm architecture:check`                          | Passed  | Architecture import policy passed with 443 workspace import edges reviewed.                                                                                                                                                                                                             |
| `pnpm api:contract`                                | Passed  | Wrote `.tmp/api-contract/openapi.json` with 310 paths.                                                                                                                                                                                                                                  |
| `pnpm format:check`                                | Passed  | Prettier check passed.                                                                                                                                                                                                                                                                  |
| `pnpm docs:check`                                  | Passed  | Documentation link validation passed.                                                                                                                                                                                                                                                   |
| `pnpm policy:check`                                | Passed  | Secret scan, package manifest, supply-chain, toolchain, env, architecture, dead-code, migration, OSS, docs, evidence, proof-index, and boundary policies passed.                                                                                                                        |
| `pnpm --filter @open-practice/domain test`         | Passed  | 31 test files and 238 tests passed.                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/domain typecheck`    | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain build`        | Passed  | Build completed.                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database test`       | Passed  | 25 test files and 148 tests passed.                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/database db:check`   | Passed  | Drizzle schema check passed.                                                                                                                                                                                                                                                            |
| `pnpm migrations:check`                            | Passed  | Migration parity passed: 71 SQL files match 71 journal entries.                                                                                                                                                                                                                         |
| `pnpm migrations:lint`                             | Passed  | Migration lint passed: 0 changed SQL migration files reviewed.                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/database typecheck`  | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database build`      | Passed  | Build completed.                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/providers test`      | Passed  | 11 test files and 23 tests passed; Node localStorage experimental warnings only.                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/providers typecheck` | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/providers build`     | Passed  | Build completed.                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/api test`            | Passed  | 42 test files and 578 tests passed; expected route/error logs and localStorage warnings only.                                                                                                                                                                                           |
| `pnpm --filter @open-practice/api typecheck`       | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/worker test`         | Passed  | 5 test files and 46 tests passed; Node localStorage experimental warnings only.                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/worker typecheck`    | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/worker build`        | Passed  | Build completed.                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/web test`            | Passed  | 41 test files and 217 tests passed.                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/web typecheck`       | Passed  | TypeScript no-emit check passed.                                                                                                                                                                                                                                                        |
| `pnpm build`                                       | Passed  | Turbo built all 6 packages; Next generated 20 static pages.                                                                                                                                                                                                                             |
| `pnpm ci:local`                                    | Passed  | Full local gate passed with existing lint warnings but no errors, plus `git diff --check`.                                                                                                                                                                                              |
| `pnpm migrations:replay`                           | Passed  | First attempt was blocked because no local Postgres was listening on `localhost:35432`; after starting Docker Desktop and `docker compose up -d postgres`, 71 migrations replayed into disposable database `open_practice_migration_replay_55991_20260623205238` and cleaned up.        |
| `pnpm docker:app-smoke`                            | Passed  | Built app/service images, verified PostgreSQL-backed API health, web root, and web-origin `/api/setup/status`, then removed the disposable stack and volumes.                                                                                                                           |
| `pnpm e2e:docker`                                  | Passed  | First attempt was blocked because the replay Postgres service occupied `127.0.0.1:35432`; after `docker compose stop postgres` and `docker compose -p open-practice-e2e down -v --remove-orphans`, rerun passed 3/3 Docker Chromium tests and removed the disposable stack and volumes. |

## Publish And Prune

Publication and pruning are recorded after this proof note is committed and `main` is fast-forwarded
to the validated integration branch. Required final checks:

- `git rev-list --left-right --count main...origin/main`
- `git ls-remote origin refs/heads/main`
- `git worktree list --porcelain`
- `git branch --merged main`
- `git branch --no-merged main`
- `git stash list | wc -l`

## Final Changed Paths

```text
apps/api/package.json
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/package.json
apps/worker/package.json
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md
docs/validation/OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md
docs/validation/OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md
docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md
docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md
docs/validation/OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-23.md
docs/validation/README.md
package.json
packages/database/package.json
packages/database/test/repository.matter-lifecycle.test.ts
packages/domain/package.json
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
packages/providers/package.json
pnpm-lock.yaml
```
