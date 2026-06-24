# OP Mainline Merge Push Prune Proof - 2026-06-24

This proof records the 2026-06-24 Open Practice mainline closeout from base
`4e2ab1cf5d4c54f26d5b341ce836edec0dadec02` (`origin/main`) into integration branch
`merge/open-practice-mainline-20260624`.

## Scope

Three dirty Open Practice lanes were committed on their existing branches before integration.
Initial stash count was `42`; stashes are intentionally preserved throughout this closeout.

| Branch                                           | Commit     | Scope                                                  |
| ------------------------------------------------ | ---------- | ------------------------------------------------------ |
| `private-pilot/readiness-remediation-20260623`   | `07adbc70` | Private-pilot remediation and release-readiness depth. |
| `private-pilot/minio-readiness-blocker-20260624` | `cf97bb22` | MinIO residual-watch private-pilot readiness blocker.  |
| `feat/video-meetings-control-plane-20260623`     | `dbe0a294` | Calendar video-meetings control-plane and safe review. |

## Merge Reconciliation

- `private-pilot/readiness-remediation-20260623` merged first as the broad private-pilot baseline.
- `private-pilot/minio-readiness-blocker-20260624` merged second. Conflicts in release-proof
  tooling, selector guidance, Admin Readiness tests, self-hosting docs, planning, and the validation
  index were resolved additively so private-pilot release mode runs both the self-host restore drill
  and Docker residual-watch gate.
- `feat/video-meetings-control-plane-20260623` merged third. Calendar component conflicts were
  resolved to the video-control-plane implementation because it keeps the staff handoff/readiness
  summaries while adding scheduling-review ordering, safe next steps, readiness labels, and
  guest-session controls. Planning and validation docs keep all three lane proof entries.
- Private-pilot readiness remains held because the MinIO lane intentionally promotes bundled MinIO
  archived-source or Critical/High residual-watch evidence into a private-pilot readiness blocker.
  This closeout does not clear that blocker, change MinIO pins, change Compose contracts, add
  provider side effects, enable live settlement, enable automatic trust posting, or retain raw
  private document text.
