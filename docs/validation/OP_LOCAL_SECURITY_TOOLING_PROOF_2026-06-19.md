# Local Security Tooling Proof

Date: 2026-06-19 PDT

Branch: `chore/local-tooling-ratchets-20260619`

Worktree: `/Users/bryan/projects/open-practice-local-tooling-ratchets`

## Scope

Implemented a local-only security review packet writer stacked on the existing local tooling
ratchets worktree.

- Added `pnpm security:review` through `scripts/create-security-review.mjs`.
- Added optional local wrapper scripts for Gitleaks history/diff scanning, Semgrep privacy rules,
  OSV advisory scanning, ScanCode source/license scanning, Hadolint/Checkov Docker linting, Trivy
  image scanning, and Cosign release-artifact attestation.
- Added `--json-output <path>` to the repo-owned tracked secret scanner without serializing
  matched secret values.
- Updated validation selection so security review tooling, the tracked secret scanner, and the
  hot-path rescan helper select `pnpm security:review`; Semgrep config selects
  `pnpm security:privacy-rules`.
- Documented the local security review packet in testing and GitHub-maintenance docs.
- Kept scanner dependencies external and optional: no npm scanner dependency was added, no external
  SaaS scan was enabled, no GitHub Actions, no Dependabot automation, no CodeQL default setup, no
  remote required checks, and no runtime product/API/schema changes were introduced.

Artifacts remain ignored local evidence only. They contain command statuses, git/package-manager
metadata, lockfile hash, SBOM/license/audit outputs, scanner locations, and synthetic/local
metadata.

## Preserved Local State

The busy root checkout at `/Users/bryan/projects/open-practice` was left untouched with its
unrelated web/dev-stack changes. This work continued in the sibling worktree above.

## Security Slice Path Set

- `docs/development/github-maintenance.md`
- `docs/development/maintenance.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP_LOCAL_SECURITY_TOOLING_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `package.json`
- `scripts/create-security-review.mjs`
- `scripts/create-security-review.test.mjs`
- `scripts/run-gitleaks-history-scan.mjs`
- `scripts/run-semgrep-privacy-rules.mjs`
- `scripts/run-osv-scanner.mjs`
- `scripts/run-license-source-scan.mjs`
- `scripts/lint-docker-config.mjs`
- `scripts/scan-docker-images.mjs`
- `scripts/attest-release-artifacts.mjs`
- `scripts/optional-tooling.mjs`
- `scripts/scan-tracked-secrets.mjs`
- `scripts/scan-tracked-secrets.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`

The final selector is run against the full live dirty union in this stacked worktree because the
local tooling ratchets slice is still present and uncommitted.

## Security Review Packet

`pnpm security:review` writes to `.tmp/open-practice-security-review/<timestamp>/` by default and
runs every command before deciding its final status. It exits nonzero when any required command
fails.

The full packet command order is:

1. `pnpm verify:select -- --dirty`
2. `pnpm security:scan -- --fail-on-skipped --json-output <artifact>/tracked-secret-scan.json`
3. `pnpm security:secrets-history` (optional)
4. `pnpm security:privacy-rules` (optional)
5. `pnpm deps:supply-chain`
6. `pnpm deps:audit`
7. `pnpm deps:osv` (optional)
8. `pnpm deps:licenses -- --json-output <artifact>/dependency-licenses.json`
9. `pnpm license:scan` (optional)
10. `pnpm exec cyclonedx-npm --ignore-npm-errors --output-format JSON --output-file <artifact>/sbom.cdx.json`
11. `pnpm policy:check`
12. `node scripts/security-hot-path-rescan.mjs --artifact-root <artifact>/hot-path-rescan`
13. `pnpm docker:residual-watch`
14. `pnpm docker:lint` (optional)
15. `pnpm docker:scan` (optional)
16. `pnpm security:scan -- --path <artifact> --fail-on-skipped --scan-large-files`

Recorded artifacts:

- Full run:
  `/Users/bryan/projects/open-practice-local-tooling-ratchets/.tmp/open-practice-security-review/2026-06-19T03-56-48Z`
- Full run status: `passed`
- Full run command count: 16 commands, 10 required, 6 optional, 0 failed required.
- Full run lockfile SHA-256:
  `af22c55356cdb25f9270f972189a8c8a0dafc637915308fefb05848589ad9d20`
- Tracked secret scan JSON: `0` findings, `0` skipped files, `tracked_git_files` scope with
  `1031` files
- Hot-path rescan artifact:
  `/Users/bryan/projects/open-practice-local-tooling-ratchets/.tmp/open-practice-security-review/2026-06-19T03-56-48Z/hot-path-rescan/2026-06-19T03-57-02Z`
- Nested Docker residual-watch artifact:
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-19T03-57-42Z`
- Optional wrapper evidence:
  - Gitleaks history scan ran locally and returned `review-required`; 11 redacted findings were
    recorded under `.tmp/security/gitleaks/2026-06-19T03-56-49Z`.
  - Semgrep privacy rules skipped cleanly because Semgrep was not installed locally; evidence under
    `.tmp/security/semgrep-privacy/2026-06-19T03-56-53Z`.
  - OSV skipped cleanly because `osv-scanner` was not installed locally; evidence under
    `.tmp/security/osv/2026-06-19T03-56-54Z`.
  - ScanCode skipped cleanly because `scancode` was not installed locally; evidence under
    `.tmp/license/scancode/2026-06-19T03-56-56Z`.
  - Docker static lint skipped cleanly because Hadolint/Checkov were not installed locally;
    evidence under `.tmp/docker/lint/2026-06-19T03-59-13Z`.
  - Docker image scan skipped cleanly because Trivy was not installed locally; evidence under
    `.tmp/docker/trivy/2026-06-19T03-59-13Z`.

