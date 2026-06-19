# Database Access Hot Path Efficiency Proof

Date: 2026-06-18 PDT

## Scope

Implemented a focused, behavior-preserving database access efficiency slice on
`refactor/db-access-hot-path-efficiency`:

- Added hot-path B-tree indexes for user matter assignments, billing invoices/payments/allocations,
  document and signature lookups, ledger/trust reads, and job lifecycle queue reads.
- Added migration `0065_hot_path_access_indexes.sql` and the matching Drizzle journal entry.
- Added schema assertions for the new index names.
- Batched Drizzle user assignment hydration and changed email lookup to query the user row directly
  before loading assignments.
- Scoped invoice lines and payment allocations to the selected invoice/payment IDs instead of
  loading all firm children for list responses.
- Deduped invoice IDs during manual payment allocation validation and invoice total refresh.
- Pushed simple billing expense category and signature webhook filters into SQL.
- Reworked Drizzle matter-workspace summary/activity construction to build per-matter maps once and
  pass matter-local row arrays into summary and activity builders.

## Boundaries Preserved

- No HTTP API response shape, route, permission, trust posting, payment settlement, provider, or
  public data boundary was changed.
- Repository contracts remain compatible; changes are internal query, grouping, schema index, and
  validation coverage updates.
- Billing changes keep manual payment reconciliation and invoice mutation behavior unchanged.
- Trust and ledger changes add read indexes only; no posting, settlement, bank-feed, approval, or
  accounting-certification behavior was added.
- Examples, fixtures, and proof notes remain synthetic.

## Follow-Up Findings Kept Out Of Scope

The larger database-access findings remain backlog candidates instead of this first branch:

- Contact visibility and dossier split.
- Client portal batch projection.
- Communications/email bulk reads.
- Operational views and report read models.
- Filtered audit reads.

## Validation Selection

Final changed-path selection command:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Final changed paths selected:

- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_DATABASE_ACCESS_HOT_PATH_EFFICIENCY_PROOF_2026-06-18.md`
- `packages/database/migrations/0065_hot_path_access_indexes.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/auth/drizzle.ts`
- `packages/database/src/repository/billing-entries/drizzle.ts`
- `packages/database/src/repository/billing-invoices-payments/drizzle.ts`
- `packages/database/src/repository/matter-workspace/drizzle.ts`
- `packages/database/src/repository/signatures/drizzle.ts`
- `packages/database/src/schema/billing.ts`
- `packages/database/src/schema/documents.ts`
- `packages/database/src/schema/jobs-email.ts`
- `packages/database/src/schema/ledger.ts`
- `packages/database/src/schema/matters.ts`
- `packages/database/src/schema/signatures.ts`
- `packages/database/test/repository.billing-invoices-payments.test.ts`
- `packages/database/test/repository.first-run.test.ts`
- `packages/database/test/schema.test.ts`

The selector recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`

## Final Validation

| Command                                           | Result                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                               | Passed.                                                                                                                           |
| `pnpm docs:check`                                 | Passed.                                                                                                                           |
| `pnpm policy:check`                               | Passed, including migration parity, proof index, docs, OSS reuse, secrets, deadcode, and boundary gates.                          |
| `pnpm --filter @open-practice/database test`      | Passed: 22 files, 132 tests.                                                                                                      |
| `pnpm --filter @open-practice/database db:check`  | Passed.                                                                                                                           |
| `pnpm migrations:check`                           | Passed: 66 SQL files match 66 journal entries.                                                                                    |
| `pnpm --filter @open-practice/database typecheck` | Passed.                                                                                                                           |
| `pnpm --filter @open-practice/database build`     | Passed.                                                                                                                           |
| `pnpm --filter @open-practice/api test`           | Passed: 42 files, 558 tests.                                                                                                      |
| `pnpm migrations:replay`                          | Passed after starting local Compose Postgres on `127.0.0.1:35432`: 66 migrations applied to a disposable database and cleaned up. |
| `git diff --check`                                | Passed.                                                                                                                           |

The first `pnpm migrations:replay` attempt failed before the local replay Postgres service was
running, with connection refused on `localhost:35432`. After `docker compose up -d postgres` and a
healthy container check, the replay passed with admin client `psql`.
