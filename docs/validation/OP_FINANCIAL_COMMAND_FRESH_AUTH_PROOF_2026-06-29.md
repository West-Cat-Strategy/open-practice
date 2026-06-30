# Financial Command Fresh-Auth Proof - 2026-06-29

## Scope

This branch reuses the existing `requireFreshAuth` step-up guard for high-risk financial command
mutations:

- `POST /api/payments/:paymentId/reconcile`
- `POST /api/billing/trust-transfer-requests/:id/approve`
- `POST /api/billing/trust-transfer-requests/:id/reject`
- `POST /api/billing/trust-transfer-requests/:id/link`
- `POST /api/ledger/posting-requests/:id/approve`
- `POST /api/ledger/posting-requests/:id/reject`

The guard is checked after existing role, matter-scope, lifecycle, balance, duplicate-link,
self-approval, idempotency, and no-overdraft preconditions, and before the final financial mutation.
It does not add a new MFA system, change role permissions, widen matter access, call providers,
settle funds, change trust-transfer semantics, or change trust posting semantics.

All tests, fixtures, examples, and proof evidence use synthetic data only and do not add client,
matter-private, credential, payment, provider, or deployment details.

## Changed Paths

- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/billing/payments.ts`
- `apps/api/src/routes/billing/trust-transfer-requests.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger/posting-requests.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_FINANCIAL_COMMAND_FRESH_AUTH_PROOF_2026-06-29.md`
- `docs/validation/README.md`

## Boundary Proof

- Payment reconciliation now requires a fresh session before `repository.reconcilePayment`.
- Trust-transfer approve/reject/link now require a fresh session before
  `repository.updateTrustTransferRequest`.
- Trust posting approve/reject now require a fresh session before
  `repository.approveLedgerPostingRequest` or `repository.rejectLedgerPostingRequest`.
- Missing and stale sessions return the existing `FRESH_AUTH_REQUIRED` response.
- Existing role denial, matter-scope denial, self-approval denial, lifecycle conflict, duplicate-link
  conflict, invoice/trust-balance guard, idempotency, no-overdraft, audit metadata, no provider
  settlement, and no automatic trust posting behaviors are preserved.

## Selector

- `pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/payments.ts apps/api/src/routes/billing/trust-transfer-requests.ts apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger/posting-requests.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP_FINANCIAL_COMMAND_FRESH_AUTH_PROOF_2026-06-29.md docs/validation/README.md`
  - Passed after the final changed path set was known. The selector recommended architecture,
    contract, format, docs, policy, API test, and API typecheck checks.

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
```

## Selected Validation

Fresh-worktree setup:

- `pnpm --filter @open-practice/domain build`
  - Passed.
- First parallel `pnpm --filter @open-practice/database build` and
  `pnpm --filter @open-practice/providers build` attempts failed because the fresh sibling
  worktree did not yet have `@open-practice/domain` build output. This was setup-order drift, not a
  product regression.
- `pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`
  - Passed after the domain build completed.

Focused implementation proof:

- First `pnpm --filter @open-practice/api test -- src/routes/billing.test.ts src/routes/ledger.test.ts`
  attempt failed before collecting tests because the fresh sibling worktree did not yet have
  upstream workspace package build output.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts src/routes/ledger.test.ts`
  - Passed: 2 files, 68 tests.

Selector-driven validation:

- `pnpm architecture:check`
  - Passed: 466 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: generated `.tmp/api-contract/openapi.json` with 346 paths.
- `pnpm docs:check`
  - Passed.
- First `pnpm format:check`
  - Failed on Markdown formatting in `docs/api-and-state-machines.md` and
    `docs/validation/README.md`.
- `pnpm exec prettier --write docs/api-and-state-machines.md docs/validation/README.md`
  - Passed; formatting-only cleanup.
- Second `pnpm format:check`
  - Passed.
- `pnpm policy:check`
  - Blocked because the repository's central OSS reuse reference-lock metadata is out of sync with
    `docs/index.json` for existing reference entries. The successful subchecks before that blocker
    were secrets, package manifest policy, lockfile supply chain, toolchain, env surface,
    architecture, deadcode, migration parity, and migration lint. This branch adds no dependencies,
    copied excerpts, vendored assets, or reference-derived code.
- First `pnpm --filter @open-practice/api test`
  - Failed with one unrelated full-suite timing failure in `src/routes/caldav.test.ts` after 633
    passing tests. The failure was `Test timed out in 5000ms` in
    `creates, reads, rejects stale writes, and deletes matter events through CalDAV`.
- `pnpm --filter @open-practice/api exec vitest run src/routes/caldav.test.ts`
  - Passed in isolation: 1 file, 8 tests. This supports classifying the full-suite failure as a
    suite timing flake outside the financial command fresh-auth path.
- Second `pnpm --filter @open-practice/api test`
  - Passed: 43 files, 634 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
