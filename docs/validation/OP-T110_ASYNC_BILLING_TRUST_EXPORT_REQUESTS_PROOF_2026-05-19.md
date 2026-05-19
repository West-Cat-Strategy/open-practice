# OP-T110 Async Billing And Trust Export Requests Proof

Date: 2026-05-19

Branch: `codex/op-t110-async-billing-trust-exports`

Integration commit: `477982d`

## Scope

This slice moves billing and trust export requests behind staff-only async create/status/download
routes modeled on the existing audit-export pattern. Job metadata is limited to safe request and
count fields such as IDs, kind, status, and counts.

It does not store export bodies, ledger detail, recipient data, private narratives, or downloaded
payload content in job metadata or audit metadata.

## Validation

Selector:

```bash
pnpm verify:select -- --files <changed paths>
```

Result: pass. The selector recommended policy, domain/API/worker/provider tests and typechecks, and
route-boundary validation for the touched billing, queue, and manifest paths.

Worker-owned focused proof:

```bash
pnpm policy:check
pnpm migrations:check
pnpm --filter @open-practice/domain test -- billing.test.ts permissions.test.ts audit-taxonomy.test.ts
pnpm --filter @open-practice/api test -- src/routes/billing.test.ts
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
git diff --check
```

Result: pass. The worker reported all commands green before the lane was cherry-picked into
`codex/open-practice-improvement-batch`.
