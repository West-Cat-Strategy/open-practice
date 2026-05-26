# OP-T120 Document Retention-Review Hints Proof

**Date:** 2026-05-26

## Scope

Implemented the first read-only document retention-review staff review surface:

- Added `retention_review` reviewer cues to the matter-scoped document-processing workbench and
  dashboard.
- Derived hints only from existing document state: legal hold, supersession references, upload,
  checksum, scan, and external-upload review status.
- Surfaced the new cue group through the existing dashboard cue list, metadata tags, and cue filter.
- Kept the slice non-mutating: no deletion automation, retention deadline, retention-policy
  eligibility, jurisdictional compliance claim, migration, audit write, worker change, provider
  change, or dependency change.

`OP-T120` is used for this proof because a separate in-flight dirty-tree row already occupied
`OP-T119` for staff-only conversation export artifacts by the time this proof was recorded.

## Validation

Selector:

```bash
pnpm verify:select -- --files packages/domain/src/document-suggestions.ts packages/domain/src/document-suggestions.test.ts apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing.test.ts apps/web/app/types.ts apps/web/app/document-processing-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP-T120_DOCUMENT_RETENTION_REVIEW_HINTS_PROOF_2026-05-25.md
```

Focused OP-T120 checks:

```bash
./node_modules/.bin/vitest run packages/domain/src/document-suggestions.test.ts
./node_modules/.bin/vitest run apps/api/src/routes/document-processing.test.ts
node scripts/validate-doc-links.mjs
```

Passed focused checks:

```bash
./node_modules/.bin/vitest run packages/domain/src/document-suggestions.test.ts
./node_modules/.bin/vitest run apps/api/src/routes/document-processing.test.ts
./node_modules/.bin/tsc -p packages/domain/tsconfig.json --noEmit
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
node scripts/validate-doc-links.mjs
```

Blocked by unrelated dirty-tree edits:

- `./node_modules/.bin/vitest run apps/web/app/dashboard-client.test.ts` failed because Vite
  could not parse `apps/web/app/dashboard/contacts-section.tsx`, which contains an existing JSX
  syntax issue outside OP-T120.
- `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit` failed on unrelated calendar,
  communications, conversation, and database contract errors already present in the dirty tree.

The direct package-manager validation selector also reported `pnpm` fetch failures in this
environment, so the checks above used the local binaries already present in `node_modules`.

## Privacy And Boundaries

- Synthetic test data only.
- Retention-review cues are status-only reviewer hints and do not expose storage keys, checksum
  hashes, raw OCR text, provider payloads, token values, external-upload link IDs, or arbitrary
  review metadata.
- The API remains matter-scoped and read-only for these hints; no retention or deletion action was
  added.
