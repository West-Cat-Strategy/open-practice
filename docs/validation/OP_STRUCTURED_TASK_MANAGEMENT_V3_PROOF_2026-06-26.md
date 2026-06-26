# Structured Task Management V3 Proof - 2026-06-26

## Scope

- Branch: `feat/structured-task-management-v3-20260626`
- Worktree: `/Users/bryan/projects/open-practice-task-structure-v3-20260626`
- Surface: additive structured task records, staff-only task structure API routes, reusable
  templates, Tasks dashboard structured-detail controls, route authorization manifest coverage, and
  migration/repository/domain proof.

## Implemented Boundary

- Existing task CRUD, archive, source-pair, workbench, permission, and audit behavior stays
  compatible. The structured layer adds checklist items, staff comments, dependencies, reusable
  templates, and template items without replacing the current task projection.
- Domain records now model task checklist items, staff-only task comments, task dependencies, task
  templates, and template items. `buildTaskStructuredDetail` returns the base task projection,
  checklist progress, dependency blocker summary, safe comment counts/latest timestamp, active
  template metadata, and structured child rows for staff detail reads.
- Migration `0071_structured_task_management.sql` adds firm/task/matter-scoped checklist items,
  staff-only comments, dependency links, firm-scoped templates, and template items with lifecycle,
  archive, version, sort, and check constraints. Active dependency self-links are rejected by the
  schema, and duplicate active links are rejected through active partial uniqueness.
- Memory and Drizzle repositories implement list/create/update/archive operations for checklist
  items, comments, dependencies, templates, and template items. Repository logic rejects active
  duplicate dependencies and active blocking dependency cycles.
- Staff-only API routes expose `GET /api/tasks/:taskId/structure`, checklist create/update/status/
  archive operations, append-first comment creation and archive, dependency creation/archive,
  template list/admin/archive, applying a template to an existing task, and creating a task from a
  template.
- Authorization preserves matter-scoped task permissions: structure reads require staff plus
  `task:read`; checklist/comment/dependency mutations require staff plus `task:update`; applying a
  template to an existing task requires `task:update`; applying a template to create a task requires
  `task:create` on the target matter. Template administration is limited to `owner_admin` and
  `licensee`.
- Audit metadata records only IDs, statuses, counts, due dates, assignment IDs, template action
  flags, and dependency types. Tests reject comment bodies, checklist titles, template item titles,
  and template names in serialized audit event metadata.
- The Tasks dashboard adds a dense structured detail panel with checklist progress, item actions,
  dependency blockers, staff comment creation/archive, and template apply controls while preserving
  existing create/edit/filter/archive controls and permission-honest action affordances.
- The route authorization manifest and API/state-machine docs cover the new task structure and
  template routes.
- All fixtures and examples are synthetic. No recurrence, court-rule automation, provider sync,
  automatic deadline mutation, client-visible task comments, task email delivery, new dependency, or
  reference-derived code is included in this slice.

## Final Changed Paths

```text
docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md
packages/database/migrations/0071_structured_task_management.sql
packages/database/migrations/meta/0071_snapshot.json
packages/database/test/repository.tasks-structure.test.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/tasks-section.test.tsx
apps/web/app/dashboard/tasks-section.tsx
apps/web/app/types.ts
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/README.md
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/tasks-contracts.ts
packages/database/src/repository/tasks/drizzle.ts
packages/database/src/repository/tasks/memory.ts
packages/database/src/schema/tasks.ts
packages/domain/src/models.ts
packages/domain/src/tasks.test.ts
packages/domain/src/tasks.ts
scripts/route-authorization-manifest.mjs
```

## Selector

Final selector command:

```sh
pnpm verify:select -- --files docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md packages/database/migrations/0071_structured_task_management.sql packages/database/migrations/meta/0071_snapshot.json packages/database/test/repository.tasks-structure.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/tasks-contracts.ts packages/database/src/repository/tasks/drizzle.ts packages/database/src/repository/tasks/memory.ts packages/database/src/schema/tasks.ts packages/domain/src/models.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
```

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

