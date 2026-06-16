# Workflow-Step History Projection Proof - 2026-06-16

## Scope

Branch: `feature/workflow-step-history`

This branch adds a read-only workflow-step history projection over existing job lifecycle records and
workflow-shaped audit events. It does not add Temporal, a new workflow engine, BullMQ orchestration
changes, new worker processors, a persisted workflow table, or sensitive payload/body storage.

## Implemented Surfaces

- Domain projection in `packages/domain/src/workflow-audit.ts` groups safe job lifecycle records and
  workflow audit envelopes by request ID first, then job/retry/resource identity.
- `GET /api/jobs/workflows` returns compact histories with status, timing, matter IDs, queue/job
  references, retry/idempotency cues, and ordered steps. It is declared before `/api/jobs/:jobId`
  and covered by the route authorization manifest as `job:read`.
- Owner/admin/auditor users can read firm-wide projected histories. Other staff are constrained by
  existing job lifecycle visibility and matter-scoped audit-event visibility.
- The Operations dashboard loads the projection through
  `apps/web/app/_features/operations/server-resources.ts` and renders compact history rows in the
  existing Queues section near worker runs.

## Redaction Boundary

The projection serializes only safe metadata keys and values already allowed by the job redaction
and workflow audit metadata builders. It omits raw job payload bodies, raw audit metadata values
outside the workflow allowlist, idempotency keys, tokens, storage keys, provider blobs, emails,
generated text, private evidence, and privileged diagnostics.

## Selector Path Set

Final selector path set:

```text
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/jobs.ts
apps/web/app/_features/operations/server-resources.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/queues-section.tsx
apps/web/app/page.tsx
apps/web/app/types.ts
apps/web/app/worker-runs-dashboard.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_WORKFLOW_STEP_HISTORY_PROJECTION_PROOF_2026-06-16.md
docs/validation/README.md
packages/domain/src/permissions.ts
packages/domain/src/workflow-audit.test.ts
packages/domain/src/workflow-audit.ts
scripts/route-authorization-manifest.mjs
```

## Validation

Validation is being run from the branch worktree
`/Users/bryan/projects/open-practice-workflow-step-history`.

| Command                                                                                                             | Status | Notes                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final changed paths>`                                                               | Passed | Recommended format, docs, policy, root/package tests, typechecks, and build.                 |
| `pnpm --filter @open-practice/domain test -- workflow-audit`                                                        | Passed | Focused domain projection and redaction coverage passed: 27 files, 174 tests.                |
| `pnpm --filter @open-practice/api exec vitest run src/routes/jobs.test.ts -t "workflow history" --reporter=verbose` | Passed | Focused API route coverage passed: 2 workflow-history tests.                                 |
| `pnpm --filter @open-practice/web test -- dashboard-client`                                                         | Passed | Focused dashboard helper/render coverage passed: 35 files, 187 tests.                        |
| `pnpm --filter @open-practice/domain test`                                                                          | Passed | 27 files, 174 tests.                                                                         |
| `pnpm --filter @open-practice/domain typecheck`                                                                     | Passed | TypeScript no-emit check.                                                                    |
| `pnpm --filter @open-practice/domain build`                                                                         | Passed | Build output refreshed for downstream API/web checks.                                        |
| `pnpm --filter @open-practice/api test`                                                                             | Passed | 41 files, 516 tests.                                                                         |
| `pnpm --filter @open-practice/api typecheck`                                                                        | Passed | TypeScript no-emit check.                                                                    |
| `pnpm --filter @open-practice/web test`                                                                             | Passed | 35 files, 187 tests.                                                                         |
| `pnpm --filter @open-practice/web typecheck`                                                                        | Passed | TypeScript no-emit check.                                                                    |
| `pnpm --filter @open-practice/providers test`                                                                       | Passed | 9 files, 20 tests.                                                                           |
| `pnpm --filter @open-practice/worker test`                                                                          | Passed | 5 files, 40 tests.                                                                           |
| `pnpm test`                                                                                                         | Passed | Turbo package tests plus 63 script tests.                                                    |
| `pnpm build`                                                                                                        | Passed | Turbo build across all six packages.                                                         |
| `pnpm format:check`                                                                                                 | Passed | Prettier check after formatting touched files.                                               |
| `pnpm docs:check`                                                                                                   | Passed | Documentation links passed.                                                                  |
| `pnpm policy:check`                                                                                                 | Passed | Secrets, package policy, dead code, migrations, OSS reuse, proof index, and boundaries pass. |

## Test Scenarios Covered

- Workflow audit events plus linked jobs produce ordered multi-step histories.
- Job-only records still appear as bounded histories.
- Non-firm-wide users cannot see unrelated matter workflows.
- Serialized output omits raw bodies, tokens, storage keys, generated/private text, provider
  payloads, raw idempotency keys, and unsafe audit metadata values.
- Dashboard Queues renders empty/default, active/queued, failed/retryable, and completed workflow
  history states without introducing a new navigation surface.
