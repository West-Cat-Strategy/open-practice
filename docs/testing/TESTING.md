# Testing Guide

Use this file to choose validation commands. Prefer the full local gate for cross-package changes,
API contracts, database schema changes, auth changes, or release handoff.

## Default Commands

| Need                   | Command                                          | Notes                                                                                                                       |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Full local gate        | `pnpm ci:local`                                  | Runs the full local verification lane and `git diff --check`.                                                               |
| Release readiness      | `pnpm release:local`                             | Creates a local release proof artifact with dependency audit, license, SBOM, full local gate, and diff whitespace evidence. |
| Dependency audit       | `pnpm deps:audit`                                | Runs local production and development dependency audits.                                                                    |
| License evidence       | `pnpm deps:licenses`                             | Summarizes dependency license groups and fails only on unknown or unlicensed groups.                                        |
| Selective validation   | `pnpm verify:select -- --base <git-ref>`         | Prints recommended commands for changed files without running them.                                                         |
| Dirty-tree selection   | `pnpm verify:select -- --dirty`                  | Prints recommended commands for staged, unstaged, and untracked working-tree files.                                         |
| Formatting             | `pnpm format:check`                              | Required before handoff.                                                                                                    |
| Static lint            | `pnpm lint`                                      | Runs Turbo package lint tasks.                                                                                              |
| Type checking          | `pnpm typecheck`                                 | Runs Turbo package type checks.                                                                                             |
| Tests                  | `pnpm test`                                      | Runs package test suites.                                                                                                   |
| Database schema check  | `pnpm --filter @open-practice/database db:check` | Required for schema or migration changes.                                                                                   |
| Policy and docs checks | `pnpm policy:check`                              | Runs tracked-secret, package manifest, OSS reuse, docs link, and architecture-boundary policy checks.                       |
| Build                  | `pnpm build`                                     | Required for release or app shell changes.                                                                                  |

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

| Changed path                                     | Recommended commands                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/**`                                    | `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`, `pnpm policy:check`                                                                                                            |
| `apps/worker/**`                                 | `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/worker typecheck`, `pnpm --filter @open-practice/worker build`, `pnpm policy:check`                                                         |
| `packages/domain/**`                             | `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`; source files also add API, providers, and worker tests                                                                   |
| `packages/database/**` or any `migrations/` path | `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`, `pnpm --filter @open-practice/database typecheck`, `pnpm --filter @open-practice/api test`                            |
| `packages/providers/**`                          | `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/providers typecheck`, `pnpm --filter @open-practice/providers build`, `pnpm --filter @open-practice/api test`, worker test and typecheck |
| `apps/web/**`                                    | `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, `pnpm build`                                                                                                                   |
| `docs/**`                                        | `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`                                                                                                                                                           |
| `scripts/**`                                     | `pnpm policy:check`, `pnpm test`                                                                                                                                                                                      |
| Root config, local gate, Turbo, TS config        | `pnpm ci:local`                                                                                                                                                                                                       |
| Package manifests or lockfile                    | `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`                                                                                                                                                              |

Output is deterministic, de-duplicated, and one command per line after a short header.

`pnpm policy:check` includes `scripts/validate-package-manifests.mjs`, which blocks dependency,
development dependency, optional dependency, or peer dependency ranges set to `latest` in repo
package manifests. Use pinned or semver-bounded ranges so local validation stays repeatable.
Use `pnpm deps:licenses` when adding or upgrading dependencies to keep a reviewable license-group
summary. The command highlights copyleft, public-license, and unusual groups for review but only
fails the local run when a dependency reports an unknown, unlicensed, or empty license group.

## Test Coverage Ratchets

`pnpm policy:check` includes `scripts/validate-open-practice-boundaries.mjs`. That gate now treats
route ownership and route test coverage as one contract:

- Every API route registrar imported by `apps/api/src/server.ts` must be represented in the
  boundary registry.
- Every represented API route family must keep at least one route test file, either a direct
  `apps/api/src/routes/*.test.ts` file or the current `apps/api/src/server.test.ts` integration
  coverage for setup, session, and matter bootstrap flows.
- New route families should add or update the route test before the boundary registry is expanded.

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

## Change-Type Guidance

- API route, auth, permission, or lifecycle changes: run API tests, typecheck, policy checks, and `pnpm ci:local` before handoff.
- Domain invariants, trust/funds, conflicts, signatures, or billing rules: run the owning package tests plus API tests if routes expose the behavior.
- Database schema or repository behavior: run database tests, `db:check`, API tests, and the full verification lane.
- Web dashboard, route catalog, or UI state changes: run web tests and typecheck; use `pnpm build` for Next app integration proof.
- Documentation-only changes: run `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.

## Current Gaps

Open Practice does not yet have a Playwright smoke suite, Docker-backed browser matrix, dependency/dead-code review, or disposable database migration replay lane. Add those only after the current policy and docs control plane stays stable.

## Local Release Proof

`pnpm release:local` writes ignored local artifacts under `artifacts/release-local/<timestamp>/`.
Each run records git metadata, command logs, dependency audit status, dependency license evidence, a
CycloneDX SBOM, and the `pnpm ci:local` result. Failed required commands still leave partial proof
behind for diagnosis, and the command exits nonzero when any required release check fails.
