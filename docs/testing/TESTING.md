# Testing Guide

Use this file to choose validation commands. Prefer the full local CI lane for cross-package changes, API contracts, database schema changes, auth changes, or release handoff.

## Default Commands

| Need                   | Command                                          | Notes                                                                |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Full local CI parity   | `pnpm verify`                                    | Mirrors the GitHub Actions verify job.                               |
| Selective validation   | `pnpm verify:select -- --base <git-ref>`         | Prints recommended commands for changed files without running them.  |
| Formatting             | `pnpm format:check`                              | Required before handoff.                                             |
| Static lint            | `pnpm lint`                                      | Runs Turbo package lint tasks.                                       |
| Type checking          | `pnpm typecheck`                                 | Runs Turbo package type checks.                                      |
| Tests                  | `pnpm test`                                      | Runs package test suites.                                            |
| Database schema check  | `pnpm --filter @open-practice/database db:check` | Required for schema or migration changes.                            |
| Policy and docs checks | `pnpm policy:check`                              | Runs OSS reuse, docs links, and architecture-boundary policy checks. |
| Build                  | `pnpm build`                                     | Required for release or app shell changes.                           |

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

Selection rules:

| Changed path                                         | Recommended commands                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/**`                                        | `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`, `pnpm policy:check`                                                                                 |
| `packages/domain/**`                                 | `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`; source files also add API tests                                                               |
| `packages/database/**` or any `migrations/` path     | `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`, `pnpm --filter @open-practice/database typecheck`, `pnpm --filter @open-practice/api test` |
| `apps/web/**`                                        | `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, `pnpm build`                                                                                        |
| `docs/**`                                            | `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`                                                                                                                                |
| `scripts/**`                                         | `pnpm policy:check`, `pnpm test`                                                                                                                                                           |
| Root config, lockfile, CI, package, Turbo, TS config | `pnpm verify`                                                                                                                                                                              |

Output is deterministic, de-duplicated, and one command per line after a short header.

## Package-Scoped Commands

Use these for focused work before the full lane:

```bash
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/web test
```

Package-level type checks are also available:

```bash
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/providers typecheck
```

## Change-Type Guidance

- API route, auth, permission, or lifecycle changes: run API tests, typecheck, policy checks, and `pnpm verify` before handoff.
- Domain invariants, trust/funds, conflicts, signatures, or billing rules: run the owning package tests plus API tests if routes expose the behavior.
- Database schema or repository behavior: run database tests, `db:check`, API tests, and the full verification lane.
- Web dashboard, route catalog, or UI state changes: run web tests and typecheck; use `pnpm build` for Next app integration proof.
- Documentation-only changes: run `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.

## Current Gaps

Open Practice does not yet have a Playwright smoke suite, Docker-backed browser matrix, dependency/dead-code review, or disposable database migration replay lane. Add those only after the current policy and docs control plane stays stable.
