# OP Dead-Code Prune Proof - 2026-06-13

## Scope

- Branch/worktree: `chore/dead-code-prune-2026-06-13` in
  `/Users/bryan/projects/open-practice-dead-code-prune`.
- Base: current `op-client-portal-v2` branch tip at `47c5db97`, excluding uncommitted OP-T156
  changes in `/Users/bryan/projects/open-practice`.
- Purpose: add a maintained dead-code gate and prune only high-confidence unused code, styles, and
  direct dependencies.

## Cleanup Summary

- Added `knip@6.16.1`, `knip.jsonc`, and `pnpm deadcode:check`; `pnpm policy:check` now runs the
  dead-code gate before migration/docs/boundary checks.
- Removed direct web dependencies `orderedmap`, `rope-sequence`, and `w3c-keyname`; these remain
  available transitively through the retained ProseMirror packages.
- Removed unused export surface from API helpers, unused web helpers/types, and the unused dashboard
  review-rail preference hook file.
- Removed manually verified unused CSS selector groups for legacy matter/control panels,
  permission rows, setup preset cards, setup review lists, and nested grids.

## Held Candidates

- Kept public root-domain helpers such as billing, ledger, and document-assembly helpers because
  they are compatibility-facing exports and need an explicit public-surface decision before
  removal.
- Kept `drizzle-mappers.ts` compatibility re-exports for public-consultation intake mappers because
  the live planning note documents that barrel as an intentional compatibility surface.
- Kept Next App Router convention files, Tiptap-generated `.is-editor-empty`, e2e-support routes,
  web-safe domain subpath exports, schema exports, and explicit ProseMirror packages used for
  production bundling compatibility.
- Scoped Knip to files/dependencies/unlisted/unresolved/binaries; symbol-level export cleanup stays
  manual because repository facades and response-model modules intentionally expose broad
  compatibility surfaces.

## Validation

Final changed path selector:

```bash
{ git diff --name-only -z; git ls-files --others --exclude-standard -z; } | xargs -0 pnpm verify:select -- --files
```

Recommended commands from the final path set:

- `pnpm ci:local`
- `pnpm deps:audit`
- `pnpm deps:licenses`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Focused validation completed before the broad handoff gate:

- `pnpm deadcode:check` passed after tightening root Knip entries to package-script and Playwright
  roots with broad `project` coverage.
- `pnpm deps:audit` passed: no known production or development vulnerabilities.
- `pnpm deps:licenses` passed: 562 packages / 590 versions; existing review-required license groups
  remained review-only and no unknown/unlicensed groups were introduced.
- `pnpm format:check` passed after formatting `docs/testing/TESTING.md`.
- `pnpm docs:check` passed.
- `pnpm --filter @open-practice/api test` passed: 41 files / 504 tests.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/web test` passed: 35 files / 179 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed: 6 successful tasks.
- `pnpm policy:check` passed, including secret scan, package-manifest policy, `pnpm
deadcode:check`, migration parity, OSS reuse, docs link validation, proof-index validation,
  local-evidence Docker ignore validation, and architecture-boundary policy.
- `pnpm ci:local` passed after the proof update: repo-wide format, lint, typecheck, package tests,
  script tests, database `db:check`, policy checks, and build.

CSS/setup follow-up validation:

- `E2E_FIRST_RUN_API_PORT=45283 E2E_FIRST_RUN_WEB_PORT=45284 node scripts/run-e2e.mjs first-run`
  passed: 1 first-run Playwright test.
- Full `pnpm e2e:host` attempts were not green in this local session:
  - default-port run hit an existing web listener on `33110` and exited `143`;
  - isolated-port run on `34373/33373` reached the UI/UX dense-panel breakpoint test, then failed on
    `page.goto` with `net::ERR_CONNECTION_RESET` at `/?section=calendar` and exited `143`.
- To isolate the CSS-adjacent failure, a manual host runtime on `45273/45274` ran the specific
  dense-panel Host Chromium test directly; it passed: 1 Playwright test in 37.8s.

Database note:

- The final selector did not include `packages/database/**` after the compatibility re-export hunk
  was restored. Earlier in this lane, before that restore, database checks passed:
  `pnpm --filter @open-practice/database test` (18 files / 113 tests),
  `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
  `pnpm --filter @open-practice/database typecheck`, and
  `pnpm --filter @open-practice/database build`.