## Final Selector Contract

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
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation

| Command                                                                                                                                                                                                                                                                                                     | Result                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)`                                                                                                                                                                                                                                    | Passed after proof/index edits; selected the full dirty-union command set listed above.                                                          |
| `node --test scripts/*.test.mjs`                                                                                                                                                                                                                                                                            | Passed: 96 script tests, including selector, security packet, architecture, API contract, migration lint, supply-chain, and verify-run coverage. |
| `pnpm verify:run -- --dry-run --files scripts/run-selected-validation.mjs scripts/select-validation.mjs`                                                                                                                                                                                                    | Passed; wrote `.tmp/validation-runs/2026-06-19T04-06-53Z` while keeping `verify:select` read-only.                                               |
| `pnpm security:review`                                                                                                                                                                                                                                                                                      | Passed after proof/index edits; wrote the final 16-command security-review artifact above.                                                       |
| `pnpm security:secrets-history`                                                                                                                                                                                                                                                                             | Completed with `review-required`; wrote the Gitleaks artifact above with 11 redacted findings.                                                   |
| `pnpm security:privacy-rules`                                                                                                                                                                                                                                                                               | Skipped cleanly because Semgrep was unavailable locally; wrote skip evidence under `.tmp/security/semgrep-privacy/`.                             |
| `pnpm deps:supply-chain`                                                                                                                                                                                                                                                                                    | Passed: reviewed lockfile registry, git/file dependency, integrity, and native-build approval policy.                                            |
| `pnpm deps:osv`                                                                                                                                                                                                                                                                                             | Skipped cleanly because `osv-scanner` was unavailable locally; wrote skip evidence under `.tmp/security/osv/`.                                   |
| `pnpm deps:audit`                                                                                                                                                                                                                                                                                           | Passed after proof/index edits: no known production or development vulnerabilities reported.                                                     |
| `pnpm deps:licenses`                                                                                                                                                                                                                                                                                        | Passed after proof/index edits: 564 packages and 590 package versions reported; review groups surfaced for local evidence.                       |
| `pnpm license:scan`                                                                                                                                                                                                                                                                                         | Skipped cleanly because ScanCode was unavailable locally; wrote skip evidence under `.tmp/license/scancode/`.                                    |
| `pnpm architecture:check`                                                                                                                                                                                                                                                                                   | Passed: 430 workspace import edges reviewed.                                                                                                     |
| `pnpm api:contract`                                                                                                                                                                                                                                                                                         | Passed; wrote `.tmp/api-contract/openapi.json` with 306 paths.                                                                                   |
| `pnpm migrations:lint`                                                                                                                                                                                                                                                                                      | Passed: 0 changed SQL migration files reviewed.                                                                                                  |
| `pnpm docker:lint`                                                                                                                                                                                                                                                                                          | Skipped cleanly because Hadolint/Checkov were unavailable locally; wrote skip evidence under `.tmp/docker/lint/`.                                |
| `pnpm docker:scan`                                                                                                                                                                                                                                                                                          | Skipped cleanly because Trivy was unavailable locally; wrote skip evidence under `.tmp/docker/trivy/`.                                           |
| `pnpm release:attest`                                                                                                                                                                                                                                                                                       | Skipped cleanly because no explicit local artifact/key was supplied; no transparency-log publication was attempted.                              |
| `pnpm format:check`                                                                                                                                                                                                                                                                                         | Passed after proof/index edits.                                                                                                                  |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                           | Passed after proof/index edits.                                                                                                                  |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                         | Passed after proof/index edits, including toolchain/env checks, secret scan, proof index, local evidence ignore, and boundary gates.             |
| `pnpm test`                                                                                                                                                                                                                                                                                                 | Passed after proof/index edits, including 81 script tests and the package test graph.                                                            |
| `pnpm ci:local`                                                                                                                                                                                                                                                                                             | Passed after proof/index edits: format, lint, typecheck, tests, database check, policy, build, and `git diff --check`.                           |
| `pnpm e2e:a11y`                                                                                                                                                                                                                                                                                             | Passed: 2 Chromium accessibility tests.                                                                                                          |
| `pnpm e2e:host`                                                                                                                                                                                                                                                                                             | Passed: 35 host Playwright tests.                                                                                                                |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                                                        | Passed: 1 first-run Playwright test; log captured under `.tmp/open-practice-local-security-validation/e2e-first-run.log`.                        |
| `pnpm e2e:matterless`                                                                                                                                                                                                                                                                                       | Passed: 1 matterless Playwright test; log captured under `.tmp/open-practice-local-security-validation/e2e-matterless.log`.                      |
| `pnpm e2e:client-portal`                                                                                                                                                                                                                                                                                    | Passed: 2 client-portal Playwright tests; log captured under `.tmp/open-practice-local-security-validation/e2e-client-portal.log`.               |
| `pnpm docker:residual-watch`                                                                                                                                                                                                                                                                                | Passed; standalone artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-19T03-09-23Z`.                               |
| `pnpm docker:app-smoke`                                                                                                                                                                                                                                                                                     | Passed with PostgreSQL-backed API health and web response checks; log captured under `.tmp/open-practice-local-security-validation/`.            |
| `OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT=35433 OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT=36380 OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT=39002 OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT=39003 OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT=31026 OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT=38026 pnpm e2e:docker` | Passed: 3 Docker Chromium tests, with alternate loopback ports to avoid unrelated local dev-stack port bindings.                                 |

## Skips

Browser, Docker runtime, dependency audit, policy, docs, and test gates were not skipped. Optional
advisory wrappers skipped only when their local scanner binary, image, artifact, or key was absent;
their skip artifacts are recorded above.
