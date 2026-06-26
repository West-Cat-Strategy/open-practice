# Docker Storage Preflight Proof

Date: 2026-06-26
Branch: `chore/docker-storage-preflight-20260626`
Worktree: `/Users/bryan/projects/open-practice-docker-storage-preflight-20260626`
Base: `main` at `e21cd343d1f7904d372a0473fdf54572012e3083`
Status: Selector validation passed; private-pilot release proof is environment-blocked by local
Docker storage pressure and a missing replay Postgres service.

## Scope

This branch adds a narrow local Docker storage-capacity guard for Docker-heavy validation and
private-pilot release proof. The preflight checks Docker daemon reachability, records
`docker system df` context, and measures the Docker container filesystem with `df -Pk /` in an
already-local image using `--pull=never`.

The guard is wired into:

- `pnpm docker:app-smoke`, with a soft pre-build probe and required post-build probe.
- `pnpm e2e:docker`, with a soft pre-Compose probe and required pre-migration probe.
- `pnpm selfhost:restore-drill`, with redacted ignored evidence metadata for the soft pre-build and
  required post-build probes.
- `pnpm release:local -- --private-pilot`, with a required `docker-storage-preflight` command near
  the start of release proof metadata.

The branch preserves runtime APIs, schemas, Compose contracts, Docker pins, dependency manifests,
application behavior, synthetic-only proof, and clean-room posture. The preflight never prunes,
deletes, or mutates Docker storage; when free space is below the local 8 GiB default, it tells the
operator to reclaim Docker storage and rerun the Docker validation command.

## Final Path Set

Selector and validation use this final changed-path set:

```text
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md
docs/validation/README.md
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/docker-app-smoke.mjs
scripts/docker-storage-preflight.mjs
scripts/docker-storage-preflight.test.mjs
scripts/run-e2e.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/selfhost-restore-drill.mjs
```

## Selector Output

`pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

## Validation

| Command                                                                                                                                                                  | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                                                         | Pass    | Selected the Docker, E2E, docs, policy, and script-test lanes listed above.                                                                                                                                                                                                                                                                                                                                                         |
| `node --test scripts/docker-storage-preflight.test.mjs scripts/create-release-proof.test.mjs scripts/select-validation.test.mjs scripts/selfhost-restore-drill.test.mjs` | Pass    | Focused Node contract tests passed before docs/proof reconciliation.                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm docker:residual-watch`                                                                                                                                             | Pass    | Accepted residuals: 3; local artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-26T21-43-13Z`.                                                                                                                                                                                                                                                                                                        |
| `pnpm docker:app-smoke`                                                                                                                                                  | Pass    | Pre-build preflight found 9.0 GiB free; post-build preflight found 8.7 GiB free; app/API smoke passed and stack cleaned up.                                                                                                                                                                                                                                                                                                         |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                                                        | Pass    | Synthetic restore drill passed; evidence: `.tmp/open-practice-selfhost-restore-drill/2026-06-26T21-47-34Z`; pre/post preflights found 8.6 GiB free.                                                                                                                                                                                                                                                                                 |
| `pnpm e2e:host`                                                                                                                                                          | Pass    | Host Playwright suite passed: 36 tests.                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm e2e:docker`                                                                                                                                                        | Pass    | Docker pre-compose preflight found 8.7 GiB free; pre-migration preflight found 8.6 GiB free; Docker Playwright suite passed: 3 tests.                                                                                                                                                                                                                                                                                               |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                     | Pass    | First-run Playwright suite passed: 1 test.                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm e2e:matterless`                                                                                                                                                    | Pass    | Matterless Playwright suite passed: 2 tests.                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm e2e:client-portal`                                                                                                                                                 | Pass    | Client portal Playwright suite passed: 2 tests.                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm e2e:a11y`                                                                                                                                                          | Pass    | Accessibility Playwright suite passed: 2 tests.                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm format:check`                                                                                                                                                      | Pass    | Prettier check passed.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm docs:check`                                                                                                                                                        | Pass    | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm policy:check`                                                                                                                                                      | Pass    | Security, package, supply-chain, toolchain, env, architecture, migration, OSS reuse, docs, proof-index, local evidence, and boundary policy checks passed.                                                                                                                                                                                                                                                                          |
| `pnpm test`                                                                                                                                                              | Pass    | Full selected test suite passed: 174 tests.                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm release:local -- --private-pilot`                                                                                                                                  | Blocked | Release artifact: `artifacts/release-local/2026-06-26T22-06-28Z`. The new `docker-storage-preflight` command ran near the start and passed at 8.7 GiB free, then the later self-host restore drill failed fast before build at 7.2 GiB free, below the 8.0 GiB threshold. `migration-replay` also failed because Postgres on `localhost:35432` was not running. A direct preflight rerun after release exit confirmed 6.3 GiB free. |
| `pnpm proof:reconcile -- --proof docs/validation/OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md --files <final path set>`                                               | Pass    | Reconciled 13 paths and returned the expected selector command list.                                                                                                                                                                                                                                                                                                                                                                |
| `git diff --check`                                                                                                                                                       | Pass    | Whitespace check passed.                                                                                                                                                                                                                                                                                                                                                                                                            |

## Boundaries

- All proof uses synthetic repo fixtures, local Docker command metadata, and ignored local artifacts
  only.
- No client, matter, credential, payment, private deployment, raw audit, object body, or privileged
  document data is added to tracked files.
- The storage preflight is local validation/release ergonomics only. It does not change runtime
  behavior, Compose contracts, Docker image pins, schemas, dependencies, object-storage behavior, or
  private-pilot readiness semantics.
