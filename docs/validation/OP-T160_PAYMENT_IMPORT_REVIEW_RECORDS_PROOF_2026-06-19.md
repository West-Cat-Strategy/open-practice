# OP-T160 Payment Import Review Records Proof

Date: 2026-06-19 PDT

## Scope

OP-T160 adds the first runtime slice under the 2026-06-17 payment import and deposit matching
boundary packet. The slice is staff-only, provider-neutral, and review-only:

- domain records model normalized processor evidence as `PaymentImportReviewRecord` rows with safe
  provider labels, event family/status, safe external IDs, amount/currency, observed/imported
  timestamps, candidate invoice/payment-request IDs, duplicate/conflict posture, and explicit
  no-side-effect boundary flags;
- the database stores review records with firm/matter scoping, candidate foreign keys, and a unique
  `(firm_id, provider_label, external_event_id)` constraint;
- memory and Drizzle repositories reuse an existing record for identical normalized evidence and
  return an idempotency conflict for changed evidence with the same external event;
- `GET /api/billing/payment-import-review-records` and
  `POST /api/billing/payment-import-review-records` enforce staff billing access, matter/candidate
  scope, strict normalized input, and safe audit metadata;
- `GET /api/billing/dashboard` and the Billing dashboard show per-matter normalized processor import
  cues, candidate invoice/payment-request IDs, duplicate/conflict indicators, and no-mutation copy.

## Boundaries Preserved

- No raw provider payloads, webhook headers, signing material, card/customer data, checkout URLs,
  receipt files, dispute packets, refund artifacts, chargeback payloads, provider private metadata,
  or provider-specific schemas are retained in rows, audit metadata, fixtures, docs, or proof.
- No invoice paid/balance/status mutation, payment creation, allocation, deposit matching,
  reconciliation record creation, ledger entry creation, settlement automation, provider command,
  refund handling, chargeback handling, client notification, trust transfer, or trust posting.
- Deposit matching remains candidate cue metadata only.
- Examples and fixtures use synthetic data only, including the generic provider label
  `synthetic_processor`.
- No dependency, copied excerpt, vendored asset, or reference-derived code was added.

## OP-T160-Owned Path Set

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/billing/dashboard.ts`
- `apps/api/src/routes/billing/payment-import-review-records.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/_features/billing/server-resources.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/billing-section.test.tsx`
- `apps/web/app/dashboard/billing-section.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/payment-import-deposit-matching-boundary-packet.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `packages/database/migrations/0066_payment_import_review_records.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
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
- `packages/domain/src/sample-data.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/validate-open-practice-boundaries.mjs`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/billing/payment-import-review-records.ts apps/web/app/_features/billing/models.ts apps/web/app/_features/billing/server-resources.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md docs/validation/README.md packages/database/migrations/0066_payment_import_review_records.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/payment-import-review-records-contracts.ts packages/database/src/repository/payment-import-review-records/drizzle.ts packages/database/src/repository/payment-import-review-records/memory.ts packages/database/src/schema/billing.ts packages/database/test/repository.payment-import-review-records.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/sample-data.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
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

## Validation Results

Focused implementation checks during development:

- Initial `pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts schema.test.ts`
  failed because the fresh sibling worktree did not yet have built `@open-practice/domain`
  artifacts.
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/database test -- repository.payment-import-review-records.test.ts schema.test.ts`
  (24 files, 139 tests)
- Initial `pnpm --filter @open-practice/api test -- billing.test.ts` failed because the fresh
  sibling worktree did not yet have built `@open-practice/providers` artifacts.
- Pass: `pnpm --filter @open-practice/providers build`
- Pass: `pnpm --filter @open-practice/api test -- billing.test.ts` (42 files, 561 tests)
- Initial `pnpm --filter @open-practice/web typecheck` found the Billing dashboard test fixture
  passed an optional review-record list directly; the test now defaults the fixture to an empty
  array before rendering.
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm --filter @open-practice/web test -- billing-section.test.tsx` (37 files, 202 tests)

Selector-based final validation:

- Pass: `pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing.ts apps/api/src/routes/billing/dashboard.ts apps/api/src/routes/billing/payment-import-review-records.ts apps/web/app/_features/billing/models.ts apps/web/app/_features/billing/server-resources.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.test.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/payment-import-deposit-matching-boundary-packet.md docs/planning-and-progress.md docs/validation/OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md docs/validation/README.md packages/database/migrations/0066_payment_import_review_records.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/payment-import-review-records-contracts.ts packages/database/src/repository/payment-import-review-records/drizzle.ts packages/database/src/repository/payment-import-review-records/memory.ts packages/database/src/schema/billing.ts packages/database/test/repository.payment-import-review-records.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/sample-data.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs`
- Pass after Prettier normalization: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm test` (Turbo workspace tests plus 63 script contract tests)
- Pass: `pnpm --filter @open-practice/domain test` (31 files, 223 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/database test` (24 files, 139 tests)
- Pass: `pnpm --filter @open-practice/database db:check`
- Pass: `pnpm migrations:check`
- Pass: `pnpm --filter @open-practice/database typecheck`
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/api test` (42 files, 561 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests)
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 46 tests)
- Pass: `pnpm --filter @open-practice/web test` (37 files, 202 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build` (6 workspace build tasks)
- Pass: `git diff --check`
