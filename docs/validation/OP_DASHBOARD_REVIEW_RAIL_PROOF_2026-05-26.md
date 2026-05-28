# Dashboard Review Rail Collapse Proof

Date: 2026-05-26 PDT

## Scope

Finished the branch-local dashboard review rail/sidebar polish slice:

- Added stable review-rail controls for zero-matter and matter dashboard states.
- Kept the review rail unmounted while collapsed and restored it through either the topbar toggle or
  fixed-edge handle.
- Replaced ambiguous sidebar copy with review-tool labels and connected the toggle, handle, and rail
  through `aria-controls` / `aria-expanded`.
- Added explicit collapsible primary navigation group labels and content targets without changing
  route catalog order, permissions, or disabled-section reasons.
- Added session-scoped review rail collapsed-state persistence, focus restoration on expand, and
  mobile/reduced-motion handle hardening.
- Added actionable operations-focus cards for enabled dashboard sections, including a count-only
  public consultation request signal that links to Intake without exposing requester details outside
  the Intake surface.
- Kept the slice web-only: no API, database, route catalog, dependency, permission, provider, or
  migration changes were added for this proof.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/styles/10-shell-navigation.css apps/web/app/styles/20-dashboard-panels.css docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_DASHBOARD_REVIEW_RAIL_PROOF_2026-05-26.md
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm --filter @open-practice/web test -- app/dashboard/dashboard-shell.test.tsx
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web lint
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

Because the checkout also contained preserved public-consultation/API docs work, the whole dirty-tree
selector was run as well:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

It selected the same web/docs/build checks plus API validation. The API checks passed:

```sh
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
```

2026-05-27 branch-local follow-through reran the dirty-tree selector after the public consultation
tenant-safe defaults and OSS lock reconciliation were present in the same checkout. The selector
recommended the same focused command set:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

All recommended checks passed. The web suite passed with 12 files and 107 tests, including this
proof's dashboard shell coverage. The API suite passed with 35 files and 388 tests. Follow-up
`pnpm refs:clone -- --check`, `pnpm --filter @open-practice/web lint`, and `git diff --check` also
passed.

2026-05-27 current-branch polish follow-through added review-rail persistence, actionable
operations-focus targets, count-only public consultation focus, mobile/reduced-motion handle
hardening, and backlog hygiene for shipped candidate rows. The dirty-tree selector still recommended
the same focused command set:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm docs:check
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/api test
pnpm exec prettier --write apps/web/app/dashboard/dashboard-shell.tsx
pnpm format:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

Results:

- API tests passed: 35 files, 388 tests.
- Web tests passed: 12 files, 109 tests, including review rail labels/refs, actionable vs static
  operations-focus cards, public consultation count-only focus, and disabled-empty public
  consultation settings.
- API and web typechecks passed.
- Formatting, docs links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, route-boundary policy, production build, and whitespace checks passed.

## Browser Proof

Initial browser screenshots were skipped for this slice because there was no already-running seeded
dashboard/API harness in this mixed dirty checkout. The focused server-render tests cover the
collapsed labels, `aria-controls`, `aria-expanded`, review rail ID, primary navigation group labels,
and actionable/static operations-focus rendering; the Next.js build remains the render/runtime gate.

2026-05-27 current-branch polish follow-through started the local dev stack and captured desktop and
mobile screenshots against `http://localhost:3000/?section=intake`:

```text
.tmp/visual-proof/desktop-1440x1100-expanded.png
.tmp/visual-proof/desktop-1440x1100-collapsed.png
.tmp/visual-proof/mobile-390x844-expanded.png
.tmp/visual-proof/mobile-390x844-collapsed.png
```

The Playwright screenshot script verified the screenshots were nonblank, the desktop collapsed edge
handle was visible, the mobile collapsed handle was hidden, and the collapsed review rail was not
visible. The dev worker emitted Redis connection-refused logs because Redis was not running; the API
and web dashboard still served the visual proof target, so that worker noise is an environment note
for this browser-only check.

## Notes

- Existing public-consultation and OSS-reconciliation edits in the same checkout were preserved and
  not widened by this dashboard slice.
- `docs/improvement-opportunities.md` was pruned so shipped first slices are not re-presented as
  future work; residual candidates remain candidate-only.
- All data in this proof is synthetic.
