# OP-T97 Audit Projection Dashboard Summaries Proof

Date: 2026-05-17

## Scope

- Promoted `Audit Projection Dashboard Summaries` from the improvement backlog to OP-T97 on the
  live workboard.
- Added a read-only dashboard summary over the existing audit taxonomy projection for unknown
  actions, matter-scope gaps, and resource-type mismatches.
- Kept stored audit events, audit hashing, and persistence unchanged.

## Validation

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  recommended `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
  `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
  `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
  `pnpm build`.
- `pnpm install` completed from the existing lockfile in the fresh worktree; no lockfile changes were
  required. The install warning about ignored package build scripts was left unchanged.
- `pnpm format:check` passed after formatting touched docs and the web test file.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm --filter @open-practice/api test` passed: 32 files, 298 tests.
- `pnpm --filter @open-practice/api typecheck` passed after `pnpm build` populated workspace package
  outputs for the fresh worktree.
- `pnpm --filter @open-practice/web test` passed: 9 files, 80 tests.
- `pnpm --filter @open-practice/web typecheck` passed after `pnpm build` populated workspace package
  outputs for the fresh worktree.
- `pnpm build` passed.

## Notes

- The first pre-build API/web test and typecheck attempts failed because the fresh worktree had no
  `node_modules` or built workspace package outputs. After `pnpm install` and `pnpm build`, the same
  selected checks passed.
- The API taxonomy fixture expected two matter-scope gaps because the synthetic seed audit log
  already includes one matter-scoped portal grant without explicit matter metadata.
