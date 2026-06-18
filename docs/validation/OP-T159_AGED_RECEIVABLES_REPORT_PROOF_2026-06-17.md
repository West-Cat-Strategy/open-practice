# OP-T159 Aged Receivables Report Proof

Date: 2026-06-17 PDT

## Scope

OP-T159 adds an additive, read-only `aged_receivables` staff report definition to the existing
staff reporting workspace. It reuses the existing `/api/reports/workspace` and
`/api/reports/export-requests` surfaces, existing report export profiles, and existing reports queue
job lifecycle metadata.

The runtime change is additive:

- `packages/domain/src/reports.ts` now exposes `aged_receivables`, plus `client` and `invoice`
  grouping keys, while leaving `invoice_aging` compatible.
- The aged receivables projection includes visible issued and partially paid invoices with
  outstanding balances only, and derives current, 1-30, 31-60, 61-90, and 91+ bucket amounts from
  stored invoice balances.
- API report export requests accept the new definition/groupings and load visible contact display
  names for safe client grouping.
- The Reports dashboard renders client, invoice, bucket, and days-past-due summary text from the
  report row metadata.

## Boundaries Preserved

- No new routes, schemas, migrations, dependencies, copied snippets, report execution engine,
  custom SQL, BI embed, scheduler, scheduled delivery, or raw report-body storage.
- No payment creation, automatic payment allocation, invoice balance mutation, payment settlement
  processing, refunds, chargebacks, trust posting, or accounting/compliance certification.
- Report job metadata remains bounded to definition/profile/grouping/filter/requester/provenance
  state; downloads regenerate authorized projections.
- Report rows use existing invoice totals, visible matter labels, and visible contact display names
  only. They do not expose invoice memos, line narratives, contact identifiers, email addresses,
  payment evidence, settlement payloads, trust evidence, or private notes.
- Reference projects remained vocabulary/background only; implementation, tests, docs, and copy are
  original Open Practice work with synthetic examples.

## OP-T159-Owned Path Set

- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/reports.ts`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md`
- `docs/validation/README.md`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Focused implementation checks already run during development:

- Initial `pnpm --filter @open-practice/domain test -- reports.test.ts` failed on a synthetic matter
  title assertion; the expected fixture label was corrected.
- Pass: `pnpm --filter @open-practice/domain test -- reports.test.ts` (30 files, 212 tests).
- Initial `pnpm --filter @open-practice/api test -- reports.test.ts` failed before tests ran because
  the fresh sibling worktree lacked built `@open-practice/domain` and `@open-practice/database`
  outputs.
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/providers build`
- Second `pnpm --filter @open-practice/api test -- reports.test.ts` failed on an overly strict
  nested matcher in the new aged receivables export test; the matcher was narrowed to the intended
  payload shape.
- Pass: `pnpm --filter @open-practice/api test -- reports.test.ts` (42 files, 554 tests).
- Pass: `pnpm --filter @open-practice/web test -- reports-section.test.tsx` (37 files, 201 tests).

Selector-based final validation:

- Pass: `pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts`
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/domain test` (30 files, 212 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/api test` (42 files, 554 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests)
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 45 tests)
- Pass: `pnpm --filter @open-practice/web test` (37 files, 201 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build` (6 workspace build tasks)
- Pass: `git diff --check`
