# OP-T97 Matters Operational View Presets Proof

Date: 2026-05-17

## Scope

OP-T97 adds the first saved operational view surface beyond queue-dashboard views. The slice is
limited to owner-private `matters` definitions and one dashboard preset family: matter follow-up
views driven by the built-in stale-matter and uncontacted-client operational view keys.

## Changed Surfaces

- Domain/API/database saved operational view surface enum now accepts `queues` and `matters`.
- Database migration `0033_saved_operational_view_matters_surface.sql` adds the `matters` enum value.
- Dashboard loading now fetches all active owner-private definitions, keeps queue views scoped to the
  queues panel, and adds save/apply/archive controls for matter follow-up views in the matter command
  centre.
- API/state-machine docs now list the saved operational view definition routes and note the current
  matter follow-up preset family.

## Validation

Selector:

```sh
pnpm verify:select -- --files apps/api/src/routes/operational-views.test.ts apps/api/src/routes/operational-views.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-utils.ts apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/page.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T97_MATTERS_OPERATIONAL_VIEW_PRESETS_PROOF_2026-05-17.md packages/database/src/schema.ts packages/database/test/repository.operational-views.test.ts packages/domain/src/operational-views.ts packages/database/migrations/0033_saved_operational_view_matters_surface.sql
```

Passed:

```sh
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database db:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm build
git diff --check
```

Notes:

- A fresh worktree initially could not resolve downstream package entrypoints until
  `@open-practice/domain`, `@open-practice/providers`, and `@open-practice/database` were built.
  Rerunning the affected database/API checks after the builds passed.
- No browser screenshot proof was captured because this slice is a focused saved-view contract and
  dashboard control addition covered by web tests/typecheck/build rather than a broad visual redesign.
