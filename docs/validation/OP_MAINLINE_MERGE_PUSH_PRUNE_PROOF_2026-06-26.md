# OP Mainline Merge Push Prune Proof - 2026-06-26

This proof records the Open Practice all-active-lane closeout from base
`e21cd343fb81ee0e052978fc072b8066790484e8` (`main`, `origin/main`, and GitHub
`main`) into integration branch `merge/open-practice-mainline-20260626`.

The closeout uses synthetic data only and preserves privacy, matter-scoped access, auditability,
credential/payment/private-deployment boundaries, clean-room reuse discipline, and the initial
stash count of `42`.

## Scope

Eight active lanes were committed or adopted before integration.

| Branch                                                 | Commit     | Scope                                                         |
| ------------------------------------------------------ | ---------- | ------------------------------------------------------------- |
| `audit/features-capabilities-parity-20260626`          | `6e32215`  | Intake, portal, and capability-gap parity audit closeout.     |
| `remediation/features-capabilities-parity-20260626`    | `00927bb1` | Document conversion readiness metadata remediation.           |
| `feature/appointment-booking-tentative-holds-20260626` | `c6de942`  | Appointment booking profiles, public runner, and holds.       |
| `feat/structured-task-management-v3-20260626`          | `114bc87`  | Structured task checklist, comment, blocker, and template UI. |
| `feat/calendar-tickler-review-bridge-20260626`         | `5cc15a8`  | Calendar tickler review bridge over existing request records. |
| `private-pilot/external-s3-env-bootstrap-20260626`     | `365c1ad`  | Ignored external S3 restore-drill env bootstrap/preflight.    |
| `chore/docker-storage-preflight-20260626`              | `60257eb`  | Docker storage preflight for Docker-heavy local proof gates.  |
| `security/gitleaks-history-fixture-tuning-20260626`    | `2c39160`  | Exact reviewed Gitleaks history fixture false positives.      |

## Merge Reconciliation

- Merge order was audit, remediation, appointment booking, structured task management, calendar
  tickler bridge, external S3 env bootstrap, Docker storage preflight, and Gitleaks tuning.
- Migration conflicts were resolved by keeping appointment booking as
  `0071_appointment_booking_tentative_holds.sql` and renumbering structured task management to
  `0072_structured_task_management.sql`, including `meta/0072_snapshot.json` and `_journal.json`.
  Final migration parity is 73 SQL files and 73 journal entries.
- Shared dashboard/task surfaces were resolved additively so appointment booking, structured task
  details, and calendar tickler review actions all remain available.
- Shared docs/proof/planning/script conflicts were resolved additively across the validation index,
  planning board, route authorization manifest, selector, release proof, restore drill, Docker
  preflight, and Gitleaks history surfaces.
- The final host E2E adjustment in `e2e/host.spec.ts` follows the new public intake runner behavior:
  required incomplete items are rendered as human-readable labels rather than raw item IDs.

The integrated branch preserves synthetic-only proof, matter-scoped authorization, route
redaction, review-only document-conversion posture, no provider side effects, no automatic matter
creation, no automatic task/tickler mutation, no new dependency, no copied source, no credential or
payment material, and no private client or matter data.

## Selector Output

The final selector command used the exact 124-path set listed below:

```bash
pnpm verify:select -- --files <124 final changed paths>
```

It emitted:

