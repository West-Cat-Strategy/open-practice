# UI Overlap Resilience Proof - 2026-06-19

## Scope

Branch: `refactor/ui-overlap-resilience-20260619`

This branch hardens the zero-matter first-matter workspace against overlapping controls and clipped
content at constrained desktop and mobile widths. The change is UI/CSS and browser-proof only. It
does not change API payloads, authorization, matter creation semantics, setup behavior, provider
behavior, payment settlement, trust posting, or public data boundaries.

Changed implementation paths:

- `apps/web/app/styles/20-dashboard-panels.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `e2e/helpers/ui-ux-assertions.ts`
- `e2e/ui-ux.spec.ts`

Proof/index paths:

- `docs/validation/OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `docs/planning-and-progress.md`

## Review Findings

Two read-only subagent reviews converged on the same root cause: the first-matter form and created
records sidecar could keep competing fixed minimums before the global `720px` collapse breakpoint.
The form grid also lacked explicit block/grid label layout, the segmented control did not wrap
button text safely, and the existing UI/UX collision helper did not inspect first-matter containers.

## Implementation Notes

- Made the first-matter panel, layout, form labels, fieldset, segmented controls, detail sidecar, and
  submit button `min-width: 0`/wrap-safe where appropriate.
- Replaced the first-matter form's fixed two-column minimum with content-aware `auto-fit` tracks.
- Added a component-specific `900px` first-matter layout collapse so constrained workspace cards do
  not keep the sidecar beside the form.
- Added first-matter and zero-matter grid selectors to the existing overflow and sibling-collision
  E2E helpers.
- Added a focused matterless E2E breakpoint test for `/?section=matters` at `1100`, `760`, `720`,
  and `520` pixel widths.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/90-responsive-motion.css e2e/helpers/ui-ux-assertions.ts e2e/ui-ux.spec.ts docs/validation/OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md docs/validation/README.md docs/planning-and-progress.md
```

Selector output recommended:

- `pnpm e2e:host`
- `pnpm e2e:docker`
- `node scripts/run-e2e.mjs first-run`
- `pnpm e2e:matterless`
- `pnpm e2e:client-portal`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Prerequisite builds in the fresh sibling worktree:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/database build
```

Initial `pnpm --filter @open-practice/web test` and
`pnpm --filter @open-practice/web typecheck` runs failed before those prerequisite builds because
workspace package `dist` outputs were absent. After the prerequisite builds, selected checks passed
unless noted below.

Passed:

```bash
pnpm exec prettier --check apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/90-responsive-motion.css e2e/helpers/ui-ux-assertions.ts e2e/ui-ux.spec.ts
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm e2e:matterless -- --grep "keeps the first-matter starter workspace readable at review breakpoints"
pnpm e2e:matterless
pnpm e2e:client-portal -- --grep "keeps the client portal workspace readable"
node scripts/run-e2e.mjs first-run
pnpm build
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Observed pass details:

- Web unit tests: `37` files, `202` tests passed.
- Focused first-matter matterless E2E: `1` test passed on `matterless-chromium`.
- Full matterless E2E: `2` tests passed on `matterless-chromium`.
- Client portal focused E2E: `1` test passed on `client-portal-chromium`.
- First-run E2E: `1` test passed on `first-run-chromium`.
- Build: `6` packages built successfully.
- Documentation and policy gates: formatting, docs links, tracked-secret scan, package manifest
  policy, dead-code scan, migration parity, OSS reuse policy, validation proof index, local evidence
  Docker ignore, and Open Practice boundary policy passed.

Blocked or partially blocked selected browser proof:

- `pnpm e2e:host -- --grep "sweeps every host dashboard section for layout health and active navigation|keeps dense dashboard panels readable at review breakpoints|keeps dashboard rail and sidebar controls stable"`:
  the first attempt was blocked by a concurrent Next dev server from another E2E mode. The solo rerun
  passed the Chromium and mobile Chromium layout checks that ran, but the command returned nonzero
  because local Playwright Firefox and WebKit executables were not installed.
- `pnpm e2e:docker -- --grep "keeps Docker-backed external upload receipt layout stable"`:
  blocked before browser execution because `127.0.0.1:36379` was already allocated by the separate
  `open-practice-dev-redis-1` stack. The failed `open-practice-e2e` Compose resources were cleaned
  up with `docker compose -p open-practice-e2e down -v --remove-orphans`; the existing dev stack was
  left untouched.
