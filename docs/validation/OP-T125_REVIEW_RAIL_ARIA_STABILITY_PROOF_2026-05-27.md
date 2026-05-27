# OP-T125 Review Rail ARIA Stability Proof

Date: 2026-05-27 PDT

## Scope

Stabilizes the dashboard review-rail accessibility target after the current-branch collapse/persist
polish:

- Keep topbar and fixed-edge review-rail controls pointed at a mounted review-rail target in both
  zero-matter and matter dashboard layouts.
- Preserve session-scoped collapsed-state persistence, focus restoration, mobile hiding, and
  reduced-motion behavior.
- Keep the slice web-only: no API, route catalog, dependency, permission, provider, database, or
  migration changes.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/styles/10-shell-navigation.css apps/web/app/styles/90-responsive-motion.css docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T125_REVIEW_RAIL_ARIA_STABILITY_PROOF_2026-05-27.md
```

Validation results will be recorded after the OP-T125 runtime patch lands in this checkout.

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
pnpm verify:select -- --files apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/styles/10-shell-navigation.css apps/web/app/styles/90-responsive-motion.css docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T125_REVIEW_RAIL_ARIA_STABILITY_PROOF_2026-05-27.md
pnpm --filter @open-practice/web test -- app/dashboard/dashboard-shell.test.tsx
pnpm --filter @open-practice/web typecheck
pnpm build
pnpm docs:check
pnpm policy:check
git diff --check
```

The whole dirty checkout selector was then rerun:

```sh
pnpm verify:select -- --dirty
```

It recommended the full dirty-branch set, which also passed:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/api test
pnpm build
git diff --check
```

Results:

- Web tests passed: 12 files, 114 tests, including collapsed review-rail target coverage.
- API tests passed: 35 files, 388 tests.
- API typecheck passed.
- Web typecheck passed.
- Production build passed: 6 successful tasks.
- Documentation links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, route-boundary policy, and whitespace checks passed.
- API test output included expected harness logs for negative authorization, setup-key,
  provider-unconfigured, validation, and route-not-found cases; all suites exited successfully.
- Browser screenshots were not recaptured for OP-T125 because the slice keeps the same visible
  expanded rail and collapsed edge handle; it adds a visually hidden accessibility target for the
  already-captured collapsed dashboard states.

## Notes

- Existing public-consultation, OSS proof, OP-T124, and dashboard polish edits in this dirty
  checkout are preserved.
- All examples and tests for this slice use synthetic data.
