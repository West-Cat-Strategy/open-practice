# OP Refund And Chargeback Review Decisions Proof - 2026-06-29

Date: 2026-06-29
Branch: `feat/refund-chargeback-review-decisions-20260629`
Base: `origin/main`
Status: Implemented as staff-only, provider-neutral decision records over existing payment import
refund/chargeback cues.

## Scope

This slice adds the smallest durable staff decision layer over existing payment import exception
cues.

- Only existing payment import review records with `eventFamily="payment"` and `eventStatus` of
  `refund_observed` or `chargeback_observed` can receive decisions.
- Decisions are enum-only: `exception_confirmed`, `exception_rejected`, or
  `needs_more_evidence`.
- Reasons are enum-only: `refund_observed`, `chargeback_observed`, `duplicate_or_conflict`,
  `candidate_reference_mismatch`, `missing_reviewer_evidence`, or `status_unclear`.
- `exception_confirmed` must use the reason matching the derived cue category.
- Idempotency is keyed by `(firm, payment import review record, idempotency key)`: identical
  replays return the existing decision and changed replays conflict.
- Billing dashboard payloads and UI expose read-only decision counts plus the latest decision
  posture for staff visibility.

## Boundary

- No provider calls, refund execution, dispute/chargeback workflow, ledger reversal, invoice
  mutation, allocation mutation, trust transfer, trust posting, client notification, settlement
  automation, reconciliation automation, dashboard form/control, or funds movement.
- No amounts, external payment/event IDs, raw provider payloads, webhook headers, signing material,
  card/customer data, checkout URLs, receipt files, dispute packets, refund artifacts, chargeback
  payloads, provider private metadata, object keys, notes, reviewer free text, or provider schemas
  are stored in the decision table, audit metadata, docs, proof, or sample data.
- Stored decision fields are limited to safe IDs, firm/matter/import-record link, derived category,
  enum decision/reason, idempotency key/fingerprint, reviewer user/timestamps, reviewer evidence
  posture, and explicit no-side-effect boundary flags.
- Synthetic data only.

## Final Changed Paths

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/billing/server-resources.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP_REFUND_CHARGEBACK_REVIEW_DECISIONS_PROOF_2026-06-29.md
docs/validation/README.md
packages/database/migrations/0075_payment_import_refund_chargeback_reviews.sql
packages/database/migrations/meta/0075_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/billing.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
scripts/route-authorization/billing.mjs
```

## Focused Development Proof

| Command                                                                                                         | Status | Notes                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain test -- billing.test.ts audit-taxonomy.test.ts`                            | Pass   | Package script ran the domain suite: 33 files and 267 tests passed, including enum/boundary defaults and audit taxonomy allowlist coverage. |
| `pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts schema.test.ts` | Pass   | Passed after building `@open-practice/domain`; package script ran the database suite: 27 files and 162 tests passed.                        |
| `pnpm --filter @open-practice/domain build`                                                                     | Pass   | Domain build passed after the first database test attempt exposed the fresh-worktree missing `dist` package output.                         |
| `pnpm --filter @open-practice/database build`                                                                   | Pass   | Database build passed.                                                                                                                      |
| `pnpm --filter @open-practice/providers build`                                                                  | Pass   | Providers build passed for downstream package resolution.                                                                                   |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`                                   | Pass   | Focused Billing API route suite passed: 1 file and 32 tests.                                                                                |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx`                       | Pass   | Focused Billing dashboard render test passed: 1 file and 1 test.                                                                            |
| `pnpm --filter @open-practice/api test -- billing.test.ts`                                                      | Pass   | A later broad API run passed; an earlier package-script argument-forwarding attempt hit a transient unrelated `document-assembly` timeout.  |

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/billing/payment-import-review-records.ts apps/web/app/_features/billing/models.ts apps/web/app/_features/billing/server-resources.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP_REFUND_CHARGEBACK_REVIEW_DECISIONS_PROOF_2026-06-29.md docs/validation/README.md packages/database/migrations/0075_payment_import_refund_chargeback_reviews.sql packages/database/migrations/meta/0075_snapshot.json packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/payment-import-review-records-contracts.ts packages/database/src/repository/payment-import-review-records/drizzle.ts packages/database/src/repository/payment-import-review-records/memory.ts packages/database/src/schema/billing.ts packages/database/test/repository.payment-import-review-records.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts scripts/route-authorization/billing.mjs
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                              | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                     | Pass    | Selector produced the command set above for the exact 31-path final change set.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm architecture:check`                                                                                                            | Pass    | Architecture import policy passed: 462 workspace import edges reviewed.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm api:contract`                                                                                                                  | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 343 paths, including the new refund/chargeback review decision routes.                                                                                                                                                                                                                                                                                                                                           |
| `pnpm format:check`                                                                                                                  | Pass    | Repo-wide Prettier check passed after formatting supported Markdown/JSON/TypeScript files; SQL remains covered by migration checks.                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm docs:check`                                                                                                                    | Pass    | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm policy:check`                                                                                                                  | Blocked | Blocked by unrelated central reference-index lock drift after secret scan, package manifest policy, lockfile supply-chain policy, toolchain policy, env surface, architecture, dead-code, migration parity, and migration lint subchecks passed. Failing refs were existing central-lock mismatches such as `activepieces__activepieces`, `apache__fineract`, `opencollective__opencollective-api`, `openfga__openfga`, `temporalio__temporal`, and other reference corpus entries. |
| `pnpm test`                                                                                                                          | Pass    | Root Turbo test plus script tests passed: package suites green and 182 script tests passed.                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/domain test`                                                                                           | Pass    | Domain suite passed: 33 files and 267 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                                                      | Pass    | Domain TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/domain build`                                                                                          | Pass    | Domain build passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/database test`                                                                                         | Pass    | Database suite passed: 27 files and 162 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/database db:check`                                                                                     | Pass    | Drizzle schema check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm migrations:check`                                                                                                              | Pass    | Migration parity passed: 76 SQL files and 76 journal entries.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm migrations:lint`                                                                                                               | Pass    | Migration lint passed; no destructive/not-null-without-default findings.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/database typecheck`                                                                                    | Pass    | Database TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/database build`                                                                                        | Pass    | Database build passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api test`                                                                                              | Pass    | API suite passed: 43 files and 623 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/api typecheck`                                                                                         | Pass    | API TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/providers test`                                                                                        | Pass    | Providers suite passed: 13 files and 37 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/worker test`                                                                                           | Pass    | Worker suite passed: 6 files and 54 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web test`                                                                                              | Pass    | Web suite passed: 46 files and 243 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/web typecheck`                                                                                         | Pass    | Web TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm build`                                                                                                                         | Pass    | Turbo build passed: 6 successful package build tasks.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `git diff --check`                                                                                                                   | Pass    | Dirty-tree whitespace check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm proof:reconcile -- --proof docs/validation/OP_REFUND_CHARGEBACK_REVIEW_DECISIONS_PROOF_2026-06-29.md --files <final path set>` | Pass    | Proof reconciliation passed for 31 paths and the selector command set above.                                                                                                                                                                                                                                                                                                                                                                                                        |

## Notes

The root checkout at `/Users/bryan/projects/open-practice` had unrelated dirty work before this
slice started. This implementation was made in a clean sibling worktree at
`/Users/bryan/projects/open-practice-refund-chargeback-decisions` to preserve that unrelated work.
