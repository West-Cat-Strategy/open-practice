# Local Tooling Ratchets Proof

Date: 2026-06-19 PDT

Branch: `chore/local-tooling-ratchets-20260619`

Worktree: `/Users/bryan/projects/open-practice-local-tooling-ratchets`

## Scope

Implemented local-only tooling ratchets for validation selection, environment/toolchain policy,
dependency review evidence, rendered accessibility QA, local security scanners, architecture
checks, API contract inventory, migration lint, Docker lint/scan wrappers, OSV/source-license
scanners, and release attestation.

- Preserved the repository's deliberate local-only posture: no GitHub Actions, Dependabot
  automation, CodeQL default setup, or remote required status checks were added.
- Added selector coverage for domain package builds, root documentation policy checks, and rendered
  accessibility E2E coverage when Playwright/E2E tooling changes.
- Added `pnpm toolchain:check`, `pnpm env:check`, and `pnpm deps:review` as local scripts.
- Added `pnpm verify:run`, `pnpm deps:supply-chain`, `pnpm deps:osv`,
  `pnpm security:secrets-history`, `pnpm security:privacy-rules`, `pnpm architecture:check`,
  `pnpm architecture:graph`, `pnpm api:contract`, `pnpm migrations:lint`, `pnpm docker:lint`,
  `pnpm docker:scan`, `pnpm license:scan`, and `pnpm release:attest` as local-only scripts.
- Added `pnpm e2e:a11y` through the existing local E2E harness and an `a11y-chromium` Playwright
  project excluded from normal host suites.
- Added dev-only `@axe-core/playwright@4.11.3` after reviewing `docs/license-policy.md`.
- Kept `eslint-plugin-jsx-a11y` out of this slice because its current published peer range does
  not include the repository's ESLint major.
- Updated a staff dashboard timeline container so the serious/critical accessibility pass has a
  keyboard-focusable scroll region.

No product runtime feature, API contract, persisted schema, provider behavior, GitHub repository
setting, or production automation was changed. Examples, E2E data, dependency-review artifacts, and
proof notes remain synthetic/local.

## Preserved Local State

The original checkout at `/Users/bryan/projects/open-practice` was left on
`chore/dev-stack-rebuild-20260619` with unrelated dirty web/dev-stack files preserved. This work was
implemented in the sibling worktree above.

## Owned Path Set

- `.env.example`
- `apps/web/app/dashboard/matter-overview-section.tsx`
- `docs/development/github-maintenance.md`
- `docs/development/maintenance.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP_LOCAL_TOOLING_RATCHETS_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `e2e/a11y.spec.ts`
- `knip.jsonc`
- `package.json`
- `packages/providers/package.json`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/check-env-surface.mjs`
- `scripts/check-env-surface.test.mjs`
- `scripts/check-toolchain.mjs`
- `scripts/check-toolchain.test.mjs`
- `scripts/create-dependency-review.mjs`
- `scripts/create-dependency-review.test.mjs`
- `scripts/report-dependency-licenses.mjs`
- `scripts/report-dependency-licenses.test.mjs`
- `scripts/run-e2e.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`

Additional owned paths from the expanded local tooling plan:

- `.semgrep/open-practice.yml`
- `apps/api/eslint.config.js`
- `apps/worker/eslint.config.js`
- `packages/database/eslint.config.js`
- `packages/domain/eslint.config.js`
- `scripts/attest-release-artifacts.mjs`
- `scripts/check-architecture-graph.mjs`
- `scripts/check-architecture-graph.test.mjs`
- `scripts/generate-api-contract.mjs`
- `scripts/generate-api-contract.test.mjs`
- `scripts/lint-docker-config.mjs`
- `scripts/lint-migrations.mjs`
- `scripts/lint-migrations.test.mjs`
- `scripts/optional-tooling.mjs`
- `scripts/run-gitleaks-history-scan.mjs`
- `scripts/run-license-source-scan.mjs`
- `scripts/run-osv-scanner.mjs`
- `scripts/run-selected-validation.mjs`
- `scripts/run-selected-validation.test.mjs`
- `scripts/run-semgrep-privacy-rules.mjs`
- `scripts/scan-docker-images.mjs`
- `scripts/security-hot-path-rescan.test.mjs`
- `scripts/validate-lockfile-supply-chain.mjs`
- `scripts/validate-lockfile-supply-chain.test.mjs`

## Selector Contract

Final changed-path selection command:

```sh
pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)
```

The selector recommended:

