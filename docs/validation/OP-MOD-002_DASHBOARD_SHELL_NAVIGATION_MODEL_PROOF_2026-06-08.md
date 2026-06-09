# OP-MOD-002 Dashboard Shell Navigation Model Proof - 2026-06-08

## Scope

OP-MOD-002 extracts dashboard shell navigation availability/model derivation from
`apps/web/app/dashboard-client.tsx` into
`apps/web/app/_features/dashboard/dashboard-shell-model.ts`.

The slice intentionally does not change rendered dashboard markup, API request paths, API response
handling, active-section URL/history behavior, focus restoration behavior, or review-rail
sessionStorage behavior. `DashboardClient` still owns composed mutation state and uses the existing
`useDashboardShellState` hook for URL, focus, and review-rail shell state.

## Base and Branch

- Base commit: `76d950e9c560e986ebbdfe84164f7d038cd17d6a` (`Record OP-MOD push prune closeout`).
- Local `main` and `origin/main` matched at the base commit before the worktree was created.
- Branch: `codex/op-mod-dashboard-shell-model-2026-06-08`.
- Worktree: `/Users/bryan/projects/open-practice-op-mod-dashboard-shell-model-2026-06-08`.
- The original checkout at `/Users/bryan/projects/open-practice` was dirty on
  `codex/docker-hardening-efficiency-2026-06-07` and was left untouched.

## Changed Paths

Final changed paths from `git diff --name-only`, `git diff --name-only --cached`, and
`git ls-files --others --exclude-standard`:

- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/_features/dashboard/dashboard-shell-model.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-model.test.ts`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-MOD-002_DASHBOARD_SHELL_NAVIGATION_MODEL_PROOF_2026-06-08.md`

The final proof path list matches the intended six-file slice.

## Validation

Selector and final validation were run against the exact changed path set.

Pre-selector bootstrap:

- `pnpm --filter @open-practice/web test -- dashboard-shell-model.test.ts` initially failed in the
  fresh sibling worktree because `@open-practice/domain` package exports had not been built yet.
- `pnpm --filter @open-practice/domain build` passed.
- `pnpm --filter @open-practice/web test -- dashboard-shell-model.test.ts` then passed: 33 test
  files, 167 tests.
- `pnpm --filter @open-practice/web typecheck` passed.

Final selector:

```console
$ { git diff --name-only; git diff --name-only --cached; git ls-files --others --exclude-standard; } | sort -u | xargs pnpm verify:select -- --files
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Selected validation:

- `pnpm format:check` passed after formatting `docs/planning-and-progress.md`.
- `pnpm docs:check` passed.
- `git diff --check` passed.
- `pnpm policy:check` passed, including tracked-secret scan, package manifest policy, migration
  parity, OSS reuse policy, doc links, validation proof index, local evidence Docker-ignore, and
  Open Practice boundary policy.
- `pnpm --filter @open-practice/web test` passed: 33 test files, 167 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed: 6 successful Turbo tasks, 5 cached.

Post-proof-edit docs finishers are recorded in the closeout notes below.

## Behavior Notes

- Navigation availability now comes from `buildDashboardShellNavigationModel`, using the same
  dashboard inputs as before: billing visibility, capability sections, matter availability,
  create-matter permission, share-link status, external-upload status, and session role.
- Matter action sections keep the existing filter: non-`matters` sections that require matter
  context, plus `queues`.
- Active section labels keep the existing matter-title/catalog-title behavior with `Dashboard` as
  the fallback label.
- Review-rail storage key, history URL building, `popstate` handling, focus refs, and
  `useDashboardShellState` behavior were not changed.

## Skipped Checks

- Browser screenshots were not run because this slice changes helper placement, tests, docs, and
  client wiring only; no JSX markup, CSS, or visual layout was changed.

## Closeout Notes

- The final diff preserves the original `useDashboardShellState` call site and does not edit
  `apps/web/app/_features/dashboard/dashboard-shell-state.ts`, so section URL sync, detail-panel
  focus restoration, and review-rail sessionStorage persistence stay on the existing path.
- After this proof note was refreshed with validation results, the selector was rerun against the
  same six final changed paths and still recommended the same command set. `pnpm format:check`,
  `pnpm docs:check`, `pnpm policy:check`, and `git diff --check` then passed again, keeping the
  proof/index/workboard state aligned to the final diff.
