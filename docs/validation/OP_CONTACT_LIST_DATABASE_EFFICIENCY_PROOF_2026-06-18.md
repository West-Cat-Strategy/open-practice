# Contact List Database Efficiency Proof - 2026-06-18

## Scope

Branch: `refactor/contact-list-efficiency`

This slice keeps the public `/api/contacts` response shape and authorization behavior unchanged
while making the Drizzle contact-list path avoid full contact dossier hydration.

Changed behavior is limited to database access internals:

- `listDrizzleContactsForUser` now reads lightweight contact rows directly for firm-wide contact
  readers.
- Matter-scoped users derive visible contact IDs from assigned-matter parties and retain the
  existing standalone-created-contact visibility rule.
- Existing search, sort, pagination, kind, status, and role-category filtering semantics remain in
  the list projection after visibility is applied.

## Boundaries

- No HTTP API shape changes.
- No repository contract changes.
- No schema or migration changes.
- No new dependencies.
- No changes to `/api/contacts/dossiers`, contact timeline, contact-history export, portal grants,
  contact data-quality behavior, trust posting, payment settlement, provider behavior, or public
  data boundaries.
- Synthetic data only.

## Proof

- Added Drizzle repository coverage for firm-wide list reads, matter-scoped list reads, hidden
  matter contact search, standalone creator contact visibility, memory-vs-Drizzle list parity, and
  the absence of dossier-only dependency calls/table reads from the list path.
- Confirmed the new contact-list tests pass after building the upstream domain package:
  `pnpm --filter @open-practice/domain build`
  `pnpm --dir packages/database exec vitest run test/repository.contacts-drizzle.test.ts`

## Validation

Selector:

- `pnpm verify:select -- --files docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_CONTACT_LIST_DATABASE_EFFICIENCY_PROOF_2026-06-18.md packages/database/src/repository/contacts/drizzle.ts packages/database/test/repository.contacts-drizzle.test.ts`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`,
    `pnpm migrations:check`, `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`.

Completed validation:

- `pnpm --filter @open-practice/domain build` - passed
- `pnpm --dir packages/database exec vitest run test/repository.contacts-drizzle.test.ts` - passed
- `pnpm format:check` - passed
- `pnpm docs:check` - passed
- `pnpm policy:check` - passed
- `pnpm --filter @open-practice/database db:check` - passed
- `pnpm migrations:check` - passed
- `pnpm --filter @open-practice/database test` - passed, 23 files and 131 tests
- `pnpm --filter @open-practice/database typecheck` - passed
- `pnpm --filter @open-practice/database build` - passed
- `pnpm --filter @open-practice/providers build` - passed as downstream API test setup
- `pnpm --filter @open-practice/api test` - passed, 42 files and 558 tests
- `git diff --check` - passed