- `pnpm ci:local`
- `pnpm deps:audit`
- `pnpm deps:licenses`
- `pnpm deps:supply-chain`
- `pnpm deps:osv`
- `pnpm license:scan`
- `pnpm security:review`
- `pnpm security:secrets-history`
- `pnpm security:privacy-rules`
- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm docker:lint`
- `pnpm docker:residual-watch`
- `pnpm docker:app-smoke`
- `pnpm docker:scan`
- `pnpm e2e:host`
- `pnpm e2e:docker`
- `node scripts/run-e2e.mjs first-run`
- `pnpm e2e:matterless`
- `pnpm e2e:client-portal`
- `pnpm e2e:a11y`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm migrations:lint`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/providers typecheck`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Final Validation

| Command                                                                                                                                                                                                                                                                                                     | Result                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                                                                                                                                                                                            | Passed after adding the dev-only accessibility dependency and provider dependency updates.                                                                      |
| `node --test scripts/check-toolchain.test.mjs scripts/check-env-surface.test.mjs scripts/create-dependency-review.test.mjs scripts/select-validation.test.mjs scripts/report-dependency-licenses.test.mjs scripts/scan-tracked-secrets.test.mjs`                                                            | Passed: 27 focused script tests across 6 files.                                                                                                                 |
| `pnpm deps:review`                                                                                                                                                                                                                                                                                          | Passed; wrote `/Users/bryan/projects/open-practice-local-tooling-ratchets/.tmp/open-practice-dependency-review/2026-06-19T02-44-57Z`.                           |
| `pnpm deps:audit`                                                                                                                                                                                                                                                                                           | Passed: no known prod/dev vulnerabilities after updating `nodemailer` to `9.0.1` and forcing one workspace override.                                            |
| `pnpm deps:licenses`                                                                                                                                                                                                                                                                                        | Passed; the new `@axe-core/playwright`/`axe-core` MPL-2.0 entries are surfaced in the review-required license group as local evidence.                          |
| `pnpm format:check`                                                                                                                                                                                                                                                                                         | Passed.                                                                                                                                                         |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                           | Passed.                                                                                                                                                         |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                         | Passed, including toolchain/env checks, dependency metadata, docs, proof index, OSS reuse, secrets, deadcode, local Docker evidence ignore, and boundary gates. |
| `pnpm test`                                                                                                                                                                                                                                                                                                 | Passed.                                                                                                                                                         |
| Selected package tests/typecheck/build                                                                                                                                                                                                                                                                      | Covered by `pnpm test`, `pnpm ci:local`, and `pnpm build`.                                                                                                      |
| `pnpm e2e:a11y`                                                                                                                                                                                                                                                                                             | Passed: 2 Chromium accessibility tests over synthetic host pages.                                                                                               |
| `pnpm ci:local`                                                                                                                                                                                                                                                                                             | Passed: format, lint, typecheck, tests, database check, policy, build, and `git diff --check`.                                                                  |
| `pnpm e2e:host`                                                                                                                                                                                                                                                                                             | Passed after installing missing local Firefox/WebKit browsers with `pnpm exec playwright install firefox webkit`: 35 tests.                                     |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                                                        | Passed: 1 test.                                                                                                                                                 |
| `pnpm e2e:matterless`                                                                                                                                                                                                                                                                                       | Passed: 1 test.                                                                                                                                                 |
| `pnpm e2e:client-portal`                                                                                                                                                                                                                                                                                    | Passed: 2 tests.                                                                                                                                                |
| `pnpm docker:residual-watch`                                                                                                                                                                                                                                                                                | Passed; wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-19T02-37-41Z`.                                                             |
| `pnpm docker:app-smoke`                                                                                                                                                                                                                                                                                     | Passed with PostgreSQL-backed API health and web response checks.                                                                                               |
| `OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT=35433 OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT=36380 OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT=39002 OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT=39003 OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT=31026 OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT=38026 pnpm e2e:docker` | Passed: 3 Docker Chromium tests. The alternate ports avoided the unrelated existing local dev-stack Redis bind.                                                 |

## Notes

- The first `pnpm deps:audit` run found the existing Nodemailer advisory through direct and
  transitive provider dependencies. The final dependency update pins `nodemailer` to `9.0.1` and the
  rerun passed.
- The first `pnpm e2e:a11y` run found a serious axe violation for a scrollable timeline region
  without keyboard focusability. The final UI tweak adds a label and focus target, and the rerun
  passed.
- The first `pnpm e2e:host` run found missing local Firefox/WebKit browser binaries. After
  `pnpm exec playwright install firefox webkit`, the host suite passed.
- The first Docker E2E attempt conflicted with an unrelated existing `open-practice-dev` Redis port.
  The final harness honors Docker compose port override variables, and the rerun passed on alternate
  loopback ports without stopping the unrelated stack.