```text
Recommended validation commands:
pnpm security:review
pnpm security:secrets-history
pnpm architecture:check
pnpm api:contract
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
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                | Result           | Notes                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <124 final changed paths>`                                              | Passed           | Selected the broad integrated command set for security, Docker, self-host, browser, package, and docs.   |
| `pnpm test`                                                                                            | Passed           | Domain 254, database 155, providers 37, web 236, worker 54, API 614, and scripts 182 tests passed.       |
| `pnpm --filter @open-practice/database db:check`                                                       | Passed           | Drizzle schema check passed.                                                                             |
| `pnpm migrations:check`                                                                                | Passed           | Migration parity passed with 73 SQL files and 73 journal entries.                                        |
| `pnpm migrations:lint`                                                                                 | Passed           | Migration lint passed for the `0071` appointment-booking and `0072` structured-task migrations.          |
| `pnpm --filter @open-practice/database typecheck`                                                      | Passed           | TypeScript no-emit check passed.                                                                         |
| `pnpm --filter @open-practice/database build`                                                          | Passed           | Database package build passed.                                                                           |
| `pnpm --filter @open-practice/api typecheck`                                                           | Passed           | API TypeScript no-emit check passed.                                                                     |
| `pnpm --filter @open-practice/domain typecheck`                                                        | Passed           | Domain TypeScript no-emit check passed.                                                                  |
| `pnpm --filter @open-practice/domain build`                                                            | Passed           | Domain package build passed.                                                                             |
| `pnpm --filter @open-practice/worker typecheck`                                                        | Passed           | Worker TypeScript no-emit check passed.                                                                  |
| `pnpm --filter @open-practice/worker build`                                                            | Passed           | Worker package build passed.                                                                             |
| `pnpm --filter @open-practice/web lint`                                                                | Passed after fix | Caught and then cleared the stale `createIntakeFormLink` dashboard prop.                                 |
| `pnpm --filter @open-practice/web typecheck`                                                           | Passed           | Web TypeScript no-emit check passed after the dashboard prop cleanup.                                    |
| `pnpm build`                                                                                           | Passed           | Workspace build completed.                                                                               |
| `pnpm format:check`                                                                                    | Passed after fix | Post-proof run found Markdown wrapping; touched docs were formatted and rerun passed.                    |
| `pnpm docs:check`                                                                                      | Passed           | Documentation link validation passed after proof/index/planning edits.                                   |
| `pnpm policy:check`                                                                                    | Passed           | Local repository policy checks passed after proof/index/planning edits.                                  |
| `pnpm ci:local`                                                                                        | Passed after fix | Initial run found the stale dashboard prop; rerun passed `pnpm verify` and `git diff --check`.           |
| `pnpm api:contract`                                                                                    | Passed           | Wrote `.tmp/api-contract/openapi.json` with 338 paths.                                                   |
| `pnpm security:review -- --base origin/main`                                                           | Passed           | Artifact: `.tmp/open-practice-security-review/2026-06-27T00-22-31Z`.                                     |
| `pnpm security:secrets-history`                                                                        | Passed           | Artifact: `.tmp/security/gitleaks/2026-06-27T00-30-42Z`.                                                 |
| `pnpm docker:residual-watch`                                                                           | Passed           | Artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-27T00-30-55Z`.          |
| `pnpm docker:app-smoke`                                                                                | Passed           | Storage preflight had 22.0 GiB free before build and 20.2 GiB after build; API/web/setup smoke passed.   |
| `pnpm e2e:host`                                                                                        | Passed after fix | Full rerun passed 36 tests after the intake required-item label locator adjustment.                      |
| `pnpm e2e:docker`                                                                                      | Passed           | Docker Chromium suite passed 3 tests; storage preflight had 20.2 GiB free.                               |
| `node scripts/run-e2e.mjs first-run`                                                                   | Passed           | First-run setup browser proof passed.                                                                    |
| `pnpm e2e:matterless`                                                                                  | Passed           | Matterless browser proof passed.                                                                         |
| `pnpm e2e:client-portal`                                                                               | Passed           | Client portal browser proof passed.                                                                      |
| `pnpm e2e:a11y`                                                                                        | Passed           | Accessibility browser proof passed.                                                                      |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`      | Passed           | Artifact: `.tmp/open-practice-selfhost-restore-drill/2026-06-27T00-51-01Z`.                              |
| `pnpm migrations:replay`                                                                               | Passed           | After `docker compose up -d postgres`, 73 migrations replayed into a disposable database and cleaned up. |
| `pnpm release:local -- --private-pilot`                                                                | Passed after fix | First artifact failed because local Postgres was absent; final artifact `2026-06-27T00-56-56Z` passed.   |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md ...` | Passed           | Reconciled 124 final paths and the selected command set against the original integration base.           |

Skipped checks: none.

## Publish And Prune

Local `main` was fast-forwarded from `e21cd343d1f7904d372a0473fdf54572012e3083` to
`455e3392a3442f424b615eac7658fa25c46790f8` and pushed to `origin/main`.

```text
To https://github.com/West-Cat-Strategy/open-practice.git
   e21cd343..455e3392  main -> main
```

Post-push parity before pruning:

```text
git rev-list --left-right --count main...origin/main
0 0

git rev-parse main origin/main HEAD
455e3392a3442f424b615eac7658fa25c46790f8
455e3392a3442f424b615eac7658fa25c46790f8
455e3392a3442f424b615eac7658fa25c46790f8

git ls-remote --heads origin main
455e3392a3442f424b615eac7658fa25c46790f8	refs/heads/main

git status --short --branch
## main...origin/main
```

Only after parity, the clean merged sibling worktrees were removed:

```text
/Users/bryan/projects/open-practice-appointment-booking-20260626
/Users/bryan/projects/open-practice-calendar-tickler-review-bridge-20260626
/Users/bryan/projects/open-practice-docker-storage-preflight-20260626
/Users/bryan/projects/open-practice-external-s3-env-bootstrap-20260626
/Users/bryan/projects/open-practice-features-capabilities-remediation-20260626
/Users/bryan/projects/open-practice-gitleaks-history-fixture-tuning-20260626
/Users/bryan/projects/open-practice-task-structure-v3-20260626
```

The merged local branches were deleted:

```text
audit/features-capabilities-parity-20260626
remediation/features-capabilities-parity-20260626
feature/appointment-booking-tentative-holds-20260626
feat/structured-task-management-v3-20260626
feat/calendar-tickler-review-bridge-20260626
private-pilot/external-s3-env-bootstrap-20260626
chore/docker-storage-preflight-20260626
security/gitleaks-history-fixture-tuning-20260626
merge/open-practice-mainline-20260626
```

`git worktree prune --verbose` and `git remote prune origin` completed with no additional output.
The replay Postgres container used for `pnpm migrations:replay` was stopped before final evidence
capture.

Post-prune evidence captured before the docs-only evidence refresh:

```text
git worktree list --porcelain
worktree /Users/bryan/projects/open-practice
HEAD 455e3392a3442f424b615eac7658fa25c46790f8
branch refs/heads/main

