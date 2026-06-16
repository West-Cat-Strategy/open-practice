# ReBAC Fixture Catalogue Proof - 2026-06-16

## Scope

This branch adds an Open Practice-authored authorization fixture catalogue for current relation
vocabulary plus denial and list-visible expectations across matters, documents, jobs, and portal
links. It does not add a ReBAC policy engine, canonical-only authorization rewrite, schema change,
dependency, or route behavior change.

## Changed Paths

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/documents.test.ts`
- `apps/api/src/routes/jobs.test.ts`
- `apps/api/src/routes/matters.test.ts`
- `apps/api/src/routes/shares.test.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/validation/OP_REBAC_FIXTURE_CATALOGUE_PROOF_2026-06-16.md`
- `docs/validation/README.md`
- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/permissions.test.ts`

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/documents.test.ts apps/api/src/routes/jobs.test.ts apps/api/src/routes/matters.test.ts apps/api/src/routes/shares.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md packages/domain/src/index.ts packages/domain/src/permissions.test.ts packages/domain/src/authorization-fixtures.ts
```

Recommended:

```text
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

Passed:

- `pnpm --filter @open-practice/domain test` - 27 files, 175 tests.
- `pnpm --filter @open-practice/domain typecheck`.
- `pnpm --filter @open-practice/domain build`.
- `pnpm --filter @open-practice/database build`.
- `pnpm --filter @open-practice/providers build`.
- `pnpm --filter @open-practice/api test` - 41 files, 518 tests.
- `pnpm --filter @open-practice/api typecheck`.
- `pnpm --filter @open-practice/providers test` - 9 files, 20 tests.
- `pnpm --filter @open-practice/worker test` - 5 files, 40 tests.
- `pnpm format:check`.
- `pnpm docs:check`.
- `pnpm policy:check`.
- `git diff --check`.

## Notes

- The first API test run in this fresh sibling worktree failed before test collection because
  package `dist` outputs did not exist yet. After building domain, database, and providers in
  dependency order, the API suite passed.
- `pnpm --filter @open-practice/providers build` and the first database build attempt had the same
  fresh-worktree ordering issue when started before the domain build completed; both passed after
  the domain package was built.