- Skipped checks: none.

The expanded tooling wrappers are intentionally local-only. Optional wrappers report skipped or
review-required artifacts when their external binary, local artifact, image, key, or service is not
available instead of publishing results or widening repository settings.

## Expanded Plan Validation Refresh

After the full local-tooling plan landed, the selector was rerun against the exact live dirty union:

```sh
pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)
```

The refreshed selector passed and recommended the expanded command set above.

Additional validation:

| Command                                                                                                                                                                                                                                                                                                     | Result                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node --test scripts/*.test.mjs`                                                                                                                                                                                                                                                                            | Passed: 96 script tests.                                                                                                                                                                                                                                                                                     |
| `pnpm verify:run -- --dry-run --files scripts/run-selected-validation.mjs scripts/select-validation.mjs`                                                                                                                                                                                                    | Passed; wrote `.tmp/validation-runs/2026-06-19T04-06-53Z`.                                                                                                                                                                                                                                                   |
| `pnpm ci:local`                                                                                                                                                                                                                                                                                             | Passed after adding `cosign` to `knip.jsonc` as an ignored optional external binary; type-aware ESLint rules produced warnings only, no errors.                                                                                                                                                              |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                         | Passed, including tracked-secret scan, package manifest policy, lockfile supply-chain policy, toolchain/env checks, architecture import check, dead-code, migration parity/lint, OSS reuse, docs, proof index, local-evidence, and boundary gates.                                                           |
| `pnpm deps:audit`                                                                                                                                                                                                                                                                                           | Passed: no known production or development vulnerabilities.                                                                                                                                                                                                                                                  |
| `pnpm deps:licenses`                                                                                                                                                                                                                                                                                        | Passed: 564 packages and 590 package versions reported; review-required groups surfaced for local evidence.                                                                                                                                                                                                  |
| `pnpm architecture:check`                                                                                                                                                                                                                                                                                   | Passed: 430 workspace import edges reviewed.                                                                                                                                                                                                                                                                 |
| `pnpm api:contract`                                                                                                                                                                                                                                                                                         | Passed; wrote `.tmp/api-contract/openapi.json` with 306 paths.                                                                                                                                                                                                                                               |
| `pnpm deps:supply-chain`                                                                                                                                                                                                                                                                                    | Passed: 5 native-build approval entries reviewed.                                                                                                                                                                                                                                                            |
| `pnpm migrations:lint`                                                                                                                                                                                                                                                                                      | Passed: 0 changed SQL migration files reviewed.                                                                                                                                                                                                                                                              |
| Optional wrappers                                                                                                                                                                                                                                                                                           | `security:secrets-history` ran and produced a review-required Gitleaks artifact with 11 redacted findings; `security:privacy-rules`, `deps:osv`, `license:scan`, `docker:lint`, `docker:scan`, and `release:attest` skipped cleanly because their local binaries, images, artifact, or key were unavailable. |
| `pnpm security:review`                                                                                                                                                                                                                                                                                      | Passed; wrote `.tmp/open-practice-security-review/2026-06-19T03-56-48Z` with 16 commands: 10 required and 6 optional.                                                                                                                                                                                        |
| `pnpm e2e:a11y`                                                                                                                                                                                                                                                                                             | Passed: 2 Chromium accessibility tests.                                                                                                                                                                                                                                                                      |
| `pnpm e2e:host`                                                                                                                                                                                                                                                                                             | Passed: 35 host browser tests.                                                                                                                                                                                                                                                                               |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                                                        | Passed on sequential retry: 1 first-run browser test.                                                                                                                                                                                                                                                        |
| `pnpm e2e:matterless`                                                                                                                                                                                                                                                                                       | Passed on sequential retry: 1 matterless browser test.                                                                                                                                                                                                                                                       |
| `pnpm e2e:client-portal`                                                                                                                                                                                                                                                                                    | Passed: 2 client-portal browser tests.                                                                                                                                                                                                                                                                       |
| `pnpm docker:app-smoke`                                                                                                                                                                                                                                                                                     | Passed with PostgreSQL-backed API health and web response checks in a disposable Compose project.                                                                                                                                                                                                            |
| `OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT=35433 OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT=36380 OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT=39002 OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT=39003 OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT=31026 OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT=38026 pnpm e2e:docker` | Passed: 3 Docker Chromium tests on alternate loopback ports.                                                                                                                                                                                                                                                 |

The first attempted `node scripts/run-e2e.mjs first-run` plus `pnpm e2e:matterless` run was started
in parallel with `pnpm e2e:client-portal` and hit a local Next dev server collision. Those two stale
sessions were stopped and both lanes passed when rerun sequentially.
