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
- `docs/validation/OP_CLIO_PARITY_AUDIT_PROOF_2026-06-01.md`
- `docs/validation/README.md`
- `packages/database/migrations/0046_ai_operational_proposals.sql`
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

| Command                                                                                           | Result | Notes                                                                                      |
| ------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files <changed paths>`                                                   | Pass   | Selected format, docs, policy, tests, typechecks, db/migration checks, and build.          |
| `pnpm --filter @open-practice/domain test -- ai-operational-proposals audit-taxonomy permissions` | Pass   | Proposal validation, status-only review, safe metadata, permissions, and audit taxonomy.   |
| `pnpm --filter @open-practice/providers test -- providers`                                        | Pass   | Fake provider returns synthetic proposals for all five families.                           |
| `pnpm --filter @open-practice/database test -- repository.drafts schema`                          | Pass   | Schema/repository coverage for create/list/review behavior and migration shape.            |
| `pnpm --filter @open-practice/api test -- ai-operational-proposals`                               | Pass   | List, queue, disabled-provider, document-gating, review-only, and cross-matter denial.     |
| `pnpm --filter @open-practice/worker test -- processors`                                          | Pass   | Worker creates proposal records and skips safely without provider/source availability.     |
| `pnpm --filter @open-practice/web test -- dashboard-client`                                       | Pass   | Queues dashboard counters/rows, hidden read-only review controls, and draft queue helpers. |
| `pnpm format:check`                                                                               | Pass   | Prettier clean after formatting touched OP-T138 files.                                     |
| `pnpm docs:check`                                                                                 | Pass   | Documentation links passed.                                                                |
| `pnpm policy:check`                                                                               | Pass   | Secret scan, package policy, migration parity, OSS reuse, docs links, and boundaries.      |
| `pnpm migrations:check`                                                                           | Pass   | 47 SQL files match 47 journal entries.                                                     |
| `pnpm --filter @open-practice/database db:check`                                                  | Pass   | Drizzle schema check passed.                                                               |
| `pnpm test`                                                                                       | Pass   | Workspace tests passed, including domain/database/providers/web/worker/API and scripts.    |
| `pnpm --filter @open-practice/domain typecheck`                                                   | Pass   | Domain typecheck passed.                                                                   |
| `pnpm --filter @open-practice/database typecheck`                                                 | Pass   | Database typecheck passed.                                                                 |
| `pnpm --filter @open-practice/api typecheck`                                                      | Pass   | API typecheck passed.                                                                      |
| `pnpm --filter @open-practice/providers typecheck`                                                | Pass   | Providers typecheck passed.                                                                |
| `pnpm --filter @open-practice/worker typecheck`                                                   | Pass   | Worker typecheck passed.                                                                   |
| `pnpm --filter @open-practice/web typecheck`                                                      | Pass   | Web typecheck passed after keeping client proposal helper type-only.                       |
| `pnpm --filter @open-practice/providers build`                                                    | Pass   | Providers build passed.                                                                    |
| `pnpm --filter @open-practice/worker build`                                                       | Pass   | Worker build passed.                                                                       |
| `pnpm build`                                                                                      | Pass   | Full workspace build passed after removing a client runtime domain import.                 |
| `git diff --check`                                                                                | Pass   | No whitespace errors.                                                                      |

Local package build refreshes were needed before rerunning API/worker/web tests so the test runners
could see the newly exported domain, database, and provider runtime methods.

An initial full build failed when the new web proposal helper imported runtime values from
`@open-practice/domain`, which pulled Node-only `node:crypto` into the client bundle through the
domain index. The helper now imports domain types only and keeps the small proposal-kind list and
summary calculation local to the web layer; `pnpm --filter @open-practice/web typecheck`, the focused
web test, and `pnpm build` passed after that fix.