- All examples and proof language remain synthetic and avoid client, matter, credential, payment,
  privileged document, audit-log, or private deployment details.

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
pnpm security:review
pnpm security:secrets-history
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
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
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                   | Result                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main`                                                                                                | Passed                                    | Selected the broad integrated command set above for the committed 97-path integration branch before the new mainline proof was written.                                                                                                                                                                                                                                                                 |
| `pnpm verify:select -- --base-plus-dirty origin/main`                                                                                     | Passed                                    | Rerun after proof/index/workboard edits selected the same broad command set for the final 98-path closeout, including `docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md`.                                                                                                                                                                                                               |
| `node --test scripts/create-release-proof.test.mjs scripts/select-validation.test.mjs scripts/watch-docker-residuals.test.mjs`            | Passed                                    | Merge-hotspot script regressions passed: 40 tests across release proof, selector, and residual-watch contracts.                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/admin-readiness-section.test.tsx app/dashboard/calendar-section.test.tsx` | Passed                                    | Merge-hotspot Admin Readiness and Calendar component regressions passed: 2 files and 10 tests.                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web typecheck`                                                                                              | Passed                                    | Calendar/Admin Readiness merge surface typecheck passed.                                                                                                                                                                                                                                                                                                                                                |
| `pnpm ci:local`                                                                                                                           | Passed                                    | Full local gate passed: format, lint, typecheck, package tests, script tests, database check, policy checks, build, and `git diff --check`.                                                                                                                                                                                                                                                             |
| `pnpm docker:app-smoke`                                                                                                                   | Passed                                    | Built service/app images, ran the PostgreSQL-backed Compose stack, verified API/web/setup-status readiness, and removed the disposable stack.                                                                                                                                                                                                                                                           |
| `pnpm e2e:docker`                                                                                                                         | Passed after environment cleanup          | First attempt failed before tests because `open-practice-dev-postgres-1` from prior local replay occupied `127.0.0.1:35432`. After stopping that dev Postgres and removing the failed `open-practice-e2e` project, rerun passed 3 Docker Chromium tests and removed its stack.                                                                                                                          |
| `pnpm security:review -- --base origin/main`                                                                                              | Accepted expected MinIO readiness blocker | Wrote `.tmp/open-practice-security-review/2026-06-24T03-04-19Z/security-review.json`; the only failed required command was `docker-residual-watch` exit `2` because `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T03-10-31Z` recorded the MinIO blocker.                                                                                                                    |
| `pnpm docker:residual-watch`                                                                                                              | Accepted expected exit `2`                | Wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T03-13-13Z`; status was `readiness-blocked` because MinIO had 11 Critical and 16 High Scout findings plus archived upstream source posture.                                                                                                                                                                              |
| `pnpm release:local -- --private-pilot`                                                                                                   | Accepted expected residual-watch failure  | First run failed because local Postgres had been stopped for Docker E2E port cleanup; `pnpm migrations:replay` then passed after restarting local Postgres. Rerun wrote `artifacts/release-local/2026-06-24T03-19-31Z/release-proof.json`; only `docker-residual-watch` failed because `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T03-20-31Z` recorded the MinIO blocker. |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md --files <lane paths>`         | Passed                                    | Reconciled 78 readiness-remediation paths and selected commands.                                                                                                                                                                                                                                                                                                                                        |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md --files <lane paths>`       | Passed                                    | Reconciled 14 MinIO blocker paths after adding the mainline selector addendum for self-host restore drill selection.                                                                                                                                                                                                                                                                                    |
| `pnpm proof:reconcile -- --proof docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md --files <lane paths>`                | Passed                                    | Reconciled 23 video meetings paths and selected commands.                                                                                                                                                                                                                                                                                                                                               |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md --base-plus-dirty origin/main`          | Passed                                    | Reconciled the dirty 98-path mainline proof before the proof evidence update. Final reconciliation is rerun after this proof is committed.                                                                                                                                                                                                                                                              |
| `git diff --check`                                                                                                                        | Passed                                    | Passed before the first `main` publication. Final docs-only closeout checks are recorded in the push/prune addendum below.                                                                                                                                                                                                                                                                              |

## Publish And Prune

Initial publication and prune completed after validation:

- Local `main` fast-forwarded from `4e2ab1cf5d4c54f26d5b341ce836edec0dadec02` to
  `42d13ce528bc83df84d7e1dec990f03f7dc50c95`.
- `git push origin main` updated remote `main` from `4e2ab1cf` to `42d13ce5`.
- `git fetch origin main`, `git rev-list --left-right --count main...origin/main`,
  `git rev-parse main origin/main`, and `git ls-remote origin refs/heads/main` verified local,
  tracking, and remote `main` parity at `42d13ce528bc83df84d7e1dec990f03f7dc50c95`.
- Exact remote heads for `private-pilot/readiness-remediation-20260623`,
  `private-pilot/minio-readiness-blocker-20260624`, and
  `feat/video-meetings-control-plane-20260623` were absent after fetch/prune, so no remote lane
  branch deletion was needed.
- Each local lane branch and `merge/open-practice-mainline-20260624` was proven to be an ancestor of
  pushed `main` before local deletion.
- Clean sibling worktrees removed:
  `/Users/bryan/projects/open-practice-minio-readiness-blocker-20260624` and
  `/Users/bryan/projects/open-practice-video-meetings-control-plane-20260623`.
- Merged local branches deleted: `private-pilot/readiness-remediation-20260623`,
  `private-pilot/minio-readiness-blocker-20260624`, `feat/video-meetings-control-plane-20260623`,
  and `merge/open-practice-mainline-20260624`.
- `git worktree prune` and `git remote prune origin` completed.
- Final worktree inventory showed only `/Users/bryan/projects/open-practice` on `main`; the deleted
  lane and integration branch names no longer resolved locally.
- Stash count remained `42`.
- The local dev Postgres container restarted only to rerun migration replay was stopped after prune.

Private-pilot readiness remains held because Docker residual-watch still reports bundled MinIO as
`readiness-blocked` because of Critical/High Scout findings and archived upstream source posture.

This proof-only closeout commit is docs-only and is pushed after final selector, proof reconcile,
format, docs, policy, and diff checks.

## Final Changed Paths

```text
Dockerfile
apps/api/src/routes/caldav.test.ts
apps/api/src/routes/caldav.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/calendar/feed.ts
apps/api/src/routes/calendar/guest-sessions.ts
apps/api/src/routes/calendar/invitations.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/client-portal/workspace.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/status.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/job-status.ts
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/ledger/read.ts
apps/api/src/routes/providers-status.test.ts
apps/api/src/routes/shares.test.ts
apps/api/src/routes/shares/staff.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/calendar/models.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/_features/email-delivery/models.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/client-portal-workspace-utils.test.ts
apps/web/app/client-portal-workspace-utils.ts
apps/web/app/client-portal-workspace.test.tsx
apps/web/app/client-portal-workspace.tsx
apps/web/app/communications-inbox-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/communications-section.test.tsx
apps/web/app/dashboard/communications-section.tsx
apps/web/app/dashboard/matter-overview-section.tsx
apps/web/app/dashboard/queues-section.tsx
apps/web/app/dashboard/trust-controls-section.test.tsx
apps/web/app/dashboard/trust-controls-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/email-delivery-dashboard.test.ts
apps/web/app/email-delivery-dashboard.ts
apps/web/app/guest-sessions/GuestSessionRunner.tsx
apps/web/app/guest-sessions/runner-utils.test.ts
apps/web/app/guest-sessions/runner-utils.ts
apps/web/app/provider-status-dashboard.ts
apps/web/app/trust-controls-dashboard.ts
apps/web/app/types.ts
apps/web/app/worker-runs-dashboard.ts
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docker/postgres/Dockerfile
docs/api-and-state-machines.md
docs/deployment-hardening.md
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md
docs/validation/OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md
docs/validation/OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md
docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md
docs/validation/README.md
e2e/host.spec.ts
package.json
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/ledger.test.ts
packages/domain/src/ledger.ts
packages/domain/src/workflow-audit.test.ts
packages/domain/src/workflow-audit.ts
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/create-security-review.mjs
scripts/create-security-review.test.mjs
scripts/lint-docker-config.mjs
scripts/lint-docker-config.test.mjs
scripts/reconcile-validation-proof.mjs
scripts/run-e2e.mjs
scripts/run-license-source-scan.mjs
scripts/run-license-source-scan.test.mjs
scripts/run-osv-scanner.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
turbo.json
```
