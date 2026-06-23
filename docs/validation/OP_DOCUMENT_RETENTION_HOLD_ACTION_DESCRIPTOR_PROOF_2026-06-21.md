# Document Retention/Hold Action Descriptor Proof - 2026-06-21

## Scope

- Branch: `feat/document-retention-hold-action-descriptor-20260621`
- Worktree: `/Users/bryan/projects/open-practice-document-retention-hold-action-descriptor-20260621`
- Surface: Documents dashboard retention/hold review control.

## Implemented Boundary

- `packages/domain/src/operational-actions.ts` now owns the Documents retention/hold
  `record_review` action descriptor, including
  `document_retention_hold_review.record`, busy/disabled labels, and compact disabled-reason text.
- `apps/web/app/dashboard/documents-section.tsx` derives the retention/hold review button label,
  disabled state, stable `data-action-key`, and accessible label from that descriptor.
- The existing suggested retention decision/reason logic, `onRecordRetentionHoldDecision` call
  shape, portal grant/revoke controls, and workbench posture copy are unchanged.
- No document retention/hold route, API payload, server authorization, audit metadata, database
  repository, legal-hold blocker, retention boundary, migration, dependency, or route catalog
  behavior changed.
- Descriptor output remains read-only UI state only and does not carry document IDs, titles,
  review notes, legal-hold reason metadata, retention dates, raw payloads, or API request data.
- All examples and tests use synthetic data only. This slice does not expose client, matter,
  credential, payment, object-storage, provider-payload, private deployment, raw OCR, retained
  export-body, legal-hold override, or jurisdiction-certified retention details.

## Final Changed Paths

```text
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
docs/planning-and-progress.md
docs/validation/OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md
docs/validation/README.md
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
```

## Initial Focused Checks

Before isolating the final clean worktree:

- `pnpm --filter @open-practice/domain test -- operational-actions.test.ts` - Pass; 31 files and
  238 tests passed.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/web test -- app/dashboard/documents-section.test.tsx` - Pass; 41
  files and 217 tests passed.

## Selector

Selector command:

```sh
pnpm verify:select -- --files apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/documents-section.tsx docs/planning-and-progress.md docs/validation/OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md docs/validation/README.md packages/domain/src/operational-actions.test.ts packages/domain/src/operational-actions.ts
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

## Selected Command Results

- `pnpm architecture:check` - Pass; 443 workspace import edges reviewed.
- `pnpm format:check` - Pass.
- `pnpm docs:check` - Pass.
- `pnpm policy:check` - Pass; tracked-secret scan, package manifest policy, lockfile
  supply-chain, toolchain, env surface, architecture, dead-code, migration, OSS reuse, docs,
  validation proof index, local evidence Docker ignore, and boundary checks passed.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 236 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- Initial `pnpm --filter @open-practice/api test` - Failed in the fresh worktree before
  `@open-practice/database` was built because exported database `dist` entrypoints were missing.
- Manual `pnpm --filter @open-practice/database build` - Pass; hydrated database package
  entrypoints for downstream tests.
- Manual `pnpm --filter @open-practice/providers build` - Pass.
- `pnpm --filter @open-practice/api test` after database build - Pass; 42 files and 578 tests
  passed.
- `pnpm --filter @open-practice/providers test` - Pass; 6 files and 14 tests passed.
- Initial `pnpm --filter @open-practice/worker test` - Failed in the fresh worktree before
  `@open-practice/database` was built because exported database `dist` entrypoints were missing.
- `pnpm --filter @open-practice/worker test` after database build - Pass; 5 files and 46 tests
  passed.
- `pnpm --filter @open-practice/web test` - Pass; 41 files and 217 tests passed.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- `pnpm build` - Pass; 6 package build tasks succeeded.

## Post-Proof Reconciliation

- `pnpm proof:reconcile -- --proof docs/validation/OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md --files apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/documents-section.tsx docs/planning-and-progress.md docs/validation/OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md docs/validation/README.md packages/domain/src/operational-actions.test.ts packages/domain/src/operational-actions.ts` -
  Pass; 7 paths reconciled with the selected command set.
