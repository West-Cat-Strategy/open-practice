# OP-T162 Deposit-Match Review Command Boundary Proof - 2026-06-27

Date: 2026-06-27
Branch: `feat/deposit-match-review-command-boundary-20260627`
Base: local `main` at `9cb1f25e`
Status: Implemented with 2026-06-29 read-only reconciliation-readiness follow-up focused proof
recorded. Repository-wide format and policy checks have unrelated blockers documented below.

## Scope

OP-T162 adds the second runtime slice under the payment import and deposit matching boundary packet:
staff-only, provider-neutral, append-only deposit-match reviewer decisions over existing
`payment_import_review_records`.

- Domain types now model `PaymentImportDepositMatchReviewRecord` decisions
  `candidate_supported`, `candidate_rejected`, and `needs_more_evidence`, enum-only reasons, and
  no-side-effect boundary flags.
- Migration `0073_deposit_match_review_decisions` adds append-only
  `payment_import_deposit_match_reviews` rows with idempotency keyed by
  `(firmId, paymentImportReviewRecordId, idempotencyKey)`.
- `GET /api/billing/payment-import-review-records/:recordId/deposit-match-reviews` lists
  authorized reviewer decisions for one normalized payment import review record.
- `POST /api/billing/payment-import-review-records/:recordId/deposit-match-reviews` records one
  reviewer decision after staff access, derived matter-scoped `expense_entry:create`, deposit-family
  validation, same-matter candidate validation, strict request-field validation, and
  `candidate_supported` guardrails.
- Billing dashboard payloads and UI show latest deposit-match decision posture and decision counts
  as informational cues only.
- The 2026-06-29 readiness follow-up adds read-only Billing dashboard cues for latest
  `candidate_supported` decisions that still appear eligible for the existing manual-payment
  reconcile review workflow. The cue is advisory and does not call reconcile routes, allocate funds,
  clear deposits, mutate invoice balances, post trust, or issue provider commands.

## Boundary

- The command records reviewer evidence only. It does not reconcile manual payments, allocate
  funds, mutate invoice balances, create ledger entries, clear deposits, call payment providers,
  send client notifications, post trust, create trust transfers, or automate reconciliation.
- Raw provider request bodies, webhook headers, signing material, card/customer data, checkout URLs,
  receipt files, dispute packets, refund artifacts, chargeback payloads, provider private metadata,
  provider schemas, object keys, notes, and reviewer free text are not accepted, retained, returned,
  or audited by the OP-T162 command.
- Audit action `payment_import_deposit_match_review.recorded` stores only safe IDs, enum labels,
  amount/currency snapshots, manual-payment status snapshots, boundary flags, and
  `idempotencyKeyPresent`.
- `candidate_supported` is allowed only for deposit records with an existing candidate manual
  payment that is still `pending_reconciliation`, same-matter candidate links, matching amount/CAD
  posture, and no duplicate/conflict cue. Other decisions remain evidence-only and do not unblock
  reconciliation by themselves.
- Reconciliation-readiness cues fail closed when the latest decision is not supported, duplicate or
  conflict posture is present, current manual-payment state has drifted, the candidate invoice no
  longer matches, or current invoice balance no longer covers the payment. `/api/payments/:paymentId/reconcile`
  remains the only workflow that can create an effective allocation.
- Synthetic data only. No client, matter, credential, payment, private deployment, raw provider,
  card/customer, refund, chargeback, trust, object-storage, private metadata, or provider-schema
  details were added to docs, fixtures, audit metadata, or proof evidence.

## Final Changed Paths

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/web/app/_features/billing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md
docs/validation/README.md
packages/database/test/repository.payment-import-review-records.test.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
```

## Original OP-T162 Runtime Path Set

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/web/app/_features/billing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md
docs/validation/README.md
packages/database/migrations/0073_deposit_match_review_decisions.sql
packages/database/migrations/meta/0073_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/billing.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
scripts/route-authorization/billing.mjs
```

## Focused Development Proof

```text
PASS pnpm --filter @open-practice/domain test -- billing.test.ts
  - Focused run passed before the full selected domain suite.

PASS pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts
  - Package script ran the database suite: 27 files, 158 tests.

PASS pnpm --dir apps/api exec vitest run src/routes/billing.test.ts
  - Focused Billing API route coverage: 1 file, 32 tests.

PASS pnpm --dir apps/web exec vitest run app/dashboard/billing-section.test.tsx
  - Focused Billing section render coverage: 1 file, 1 test.

PASS pnpm --filter @open-practice/web test
  - Full selected web suite later passed: 46 files, 241 tests.
```

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/dashboard.ts apps/web/app/_features/billing/models.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md docs/validation/README.md packages/database/test/repository.payment-import-review-records.test.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
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

