# OP-T160 Matter Lifecycle Archive Command Proof - 2026-06-21

## Scope

- Branch: `feat/matter-lifecycle-archive-command-20260621`
- Worktree: `/Users/bryan/projects/open-practice`
- Runtime slice: status-only `archive` for
  `POST /api/matters/:matterId/lifecycle-commands`.

## Implemented Boundary

- `archive` executes `closed -> archived`.
- Command execution requires staff access, matter-scoped `matter:update`, and the latest matching
  `ready` lifecycle-transition record for the matter's current status.
- The existing Drizzle command execution path keeps the latest-ready evidence guard in the status
  update predicate so the write fails closed if review evidence changes between read and write.
- Command audit metadata keeps the existing safe shape: IDs, command/status fields,
  reason/idempotency-key presence, review-first state, and consequence booleans only. It does not
  store reason text, blocker text, raw idempotency keys, client facts, private portal/document data,
  payment evidence, or cleanup details.
- The slice does not mutate `closedOn`, portal grants, tasks, assignments, billing records, trust
  records, retention state, cleanup state, close semantics, or closed-or-archived reopen semantics.

## Validation

Focused pre-selector checks:

- `pnpm --filter @open-practice/domain test -- matter-lifecycle` - Pass; 31 files and 238 tests
  passed.
- Initial `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Failed
  before rebuilding `@open-practice/domain` because downstream tests read stale built domain output
  where `archive` had no required status.
- Initial `pnpm --filter @open-practice/api test -- matters` - Failed before rebuilding
  `@open-practice/domain` because downstream tests read stale built domain output and rejected the
  archive command payload.
- `pnpm --filter @open-practice/domain build` - Pass.
- Rerun `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Pass; 25
  files and 148 tests passed.
- Rerun `pnpm --filter @open-practice/api test -- matters` - Pass; 42 files and 578 tests passed.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts --testNamePattern "renders read-only matter setup profile cues"` -
  Pass; 1 test passed and 73 skipped.

Archive-command owned path set:

```text
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
apps/web/app/dashboard-client.test.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md
docs/validation/README.md
packages/database/test/repository.matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
```

The checkout also contained unrelated document-retention action descriptor edits and proof files
while this proof was recorded. Those paths were left out of the archive-command selector scope.

Selector command:

```sh
pnpm verify:select -- --files docs/validation/OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md apps/api/src/routes/matters.test.ts apps/api/src/routes/matters.ts apps/web/app/dashboard-client.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/test/repository.matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.ts
```

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
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

Final selected checks:

- `pnpm architecture:check` - Pass; 443 workspace import edges reviewed.
- `pnpm api:contract` - Pass; generated API contract inventory with 310 paths.
- `pnpm format:check` - Initial run found formatting drift in `docs/api-and-state-machines.md`;
  after targeted Prettier normalization, rerun passed.
- `pnpm docs:check` - Pass; documentation link validation passed.
- `pnpm policy:check` - Pass; secrets, package manifests, lockfile supply-chain, toolchain, env
  surface, architecture, dead code, migrations, OSS reuse, docs links, proof index,
  local-evidence Docker ignore, and boundary policy checks passed.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 238 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/database test` - Pass; 25 files and 148 tests passed.
- `pnpm --filter @open-practice/database db:check` - Pass; `drizzle-kit check` reported
  everything fine.
- `pnpm migrations:check` - Pass; 71 SQL files matched 71 journal entries.
- `pnpm migrations:lint` - Pass; 0 changed SQL migration files reviewed.
- `pnpm --filter @open-practice/database typecheck` - Pass.
- `pnpm --filter @open-practice/database build` - Pass.
- `pnpm --filter @open-practice/api test` - Pass; 42 files and 578 tests passed.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/providers test` - Pass; 11 files and 23 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 5 files and 46 tests passed.
- `pnpm --filter @open-practice/web test` - Pass; 41 files and 217 tests passed.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- Initial `pnpm build` - Blocked by a concurrent Next build lock from another `turbo build`
  process in the checkout.
- Rerun `pnpm build` after the other build exited - Pass; 6 of 6 package build tasks succeeded.
- `git diff --check` - Pass.
