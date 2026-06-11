# OP-T153 Task System V2 Proof - 2026-06-10

## Scope

OP-T153 adds a staff-only, matter-scoped task system V2 while preserving the OP-T146
task/deadline review surface. The slice expands task rows into lifecycle-capable task records,
adds repository and API create/update/complete/reopen/archive behavior, records audit-safe task
lifecycle events, keeps archived tasks hidden by default, validates task source provenance pairs on
partial updates, adds review-first suggested follow-ups from safe calendar scheduling signals,
surfaces task rows in operational views, and adds a first-class dashboard Tasks workspace.

Explicitly out of scope: client portal task views, court-rule calculation, provider sync,
automatic reminders, queue delivery, automatic time-entry creation, and AI/email/intake/signature/
calendar-driven task mutation. All examples and tests use synthetic data only.

The migration is `0053_task_system_v2` because the branch was replayed after
`0052_matterless_contacts_calendar` landed on `main`. The SQL contract is unchanged from the
original task-system V2 migration.

## Changed Paths

```text
apps/api/src/routes/operational-views.test.ts
apps/api/src/routes/operational-views.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/web/app/_features/dashboard/dashboard-shell-model.test.ts
apps/web/app/_features/operations/server-resources.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/dashboard-shell.test.tsx
apps/web/app/dashboard/tasks-section.test.tsx
apps/web/app/dashboard/tasks-section.tsx
apps/web/app/operational-focus-panel.ts
apps/web/routes/routeCatalog.test.ts
apps/web/routes/routeCatalog.ts
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP-T153_TASK_SYSTEM_V2_PROOF_2026-06-10.md
docs/validation/README.md
e2e/ui-ux.spec.ts
packages/database/migrations/0053_task_system_v2.sql
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/tasks-contracts.ts
packages/database/src/repository/tasks/drizzle.ts
packages/database/src/repository/tasks/memory.ts
packages/database/src/schema/tasks.ts
packages/database/src/seed.ts
packages/database/test/repository.calendar.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/models.ts
packages/domain/src/operational-views.test.ts
packages/domain/src/operational-views.ts
packages/domain/src/permissions.ts
packages/domain/src/sample-data.ts
packages/domain/src/tasks.test.ts
packages/domain/src/tasks.ts
scripts/route-authorization-manifest.mjs
```

## Validation

Selector:

- `git diff --name-only main...HEAD | sort | xargs pnpm verify:select -- --files`
  - Passed.
  - Recommended host and Docker E2E, format/docs/policy checks, full tests, focused
    domain/database/API/web checks, provider/worker tests, database build/typecheck, database
    check, migration check, and build.

Replay and proof reconciliation:

- Rebased `codex/op-task-system-v2-2026-06-10` onto current `main`
  `30a26a17822c0a8482caaba9d6de3c9b37112701`.
- Preserved the landed matterless contacts/calendar changes from `main`.
- Renumbered the task-system migration from `0052_task_system_v2` to `0053_task_system_v2`
  because `0052_matterless_contacts_calendar` is now on `main`.
- Rechecked the proof Changed Paths block against `git diff --name-only main...HEAD`; no
  mismatches.

Focused checks:

- `pnpm --filter @open-practice/domain test`
  - Passed: 24 files, 175 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed. This refreshed built package exports after replaying onto the matterless mainline.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files, 112 tests.
- `pnpm --filter @open-practice/database db:check`
  - Passed.
- `pnpm migrations:check`
  - Passed: 54 SQL files matched 54 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Initial replay attempt failed because `@open-practice/domain` build output was stale for
    already-landed matterless exports such as `CalendarEventScope`, `createdByUserId`, and
    `sampleMatterlessFirm`.
  - Passed after `pnpm --filter @open-practice/domain build`.
- `pnpm --filter @open-practice/database build`
  - Initial replay attempt failed for the same stale domain build-output reason.
  - Passed after `pnpm --filter @open-practice/domain build`.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files, 512 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 35 files, 178 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Initial replay attempt failed because the new Tasks route needed the `availability` field
    introduced by the matterless route-catalog contract.
  - Passed after setting the Tasks route to firm availability and rerunning route-catalog coverage.
- `pnpm --filter @open-practice/providers test`
  - Passed: 7 files, 18 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 3 files, 36 tests.
- `pnpm build`
  - Passed: 6 successful build tasks.
- `pnpm test`
  - Passed: 9 successful package test/build tasks plus 63 script tests.
- `pnpm e2e:host`
  - Passed: 33 passed, 7 skipped.
- `pnpm e2e:docker`
  - Passed.
  - The Codex tool output was truncated before the final Playwright count, but the command exited
    successfully and `test-results/e2e/.last-run.json` recorded `{"status":"passed","failedTests":[]}`.
- `pnpm format:check`
  - Passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `git diff --check`
  - Passed.

Broad closeout:

- `pnpm ci:local`
  - Not rerun after replay because the selector-selected broad gates above covered package tests,
    script tests, typechecks, migration/database checks, docs/policy checks, build, host E2E, and
    Docker E2E.

Host E2E caught two UI coverage issues during implementation: the new Tasks dashboard section needed
an E2E sentinel, and mobile task row actions needed wrapping. Both fixes are included in the final
diff and were covered by the final host and Docker E2E passes. Replay validation also caught the
route-catalog availability field needed by the matterless mainline contract; the Tasks route now
declares firm availability and is covered by route-catalog tests plus web typecheck.
