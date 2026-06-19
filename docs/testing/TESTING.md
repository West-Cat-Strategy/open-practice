# Testing Guide

Use this file to choose validation commands. Prefer the full local gate for cross-package changes,
API contracts, database schema changes, auth changes, or release handoff.

## Default Commands

| Need                   | Command                                          | Notes                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full local gate        | `pnpm ci:local`                                  | Runs the full local verification lane and `git diff --check`.                                                                                                                                                         |
| Release readiness      | `pnpm release:local`                             | Creates a local release proof artifact with dependency audit, license JSON, SBOM, full local gate, migration replay, artifact secret scan, and diff whitespace evidence.                                              |
| Release attestation    | `pnpm release:attest`                            | Optional local Cosign wrapper for signing a specific local release artifact with `--artifact` and `--key`; skips without a local key/artifact and does not upload to a transparency log by default.                   |
| Security review        | `pnpm security:review`                           | Writes a full local security review packet with selector, tracked-secret JSON, audit, license, SBOM, policy, hot-path, Docker residual, and artifact-scan evidence.                                                   |
| Secrets history scan   | `pnpm security:secrets-history`                  | Runs optional local Gitleaks history/diff scanning when installed. Findings are review artifacts, not automatic publication blockers.                                                                                 |
| Privacy rule scan      | `pnpm security:privacy-rules`                    | Runs optional local Semgrep rules for Open Practice private-payload metadata patterns when Semgrep is installed.                                                                                                      |
| Dependency audit       | `pnpm deps:audit`                                | Runs local production and development dependency audits.                                                                                                                                                              |
| License evidence       | `pnpm deps:licenses`                             | Summarizes dependency license groups and fails only on unknown or unlicensed groups. Use `-- --json-output <path>` for package-level JSON evidence.                                                                   |
| Source license scan    | `pnpm license:scan`                              | Runs optional local ScanCode source/license scanning when installed, excluding ignored reference and dependency folders.                                                                                              |
| Dependency review      | `pnpm deps:review`                               | Writes a non-gating local dependency review artifact under `.tmp/open-practice-dependency-review/<timestamp>/` with outdated, audit, license, package-manager, and lockfile evidence.                                 |
| Supply-chain policy    | `pnpm deps:supply-chain`                         | Checks the pnpm lockfile for non-registry dependency refs, registry drift, missing integrity, and native-build approval drift.                                                                                        |
| OSV advisory scan      | `pnpm deps:osv`                                  | Runs optional local OSV lockfile scanning when `osv-scanner` is installed.                                                                                                                                            |
| Dead-code gate         | `pnpm deadcode:check`                            | Runs Knip against unused files, dependencies, unlisted dependencies, unresolved imports, and binaries.                                                                                                                |
| Toolchain policy       | `pnpm toolchain:check`                           | Verifies local Node.js is at least 24 and the installed pnpm version matches `package.json` plus the Dockerfile build argument.                                                                                       |
| Env surface policy     | `pnpm env:check`                                 | Compares runtime environment names against `.env.example` plus the repo-owned allowlist in `scripts/check-env-surface.mjs`.                                                                                           |
| Selective validation   | `pnpm verify:select -- --base <git-ref>`         | Prints recommended commands for changed files without running them.                                                                                                                                                   |
| Selected validation    | `pnpm verify:run -- --files <paths...>`          | Runs selector-chosen commands and writes ignored command logs under `.tmp/validation-runs/<timestamp>/`.                                                                                                              |
| Final-path selection   | `pnpm verify:select -- --base-plus-dirty <ref>`  | Prints one deterministic command set for a branch diff plus staged, unstaged, and untracked files.                                                                                                                    |
| Dirty-tree selection   | `pnpm verify:select -- --dirty`                  | Prints recommended commands for staged, unstaged, and untracked working-tree files.                                                                                                                                   |
| Proof reconciliation   | `pnpm proof:reconcile -- --proof <path> ...`     | Checks proof-note final paths, selector output, selected commands, skipped-check reasons, and synthetic/privacy wording against a selector input mode.                                                                |
| API contract inventory | `pnpm api:contract`                              | Generates an ignored OpenAPI route/auth inventory from the route authorization manifest under `.tmp/api-contract/openapi.json`.                                                                                       |
| Architecture check     | `pnpm architecture:check`                        | Checks workspace import direction against the repository guide. Use `pnpm architecture:graph` for an ignored DOT graph artifact.                                                                                      |
| Formatting             | `pnpm format:check`                              | Required before handoff.                                                                                                                                                                                              |
| Static lint            | `pnpm lint`                                      | Runs Turbo package lint tasks.                                                                                                                                                                                        |
| Type checking          | `pnpm typecheck`                                 | Runs Turbo package type checks.                                                                                                                                                                                       |
| Tests                  | `pnpm test`                                      | Runs package test suites.                                                                                                                                                                                             |
| Host browser E2E       | `pnpm e2e:host`                                  | Runs Playwright against a synthetic memory-backed API plus Next.js web runtime across Chromium desktop/mobile, Firefox, and WebKit.                                                                                   |
| Docker browser E2E     | `pnpm e2e:docker`                                | Runs Playwright against a disposable PostgreSQL-backed runtime with Redis, MinIO, and Mailpit infrastructure.                                                                                                         |
| Matterless browser E2E | `pnpm e2e:matterless`                            | Runs the dedicated Chromium matterless-auth coverage against the host memory runtime.                                                                                                                                 |
| Client portal E2E      | `pnpm e2e:client-portal`                         | Runs the dedicated Chromium client-portal auth coverage against the host memory runtime.                                                                                                                              |
| Accessibility E2E      | `pnpm e2e:a11y`                                  | Runs the dedicated Chromium rendered accessibility lane with axe against synthetic staff and public-token pages.                                                                                                      |
| Docker app image smoke | `pnpm docker:app-smoke`                          | Pulls Redis, builds wrapped local service images plus API/Web/Worker images, starts the local Compose stack, migrates the default Compose database, checks API/web readiness, and supports app-image footprint proof. |
| Docker static lint     | `pnpm docker:lint`                               | Runs optional local Hadolint and Checkov checks when installed; skips with local evidence when missing.                                                                                                               |
| Docker image scan      | `pnpm docker:scan`                               | Runs optional local Trivy image scanning when installed; pair with `pnpm docker:app-smoke` so app images exist.                                                                                                       |
| Self-host Compose gate | `pnpm selfhost:check -- --env-file <path>`       | Validates self-host env values and rendered `docker-compose.selfhost.yml` posture without starting the stack.                                                                                                         |
| Database schema check  | `pnpm --filter @open-practice/database db:check` | Required for schema or migration changes.                                                                                                                                                                             |
| Migration parity       | `pnpm migrations:check`                          | Verifies SQL migration files and Drizzle journal entries stay in lockstep.                                                                                                                                            |
| Migration lint         | `pnpm migrations:lint`                           | Checks changed SQL migrations for destructive or lock-prone review-required patterns.                                                                                                                                 |
| Migration replay       | `pnpm migrations:replay`                         | Applies migrations to a disposable local PostgreSQL database and cleans it up.                                                                                                                                        |
| Policy and docs checks | `pnpm policy:check`                              | Runs tracked-secret, package manifest, dead-code, migration parity, OSS reuse, docs link, validation-proof index, local-evidence, and architecture-boundary policy checks.                                            |
| Build                  | `pnpm build`                                     | Required for release or app shell changes.                                                                                                                                                                            |

