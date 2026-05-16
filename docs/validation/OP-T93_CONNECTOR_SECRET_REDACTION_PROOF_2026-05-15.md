# OP-T93 Connector Secret Redaction Proof

Date: 2026-05-15; refreshed 2026-05-16

## Scope

OP-T93 hardens connector secret handling across the API, worker, and repository seam.

- Connector API reads return the masked unchanged-secret sentinel instead of stored secret-reference IDs.
- Connector updates preserve stored secret references when clients echo the masked sentinel.
- Connector retry/error summaries and delivery-attempt metadata are sanitized at the repository boundary before API, backup, or export-style reads can observe them.

## Validation

Initial focused test runs in the fresh worktree failed before executing OP-T93 tests because the worktree did not have `node_modules`. After `pnpm install`, package tests still needed built sibling package entrypoints, so `@open-practice/domain`, `@open-practice/database`, and `@open-practice/providers` were built before rerunning the focused suites.

Passing checks:

- `pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/api/src/routes/connectors.test.ts apps/api/src/routes/outbound-webhooks.ts apps/api/src/routes/outbound-webhooks.test.ts apps/worker/src/processors.ts apps/worker/src/processors.test.ts packages/database/src/repository/contracts.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/test/repository.connectors.test.ts packages/domain/src/audit-taxonomy.ts docs/api-and-state-machines.md docs/planning-and-progress.md`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/api test -- src/routes/connectors.test.ts src/routes/outbound-webhooks.test.ts`
- `pnpm --filter @open-practice/worker test -- src/processors.test.ts`
- `pnpm --filter @open-practice/database test -- test/repository.connectors.test.ts`
- `pnpm --filter @open-practice/domain test -- audit-taxonomy.test.ts outbound-webhooks.test.ts`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/providers test`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm format:check`
- `git diff --check`

Notes:

- The API test command ran the full API suite: 31 files, 291 tests passed.
- The worker test command ran the worker suite: 3 files, 18 tests passed.
- The database test command ran the database suite: 14 files, 62 tests passed.
