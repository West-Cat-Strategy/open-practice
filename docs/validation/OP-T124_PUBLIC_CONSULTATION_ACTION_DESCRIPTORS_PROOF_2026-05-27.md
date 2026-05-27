# OP-T124 Public Consultation Action Descriptors Proof

Date: 2026-05-27 PDT

## Scope

Extends the shipped OP-T123 operational action-state descriptor boundary to public consultation
review controls in the Intake dashboard section:

- Describe conflict-check, dismiss, and convert review actions through the shared operational action
  availability helper.
- Keep public consultation requester email, request body, source URL, and opposing-party details
  inside the existing Intake request row only.
- Preserve the existing API, repository, permission, audit, route, dependency, and migration
  boundaries.
- Leave larger backend candidates such as payment reconciliation, matter transition journals, and
  provider webhook intake for a clean follow-up branch.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --dirty
```

Recommended commands:

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

The focused OP-T124 selector was also run against the changed web/docs path set:

```sh
pnpm verify:select -- --files apps/web/app/public-consultation-intakes-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP-T124_PUBLIC_CONSULTATION_ACTION_DESCRIPTORS_PROOF_2026-05-27.md
```

It selected:

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
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/api typecheck
pnpm policy:check
pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md
pnpm verify:select -- --dirty
pnpm format:check
pnpm docs:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/api test
pnpm build
git diff --check
```

Results:

- Focused and full web tests passed: 12 files, 113 tests.
- API tests passed: 35 files, 388 tests.
- API and web typechecks passed.
- Formatting, docs links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, route-boundary policy, production build, and whitespace checks passed.
- API test output included expected harness logs for negative authorization, setup-key, validation,
  provider-unconfigured, and route-not-found cases; all suites exited successfully.

## Notes

- Existing public-consultation, OSS proof, dashboard review-rail, and branch-consolidation edits in
  this dirty checkout were preserved.
- `docs/improvement-opportunities.md` now records OP-T124 as a shipped descriptor slice and keeps
  only future candidate-by-candidate descriptor adoption as residual backlog.
- Browser screenshots were not recaptured for OP-T124 because this slice changes shared action
  availability labels, disabled reasons, and redacted conflict-rail status text rather than layout;
  the current dirty branch already has desktop/mobile dashboard visual proof in
  [Dashboard Review Rail Collapse Proof](OP_DASHBOARD_REVIEW_RAIL_PROOF_2026-05-26.md).
- All examples and tests for this slice use synthetic data.
