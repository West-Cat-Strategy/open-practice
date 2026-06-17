# Firm-Managed Expense Category Registry Proof

Date: 2026-06-17 PDT

## Scope

Implemented the first firm-managed expense category registry slice:

- Added persisted `billing_expense_categories` records with immutable normalized codes, labels,
  active posture, reimbursable defaults/allowance, optional matter scope, practice-area and
  jurisdiction applicability, OP-authored review cues, and created/updated metadata.
- Added nullable `expense_entries.category_code`; existing expense rows can keep a null code and
  their free-text `category` snapshot.
- Added Billing controls APIs and dashboard controls for listing, creating, and updating firm
  categories under the existing Billing controls access model.
- Updated new expense entry and review-draft creation to require `categoryCode`, validate active
  firm/matter/practice-area/jurisdiction/reimbursable applicability, and snapshot the managed label
  into `category`.
- Updated expense-entry edits so category changes require `categoryCode`, while non-category edits
  on legacy free-text rows continue through existing finalized, lock, invoice, and write-off rules.
- Extended billing dashboard payloads with `expenseCategories` while keeping a compatibility
  `expenseCategoryProfiles` projection for existing consumers in this slice.

## Boundaries Preserved

- Legacy free-text expense rows remain readable; they are not backfilled or forced into registry
  codes.
- Category deactivation prevents future new selections but does not mutate or invalidate existing
  expense entries, invoices, payment evidence, or trust records.
- Invoice approval remains the only path that marks selected expenses `billed`.
- Manual-payment reconciliation remains the only path where pending payment evidence affects invoice
  balances.
- No live settlement, processor webhook behavior, automatic payment application, bank-feed matching,
  or trust-ledger posting was added.
- Audit metadata for category create/update is bounded to IDs, code, active posture, and scope
  counts. Examples and fixtures remain synthetic.

## Validation Selection

Final changed-path selection command:

```sh
pnpm verify:select -- --files $(git diff --name-only HEAD) $(git ls-files --others --exclude-standard)
```

The selector recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Final Validation

| Command                                                                                      | Result                                           |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `pnpm format:check`                                                                          | Passed.                                          |
| `pnpm docs:check`                                                                            | Passed.                                          |
| `pnpm policy:check`                                                                          | Passed.                                          |
| `pnpm test`                                                                                  | Passed: workspace tests plus 63 script tests.    |
| `pnpm --filter @open-practice/domain test -- billing.test.ts`                                | Passed: 30 files, 212 tests.                     |
| `pnpm --filter @open-practice/database test -- repository.billing-controls.test.ts`          | Passed: 22 files, 128 tests.                     |
| `pnpm --filter @open-practice/api test -- src/routes/billing.test.ts`                        | Passed: 42 files, 554 tests.                     |
| `pnpm --filter @open-practice/web test -- dashboard-client.test.ts billing-section.test.tsx` | Passed: 37 files, 201 tests.                     |
| `pnpm --filter @open-practice/domain test`                                                   | Passed: 30 files, 212 tests.                     |
| `pnpm --filter @open-practice/domain typecheck`                                              | Passed.                                          |
| `pnpm --filter @open-practice/database test`                                                 | Passed: 22 files, 128 tests.                     |
| `pnpm --filter @open-practice/database db:check`                                             | Passed.                                          |
| `pnpm migrations:check`                                                                      | Passed: 65 SQL files match 65 journal entries.   |
| `pnpm --filter @open-practice/database typecheck`                                            | Passed.                                          |
| `pnpm --filter @open-practice/database build`                                                | Passed.                                          |
| `pnpm --filter @open-practice/api test`                                                      | Passed: 42 files, 554 tests.                     |
| `pnpm --filter @open-practice/api typecheck`                                                 | Passed.                                          |
| `pnpm --filter @open-practice/providers test`                                                | Passed: 9 files, 20 tests.                       |
| `pnpm --filter @open-practice/worker test`                                                   | Passed: 5 files, 45 tests.                       |
| `pnpm --filter @open-practice/web test`                                                      | Passed: 37 files, 201 tests.                     |
| `pnpm --filter @open-practice/web typecheck`                                                 | Passed after adding the web billing-type export. |
| `pnpm build`                                                                                 | Passed: 6 packages.                              |
| `git diff --check`                                                                           | Passed.                                          |
