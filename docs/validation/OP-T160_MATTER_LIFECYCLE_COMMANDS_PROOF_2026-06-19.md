# OP-T160 Matter Lifecycle Commands Proof - 2026-06-19

## Scope

- Branch: `codex/matter-lifecycle-commands-2026-06-19`
- Worktree: `/Users/bryan/projects/open-practice-matter-lifecycle-commands-2026-06-19`
- Runtime slice: `POST /api/matters/:matterId/lifecycle-commands` for `pause` and `reopen` only.

## Implemented Boundary

- `pause` executes `open -> paused`; `reopen` executes `paused -> open`.
- Command execution requires staff access, matter-scoped `matter:update`, and the latest matching
  `ready` lifecycle-transition record for the matter's current status.
- Drizzle command execution repeats the latest-ready evidence guard in the status update predicate
  so the write fails closed if review evidence changes between read and write.
- Command audit metadata stores safe IDs, command/status fields, reason/idempotency-key presence,
  and consequence booleans only. It does not store reason text, blocker text, raw idempotency keys,
  client facts, private portal/document data, payment evidence, or cleanup details.
- The slice does not mutate `closedOn`, portal grants, tasks, assignments, billing records, trust
  records, retention state, cleanup state, or any close/archive semantics.

## Validation

Final path set from `git diff --name-only`:

```text
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md
docs/validation/README.md
packages/database/src/repository/drizzle.ts
packages/database/src/repository/matter-lifecycle-contracts.ts
packages/database/src/repository/matter-lifecycle/drizzle.ts
packages/database/src/repository/matter-lifecycle/memory.ts
packages/database/src/repository/memory.ts
packages/database/test/repository.matter-lifecycle.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
scripts/route-authorization-manifest.mjs
```

Selector command:

```sh
pnpm verify:select -- --files apps/api/src/routes/matters.test.ts apps/api/src/routes/matters.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md docs/validation/README.md packages/database/src/repository/drizzle.ts packages/database/src/repository/matter-lifecycle-contracts.ts packages/database/src/repository/matter-lifecycle/drizzle.ts packages/database/src/repository/matter-lifecycle/memory.ts packages/database/src/repository/memory.ts packages/database/test/repository.matter-lifecycle.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.ts scripts/route-authorization-manifest.mjs
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

The selector was rerun after tightening the Drizzle write guard; the recommended command list
remained unchanged.

Check results:

- `pnpm format:check` - Pass after a narrow Prettier normalization of touched markdown and Drizzle
  files; final rerun passed with all matched files using Prettier style.
- `pnpm docs:check` - Pass; documentation link validation passed.
- `pnpm policy:check` - Pass; secrets, package manifest, dead code, migration parity, OSS reuse,
  doc links, validation proof index, local evidence Docker ignore, and boundary policy checks passed.
- `pnpm test` - Pass; Turbo reported 9 successful tasks, and script tests reported 63 passed.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 226 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/database test` - Pass; 23 files and 138 tests passed.
- `pnpm --filter @open-practice/database db:check` - Pass; `drizzle-kit check` reported
  everything fine.
- `pnpm migrations:check` - Pass; 66 SQL files matched 66 journal entries.
- `pnpm --filter @open-practice/database typecheck` - Pass.
- `pnpm --filter @open-practice/database build` - Pass.
- `pnpm --filter @open-practice/api test` - Pass; 42 files and 564 tests passed.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/providers test` - Pass; 9 files and 20 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 5 files and 46 tests passed.
- Manual `pnpm --filter @open-practice/domain build` - Pass; selector omitted this command for a
  domain source change, so it was included manually.
- `git diff --check` - Pass.
