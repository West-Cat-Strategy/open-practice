# OP-T160 Deposit-Match Review Records Proof

Date: 2026-06-20 PDT

## Scope

This branch-first follow-up extends the existing OP-T160 payment import review-record family with
one normalized deposit-match review cue: `candidateManualPaymentId`.

- Domain, database, repository, API, and Billing dashboard projections carry the optional existing
  manual-payment candidate ID alongside candidate invoice and hosted payment-request IDs.
- `POST /api/billing/payment-import-review-records` validates candidate invoice, hosted
  payment-request, and manual-payment links inside the review matter; same-matter manual payments
  with a mismatched invoice candidate are rejected.
- `GET /api/billing/payment-import-review-records` can filter by `candidateManualPaymentId`.
- Billing dashboard summaries show deposit-match review counts and render invoice,
  payment-request, and manual-payment candidate cues with duplicate/conflict posture.

## Boundaries Preserved

- No raw provider payloads, webhook headers, signing material, card/customer data, checkout URLs,
  receipt files, dispute packets, refund artifacts, chargeback payloads, provider private metadata,
  or provider-specific schemas are retained in rows, audit metadata, fixtures, docs, or proof.
- No invoice paid/balance/status mutation, payment creation, allocation, deposit matching,
  reconciliation record creation, ledger entry creation, settlement automation, provider command,
  refund handling, chargeback handling, client notification, trust transfer, or trust posting.
- Candidate manual-payment IDs are references to existing review evidence only.
- Examples and fixtures use synthetic data only.
- No dependency, copied excerpt, vendored asset, or reference-derived code was added.

## OP-T160 Deposit-Match-Owned Path Set

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing/dashboard.ts`
- `apps/api/src/routes/billing/payment-import-review-records.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/_features/billing/server-resources.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/dashboard/billing-section.test.tsx`
- `apps/web/app/dashboard/billing-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/payment-import-deposit-matching-boundary-packet.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md`
- `docs/validation/README.md`
- `packages/database/migrations/0070_deposit_match_review_records.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/payment-import-review-records-contracts.ts`
- `packages/database/src/repository/payment-import-review-records/drizzle.ts`
- `packages/database/src/repository/payment-import-review-records/memory.ts`
- `packages/database/src/schema/billing.ts`
- `packages/database/test/repository.payment-import-review-records.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`

## Validation Selection

`pnpm verify:select -- --files ...` recommended:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm migrations:lint`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation Results

- PASS `pnpm --filter @open-practice/domain test -- billing.test.ts audit-taxonomy.test.ts`
  - Package script ran the domain suite: 31 files, 229 tests.
- PASS `pnpm --filter @open-practice/domain typecheck`
- PASS `pnpm --filter @open-practice/domain build`
- PASS `pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts schema.test.ts`
  - Package script ran the database suite after upstream domain build: 25 files, 148 tests.
  - A first fresh-worktree run before the domain package build failed to resolve
    `@open-practice/domain`; rerun after the selector-ordered build passed.
- PASS `pnpm --filter @open-practice/database db:check`
- PASS `pnpm migrations:check`
- PASS `pnpm migrations:lint`
- PASS `pnpm --filter @open-practice/database typecheck`
- PASS `pnpm --filter @open-practice/database build`
- OBSERVED `pnpm --filter @open-practice/api test -- billing.test.ts`
  - Package script ran the API suite with default timeout and exposed two existing CalDAV timeout
    failures outside this slice.
- PASS `pnpm --dir apps/api exec vitest run src/routes/billing.test.ts`
  - Focused Billing API route coverage: 1 file, 32 tests.
- PASS `pnpm --filter @open-practice/api test -- --testTimeout=15000`
  - Broader API package rerun: 42 files, 571 tests.
- PASS `pnpm --filter @open-practice/api typecheck`
- PASS `pnpm --filter @open-practice/providers test`
  - 11 files, 22 tests.
- PASS `pnpm --filter @open-practice/worker test`
  - 5 files, 46 tests.
- PASS `pnpm --filter @open-practice/web test -- billing-section.test.tsx`
  - Package script ran the web suite: 41 files, 217 tests.
- PASS `pnpm --filter @open-practice/web typecheck`
- PASS `pnpm architecture:check`
- PASS `pnpm api:contract`
- PASS `pnpm format:check`
- PASS `pnpm docs:check`
- PASS `pnpm policy:check`
- PASS `pnpm build`
  - Turbo build completed 6 successful tasks.
