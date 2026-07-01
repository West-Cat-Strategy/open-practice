# OP Refund And Chargeback Resolution Records Proof - 2026-06-30

Date: 2026-06-30
Branch: `integrate/open-practice-all-worktrees-20260630`
Base: `origin/main`
Status: Implemented in the existing integration checkout as a narrow refund/chargeback
resolution-record closeout. The checkout contains unrelated dirty lanes; this proof is scoped to
the final changed paths below.

## Scope

Added a staff-only refund/chargeback resolution record over the existing payment import packet
preview. The record snapshots only safe IDs, derived category, latest enum review posture, reviewer
metadata, idempotency posture, and fixed no-side-effect flags.

The implementation does not add provider commands, invoice balance mutation, ledger reversal, trust
posting, client notification, refund or dispute artifact storage, free-form notes, or funds
movement.

## Boundary Evidence

- `awaiting_decision` previews reject resolution recording with `409 PAYMENT_IMPORT_REFUND_CHARGEBACK_RESOLUTION_REVIEW_REQUIRED`.
- The POST body accepts only a caller-provided `id` and `idempotencyKey`; note and artifact fields are rejected by strict validation.
- Idempotency is scoped to `(firm, payment import review record, idempotency key)`.
- Identical resolution fingerprints replay the stored record; changed fingerprints conflict.
- The route requires staff access plus matter-scoped `expense_entry` access.
- Dashboard rendering shows the latest stored resolution record next to the existing preview without
  operational refund, dispute, provider, client notification, or funds movement controls.
- Migration `0080` is additive: it creates `payment_import_refund_chargeback_resolution_records`
  with safe enum/check constraints, FKs, indexes, idempotency uniqueness, and no destructive SQL.

## Final Changed Paths

