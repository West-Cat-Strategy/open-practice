# Private-Pilot MinIO Readiness Blocker Proof

Date: 2026-06-24
Branch: `private-pilot/minio-readiness-blocker-20260624`
Worktree: `/Users/bryan/projects/open-practice-minio-readiness-blocker-20260624`
Base: `main` / `origin/main` at `4e2ab1cf`
Status: Local proof recorded; private-pilot readiness remains held because bundled MinIO
residual-watch evidence reports archived upstream source posture and Critical/High Scout CVEs.

## Scope

This branch turns the bundled MinIO private-pilot watch item into an explicit readiness blocker while
preserving local-only self-hosting boundaries.

- `pnpm docker:residual-watch` now writes `readinessBlockers` and returns
  `readiness-blocked`/exit `2` because bundled MinIO has archived upstream source posture or
  Critical/High Docker Scout findings.
- Docker, Scout, registry, source, or network failures remain ordinary infrastructure/tooling
  failures with exit `1`.
- `pnpm release:local -- --private-pilot` requires `pnpm docker:residual-watch`; default
  `pnpm release:local` is unchanged.
- Admin Readiness shows owner-visible read-only object-storage blocker copy instead of reading local
  scan artifacts.

No MinIO pin, Dockerfile, Compose contract, runtime API, schema, package dependency, copied upstream
source, live-settlement behavior, trust-posting behavior, production email behavior, provider
activation, or private data handling changed.

## Final Path Set

Selector and validation use this final changed-path set:

```text
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md
docs/validation/README.md
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```

## Selector Output

`pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm architecture:check
pnpm docker:residual-watch
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                 | Status                   | Notes                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test scripts/watch-docker-residuals.test.mjs scripts/create-release-proof.test.mjs scripts/select-validation.test.mjs`          | Pass                     | 36 script tests passed, including MinIO Critical/High quickview and dedicated CVE evidence readiness-blocker metadata, archived-source readiness-blocker metadata, private-pilot release proof residual-watch gating, and selector routing.                                                                                                                   |
| `pnpm --filter @open-practice/web test -- --run apps/web/app/dashboard/admin-readiness-section.test.tsx`                                | Blocked                  | Reason: fresh worktree had not built workspace package outputs yet; web Vitest could not resolve `@open-practice/domain` exports. The focused Admin Readiness test was rerun after upstream package build hydration.                                                                                                                                          |
| `pnpm verify:select -- --files <final path set>`                                                                                        | Pass                     | Selector chose architecture, residual-watch, format, docs, policy, full test, web test, web typecheck, and build checks.                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/domain build`                                                                                             | Pass                     | Hydrated fresh-worktree domain package outputs before the focused Admin Readiness rerun.                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/web test -- app/dashboard/admin-readiness-section.test.tsx`                                               | Pass                     | Focused web rerun passed; Vitest reported 41 files and 217 tests.                                                                                                                                                                                                                                                                                             |
| `pnpm docker:residual-watch`                                                                                                            | Pass (expected exit `2`) | The command produced `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T02-08-24Z` with status `readiness-blocked` because MinIO Scout quickview and dedicated CVE evidence reported 11 Critical and 16 High findings, and `minio/minio` source metadata reported archived posture.                                                    |
| `docker compose up -d postgres`                                                                                                         | Pass                     | Started local replay Postgres on the default Compose port and confirmed `open-practice-dev-postgres-1` was healthy on `127.0.0.1:35432`.                                                                                                                                                                                                                      |
| `pnpm migrations:replay`                                                                                                                | Pass                     | 71 migrations replayed into disposable database `open_practice_migration_replay_6508_20260624021907` and cleaned up with `psql`.                                                                                                                                                                                                                              |
| `pnpm release:local -- --private-pilot`                                                                                                 | Pass (expected exit `1`) | Private-pilot propagation verified in `artifacts/release-local/2026-06-24T02-19-17Z`: `migration-replay` passed inside the release artifact, and the only failed required command was `docker-residual-watch` exit `2` because MinIO readiness evidence was recorded in `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T02-19-39Z`. |
| `pnpm architecture:check`                                                                                                               | Pass                     | Selector-chosen check passed with 443 reviewed import edges.                                                                                                                                                                                                                                                                                                  |
| `pnpm format:check`                                                                                                                     | Pass                     | Selector-chosen formatting check passed after the blocker-resolution proof refresh.                                                                                                                                                                                                                                                                           |
| `pnpm docs:check`                                                                                                                       | Pass                     | Selector-chosen docs check passed after the blocker-resolution proof refresh.                                                                                                                                                                                                                                                                                 |
| `pnpm policy:check`                                                                                                                     | Pass                     | Selector-chosen policy check passed after the blocker-resolution proof refresh.                                                                                                                                                                                                                                                                               |
| `pnpm test`                                                                                                                             | Pass                     | Selector-chosen full test check passed after the parser update, including 9 successful Turbo package tasks and 139 Node script tests.                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web test`                                                                                                 | Pass                     | Selector-chosen web test check passed with 41 files and 217 tests.                                                                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/web typecheck`                                                                                            | Pass                     | Selector-chosen web typecheck passed.                                                                                                                                                                                                                                                                                                                         |
| `pnpm build`                                                                                                                            | Pass                     | Selector-chosen build passed across 6 packages.                                                                                                                                                                                                                                                                                                               |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md --files <final path set>` | Pass                     | Reconciliation passed for 14 paths and the selector-chosen command list after the blocker-resolution proof refresh.                                                                                                                                                                                                                                           |
| `git diff --check`                                                                                                                      | Pass                     | Whitespace check passed after the blocker-resolution proof refresh.                                                                                                                                                                                                                                                                                           |

## Boundaries

- The branch uses only synthetic proof and local ignored artifacts.
- Admin Readiness does not read local scan artifacts, credentials, env files, object bodies, audit
  exports, or private deployment details.
- Bundled MinIO readiness blockers are release-handoff blockers only; the local development Compose
  stack and self-host profile remain unchanged.
