# Clio Billing Salvage Proof

Date: 2026-06-01 PDT

## Scope

Inspected `codex/op-clio-parity-consolidation-2026-05-31` after OP-T134, OP-T135, OP-T141,
and OP-T142 were already present on `main`.

Recovered only the still-relevant billing capture residue:

- `GET /api/billing/dashboard` keeps draft/submitted time entries visible in capture review even
  when `billable` is false, so review-only draft capture does not disappear before staff decide
  whether it should be billable.
- The dashboard response exposes OP-authored timer-draft policy metadata showing that local timer
  capture creates drafts only, does not auto-submit or auto-approve, and does not bypass billing
  period locks.
- API/web billing types preserve the `billable` flag on time capture-review rows, and local
  dashboard state updates keep that flag when a timer draft is created.
- Billing route tests now cover non-billable timer drafts, non-reimbursable expense drafts,
  draft-only policy metadata, and audit redaction for synthetic draft narratives/descriptions.
- While running the selector-picked API suite, repaired an unrelated date-sensitive
  client-portal route test by making synthetic token expiries future-relative instead of fixed at
  2026-06-01.

Out of scope: replaying the stale consolidation commit, replacing the shipped OP-T134 timer and
expense endpoints, changing invoice eligibility, adding payment processing, changing trust posting,
or promoting OP-T136 trust/accounting work.

## Branch Retirement

The broad `codex/op-clio-parity-consolidation-2026-05-31` diff remains stale against current
`main`. Its OP-T134, OP-T135, OP-T141, and OP-T142 substance is already represented by the
mainline implementations and proof notes. After this small salvage is merged, the remaining branch
content can be retired rather than replayed.

## Changed Paths

- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP_CLIO_BILLING_SALVAGE_PROOF_2026-06-01.md`
- `docs/validation/README.md`
- `packages/domain/src/billing.ts`
- `packages/domain/src/billing.test.ts`

## Validation

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Result                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing.ts apps/api/src/routes/client-portal.test.ts apps/web/app/billing-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/page.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/planning.md docs/validation/README.md docs/validation/OP_CLIO_BILLING_SALVAGE_PROOF_2026-06-01.md packages/domain/src/billing.test.ts packages/domain/src/billing.ts` | Passed; selected format/docs/policy, domain/API/web tests and typechecks, provider/worker tests, and build. |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Passed as a fresh-worktree local export preflight.                                                          |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Passed as a fresh-worktree local export preflight.                                                          |
| `pnpm --filter @open-practice/providers build`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Passed as a fresh-worktree local export preflight.                                                          |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed after formatting Markdown tables.                                                                    |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Passed.                                                                                                     |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed; migration parity, OSS reuse, docs links, boundary policy, and tracked-secret checks were green.     |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed: 22 files, 150 tests.                                                                                |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Passed.                                                                                                     |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                           | Passed: 1 file, 26 tests.                                                                                   |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed after the date-sensitive client-portal test-data fix: 39 files, 428 tests.                           |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed.                                                                                                     |
| `pnpm --filter @open-practice/providers test`                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Passed: 7 files, 17 tests.                                                                                  |
| `pnpm --filter @open-practice/worker test`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed: 3 files, 27 tests.                                                                                  |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed: 16 files, 128 tests.                                                                                |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed.                                                                                                     |
| `pnpm build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Passed: 6 packages built.                                                                                   |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Passed.                                                                                                     |

The first full `pnpm --filter @open-practice/api test` attempt failed in
`src/routes/client-portal.test.ts` because hard-coded 2026-06-01 link expiries had become expired
on 2026-06-01. The final run passed after changing only the synthetic test expiries to
future-relative dates.
