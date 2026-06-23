# AI Proposal Authorization Matrix Proof - 2026-06-20

## Scope

This branch adds a behavior-preserving authorization fixture matrix for
`GET /api/ai-operational-proposals`. It extends the OP-authored catalogue to cover firm-wide,
assigned-matter, unassigned-matter, and client-external staff-route denial/list-visible expectations
for AI operational proposal list queries.

The slice does not add a ReBAC policy engine, canonical authorization rewrite, route behavior
change, route manifest change, schema change, migration, dependency, public-token change, portal
grant change, or matter-scope replacement.

## Changed Paths

- `apps/api/src/routes/ai-operational-proposals.test.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md`
- `docs/validation/README.md`
- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/permissions.test.ts`

## Validation

Revalidated on 2026-06-20 from the recreated sibling worktree
`/Users/bryan/projects/open-practice-ai-proposal-authz-matrix-20260620` on
`hardening/ai-proposal-authz-matrix-20260620`. Current `main` already contained the matrix, so the
only new tracked change in this closeout is this proof refresh.

Selector:

```bash
pnpm verify:select -- --files docs/validation/OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md apps/api/src/routes/ai-operational-proposals.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/authorization-fixtures.ts packages/domain/src/permissions.test.ts
```

Recommended:

```text
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

Passed:

- `pnpm verify:select -- --files docs/validation/OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md apps/api/src/routes/ai-operational-proposals.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/authorization-fixtures.ts packages/domain/src/permissions.test.ts`.
- `pnpm architecture:check` - 442 workspace import edges reviewed.
- `pnpm api:contract` - generated `.tmp/api-contract/openapi.json` with 310 paths.
- `pnpm docs:check`.
- `pnpm policy:check`.
- `pnpm --filter @open-practice/domain test` - 31 files, 235 tests.
- `pnpm --filter @open-practice/domain typecheck`.
- `pnpm --filter @open-practice/domain build`.
- `pnpm --filter @open-practice/database build`.
- `pnpm --filter @open-practice/providers build`.
- `pnpm --filter @open-practice/api test` - 42 files, 578 tests, after building upstream
  package outputs.
- `pnpm --filter @open-practice/api typecheck`.
- `pnpm --filter @open-practice/providers test` - 11 files, 23 tests.
- `pnpm --filter @open-practice/worker test` - 5 files, 46 tests.

Final checks after proof reconciliation:

- `pnpm format:check`.
- `pnpm docs:check`.
- `pnpm policy:check`.
- `git diff --check`.

## Notes

- Reviewed `scripts/route-authorization-manifest.mjs` and
  `scripts/validate-open-practice-boundaries.test.mjs`; the existing
  `GET /api/ai-operational-proposals` manifest entry already remains owned by
  `registerAiOperationalProposalRoutes` as authenticated `ai_proposal:read` with optional matter
  scope.
- The new API test creates only synthetic matter/proposal/user records and verifies the current
  filter behavior without changing route implementation.
- The first focused API test attempt failed before test collection because the fresh sibling
  worktree did not yet have built `@open-practice/database` package outputs. After building
  `@open-practice/domain`, `@open-practice/database`, and `@open-practice/providers`, the focused
  API test and full API suite passed.
