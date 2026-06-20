# Lifecycle Review Action Descriptor Proof - 2026-06-20

## Scope

- Branch: `feat/lifecycle-review-action-descriptor-20260620`
- Worktree: `/Users/bryan/projects/open-practice-lifecycle-review-action-descriptor-20260620`
- Surface: Matter overview Lifecycle readiness review form and `Record review` action.

## Implemented Boundary

- `packages/domain/src/operational-actions.ts` now owns the Lifecycle readiness review
  `record_review` action descriptor, including `matter_lifecycle_review.record`, available label,
  busy label, disabled reasons, and compact reason labels.
- `apps/web/app/dashboard/matter-overview-section.tsx` derives lifecycle form/button disabled
  state, button label, stable `data-action-key`, and accessible labels from that descriptor.
- The existing lifecycle status text is exposed as a polite status region for success, busy, and
  failure messages.
- No lifecycle route, payload builder, API authorization, matter lifecycle command behavior,
  provider behavior, settlement behavior, trust posting, retention cleanup, or review evidence model
  changed.
- Descriptor output remains read-only UI state only and does not carry matter IDs, lifecycle
  reasons, blocker text, private facts, or API payload data.

## Validation

Final path set from `git ls-files -m -o --exclude-standard`:

```text
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard/matter-overview-section.tsx
docs/planning-and-progress.md
docs/validation/OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md
docs/validation/README.md
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
```

Selector command:

```sh
pnpm verify:select -- --files apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/matter-overview-section.tsx docs/planning-and-progress.md docs/validation/OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md docs/validation/README.md packages/domain/src/operational-actions.test.ts packages/domain/src/operational-actions.ts
```

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Check results:

- `pnpm architecture:check` - Pass; 437 workspace import edges reviewed.
- `pnpm format:check` - Pass; all matched files use Prettier style.
- `pnpm docs:check` - Pass; documentation link validation passed.
- `pnpm policy:check` - Pass; tracked-secret scan, package manifest policy, lockfile
  supply-chain, toolchain, env surface, architecture, dead-code, migration, OSS reuse, docs,
  validation proof index, local evidence Docker ignore, and boundary checks passed.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 230 tests passed.
- Focused `pnpm --filter @open-practice/domain test -- operational-actions.test.ts` - Pass; 31
  files and 230 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- Initial `pnpm --filter @open-practice/web test -- dashboard-client.test.ts` - Failed in the fresh
  worktree before `@open-practice/domain` was built because exported domain `dist` entrypoints were
  missing.
- `pnpm --filter @open-practice/web test -- dashboard-client.test.ts` after domain build - Pass; 41
  files and 217 tests passed.
- Manual `pnpm --filter @open-practice/database build` - Pass; needed before API tests in the fresh
  worktree because API tests import database package entrypoints.
- Manual `pnpm --filter @open-practice/providers build` - Pass; built downstream package
  entrypoints before API/worker validation.
- Initial `pnpm --filter @open-practice/api test` - Failed in the fresh worktree before
  `@open-practice/database` was built because exported database `dist` entrypoints were missing.
- `pnpm --filter @open-practice/api test` after database/providers builds - Pass; 42 files and 571
  tests passed.
- `pnpm --filter @open-practice/providers test` - Pass; 6 files and 13 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 5 files and 46 tests passed.
- `pnpm --filter @open-practice/web test` - Pass; 41 files and 217 tests passed.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- `pnpm build` - Pass; 6 package build tasks succeeded.
- `git diff --check` - Pass.
