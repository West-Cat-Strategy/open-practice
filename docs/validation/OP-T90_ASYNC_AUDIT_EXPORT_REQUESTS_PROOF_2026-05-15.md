# OP-T90 Async Audit Export Requests Proof

**Date:** 2026-05-15
**Status:** Review-ready

## Scope

Implemented the first worker-owned report/export slice for audit exports.

- Added a `reports` queue name across domain, database schema, API queue wiring, worker queue
  configuration, and job status surfaces.
- Added queued audit export request endpoints with create, poll, and download links.
- Configured report queues now create `queued` lifecycle records; downloads return
  `AUDIT_EXPORT_NOT_READY` until the worker marks the report job `completed`.
- Kept report bodies out of job metadata; export jobs only record bounded summary metadata such as
  report type, report scope, requesting user, and event count.
- Returned redacted audit export content with metadata keys and hash fields instead of raw metadata
  values.
- Added bounded `/api/jobs` pagination with `limit`, `cursor`, `nextCursor`, and `hasMore`.
- Added connector event allowlist rejection coverage and a selector ratchet for the `scripts`
  shorthand while this path set was already under validation.

## Clean-Room Notes

- Reference repositories were recorded as behavior-level planning inputs in
  [Application Strengthening Plan](../development/application-strengthening-plan.md).
- No source, fixtures, copied implementation text, schemas, or assets were copied from reference
  repositories.
- All test data is synthetic and matter-scoped.

## Validation

Current narrow re-proof after queue/download tightening:

- `pnpm verify:select -- --files apps/api/src/routes/audit.ts apps/api/src/routes/audit.test.ts apps/worker/src/processors.ts apps/worker/src/processors.test.ts docs/planning-and-progress.md docs/validation/OP-T90_ASYNC_AUDIT_EXPORT_REQUESTS_PROOF_2026-05-15.md`
- `pnpm --filter @open-practice/api exec vitest run src/routes/audit.test.ts src/routes/jobs.test.ts`
- `pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts src/queues.test.ts`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm docs:check`
- `pnpm format:check`
- `pnpm policy:check`

Earlier full-slice proof from the initial OP-T90 implementation:

- `pnpm verify:select -- --dirty`
- `node --test scripts/select-validation.test.mjs`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api exec vitest run src/routes/audit.test.ts src/routes/jobs.test.ts src/routes/connectors.test.ts`
- `pnpm --filter @open-practice/worker exec vitest run src/queues.test.ts src/processors.test.ts`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm docs:check`
- `pnpm format:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm build`

All listed checks passed.

## Follow-Up

OP-T91 remains the next ordered strengthening slice: dashboard freshness, retry controls, stale/error
states, and redacted lane error copy.
