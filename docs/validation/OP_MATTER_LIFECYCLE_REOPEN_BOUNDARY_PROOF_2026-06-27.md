# Matter Lifecycle Reopen Boundary Proof - 2026-06-27

## Scope

- Branch: `codex/matter-lifecycle-reopen-boundary-20260627`
- Runtime slice: status-only closed/archived reopen through existing
  `POST /api/matters/:matterId/lifecycle-commands`.
- Reuses `command: "reopen"`; no new route, dependency, schema, migration, worker, provider,
  cleanup, source-record automation, or UI surface.

## Implemented Boundary

- `reopen` executes `paused -> open`, `closed -> open`, and `archived -> open`.
- Execution still requires staff `matter:update`, caller `expectedStatus`, reason, idempotency-key
  presence, a linked lifecycle-transition record ID, and the latest matching `ready`
  lifecycle-transition record whose `currentStatus` matches the matter's current status.
- Domain command policy exposes plural required statuses for commands. The memory and Drizzle
  repositories use that helper, and the Drizzle write still fails closed when matter status or
  latest-ready evidence changes before update.
- The command may only update `matters.status` to `open` and append one
  `matter.lifecycle_command_executed` audit event.
- Audit metadata stores safe IDs, statuses, booleans, and `retentionChanged: false`. It does not
  store reason text, blocker text, raw idempotency keys, private matter/client facts, payment
  evidence, provider payloads, cleanup details, or retention details.

## Side-Effect Proof

The repository and route tests compare before/after snapshots for closed and archived reopen and
prove these records are unchanged:

- `closedOn`
- portal grants, portal document access, share links, and external upload links
- assigned users from overview projections
- tasks, checklist items, task comments, dependencies, and task templates
- time entries, expenses, invoices, and payments
- ledger entries and trust transfer requests
- document legal-hold and review metadata
- lifecycle-transition source records
- cleanup state by absence of cleanup mutation paths in this command slice

## Validation

Initial focused checks before the final docs/proof reconciliation:

- `pnpm --filter @open-practice/domain test -- matter-lifecycle` - passed
- `pnpm --filter @open-practice/domain build` - passed
- `pnpm --filter @open-practice/database test -- repository.matter-lifecycle` - passed
- `pnpm --filter @open-practice/database build` - passed
- `pnpm --filter @open-practice/providers build` - passed
- `pnpm --filter @open-practice/api exec vitest run src/routes/matters.test.ts` - passed

Final changed path selector input:

```text
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/README.md
docs/validation/OP_MATTER_LIFECYCLE_REOPEN_BOUNDARY_PROOF_2026-06-27.md
packages/database/src/repository/matter-lifecycle/drizzle.ts
packages/database/src/repository/matter-lifecycle/memory.ts
packages/database/test/repository.matter-lifecycle.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
```

`pnpm verify:select -- --files <final changed paths>` selected:

```text
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

Selector-command results:

- `pnpm architecture:check` - passed
- `pnpm api:contract` - passed
- `pnpm format:check` - passed
- `pnpm docs:check` - passed
- `pnpm --filter @open-practice/domain test` - passed, 32 files / 255 tests
- `pnpm --filter @open-practice/domain typecheck` - passed
- `pnpm --filter @open-practice/domain build` - passed
- `pnpm --filter @open-practice/database test` - passed, 27 files / 155 tests
- `pnpm --filter @open-practice/database db:check` - passed
- `pnpm migrations:check` - passed
- `pnpm migrations:lint` - passed
- `pnpm --filter @open-practice/database typecheck` - passed
- `pnpm --filter @open-practice/database build` - passed
- `pnpm --filter @open-practice/providers build` - passed as a prerequisite for API/worker package
  resolution in the clean sibling worktree
- `pnpm --filter @open-practice/api test` - passed, 43 files / 614 tests
- `pnpm --filter @open-practice/api typecheck` - passed after provider build
- `pnpm --filter @open-practice/providers test` - passed, 13 files / 37 tests
- `pnpm --filter @open-practice/worker test` - passed, 6 files / 54 tests after provider build
- `git diff --check` - passed

Policy note:

- `pnpm policy:check` reached and passed tracked-secret scanning, package-manifest policy, lockfile
  supply-chain policy, toolchain policy, env-surface policy, architecture policy, dead-code policy,
  migration parity, and migration lint, then failed in `node scripts/validate-oss-reuse.mjs`.
- `node scripts/validate-oss-reuse.mjs` reproduces the same pre-existing OSS reference lock drift:
  21 `docs/oss-references.lock.json` commit pins no longer match
  `/Users/bryan/projects/reference-repos/docs/index.json`.
- The post-failure policy subchecks passed when run directly:
  `node scripts/validate-validation-proof-index.mjs`,
  `node scripts/validate-local-evidence-dockerignore.mjs`, and
  `node scripts/validate-open-practice-boundaries.mjs`.
- The reopen slice does not add dependencies, vendored assets, copied reference excerpts, or
  reference-derived implementation code. The reference-lock refresh is intentionally left out of
  this narrow lifecycle boundary.
