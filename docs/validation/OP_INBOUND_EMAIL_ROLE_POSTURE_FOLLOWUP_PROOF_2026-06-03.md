# Inbound Email Role Posture Follow-Up Proof

Date: 2026-06-03 PDT

## Scope

Followed up the 2026-06-02 security remediation by tightening direct inbound-email role posture
without adding migrations, dependencies, provider webhooks, web UI, or a broader role-matrix
rewrite.

Implemented:

- Added direct-route API coverage for inbound-email status, message list/detail, triage mutation,
  and attachment promotion authorization.
- Preserved owner/admin and auditor firm-wide inbound-email review posture.
- Preserved matter-scoped internal reads, including the existing `billing_bookkeeper` matter read
  contract.
- Denied `client_external` users from direct inbound-email APIs.
- Kept matter-scoped status responses filtered to assigned-matter addresses, with no provider key,
  no general/unscoped address, and no other-matter address exposure.
- Required worker `rawStorageKey` values to stay inside the job firm's
  `inbound-email/<firmId>/raw/` namespace before S3 reads.
- Kept OP-T143 SSE-S3 object write behavior while removing storage-key, filename, provider-message,
  and attachment-detail metadata from direct inbound-email worker results and lifecycle metadata.

Out of scope: provider webhook ingestion, automatic matter creation or matter drafts, web UI changes,
new role definitions, repository schema changes, object-store bucket policy changes, or historical
object migration.

## Focused Validation

| Command                                                                                                                                            | Result | Notes                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts --pool forks --fileParallelism=false`                           | Passed | 1 file, 25 tests; direct-route role posture, address filtering, triage, and promotion. |
| `pnpm --filter @open-practice/worker exec vitest run src/processors/inbound-email.test.ts src/queues.test.ts --pool forks --fileParallelism=false` | Passed | 2 files, 15 tests; raw-key namespace, SSE-S3 writes, and redacted job metadata.        |

## Final Selector And Gates

Selector run against the complete dirty branch path set, including the existing OP-T143
object-storage follow-up files and this inbound-email posture proof:

```sh
pnpm verify:select -- --files .env.example apps/api/src/routes/documents.test.ts apps/api/src/routes/documents.ts apps/api/src/routes/drafts.test.ts apps/api/src/routes/drafts.ts apps/api/src/routes/external-uploads.test.ts apps/api/src/routes/external-uploads.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email.ts apps/api/src/routes/intake-forms.test.ts apps/api/src/routes/intake-forms.ts apps/api/src/routes/types.ts apps/api/src/routes/upload-verification.ts apps/api/src/server.test.ts apps/api/src/server.ts apps/worker/src/processors.ts apps/worker/src/processors/inbound-email.test.ts apps/worker/src/processors/inbound-email.ts apps/worker/src/queues.test.ts apps/worker/src/worker.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/planning-and-progress.md docs/tech-stack.md docs/validation/OP_SECURITY_REVIEW_PROOF_2026-06-02.md docs/validation/README.md docs/validation/OP-T143_OBJECT_STORAGE_ENCRYPTION_FOLLOWUP_PROOF_2026-06-02.md docs/validation/OP_INBOUND_EMAIL_ROLE_POSTURE_FOLLOWUP_PROOF_2026-06-03.md
```

Selector result: passed and recommended the gate set below.

| Command                                         | Result | Notes                                                                                |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `pnpm format:check`                             | Passed | Passed after targeted Prettier on the reported dirty files.                          |
| `pnpm docs:check`                               | Passed | Documentation link validation passed.                                                |
| `pnpm policy:check`                             | Passed | Secret scan, package manifests, migration parity, OSS reuse, docs links, boundaries. |
| `pnpm --filter @open-practice/api test`         | Passed | 41 files, 451 tests.                                                                 |
| `pnpm --filter @open-practice/api typecheck`    | Passed | TypeScript no-emit passed.                                                           |
| `pnpm --filter @open-practice/worker test`      | Passed | 3 files, 34 tests.                                                                   |
| `pnpm --filter @open-practice/worker typecheck` | Passed | TypeScript no-emit passed.                                                           |
| `pnpm --filter @open-practice/worker build`     | Passed | Worker build passed.                                                                 |
| `pnpm build`                                    | Passed | Turbo build completed 6 successful package builds.                                   |

## Skipped Checks

- Docker-backed browser coverage was not run.
- Manual browser coverage was not run.

No Docker or browser coverage is claimed for this follow-up.
