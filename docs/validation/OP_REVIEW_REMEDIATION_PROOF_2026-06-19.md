# Open Practice Review Remediation Proof - 2026-06-19

Branch: `fix/review-remediation-20260619`

## Scope

This branch addresses the focused efficiency, code-quality, and simplicity backlog from the
2026-06-19 code review. It keeps public HTTP response shapes, database schema, dependencies,
authorization semantics, payment settlement behavior, trust posting behavior, provider behavior,
and client/private data boundaries unchanged.

Implemented remediation:

- Reused already-authorized contact dossiers and preloaded portal grants on contact detail,
  portal-access, timeline, and history-export paths to avoid repeated dossier hydration.
- Indexed active contact portal grants and relationships during domain dossier construction while
  preserving relationship direction, hidden-contact redaction, matter visibility, and sort order.
- Added internal multi-matter billing repository filters and batched non-firm-wide staff broad-list
  reads for time entries, expenses, invoices, and payments.
- Split billing route authorization manifest entries into a focused helper while preserving the
  flattened manifest export and the existing invoice/payment guard resources.
- Extracted only the external-upload dashboard request wrappers into a feature client-resource
  helper, leaving dashboard state, props, copy, and rendering behavior unchanged.
- Aligned the validation selector with testing guidance so `packages/domain/**` changes now include
  `pnpm --filter @open-practice/domain build`.

## Boundaries Preserved

- No schema or migration changes.
- No new dependencies, vendored assets, copied source, or reference-derived code.
- Billing remains operational/review evidence only: no live settlement, implicit allocation,
  invoice balance mutation outside existing review flows, payment processor behavior change, or
  trust-ledger posting.
- Contact projections remain matter-scoped and redacted; history-export audit metadata remains
  bounded and does not retain private export bodies.
- Route authorization manifest extraction is structural only; route coverage and resource/action
  mappings remain equivalent.
- Dashboard extraction does not change route catalog IDs, API payload contracts, or visible workflow
  behavior.

## Selector

Final changed-path selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/expenses.ts apps/api/src/routes/billing/invoices.ts apps/api/src/routes/billing/payments.ts apps/api/src/routes/billing/shared.ts apps/api/src/routes/billing/time-entries.ts apps/api/src/routes/contacts.test.ts apps/api/src/routes/contacts.ts apps/web/app/dashboard-client.tsx docs/development/maintenance.md docs/planning-and-progress.md docs/testing/TESTING.md docs/validation/README.md packages/database/src/repository/billing-entries-contracts.ts packages/database/src/repository/billing-entries/drizzle.ts packages/database/src/repository/billing-entries/memory.ts packages/database/src/repository/billing-invoices-payments-contracts.ts packages/database/src/repository/billing-invoices-payments/drizzle.ts packages/database/src/repository/billing-invoices-payments/memory.ts packages/database/src/repository/contacts-contracts.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/repository.contact-dossier.test.ts packages/database/test/repository.contacts-drizzle.test.ts packages/domain/src/contacts.test.ts packages/domain/src/contacts.ts scripts/route-authorization-manifest.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs scripts/validate-open-practice-boundaries.test.mjs apps/web/app/_features/external-uploads/client-resources.test.ts apps/web/app/_features/external-uploads/client-resources.ts docs/validation/OP_REVIEW_REMEDIATION_PROOF_2026-06-19.md packages/database/test/repository.billing-list-filters.test.ts scripts/route-authorization/billing.mjs
```

Selector output:

```bash
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

Final validation:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test -- contacts.test.ts
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test -- repository.contact-dossier.test.ts repository.contacts-drizzle.test.ts repository.billing-list-filters.test.ts
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test -- contacts.test.ts billing.test.ts
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test -- app/_features/external-uploads/client-resources.test.ts
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
node --test scripts/select-validation.test.mjs
node --test scripts/validate-open-practice-boundaries.test.mjs
pnpm build
git diff --check
```

All commands above passed.

Skipped checks:

- `pnpm migrations:replay`: not selected because this branch has no schema or migration changes.
- Docker app smoke, Docker E2E, and residual-watch checks: not selected because this branch does
  not change Dockerfiles, Compose, app image commands, object-storage runtime behavior, or Docker
  runtime configuration.