git branch --format='%(refname:short)'
main

git rev-list --left-right --count main...origin/main
0 0

git rev-parse main origin/main HEAD
455e3392a3442f424b615eac7658fa25c46790f8
455e3392a3442f424b615eac7658fa25c46790f8
455e3392a3442f424b615eac7658fa25c46790f8

git ls-remote --heads origin main
455e3392a3442f424b615eac7658fa25c46790f8	refs/heads/main

git stash list | wc -l
42

git status --short --branch
## main...origin/main

docker compose ps --format json
<no output>
```

Post-prune invariants captured at the evidence point above:

- One remaining worktree at `/Users/bryan/projects/open-practice`.
- Local branch `main` only.
- `main`, `origin/main`, `HEAD`, and GitHub `main` match.
- `git rev-list --left-right --count main...origin/main` reports `0 0`.
- Stash count remains `42`.

## Final Changed Paths

```text
.gitleaksignore
apps/api/src/http/auth-helpers.ts
apps/api/src/http/http.test.ts
apps/api/src/routes/appointment-booking.test.ts
apps/api/src/routes/appointment-booking.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/client-portal.ts
apps/api/src/routes/client-portal/documents.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms.ts
apps/api/src/routes/intake-forms/engagement-letter.ts
apps/api/src/routes/intake-forms/public.ts
apps/api/src/routes/intake-pipeline.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/api/src/server.ts
apps/web/app/PublicTokenHashEntry.tsx
apps/web/app/_features/document-processing/models.ts
apps/web/app/appointment-booking/AppointmentBookingRunner.tsx
apps/web/app/appointment-booking/page.tsx
apps/web/app/appointment-booking/runner-utils.test.ts
apps/web/app/appointment-booking/runner-utils.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/client-portal-workspace.tsx
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/appointment-booking-panel.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/intake-section.test.tsx
apps/web/app/dashboard/intake-section.tsx
apps/web/app/dashboard/shared-panels.tsx
apps/web/app/dashboard/tasks-section.test.tsx
apps/web/app/dashboard/tasks-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRenderer.test.ts
apps/web/app/intake-forms/IntakeFormRunner.tsx
apps/web/app/intake-forms/runner-utils.ts
apps/web/app/public-token-routes.test.ts
apps/web/app/styles/30-feature-surfaces.css
apps/web/app/styles/90-responsive-motion.css
apps/web/app/types.ts
apps/worker/src/processors.test.ts
apps/worker/src/processors/ocr.ts
docs/api-and-state-machines.md
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md
docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md
docs/validation/OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md
docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md
docs/validation/OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md
docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md
docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md
docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md
docs/validation/README.md
e2e/host.spec.ts
packages/database/migrations/0071_appointment_booking_tentative_holds.sql
packages/database/migrations/0072_structured_task_management.sql
packages/database/migrations/meta/0072_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/appointment-booking-contracts.ts
packages/database/src/repository/appointment-booking/drizzle.ts
packages/database/src/repository/appointment-booking/mappers.ts
packages/database/src/repository/appointment-booking/memory.ts
packages/database/src/repository/calendar-events-contracts.ts
packages/database/src/repository/calendar-events/drizzle.ts
packages/database/src/repository/calendar-events/memory.ts
packages/database/src/repository/contracts.ts
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/intake-forms/memory.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/tasks-contracts.ts
packages/database/src/repository/tasks/drizzle.ts
packages/database/src/repository/tasks/memory.ts
packages/database/src/schema.ts
packages/database/src/schema/appointment-booking.ts
packages/database/src/schema/tasks.ts
packages/database/test/repository.appointment-booking.test.ts
packages/database/test/repository.intake.test.ts
packages/database/test/repository.tasks-structure.test.ts
packages/domain/src/appointment-booking.test.ts
packages/domain/src/appointment-booking.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/drafting.test.ts
packages/domain/src/drafting.ts
packages/domain/src/index.ts
packages/domain/src/intake-pipeline.ts
packages/domain/src/intake.test.ts
packages/domain/src/intake.ts
packages/domain/src/models.ts
packages/domain/src/sample-data.ts
packages/domain/src/tasks.test.ts
packages/domain/src/tasks.ts
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/docker-app-smoke.mjs
scripts/docker-storage-preflight.mjs
scripts/docker-storage-preflight.test.mjs
scripts/reconcile-validation-proof.mjs
scripts/reconcile-validation-proof.test.mjs
scripts/route-authorization-manifest.mjs
scripts/run-e2e.mjs
scripts/run-gitleaks-history-scan.mjs
scripts/run-gitleaks-history-scan.test.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
scripts/validate-open-practice-boundaries.mjs
```
