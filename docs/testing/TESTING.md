# Testing Guide

Use this file to choose validation commands. Prefer the full local CI lane for cross-package changes, API contracts, database schema changes, auth changes, or release handoff.

## Default Commands

| Need                   | Command                                          | Notes                                                                |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Full local CI parity   | `pnpm verify`                                    | Mirrors the GitHub Actions verify job.                               |
| Formatting             | `pnpm format:check`                              | Required before handoff.                                             |
| Static lint            | `pnpm lint`                                      | Runs Turbo package lint tasks.                                       |
| Type checking          | `pnpm typecheck`                                 | Runs Turbo package type checks.                                      |
| Tests                  | `pnpm test`                                      | Runs package test suites.                                            |
| Database schema check  | `pnpm --filter @open-practice/database db:check` | Required for schema or migration changes.                            |
| Policy and docs checks | `pnpm policy:check`                              | Runs OSS reuse, docs links, and architecture-boundary policy checks. |
| Build                  | `pnpm build`                                     | Required for release or app shell changes.                           |

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