## Selective Validation

Use `verify:select` to inspect a change set and print recommended commands. The selector is read-only: it never runs the commands it prints.

Compare a branch or commit against `HEAD`:

```bash
pnpm verify:select -- --base main
```

Inspect an explicit path list:

```bash
pnpm verify:select -- --files apps/api/src/server.ts docs/testing/TESTING.md
```

Inspect the current dirty working tree, including staged, unstaged, and untracked files:

```bash
pnpm verify:select -- --dirty
```

Inspect the final handoff path set for an integration branch with both committed and local dirty
work:

```bash
pnpm verify:select -- --base-plus-dirty origin/main
```

After writing a proof note, reconcile it against the same path mode before handoff:

```bash
pnpm proof:reconcile -- --proof docs/validation/EXAMPLE_PROOF.md --base-plus-dirty origin/main
```

Add `--strict` to any selector mode when you want unmapped paths to fail instead of printing no
commands for those paths:

```bash
pnpm verify:select -- --strict --files README.md
```

Selection rules:

| Changed path                                     | Recommended commands                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/**`                                    | `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`, `pnpm policy:check`                                                                                                                                                                                 |
| `apps/worker/**`                                 | `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/worker typecheck`, `pnpm --filter @open-practice/worker build`, `pnpm policy:check`                                                                                                                              |
| `packages/domain/**`                             | `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/domain build`; source files also add API, providers, and worker tests                                                                                           |
| `packages/database/**` or any `migrations/` path | `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`, `pnpm migrations:lint`, `pnpm --filter @open-practice/database typecheck`, `pnpm --filter @open-practice/database build`, `pnpm --filter @open-practice/api test` |
| `packages/providers/**`                          | `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/providers typecheck`, `pnpm --filter @open-practice/providers build`, `pnpm --filter @open-practice/api test`, worker test and typecheck                                                                      |
| `apps/web/**`                                    | `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, `pnpm build`                                                                                                                                                                                        |
| `e2e/**` or `playwright.config.*`                | `pnpm e2e:host`, `pnpm e2e:docker`, `node scripts/run-e2e.mjs first-run`, `pnpm e2e:matterless`, `pnpm e2e:client-portal`, `pnpm e2e:a11y`                                                                                                                                                 |
| `docs/**`                                        | `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`                                                                                                                                                                                                                                |
| `scripts/**`                                     | `pnpm policy:check`, `pnpm test`                                                                                                                                                                                                                                                           |
| Security review tooling and secret scanners      | `pnpm security:review`, `pnpm security:secrets-history`, `pnpm policy:check`, `pnpm test`                                                                                                                                                                                                  |
| API contract or route auth manifest tooling      | `pnpm api:contract`, `pnpm policy:check`, `pnpm test`                                                                                                                                                                                                                                      |
| Semgrep privacy-rule config                      | `pnpm security:privacy-rules`, `pnpm policy:check`, `pnpm test`                                                                                                                                                                                                                            |
| Top-level maintenance docs/ignore files          | `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`                                                                                                                                                                                                                                |
| Runtime config, Dockerfiles, or Compose          | `pnpm docker:lint`, `pnpm docker:residual-watch`, `pnpm e2e:docker`, `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`, `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm build`; add `pnpm docker:app-smoke` and `pnpm docker:scan` when app images, commands, or Compose runtime behavior change |
| Root config, local gate, Turbo, TS config        | `pnpm ci:local`                                                                                                                                                                                                                                                                            |
| Package manifests or lockfile                    | `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`, `pnpm deps:supply-chain`, `pnpm deps:osv`, `pnpm license:scan`                                                                                                                                                                   |

Output is deterministic, de-duplicated, and one command per line after a short header. Domain source
changes include the domain build before downstream package checks so fresh worktrees hydrate shared
package output before API, provider, worker, or web validation.

`pnpm policy:check` includes `scripts/validate-package-manifests.mjs`, which blocks dependency,
development dependency, optional dependency, or peer dependency ranges set to `latest` in repo
package manifests. Use pinned or semver-bounded ranges so local validation stays repeatable.
It also runs the lockfile supply-chain policy, toolchain check, env-surface check, architecture
import check, dead-code gate, migration parity, migration lint, OSS reuse, docs link,
validation-proof index, local-evidence `.dockerignore`, and architecture-boundary checks; keep
command-specific proof in the relevant validation note when one of those subchecks drives a change.
Use `pnpm deps:licenses` when adding or upgrading dependencies to keep a reviewable license-group
summary. The command highlights copyleft, public-license, and unusual groups for review but only
fails the local run when a dependency reports an unknown, unlicensed, or empty license group. Use
`node scripts/report-dependency-licenses.mjs --json` or `pnpm deps:licenses -- --json-output <path>`
for package-level evidence.
Use `pnpm deps:review` when a dependency change needs a durable local review packet before a release
or handoff. The artifact is ignored and intentionally non-gating; audit and outdated results are
captured with command statuses for review.
Use `pnpm security:review` when local security tooling, tracked-secret scanning, or the hot-path
rescan helper changes. The artifact is ignored local evidence and intentionally runs every required
command before reporting pass/fail. Optional Gitleaks, Semgrep, OSV, ScanCode, Hadolint, Checkov,
Trivy, and Cosign lanes report skipped or review-required local artifacts when the corresponding
binary, image, artifact, or key is unavailable.

## Test Coverage Ratchets

`pnpm policy:check` includes `scripts/validate-open-practice-boundaries.mjs`. That gate now treats
route ownership, route test coverage, and workspace package boundaries as one contract:

- Every API route registrar imported by `apps/api/src/server.ts` must be represented in the
  boundary registry.
- Every represented API route family must keep at least one route test file, either a direct
  `apps/api/src/routes/*.test.ts` file or the current `apps/api/src/server.test.ts` integration
  coverage for setup, session, and matter bootstrap flows.
- New route families should add or update the route test before the boundary registry is expanded.
- Route submodules that declare `server.get/post/put/patch/delete/route` calls must be listed in
  the parent registrar's boundary `routeFiles` entry so authorization manifest coverage still sees
  them.
- App code must import workspace packages through `@open-practice/*` package exports instead of
  `packages/*/src` source paths.
- Workspace import direction follows the package graph in
  [Repository Guide](../development/repo-guide.md): domain imports nothing; database/providers may
  import domain; API/worker may import domain, database, and providers; web may import browser-safe
  domain exports only.
- `@open-practice/domain`, `@open-practice/database`, and `@open-practice/providers` must keep
  `main`, `types`, and `exports["."]` aligned with their built root entrypoints.
- Existing web root imports from `@open-practice/domain` are ratcheted. Add web-safe subpaths before
  increasing broad browser-facing domain imports.

When route ownership changes, update the route source, the route test, and
`scripts/validate-open-practice-boundaries.mjs` together. Use `pnpm verify:select -- --files` with
all changed paths before picking the final proof commands.

## Package-Scoped Commands

Use these for focused work before the full lane:

```bash
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/providers test
```

Package-level type checks are also available:

```bash
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/worker typecheck
```

## Browser E2E

Use the committed Playwright lanes for browser-rendered workflow proof:

```bash
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm docker:app-smoke
```

`pnpm e2e`, `pnpm playwright`, and `pnpm e2e:host` all run the fast host suite. The host suite starts
a synthetic in-memory API and the Next.js web app on isolated local ports, then covers dashboard
smoke/navigation, secure-share verification, public intake draft/incomplete behavior, and hosted
guest-session check-in/admission states across the committed host browser projects. It excludes
specialized auth-context and Chromium-only dense-breakpoint variants through Playwright project
routing so those variants remain runnable without appearing as normal host-suite skips.

`pnpm e2e:docker` starts Compose infrastructure for PostgreSQL, Redis, MinIO, and Mailpit, creates a
disposable e2e database, runs migrations, prepares the MinIO bucket, starts host API/web/worker
processes against those services, and cleans up the disposable database after Playwright exits. Use
this tier for external upload, object-storage, queue, and release-readiness browser proof. If Docker
or a required local port is unavailable, report the skipped Docker check with the blocker.

`node scripts/run-e2e.mjs first-run` starts an unseeded host memory runtime and runs the first-run
setup wizard project. Use it when setup gating, owner bootstrap, optional email configuration, or
review-step behavior changes.

`pnpm e2e:matterless` starts the host memory runtime with `DEV_AUTH_FIRM_ID=firm-matterless-e2e` and
`DEV_AUTH_USER_ID=user-matterless-admin`, then runs the `matterless-chromium` project. Use it for
matterless dashboard routing and first-matter fallback coverage.

`pnpm e2e:client-portal` starts the host memory runtime with
`DEV_AUTH_USER_ID=user-client-external`, then runs the `client-portal-chromium` project. Use it for
client-portal workspace, redaction, and private-field leakage coverage.

`pnpm e2e:a11y` starts the host memory runtime with synthetic data, then runs the `a11y-chromium`
project. It uses `@axe-core/playwright` to scan selected staff dashboard and public-token pages for
serious or critical WCAG 2.x violations. Use it when page structure, navigation, public-token flows,
or Playwright tooling changes. If Chromium is not installed, run `pnpm exec playwright install
chromium` and retry.

`pnpm docker:app-smoke` proves the built API, Web, and Worker images directly. By default it uses a
disposable Compose project, alternate loopback ports, and disposable volumes so it does not disturb a
running dev stack. Add `-- --refresh` when the proof needs pinned Redis pulls and `--pull` image
rebuilds. Use `pnpm docker:app-smoke -- --keep-up` to validate and leave the default dev stack
running on web `33000` and API `34000`. For footprint work, pair the smoke result with
`docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker --format '{{.RepoTags}} {{.Size}}'`
so the proof records before/after API, Web, and Worker image sizes.

`pnpm selfhost:check -- --env-file <path>` validates the focused self-host profile before startup.
Use `-- --env-file docker/selfhost.example.env --allow-synthetic-example` only for the checked-in
synthetic render proof; real deployments must use an ignored env file with unique secrets and HTTPS
origins.

## Change-Type Guidance

- API route, auth, permission, or lifecycle changes: run API tests, typecheck,
  `pnpm api:contract`, policy checks, and `pnpm ci:local` before handoff.
- Domain invariants, trust/funds, conflicts, signatures, or billing rules: run the owning package tests plus API tests if routes expose the behavior.
- Database schema or repository behavior: run database tests, `db:check`,
  `pnpm migrations:check`, `pnpm migrations:lint`, API tests, and the full verification lane.
- Web dashboard, route catalog, or UI state changes: run web tests and typecheck; use `pnpm build` for Next app integration proof, and `pnpm e2e:host` when rendered browser behavior changes.
- External upload, public-token, object-storage, or release browser proof: run `pnpm e2e:docker` when Docker is available.
- Dockerfile, Compose, or app-image runtime changes: run selector first, record the exact final path
  set, then include `pnpm docker:lint`, `pnpm docker:residual-watch`,
  `pnpm docker:app-smoke`, `pnpm e2e:docker`, app-image size evidence, and the selected static
  checks. Add `pnpm docker:scan` when Trivy and the app images are available. When self-hosting
  changes are included, add `pnpm selfhost:check` with the synthetic env example. If implementation
  files are still pending, keep proof rows marked as pending rather than claiming final validation.
- Documentation-only changes: run `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.