| Command                                                                                                                                      | Status  | Notes                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files <final path set>`                                                                                             | Pass    | Recommended architecture, API contract, format, docs, policy, domain/database/api/provider/worker/web tests, package typechecks/builds, database/migration checks, and repo build for the final OP-T162 path set.        |
| `pnpm --filter @open-practice/domain test -- billing.test.ts`                                                                                | Pass    | Focused domain package run passed before the selected full domain suite.                                                                                                                                                 |
| `pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts`                                             | Pass    | Focused database package run reported 27 files and 158 tests passing.                                                                                                                                                    |
| `pnpm --dir apps/api exec vitest run src/routes/billing.test.ts`                                                                             | Pass    | Focused Billing API route suite reported 1 file and 32 tests passing with read-only dashboard cue assertions.                                                                                                            |
| `pnpm --dir apps/web exec vitest run app/dashboard/billing-section.test.tsx`                                                                 | Pass    | Focused Billing section render coverage reported 1 file and 1 test passing.                                                                                                                                              |
| `pnpm architecture:check`                                                                                                                    | Pass    | Architecture import policy passed with 461 workspace import edges reviewed.                                                                                                                                              |
| `pnpm api:contract`                                                                                                                          | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 340 paths.                                                                                                                                            |
| `pnpm format:check`                                                                                                                          | Pass    | Repo-wide Prettier check passed after an earlier transient ENOENT from unrelated dirty proof files cleared.                                                                                                              |
| `pnpm exec prettier --check <final path set>`                                                                                                | Pass    | Scoped OP-T162 Prettier check passed: all matched files use Prettier code style.                                                                                                                                         |
| `pnpm docs:check`                                                                                                                            | Pass    | Documentation link validation passed.                                                                                                                                                                                    |
| `pnpm policy:check`                                                                                                                          | Blocked | Blocked because the default Codex `pnpm` 11.7.0 fails the repo toolchain check, which expects packageManager `pnpm` 11.5.3.                                                                                              |
| `PATH=/opt/homebrew/bin:$PATH pnpm policy:check`                                                                                             | Blocked | Blocked by unrelated central reference-index lock drift after repo-pinned pnpm 11.5.3 passed secret scan, package manifest, supply-chain, toolchain, env, architecture, dead-code, migration parity, and migration lint. |
| `pnpm --filter @open-practice/domain test`                                                                                                   | Pass    | Domain suite reported 33 files and 261 tests passing.                                                                                                                                                                    |
| `pnpm --filter @open-practice/domain typecheck`                                                                                              | Pass    | Domain TypeScript check passed.                                                                                                                                                                                          |
| `pnpm --filter @open-practice/domain build`                                                                                                  | Pass    | Domain build passed.                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/database test`                                                                                                 | Pass    | Database suite reported 27 files and 158 tests passing.                                                                                                                                                                  |
| `pnpm --filter @open-practice/database db:check`                                                                                             | Pass    | Drizzle schema check passed.                                                                                                                                                                                             |
| `pnpm migrations:check`                                                                                                                      | Pass    | Migration parity passed with 74 SQL files and 74 journal entries.                                                                                                                                                        |
| `pnpm migrations:lint`                                                                                                                       | Pass    | Tracked-diff migration lint passed and reported 0 tracked SQL files; supplemental direct lint for `0073_deposit_match_review_decisions.sql` passed with 1 SQL migration reviewed.                                        |
| `pnpm --filter @open-practice/database typecheck`                                                                                            | Pass    | Database TypeScript check passed.                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database build`                                                                                                | Pass    | Database build passed.                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/api test`                                                                                                      | Pass    | API suite reported 43 files and 621 tests passing.                                                                                                                                                                       |
| `pnpm --filter @open-practice/api typecheck`                                                                                                 | Pass    | API TypeScript check passed.                                                                                                                                                                                             |
| `pnpm --filter @open-practice/providers test`                                                                                                | Pass    | Providers suite reported 13 files and 37 tests passing.                                                                                                                                                                  |
| `pnpm --filter @open-practice/worker test`                                                                                                   | Pass    | Worker suite reported 6 files and 54 tests passing.                                                                                                                                                                      |
| `pnpm --filter @open-practice/web test`                                                                                                      | Pass    | Web suite reported 46 files and 241 tests passing.                                                                                                                                                                       |
| `pnpm --filter @open-practice/web typecheck`                                                                                                 | Pass    | Web TypeScript check passed.                                                                                                                                                                                             |
| `pnpm build`                                                                                                                                 | Pass    | Turbo build completed 6 successful package build tasks.                                                                                                                                                                  |
| `git diff --check`                                                                                                                           | Pass    | Broad dirty-tree whitespace check passed.                                                                                                                                                                                |
| `git diff --check -- <final path set>`                                                                                                       | Pass    | Scoped OP-T162 whitespace check passed.                                                                                                                                                                                  |
| `pnpm proof:reconcile -- --proof docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md --files <final path set>` | Pass    | Proof reconciliation passed for the 15-path OP-T162 readiness follow-up set and the selected validation command set.                                                                                                     |

## Notes

- The working tree also contains unrelated document-processing and matter-lifecycle edits. They are
  not included in this OP-T162 path set unless the same shared docs/code files were also touched for
  the deposit-match command boundary.
