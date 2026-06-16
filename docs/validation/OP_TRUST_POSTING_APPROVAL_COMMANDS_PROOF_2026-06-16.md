# Trust Posting Approval Commands Proof

Date: 2026-06-16 PDT

## Scope

Implemented the smallest opt-in pre-post trust posting approval command flow:

- `trust_posting_requests` stores selected proposed trust ledger transactions before they become
  effective, with `pending_approval`, `posted`, and `rejected` statuses.
- `GET /api/ledger/posting-requests`, `POST /api/ledger/posting-requests/prepare`,
  `POST /api/ledger/posting-requests/:id/approve`, and
  `POST /api/ledger/posting-requests/:id/reject` expose prepare/list/approve/reject commands.
- Existing `POST /api/ledger/transactions` remains the immediate posting path for non-selected
  postings, but a pending selected request with the same ledger idempotency key blocks bypass until
  checker decision.
- Approval posts the stored proposed transaction through the existing ledger transaction path,
  reusing balanced-entry validation, idempotency fingerprinting, explicit reversal posture, and
  current no-overdraft checks at approval time.
- The Funds trust controls workbench now returns and renders concise pending/posted/rejected
  posting-request cues without adding a full transaction-entry UI.

## Boundaries Preserved

- No trust-transfer auto-posting, settlement automation, bank-feed matching, provider integration,
  or automatic reconciliation was added.
- Trust-transfer approve/reject/link remains a separate billing-side flow. Posting-request approval
  directly records the resulting ledger transaction ID and does not add an approved-but-unposted/link
  state.
- Maker-checker posture is operational support only: the preparer cannot approve or reject their own
  request, and this slice does not claim jurisdiction-certified trust accounting or compliance
  certification.
- Audit metadata stores safe IDs/counts/boolean posture only; raw preparation notes, review notes,
  and rejection reasons are not copied into audit payloads.
- Synthetic fixture data only; no client, matter, credential, payment, settlement, or deployment
  details were added.

## Implementation Notes

- Domain: posting-request status constants, record validation, transaction conversion, request
  fingerprint/idempotency checks, reversal posture, and trust-control summary helpers.
- Database: migration `0061_trust_posting_requests.sql`, Drizzle schema, memory and Drizzle
  repository support for prepare/list/get/approve/reject, clone safety, idempotent prepare replay,
  pending-only decisions, approval posting, and rejection without posting.
- API: route authorization manifest coverage; existing trust-ledger create/read/approve
  authorization; matter-scoped list and decision restrictions; no self-approval; safe workflow audit
  events; direct-post guardrails for pending selected requests.
- Web: typed trust controls response defaults, summary counts, and rendered pending/posted/rejected
  posting-request cues in the Funds trust controls section.

## Validation Selection

Selector input:

```sh
pnpm verify:select -- --files apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/posting-requests.ts apps/api/src/routes/ledger/read.ts apps/api/src/routes/ledger/transactions.ts apps/web/app/_features/billing/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/trust-controls-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/OP_TRUST_POSTING_APPROVAL_COMMANDS_PROOF_2026-06-16.md docs/validation/README.md packages/database/migrations/0061_trust_posting_requests.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/ledger-posting-requests-contracts.ts packages/database/src/repository/ledger-posting-requests/drizzle.ts packages/database/src/repository/ledger-posting-requests/memory.ts packages/database/src/repository/memory.ts packages/database/src/schema/ledger.ts packages/database/test/repository.ledger.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/ledger.test.ts packages/domain/src/ledger.ts scripts/route-authorization-manifest.mjs
```

Selector output:

- `pnpm policy:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`

## Final Validation

| Command                                                                                             | Result                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain test -- ledger.test.ts audit-taxonomy.test.ts`                 | Passed: domain suite ran 28 files / 190 tests.                                                                                               |
| `pnpm --filter @open-practice/domain typecheck`                                                     | Passed.                                                                                                                                      |
| `pnpm --filter @open-practice/database test`                                                        | Passed: 21 files / 125 tests.                                                                                                                |
| `pnpm --filter @open-practice/database db:check`                                                    | Passed: Drizzle schema check clean.                                                                                                          |
| `pnpm migrations:check`                                                                             | Passed: 62 SQL files match 62 journal entries.                                                                                               |
| `pnpm --filter @open-practice/database typecheck`                                                   | Passed.                                                                                                                                      |
| `pnpm --filter @open-practice/database build`                                                       | Passed.                                                                                                                                      |
| `pnpm --filter @open-practice/api test`                                                             | Passed: 41 files / 539 tests.                                                                                                                |
| `pnpm --filter @open-practice/api typecheck`                                                        | Passed.                                                                                                                                      |
| `pnpm --filter @open-practice/web test -- trust-controls-section.test.tsx dashboard-client.test.ts` | Passed: web suite ran 35 files / 193 tests.                                                                                                  |
| `pnpm --filter @open-practice/web typecheck`                                                        | Passed.                                                                                                                                      |
| `pnpm policy:check`                                                                                 | Passed: secrets scan, package policy, dead-code check, migrations, OSS reuse, docs links, proof index, evidence ignore, and boundary policy. |
| `pnpm format:check`                                                                                 | Passed.                                                                                                                                      |
| `pnpm docs:check`                                                                                   | Passed.                                                                                                                                      |
| `pnpm build`                                                                                        | Passed: all 6 package builds completed.                                                                                                      |
| `git diff --check`                                                                                  | Passed.                                                                                                                                      |

Notes:

- The first database focused test attempt exposed an invalid conflicting-idempotency fixture; the
  fixture now builds a valid changed posting request before asserting the conflict shape.
- The first API focused test attempt checked for no ledger side effect after approval; the assertion
  now verifies no side effect immediately after preparation, before approval posts the transaction.
- A fresh-worktree typecheck ordering issue was resolved by building upstream workspace packages
  before dependent package typechecks.