## Current Gaps

Dead-code file/dependency review now runs through `pnpm deadcode:check` and `pnpm policy:check`.
Knip is scoped to unused files, dependencies, unlisted dependencies, unresolved imports, and
binaries; public export/facade cleanup remains a manual review lane because repository facades and
API response types intentionally expose broad compatibility surfaces. Toolchain alignment, env
surface drift, package graph, lockfile supply-chain policy, migration parity, migration lint, and
export consistency are covered by `pnpm policy:check`. Optional local scanners for Semgrep,
Gitleaks, OSV, ScanCode, Hadolint, Checkov, Trivy, and Cosign skip with evidence when the binary,
artifact, image, key, or local service is unavailable. The disposable migration replay lane exists,
but it requires a local PostgreSQL service reachable through `DATABASE_URL` or
`MIGRATION_REPLAY_DATABASE_URL`.

## Local Release Proof

`pnpm release:local` writes ignored local artifacts under `artifacts/release-local/<timestamp>/`.
Each run records git metadata, command logs, dependency audit status, dependency license JSON, a
CycloneDX SBOM, migration replay, a high-confidence secret scan over the generated artifact
directory, and the `pnpm ci:local` result. Failed required commands still leave partial proof behind
for diagnosis, and the command exits nonzero when any required release check fails.

## Local Security Review

`pnpm security:review` writes ignored local artifacts under
`.tmp/open-practice-security-review/<timestamp>/`. Each run records git metadata, the dirty-tree
selector, high-confidence tracked-secret JSON, dependency audit, license JSON, CycloneDX SBOM,
policy check, the existing hot-path rescan helper, Docker residual watch, optional local scanner
wrappers, and a final secret scan over the generated artifact. The helper keeps running after failed
required commands so the packet is diagnostic, then exits nonzero if any required command failed.
Optional scanner findings are local review artifacts until a maintainer promotes them into a
tracked fix. It is local evidence only and does not replace a formal Codex Security repository-wide
scan.
