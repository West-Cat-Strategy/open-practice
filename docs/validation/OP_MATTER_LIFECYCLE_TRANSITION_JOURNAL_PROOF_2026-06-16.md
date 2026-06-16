# Matter Lifecycle Transition Journal Proof - 2026-06-16

## Scope

This slice adds append-only, review-only matter lifecycle transition records for pause, close,
archive, and reopen readiness. Records store the current matter status snapshot, the fixed target
status, readiness, concise reason/blocker evidence, reviewer, reviewed timestamp, and creation
timestamp.

The journal is evidence-only. It does not mutate `matters.status`, `closedOn`, assignments, portal
access, tasks, billing records, or cleanup state, and it does not automate pausing, closing,
archiving, or reopening.

## Implementation Notes

- Domain validation fixes transition-to-target mappings:
  `pause -> paused`, `close -> closed`, `archive -> archived`, and `reopen -> open`.
- Database persistence uses migration `0060_matter_lifecycle_transition_records.sql` and an
  append-only table indexed by `firm_id, matter_id, reviewed_at`.
- API routes require staff access plus matter-scoped authorization:
  `matter:read` for listing and `matter:update` for creation.
- Matter summaries include recent lifecycle records only for matters the caller can already see.
- The Matter Overview dashboard shows recent readiness records and creation controls only inside the
  existing authorized matter workspace.
- Audit metadata records safe IDs, status snapshots, readiness, transition, blocker count, and
  review-only posture without storing blocker text or private evidence bodies.

## Validation

- `pnpm verify:select -- --files apps/api/src/routes/matters.test.ts apps/api/src/routes/matters.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/intake-section.test.tsx apps/web/app/dashboard/matter-overview-section.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/matter-command-center.ts apps/web/app/types.ts apps/worker/src/processors.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_MATTER_LIFECYCLE_TRANSITION_JOURNAL_PROOF_2026-06-16.md docs/validation/README.md packages/database/migrations/0060_matter_lifecycle_transition_records.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/matter-lifecycle-contracts.ts packages/database/src/repository/matter-lifecycle/drizzle.ts packages/database/src/repository/matter-lifecycle/memory.ts packages/database/src/repository/matter-workspace-contracts.ts packages/database/src/repository/matter-workspace/drizzle.ts packages/database/src/repository/matter-workspace/memory.ts packages/database/src/repository/memory.ts packages/database/src/schema/matters.ts packages/database/test/repository.matter-lifecycle.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/index.ts packages/domain/src/matter-lifecycle.test.ts packages/domain/src/matter-lifecycle.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs` -
  passed and selected format, docs, policy, root/package tests, domain/database/API/provider/worker/
  web typechecks, database schema/migration checks, worker build, database build, and root build.
- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed after removing a stale, unrelated contact-history export manifest
  entry; boundary policy, proof index, OSS reuse, local evidence ignore, migration parity, package
  manifest, secret scan, and dead-code checks passed.
- `pnpm test` - passed on rerun: 9 Turbo package tasks plus script tests, including API 41 files/534
  tests, web 35 files/191 tests, worker 5 files/42 tests, providers 9 files/20 tests, database 21
  files/123 tests, domain 28 files/187 tests, and 63 Node script tests.
- `pnpm --filter @open-practice/domain test` - passed: 28 files/187 tests.
- `pnpm --filter @open-practice/domain typecheck` - passed.
- `pnpm --filter @open-practice/domain build` - passed.
- `pnpm --filter @open-practice/database test` - passed: 21 files/123 tests.
- `pnpm --filter @open-practice/database db:check` - passed.
- `pnpm migrations:check` - passed: 61 SQL files match 61 journal entries.
- `pnpm --filter @open-practice/database typecheck` - passed.
- `pnpm --filter @open-practice/database build` - passed.
- `pnpm exec vitest run src/routes/matters.test.ts` from `apps/api` - passed: 18 tests.
- `pnpm --filter @open-practice/api typecheck` - passed.
- `pnpm --filter @open-practice/providers test` - passed: 9 files/20 tests.
- `pnpm --filter @open-practice/worker test` - passed on rerun after making generated document ID
  metadata assertion order-insensitive: 5 files/42 tests.
- `pnpm --filter @open-practice/worker typecheck` - passed.
- `pnpm --filter @open-practice/worker build` - passed.
- `pnpm --filter @open-practice/web test` - passed: 35 files/191 tests.
- `pnpm --filter @open-practice/web typecheck` - passed.
- `pnpm build` - passed for all six packages.
- `git diff --check` - passed.

Transient validation notes:

- An early broad `pnpm --filter @open-practice/api test` run timed out in one unrelated CalDAV test
  while the machine was under concurrent validation load. `pnpm exec vitest run
src/routes/caldav.test.ts` from `apps/api` passed on direct rerun, and the later root `pnpm test`
  run passed the full API suite.
- An early worker run exposed a generated document ID ordering assumption unrelated to lifecycle
  behavior. `apps/worker/src/processors.test.ts` now checks the unordered generated ID set and count;
  the direct worker suite and root `pnpm test` both passed afterward.
