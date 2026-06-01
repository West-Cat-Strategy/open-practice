# OP-T138 AI Operational Proposals Proof

Date: 2026-06-01 PDT

## Scope

OP-T138 adds a review-only operational proposal layer over the existing disabled-by-default AI
assist infrastructure. The slice covers five proposal families:

- Deadline extraction.
- Task creation.
- Document organization.
- Draft invoice cues.
- Client-update drafts.

Approvals are status-only. They update proposal review status and audit metadata but do not create
tasks, invoices, documents, messages, calendar entries, trust/operating ledger postings, or source
draft/document mutations.

## Clean-Room And Privacy Posture

- Synthetic examples only.
- No Clio prose, screenshots, schemas, API examples, templates, assets, or UI structure were copied.
- Generated proposal content can be stored only on authorized `ai_operational_proposals` review
  records.
- Job lifecycle metadata, BullMQ payload metadata, and audit metadata store IDs, source type,
  requested-kind/count fields, provider/model provenance, requester/reviewer IDs, idempotency
  posture, and source/proposal lengths only.
- No prompts, source text, generated proposal bodies, privileged content, client-update bodies,
  credentials, payment details, or private deployment data were added to job/audit metadata.

## Delivered Boundaries

- Provider-neutral domain types, validators, summary helpers, status-only review transition, and
  safe audit metadata for operational proposals.
- Matter-scoped `ai_operational_proposals` persistence with Drizzle schema, migration, repository
  methods, in-memory behavior, seed data, and database tests.
- API routes for listing, draft/document async queueing, provider-disabled `503` behavior, completed
  extraction gating, and status-only approve/reject review.
- `ai_proposal` permission resource with staff review access, auditor read/export posture, and no
  client or billing-only mutation rights.
- `ai_triage` worker support for `operational_action_proposals`, including provider/source skip
  behavior and metadata redaction.
- Fake provider support for all five proposal kinds without network calls.
- Operational Queues dashboard counters/rows/review controls and a Drafting-panel action that queues
  all five proposal families from the selected draft when async generation is configured.

## Owned Paths

- `apps/api/src/routes/ai-operational-proposals.ts`
- `apps/api/src/routes/ai-operational-proposals.test.ts`
- `apps/api/src/routes/types.ts`
- `apps/api/src/server.ts`
- `apps/web/app/ai-operational-proposals-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/queues-section.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/worker.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP-T138_AI_OPERATIONAL_PROPOSALS_PROOF_2026-06-01.md`
- `docs/validation/README.md`
- `packages/database/migrations/0045_ai_operational_proposals.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/test/repository.drafts.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/ai-operational-proposals.test.ts`
- `packages/domain/src/ai-operational-proposals.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/sample-data.ts`
- `packages/providers/src/draft-assist.ts`
- `packages/providers/test/providers.test.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/validate-open-practice-boundaries.mjs`

## Validation

| Command                                                                                           | Result         | Notes                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git diff --name-status main...HEAD`                                                              | Pass           | Confirmed the final isolated OP-T138 path set above: 42 changed paths, with no OP-T136 proof/migration/ledger paths and no OP-T139 implementation paths.                               |
| `pnpm verify:select -- --files <changed paths>`                                                   | Pass           | Ran against the exact `main...HEAD` path set; selected format, docs, policy, tests, typechecks, db/migration checks, provider/worker builds, and `pnpm build`.                         |
| `pnpm format:check`                                                                               | Pass           | First run caught `docs/planning-and-progress.md` table alignment; `pnpm exec prettier --write docs/planning-and-progress.md` fixed it, and rerun passed.                               |
| `pnpm docs:check`                                                                                 | Pass           | Documentation link validation passed.                                                                                                                                                  |
| `pnpm policy:check`                                                                               | Pass           | Secret scan, package manifest policy, migration parity, OSS reuse, docs links, and Open Practice boundaries passed.                                                                    |
| `pnpm migrations:check`                                                                           | Pass           | 46 SQL files match 46 journal entries after renumbering the isolated AI proposal migration to `0045_ai_operational_proposals.sql`.                                                     |
| `pnpm --filter @open-practice/database db:check`                                                  | Pass           | Drizzle schema check passed.                                                                                                                                                           |
| `pnpm --filter @open-practice/domain test -- ai-operational-proposals audit-taxonomy permissions` | Pass           | Domain suite passed: 23 files, 157 tests.                                                                                                                                              |
| `pnpm --filter @open-practice/providers test -- providers`                                        | Pass           | Providers suite passed: 7 files, 18 tests.                                                                                                                                             |
| `pnpm --filter @open-practice/database test -- repository.drafts schema`                          | Pass           | Database suite passed: 16 files, 91 tests.                                                                                                                                             |
| `pnpm --filter @open-practice/api exec vitest run src/routes/ai-operational-proposals.test.ts`    | Pass           | Focused OP-T138 API route test passed: 1 file, 6 tests.                                                                                                                                |
| `pnpm --filter @open-practice/worker test`                                                        | Pass           | Worker suite passed: 3 files, 29 tests.                                                                                                                                                |
| `pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts`                      | Pass           | Focused worker processor test passed: 1 file, 19 tests.                                                                                                                                |
| `pnpm --filter @open-practice/web test`                                                           | Pass           | Web suite passed: 16 files, 129 tests.                                                                                                                                                 |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`                   | Pass           | Focused dashboard client test passed: 1 file, 69 tests.                                                                                                                                |
| `pnpm test`                                                                                       | Fail - unowned | Blocked in the API package by three tests outside the final path set: billing checkout reuse, client-portal expired action expectations, and conversation-thread create returning 400. |
| `pnpm --filter @open-practice/domain typecheck`                                                   | Pass           | Domain typecheck passed.                                                                                                                                                               |
| `pnpm --filter @open-practice/database typecheck`                                                 | Pass           | Database typecheck passed.                                                                                                                                                             |
| `pnpm --filter @open-practice/api typecheck`                                                      | Pass           | API typecheck passed.                                                                                                                                                                  |
| `pnpm --filter @open-practice/providers typecheck`                                                | Pass           | Providers typecheck passed.                                                                                                                                                            |
| `pnpm --filter @open-practice/worker typecheck`                                                   | Pass           | Worker typecheck passed.                                                                                                                                                               |
| `pnpm --filter @open-practice/web typecheck`                                                      | Pass           | Web typecheck passed.                                                                                                                                                                  |
| `pnpm --filter @open-practice/providers build`                                                    | Pass           | Providers build passed.                                                                                                                                                                |
| `pnpm --filter @open-practice/worker build`                                                       | Pass           | Worker build passed.                                                                                                                                                                   |
| `pnpm build`                                                                                      | Pass           | Full workspace build passed.                                                                                                                                                           |
| `git diff --check`                                                                                | Pass           | No whitespace errors.                                                                                                                                                                  |

The `pnpm test` failure is intentionally not fixed in this OP-T138 slice because the failing files
are outside the final diff and match the inherited closeout area that was stripped from this branch:

- `apps/api/src/routes/billing.test.ts`: checkout reuse expectation receives `reused: false`.
- `apps/api/src/routes/client-portal.test.ts`: current-date-sensitive portal action expectations
  now receive expired statuses.
- `apps/api/src/routes/conversation-threads.test.ts`: thread creation returns `400` instead of
  `201`.

The isolated OP-T138 code paths, typechecks, policy gates, migration checks, and full workspace build
passed after the branch was rebased onto `main`.
