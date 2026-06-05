# OP-INMAIL Replay Recovery Proof

Date: 2026-06-04 PDT

## Scope

- Corrected the Mailgun raw-MIME webhook storage key so newly accepted raw objects land under the
  worker-accepted `inbound-email/<firmId>/raw/` namespace.
- Added owner-only `POST /api/inbound-email/parser-jobs/:jobId/retry` recovery for failed and
  dead-letter parser lifecycle jobs. Retry creates a new durable parser job that points at the
  same private raw object, leaves the source job intact, and returns only redacted job summaries.
- Added owner-only `POST /api/inbound-email/parser-jobs/:jobId/dead-letter` recovery for failed or
  stalled queued/active parser lifecycle jobs, with current-status confirmation and safe audit
  metadata.
- Preserved repository contracts, response redaction, parser behavior, provider configuration,
  migrations, dependencies, and dashboard UI boundaries.

Out of scope: historical object migration or object-copy repair, durable replay-cache storage,
new inbound provider adapters, automatic document promotion, parser changes, dashboard controls,
or production delivery claims.

## Changed Paths

- `apps/api/src/routes/inbound-email.ts`
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/jobs.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `scripts/route-authorization-manifest.mjs`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md`
- `docs/validation/OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md`

## Focused Validation

| Command                                                                                                                                          | Result | Notes                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts src/routes/jobs.test.ts --pool forks --fileParallelism=false` | Passed | 2 files, 53 tests; Mailgun raw namespace, parser retry/dead-letter controls, access guards, route redaction, and job redaction. |
| `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts --pool forks --fileParallelism=false`                            | Passed | 1 file, 22 tests; recovery audit taxonomy actions and safe metadata hints.                                                      |
| `pnpm --filter @open-practice/api typecheck`                                                                                                     | Passed | API TypeScript no-emit passed after package bootstrap.                                                                          |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                  | Passed | Domain TypeScript no-emit passed.                                                                                               |

## Final Selector And Gates

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Result | Notes                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/jobs.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts scripts/route-authorization-manifest.mjs docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md docs/validation/OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md` | Passed | Selector recommended `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`, domain/API tests and typechecks, providers tests, and worker tests for this final changed-path set.                                                            |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Passed | Prettier check passed after targeted formatting for the reconciled workboard row.                                                                                                                                                                             |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Passed | Documentation index and link checks passed.                                                                                                                                                                                                                   |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Passed | Secret scan, package manifests, migration parity, OSS reuse, docs links, and boundary validation passed.                                                                                                                                                      |
| `pnpm test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Passed | Repo test gate passed: domain 167 tests, providers 18 tests, web 133 tests, database 101 tests, worker 34 tests, API 477 tests, and script tests 38 tests. Expected synthetic route/error logs and localStorage warnings appeared while the command exited 0. |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed | 24 files, 167 tests.                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed | Domain TypeScript no-emit passed.                                                                                                                                                                                                                             |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Passed | 41 files, 477 tests. Expected synthetic route/error logs appeared during route tests while the command exited 0.                                                                                                                                              |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Passed | API TypeScript no-emit passed.                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/providers test`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed | 7 files, 18 tests.                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/worker test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed | 3 files, 34 tests.                                                                                                                                                                                                                                            |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Passed | No whitespace errors reported.                                                                                                                                                                                                                                |

## Boundary Notes

- Recovery endpoints require `job:update`; current role permissions keep the controls owner-only.
- Recovery responses use existing redacted job serialization and do not expose raw MIME,
  `rawStorageKey`, object-storage keys, signing material, provider tokens, or raw failure details.
- Retry is idempotent by source parser job plus optional operator idempotency key. Duplicate retry
  requests return the existing retry job without enqueueing a second parser job.
- Dead-letter recovery for queued or active jobs requires the same stalled thresholds used by
  worker-health reporting: queued over 60 minutes or active over 30 minutes.

## Skipped Checks

- Docker-backed browser coverage was not run because this API-only slice has no dashboard UI.
- Manual browser coverage was not run.