- `git ls-files -m -o --exclude-standard` - Pass; final changed-path inventory recorded above.
- `pnpm verify:select -- --files ...` - Pass; recommended the command set recorded above for the
  final 25-path set.
- `pnpm architecture:check` - Pass; 449 workspace import edges reviewed.
- `pnpm api:contract` - Pass; generated ignored OpenAPI inventory under `.tmp/api-contract` with
  325 paths.
- Initial `pnpm format:check` - Failed on Prettier drift in
  `packages/database/migrations/meta/_journal.json` and
  `packages/database/migrations/meta/0071_snapshot.json`.
- `pnpm exec prettier --write packages/database/migrations/meta/_journal.json packages/database/migrations/meta/0071_snapshot.json` -
  Pass.
- `pnpm format:check` after formatting - Pass.
- `pnpm docs:check` - Pass.
- `pnpm policy:check` - Pass.
- `pnpm test` - Pass; full domain/database/providers/web/api/worker suites and script tests passed.
- `pnpm --filter @open-practice/domain test -- src/tasks.test.ts` - Pass; structured detail
  coverage added to the existing task suite, with 31 files and 248 tests passed.
- `pnpm --filter @open-practice/database test -- test/repository.tasks-structure.test.ts` - Pass;
  repository coverage includes checklist/comment/template CRUD, duplicate dependency rejection, and
  active blocking cycle rejection.
- `pnpm --filter @open-practice/database test` - Pass; 26 files and 150 tests passed.
- `pnpm --filter @open-practice/database db:check` - Pass.
- `pnpm migrations:check` - Pass; SQL and journal parity are current.
- `pnpm migrations:lint` - Pass.
- Initial `pnpm migrations:replay` - Failed because the local Postgres service on
  `localhost:35432` was not running.
- `docker compose up -d postgres` - Pass; started the local development Postgres service for
  disposable migration replay.
- `pnpm migrations:replay` after starting Postgres - Pass; all migrations replayed and the
  disposable replay database was cleaned up.
- `pnpm --dir apps/api exec vitest run src/routes/tasks.test.ts` - Pass; structured task routes,
  staff-only comment posture, authorization failures, dependency validation, and audit-safe metadata
  coverage passed, with 1 file and 15 tests passed.
- `pnpm --filter @open-practice/web test -- app/dashboard/tasks-section.test.tsx` - Pass; structured
  detail rendering, checklist/comment/template controls, and same-matter dependency picker coverage
  passed, with 44 files and 230 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/database typecheck` - Pass.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/database build` - Pass.
- `pnpm --filter @open-practice/api test` - Pass; 42 files and 604 tests passed.
- `pnpm --filter @open-practice/providers test` - Pass; 13 files and 37 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 6 files and 52 tests passed.
- `pnpm --filter @open-practice/web test` - Pass; 44 files and 230 tests passed.
- `pnpm build` - Pass; six package build tasks succeeded, including the Next.js production build.

## Checks Not Run

- None.

## Post-Proof Reconciliation Commands

To run after this proof/index/planning update:

```sh
pnpm verify:select -- --files docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md packages/database/migrations/0071_structured_task_management.sql packages/database/migrations/meta/0071_snapshot.json packages/database/test/repository.tasks-structure.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/tasks-contracts.ts packages/database/src/repository/tasks/drizzle.ts packages/database/src/repository/tasks/memory.ts packages/database/src/schema/tasks.ts packages/domain/src/models.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
pnpm proof:reconcile -- --proof docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md --files docs/validation/OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md packages/database/migrations/0071_structured_task_management.sql packages/database/migrations/meta/0071_snapshot.json packages/database/test/repository.tasks-structure.test.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/tasks-contracts.ts packages/database/src/repository/tasks/drizzle.ts packages/database/src/repository/tasks/memory.ts packages/database/src/schema/tasks.ts packages/domain/src/models.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```
