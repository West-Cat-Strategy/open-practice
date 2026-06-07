# Testing Guide

Use this file to choose validation commands. Prefer the full local gate for cross-package changes,
API contracts, database schema changes, auth changes, or release handoff.

## Default Commands

| Need                   | Command                                          | Notes                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full local gate        | `pnpm ci:local`                                  | Runs the full local verification lane and `git diff --check`.                                                                                                            |
| Release readiness      | `pnpm release:local`                             | Creates a local release proof artifact with dependency audit, license JSON, SBOM, full local gate, migration replay, artifact secret scan, and diff whitespace evidence. |
| Dependency audit       | `pnpm deps:audit`                                | Runs local production and development dependency audits.                                                                                                                 |
| License evidence       | `pnpm deps:licenses`                             | Summarizes dependency license groups and fails only on unknown or unlicensed groups. Use `-- --json-output <path>` for package-level JSON evidence.                      |
| Selective validation   | `pnpm verify:select -- --base <git-ref>`         | Prints recommended commands for changed files without running them.                                                                                                      |
| Dirty-tree selection   | `pnpm verify:select -- --dirty`                  | Prints recommended commands for staged, unstaged, and untracked working-tree files.                                                                                      |
| Formatting             | `pnpm format:check`                              | Required before handoff.                                                                                                                                                 |
| Static lint            | `pnpm lint`                                      | Runs Turbo package lint tasks.                                                                                                                                           |
| Type checking          | `pnpm typecheck`                                 | Runs Turbo package type checks.                                                                                                                                          |
| Tests                  | `pnpm test`                                      | Runs package test suites.                                                                                                                                                |
| Host browser E2E       | `pnpm e2e:host`                                  | Runs Playwright against a synthetic memory-backed API plus Next.js web runtime across Chromium desktop/mobile, Firefox, and WebKit.                                      |
| Docker browser E2E     | `pnpm e2e:docker`                                | Runs Playwright against a disposable PostgreSQL-backed runtime with Redis, MinIO, and Mailpit infrastructure.                                                            |
| Database schema check  | `pnpm --filter @open-practice/database db:check` | Required for schema or migration changes.                                                                                                                                |
| Migration parity       | `pnpm migrations:check`                          | Verifies SQL migration files and Drizzle journal entries stay in lockstep.                                                                                               |
| Migration replay       | `pnpm migrations:replay`                         | Applies migrations to a disposable local PostgreSQL database and cleans it up.                                                                                           |
| Policy and docs checks | `pnpm policy:check`                              | Runs tracked-secret, package manifest, OSS reuse, docs link, and architecture-boundary policy checks.                                                                    |
| Build                  | `pnpm build`                                     | Required for release or app shell changes.                                                                                                                               |

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

Add `--strict` to any selector mode when you want unmapped paths to fail instead of printing no
commands for those paths:

```bash
pnpm verify:select -- --strict --files README.md
```

Selection rules:

| Changed path                                     | Recommended commands                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/**`                                    | `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`, `pnpm policy:check`                                                                                                                                                         |
| `apps/worker/**`                                 | `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/worker typecheck`, `pnpm --filter @open-practice/worker build`, `pnpm policy:check`                                                                                                      |
| `packages/domain/**`                             | `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/domain build`; source files also add API, providers, and worker tests                                                                   |
| `packages/database/**` or any `migrations/` path | `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`, `pnpm --filter @open-practice/database typecheck`, `pnpm --filter @open-practice/database build`, `pnpm --filter @open-practice/api test` |
| `packages/providers/**`                          | `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/providers typecheck`, `pnpm --filter @open-practice/providers build`, `pnpm --filter @open-practice/api test`, worker test and typecheck                                              |
| `apps/web/**`                                    | `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, `pnpm build`                                                                                                                                                                |
| `e2e/**` or `playwright.config.*`                | `pnpm e2e:host`, `pnpm e2e:docker`                                                                                                                                                                                                                                 |
| `docs/**`                                        | `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`                                                                                                                                                                                                        |
| `scripts/**`                                     | `pnpm policy:check`, `pnpm test`                                                                                                                                                                                                                                   |
| Root config, local gate, Turbo, TS config        | `pnpm ci:local`                                                                                                                                                                                                                                                    |
| Package manifests or lockfile                    | `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`                                                                                                                                                                                                           |

Output is deterministic, de-duplicated, and one command per line after a short header.

`pnpm policy:check` includes `scripts/validate-package-manifests.mjs`, which blocks dependency,
development dependency, optional dependency, or peer dependency ranges set to `latest` in repo
package manifests. Use pinned or semver-bounded ranges so local validation stays repeatable.
Use `pnpm deps:licenses` when adding or upgrading dependencies to keep a reviewable license-group
summary. The command highlights copyleft, public-license, and unusual groups for review but only
fails the local run when a dependency reports an unknown, unlicensed, or empty license group. Use
`node scripts/report-dependency-licenses.mjs --json` or `pnpm deps:licenses -- --json-output <path>`
for package-level evidence.

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
```

`pnpm e2e`, `pnpm playwright`, and `pnpm e2e:host` all run the fast host suite. The host suite starts
a synthetic in-memory API and the Next.js web app on isolated local ports, then covers dashboard
smoke/navigation, secure-share verification, public intake draft/incomplete behavior, and hosted
guest-session check-in/admission states.

`pnpm e2e:docker` starts Compose infrastructure for PostgreSQL, Redis, MinIO, and Mailpit, creates a
disposable e2e database, runs migrations, prepares the MinIO bucket, starts host API/web/worker
processes against those services, and cleans up the disposable database after Playwright exits. Use
this tier for external upload, object-storage, queue, and release-readiness browser proof. If Docker
or a required local port is unavailable, report the skipped Docker check with the blocker.

## Change-Type Guidance

- API route, auth, permission, or lifecycle changes: run API tests, typecheck, policy checks, and `pnpm ci:local` before handoff.
- Domain invariants, trust/funds, conflicts, signatures, or billing rules: run the owning package tests plus API tests if routes expose the behavior.
- Database schema or repository behavior: run database tests, `db:check`, `pnpm migrations:check`, API tests, and the full verification lane.
- Web dashboard, route catalog, or UI state changes: run web tests and typecheck; use `pnpm build` for Next app integration proof, and `pnpm e2e:host` when rendered browser behavior changes.
- External upload, public-token, object-storage, or release browser proof: run `pnpm e2e:docker` when Docker is available.
- Documentation-only changes: run `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.

## Current Gaps

Dead-code review is not yet part of the default selector. Package graph and export consistency are
covered by `pnpm policy:check`. The disposable migration replay lane exists, but it requires a local
PostgreSQL service reachable through `DATABASE_URL` or
`MIGRATION_REPLAY_DATABASE_URL`.

## Local Release Proof

`pnpm release:local` writes ignored local artifacts under `artifacts/release-local/<timestamp>/`.
Each run records git metadata, command logs, dependency audit status, dependency license JSON, a
CycloneDX SBOM, migration replay, a high-confidence secret scan over the generated artifact
directory, and the `pnpm ci:local` result. Failed required commands still leave partial proof behind
for diagnosis, and the command exits nonzero when any required release check fails.