```text
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/web/app/_features/billing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
docs/api-and-state-machines.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/README.md
docs/validation/OP_REFUND_CHARGEBACK_RESOLUTION_RECORDS_PROOF_2026-06-30.md
packages/database/migrations/0080_payment_import_refund_chargeback_resolution_records.sql
packages/database/migrations/meta/0080_snapshot.json
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

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/billing/payment-import-review-records.ts apps/web/app/_features/billing/models.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx docs/api-and-state-machines.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_REFUND_CHARGEBACK_RESOLUTION_RECORDS_PROOF_2026-06-30.md packages/database/migrations/0080_payment_import_refund_chargeback_resolution_records.sql packages/database/migrations/meta/0080_snapshot.json packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/payment-import-review-records-contracts.ts packages/database/src/repository/payment-import-review-records/drizzle.ts packages/database/src/repository/payment-import-review-records/memory.ts packages/database/src/schema/billing.ts packages/database/test/repository.payment-import-review-records.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts scripts/route-authorization/billing.mjs
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

| Command                                                                                                                                | Status       | Notes                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                       | Pass         | Selector passed for the 29-path final set and recommended the command list above.                                                                                                                                                                                                            |
| `pnpm exec prettier --check <final path set>`                                                                                          | Fail because | Directly passing the new SQL migration to Prettier fails because this repo has no SQL parser configured for explicit SQL files.                                                                                                                                                              |
| `pnpm exec prettier --check --ignore-unknown <final path set>`                                                                         | Pass         | Exact final-path formatter check passed for parseable files while ignoring unknown SQL.                                                                                                                                                                                                      |
| `node --input-type=module -e 'import { lintMigrationFiles } from "./scripts/lint-migrations.mjs"; ...'`                                | Pass         | Explicit migration lint passed for `packages/database/migrations/0080_payment_import_refund_chargeback_resolution_records.sql`.                                                                                                                                                              |
| `pnpm architecture:check`                                                                                                              | Pass         | Architecture import policy passed: 468 workspace import edges reviewed.                                                                                                                                                                                                                      |
| `pnpm api:contract`                                                                                                                    | Pass         | API contract inventory wrote `.tmp/api-contract/openapi.json` with 352 paths, including the resolution-record GET/POST routes.                                                                                                                                                               |
| `pnpm format:check`                                                                                                                    | Pass         | Whole-repo Prettier check passed.                                                                                                                                                                                                                                                            |
| `pnpm docs:check`                                                                                                                      | Pass         | Documentation link validation passed.                                                                                                                                                                                                                                                        |
| `pnpm policy:check`                                                                                                                    | Fail because | Local `pnpm` was `11.7.0`, while `packageManager` requires `11.5.3`; the command stopped at `pnpm toolchain:check` after tracked-secret, package-manifest, and lockfile checks passed.                                                                                                       |
| `npm exec --yes pnpm@11.5.3 -- pnpm policy:check`                                                                                      | Pass         | Pinned-pnpm rerun passed tracked-secret scan, package manifest policy, lockfile supply-chain policy, toolchain, env surface, architecture, dead-code, migration parity, migration lint, OSS reuse, docs links, proof index, local evidence Docker ignore, and Open Practice boundary checks. |
| `pnpm test`                                                                                                                            | Fail because | Root test reached package tests but failed in the API package on unrelated 5s timeouts in `src/routes/caldav.test.ts` and `src/routes/draft-assist.test.ts`. Domain, database, providers, worker, and web package tests passed within the run.                                               |
| `pnpm --filter @open-practice/domain test`                                                                                             | Pass         | 33 files and 296 tests passed.                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/domain typecheck`                                                                                        | Pass         | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/domain build`                                                                                            | Pass         | Domain build completed with exit code 0.                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/database test`                                                                                           | Pass         | 29 files and 174 tests passed.                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/database db:check`                                                                                       | Pass         | Drizzle check reported `Everything's fine`.                                                                                                                                                                                                                                                  |
| `pnpm migrations:check`                                                                                                                | Pass         | Migration parity passed: 81 SQL files match 81 journal entries.                                                                                                                                                                                                                              |
| `pnpm migrations:lint`                                                                                                                 | Pass         | Standard migration lint passed but reviewed 0 changed SQL files because `0080` is still untracked; the explicit lint command above covered the new SQL file.                                                                                                                                 |
| `pnpm --filter @open-practice/database typecheck`                                                                                      | Pass         | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/database build`                                                                                          | Pass         | Database build completed with exit code 0.                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/api test`                                                                                                | Fail because | Broad API suite failed on unrelated 5s timeouts. First run failed four CalDAV tests; solo rerun failed one draft-assist timeout. Focused billing route proof below passed.                                                                                                                   |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`                                                          | Pass         | Focused Billing API route suite passed: 1 file and 44 tests.                                                                                                                                                                                                                                 |
| `pnpm --filter @open-practice/api typecheck`                                                                                           | Pass         | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/providers test`                                                                                          | Pass         | 13 files and 37 tests passed.                                                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/worker test`                                                                                             | Pass         | 6 files and 52 tests passed.                                                                                                                                                                                                                                                                 |
| `pnpm --filter @open-practice/web test`                                                                                                | Pass         | 46 files and 251 tests passed.                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/web typecheck`                                                                                           | Pass         | TypeScript completed with exit code 0.                                                                                                                                                                                                                                                       |
| `pnpm build`                                                                                                                           | Pass         | Turbo build passed all 6 packages; Next build compiled successfully and generated 20 static pages.                                                                                                                                                                                           |
| `pnpm proof:reconcile -- --proof docs/validation/OP_REFUND_CHARGEBACK_RESOLUTION_RECORDS_PROOF_2026-06-30.md --files <final path set>` | Pass         | Reconciliation passed for 29 paths and the selector command set above.                                                                                                                                                                                                                       |

## Notes

Validation used synthetic payment import, review, invoice, matter, user, and audit fixtures only.
No client, matter-private, credential, provider-private payload, refund artifact, dispute artifact,
free-form note, notification body, trust posting, ledger reversal, invoice mutation, or funds
movement evidence was added to tracked source or proof. Unrelated dirty work in the integration
checkout was preserved.
