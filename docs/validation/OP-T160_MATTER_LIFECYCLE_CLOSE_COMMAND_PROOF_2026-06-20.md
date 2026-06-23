# OP-T160 Matter Lifecycle Close Command Proof - 2026-06-20

## Scope

- Branch: `codex/matter-lifecycle-close-command-20260620`
- Worktree: `/Users/bryan/projects/open-practice-matter-lifecycle-close-command-20260620`
- Runtime slice: status-only `close` for `POST /api/matters/:matterId/lifecycle-commands`.

## Implemented Boundary

- `close` executes `open -> closed`.
- Command execution requires staff access, matter-scoped `matter:update`, and the latest matching
  `ready` lifecycle-transition record for the matter's current status.
- The existing Drizzle command execution path keeps the latest-ready evidence guard in the status
  update predicate so the write fails closed if review evidence changes between read and write.
- Command audit metadata keeps the existing safe shape: IDs, command/status fields,
  reason/idempotency-key presence, review-first state, and consequence booleans only. It does not
  store reason text, blocker text, raw idempotency keys, client facts, private portal/document data,
  payment evidence, or cleanup details.
- The slice does not mutate `closedOn`, portal grants, tasks, assignments, billing records, trust
  records, retention state, cleanup state, archive semantics, or broader reopen semantics.

## Validation

Original implementation path set from `git diff --name-only` plus this proof file:

```text
apps/api/src/routes/matters.test.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md
docs/validation/README.md
packages/database/test/repository.matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
```

Focused pre-selector checks:

- `pnpm --filter @open-practice/domain test -- matter-lifecycle` - Pass; 31 files and 231 tests
  passed.
- Initial `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Blocked by
  missing fresh-worktree `@open-practice/domain` build output.
- Initial `pnpm --filter @open-practice/api test -- matters` - Blocked by missing fresh-worktree
  `@open-practice/domain`/`@open-practice/database` build output.
- `pnpm --filter @open-practice/domain build` - Pass.
- Initial parallel `pnpm --filter @open-practice/database build` and
  `pnpm --filter @open-practice/providers build` - Blocked by the same fresh-worktree race against
  missing domain output.
- Sequential `pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build` -
  Pass.
- Rerun `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Pass; 25
  files and 148 tests passed.
- Rerun `pnpm --filter @open-practice/api test -- matters` - Pass; 42 files and 571 tests passed.

Selector command:

```sh
pnpm verify:select -- --files docs/validation/OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md apps/api/src/routes/matters.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/test/repository.matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.ts
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
```

Final selected checks:

- `pnpm architecture:check` - Pass; 436 workspace import edges reviewed.
- `pnpm api:contract` - Pass; generated API contract inventory with 308 paths.
- `pnpm format:check` - Initial run found Markdown formatting drift in `docs/api-and-state-machines.md`
  and `docs/validation/README.md`; after targeted Prettier normalization, rerun passed.
- `pnpm docs:check` - Pass; documentation link validation passed.
- `pnpm policy:check` - Pass; secrets, package manifests, lockfile supply-chain, toolchain, env
  surface, architecture, dead code, migrations, OSS reuse, docs links, proof index,
  local-evidence Docker ignore, and boundary policy checks passed.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 231 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/database test` - Pass; 25 files and 148 tests passed.
- `pnpm --filter @open-practice/database db:check` - Pass; `drizzle-kit check` reported everything
  fine.
- `pnpm migrations:check` - Pass; 70 SQL files matched 70 journal entries.
- `pnpm migrations:lint` - Pass; 0 changed SQL migration files reviewed.
- `pnpm --filter @open-practice/database typecheck` - Pass.
- `pnpm --filter @open-practice/database build` - Pass.
- `pnpm --filter @open-practice/api test` - Pass; 42 files and 571 tests passed.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/providers test` - Pass; 11 files and 22 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 5 files and 46 tests passed.
- `git diff --check` - Pass.

Reopened branch verification on `codex/matter-lifecycle-close-command-20260620` confirmed the
close-command slice was already present on `main`; the only new repo-tracked change in this follow-up
is this proof refresh.

Focused reopened checks:

- `pnpm --filter @open-practice/domain test -- matter-lifecycle` - Pass; 31 files and 235 tests
  passed.
- Initial `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Blocked by
  missing fresh-worktree `@open-practice/domain` build output.
- Initial `pnpm --filter @open-practice/api test -- matters` - Blocked by missing fresh-worktree
  `@open-practice/domain`/`@open-practice/database` build output.
- `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build` -
  Pass.
- Rerun `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - Pass; 25
  files and 148 tests passed.
- Rerun `pnpm --filter @open-practice/api test -- matters` - Pass; 42 files and 578 tests passed.

Reopened selector command:

```sh
pnpm verify:select -- --files docs/validation/OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md
```

Reopened selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Reopened selected checks:

- `pnpm format:check` - Pass; all matched files use Prettier style.
- `pnpm docs:check` - Pass; documentation link validation passed.
- `pnpm policy:check` - Pass; secrets, manifests, lockfile supply chain, toolchain, env surface,
  architecture, dead code, migrations, OSS reuse, docs links, proof index, local-evidence Docker
  ignore, and boundary policy checks passed.
