# Branch Consolidation Proof

Date: 2026-05-28

## Scope

Consolidated the active local Open Practice lanes into `codex/consolidate-main-2026-05-28` before
fast-forwarding `main`:

- `feature/ui-usability-balance`
- `codex/op-t127-matter-setup`
- `codex/single-tenant-auth`

`codex/op-t127-matter-setup` already carried the dashboard usability branch ancestry. The
`codex/clio-product-spec-report` branch had no unique commit beyond `main`; its stale dirty docs
worktree overlapped the reconciled OP-T127 through OP-T142 planning state, so the dirty state was
preserved in a stash before pruning.

Remote inventory before merge showed only `origin/main`, and `gh pr list --state open` returned an
empty list.

## Merge Notes

- Merged `codex/op-t127-matter-setup` into the integration branch with an explicit merge commit.
- Committed `codex/single-tenant-auth` as `Add single-tenant auth entry flow`, then merged it into
  the integration branch.
- Resolved workboard and validation-index conflicts by keeping the newer OP-T127/product-suite
  backlog and adding the OP-M7 single-tenant auth proof row.
- Fixed the merged single-tenant API fixture so the multiple-firm auth case seeds a user and reaches
  the intended multiple-firm resolution branch instead of the partial-setup guard.

## Validation

- `pnpm verify:select -- --base origin/main`
  - Passed selector run.
- `pnpm verify:select -- --files $(git diff --name-only origin/main...HEAD)`
  - Passed selector run.
  - Recommended `format:check`, docs/policy checks, package tests/typechecks, database checks,
    providers/worker tests, web checks, and build.
- `pnpm format:check`
  - Initially reported only `docs/planning-and-progress.md` and `docs/validation/README.md`.
  - Passed after formatting those merge-resolved docs.
- `pnpm --filter @open-practice/api test -- src/server.test.ts`
  - Passed: 35 files, 393 tests.
- `pnpm ci:local`
  - Passed. This covered format, lint, typecheck, all package tests plus script tests,
    `@open-practice/database db:check`, policy checks, build, and `git diff --check`.

## Privacy Notes

All merge validation used synthetic repository fixtures and local command output. No client, matter,
credential, payment, private deployment, or privileged document details were added.
