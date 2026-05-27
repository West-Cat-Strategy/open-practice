# OP-T126 Submitted Intake Action Descriptors Proof

Date: 2026-05-27 PDT

## Scope

Extends the shipped OP-T123 and OP-T124 operational action-state descriptor boundary to submitted
intake review controls in the Intake dashboard section:

- Describe submitted intake review load, accept, reject, and request-more-info controls with shared
  safe action availability state.
- Surface disabled/busy labels, `aria-label`, `title`, and `data-action-key` values without putting
  submitted answers, decision reasons, one-time tokens, portal URLs, or submitted content into
  descriptor strings.
- Keep the slice web-only with no API, database, permission, route, dependency, migration, or CSS
  changes.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/web/app/intake-forms-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP-T126_SUBMITTED_INTAKE_ACTION_DESCRIPTORS_PROOF_2026-05-27.md
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
pnpm --filter @open-practice/web test -- dashboard-client.test.ts
pnpm exec prettier --write apps/web/app/intake-forms-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP-T126_SUBMITTED_INTAKE_ACTION_DESCRIPTORS_PROOF_2026-05-27.md
pnpm --filter @open-practice/web typecheck
pnpm build
pnpm --filter @open-practice/web test
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm verify:select -- --dirty
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Results:

- Web tests passed: 12 files, 114 tests, including submitted intake descriptor availability,
  busy, blank-reason, loaded-review, already-decided, and leak-prevention coverage.
- API tests passed: 35 files, 388 tests, covering the broader dirty branch surfaced by the final
  dirty selector.
- Web typecheck passed.
- API typecheck passed.
- Production build passed: 6 successful tasks.
- Formatting, docs links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, Open Practice boundary policy, and whitespace checks passed.

## Notes

- Existing public-consultation, OSS proof, OP-T124, OP-T125, and dashboard polish edits in this
  dirty checkout are preserved.
- All examples and tests for this slice use synthetic data.
