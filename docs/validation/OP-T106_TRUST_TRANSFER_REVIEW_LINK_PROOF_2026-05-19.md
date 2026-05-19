# OP-T106 Trust Transfer Review And Link Flow Proof

Date: 2026-05-19

## Scope

Implemented the bounded billing trust-transfer review/link slice:

- `POST /api/billing/trust-transfer-requests/:id/approve` for pending requests only, requiring
  matter-scoped `trust_ledger:approve` access, matching invoice matter, invoice-balance capacity,
  and sufficient matter trust balance.
- `POST /api/billing/trust-transfer-requests/:id/reject` for pending requests only, preserving
  reviewer evidence without linking or posting trust ledger entries.
- `POST /api/billing/trust-transfer-requests/:id/link` for approved requests only, linking to an
  existing ledger transaction that matches the request matter, amount, and client context when
  present.
- Repository read/update support for existing trust-transfer review/link fields in memory and
  Drizzle repositories.
- Safe audit taxonomy entries for approved, rejected, and linked states.

Out of scope by design: automatic trust ledger posting, automatic payment allocation, accounting
certification, new trust-transfer columns, contact data-quality resolution decisions, and new
dependencies.

## Privacy And Boundary Notes

- Synthetic matter/contact/invoice/request IDs only.
- Approval and rejection do not create ledger transactions; API tests compare ledger entry counts
  before and after review actions.
- Linking requires an already-posted matching ledger transaction and never creates ledger entries.
- Link failures for ledger transactions outside the request matter return the same not-found shape as
  missing transactions, so matter-scoped approvers cannot probe cross-matter ledger IDs.
- Link updates are guarded by conditional status/unlinked checks. Existing schema columns were
  sufficient; OP-T106 did not add a migration.
- Audit metadata records safe IDs, status transitions, amounts, balance checks, link amounts, and an
  `evidencePresent` boolean only; raw reviewer evidence and private notes are not written into audit
  metadata.
- Creation rejects caller-supplied review/link fields; accepted requests are stored as
  `pending_approval` and unlinked.

## Local Proof

- `pnpm verify:select -- --files <changed paths...>` recommended format, docs, policy, test,
  typecheck, database, migration, provider, and worker checks.
- `pnpm --filter @open-practice/domain test -- src/billing.test.ts src/audit-taxonomy.test.ts`
  passed: 16 files, 110 tests.
- `pnpm --filter @open-practice/database test -- test/repository.ledger.test.ts` passed: 14 files,
  69 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts src/server.test.ts`
  passed: 2 files, 52 tests.
- `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/database
typecheck`, and `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed: 35 SQL files match 35 journal entries.
- `pnpm --filter @open-practice/api test` passed: 33 files, 327 tests.
- `pnpm --filter @open-practice/providers test` passed: 5 files, 15 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 20 tests.
- `pnpm test` passed across the workspace and script contract tests.
- `pnpm typecheck` passed: 9 tasks.
- `pnpm build` passed: 6 tasks.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `git diff --check` passed.

## Review Notes

- API/tests and domain/repository subagent lanes implemented the bounded surfaces; the lead removed
  the accidental migration, reconciled docs, and reran validation.
- Follow-through covered stale API expectations, duplicate ledger-link prevention in route logic,
  cross-matter ledger ID probing, conditional review/link transitions, and audit taxonomy coverage
  for emitted safe metadata.
