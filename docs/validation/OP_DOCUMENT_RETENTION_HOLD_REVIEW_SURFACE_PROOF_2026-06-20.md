# Staff Document Retention/Hold Review Surface Proof

**Date:** 2026-06-20
**Branch:** `feat/document-retention-hold-review-surface-20260620`
**Worktree:** `/Users/bryan/projects/open-practice-document-retention-hold-review-surface-20260620`
**Base:** `2873e38f3d99413dff75327fc34d68779eb6191d`

## Scope

This branch starts a clean branch-first runtime slice from
`docs/document-retention-hold-workflow-design.md` because the source checkout at
`/Users/bryan/projects/open-practice` was occupied by
`audit/incomplete-implementation-inventory-20260620` with unrelated dirty docs/proof files.

The shipped slice is a staff-only, matter-scoped retention/hold decision-record surface over
existing document metadata, legal-hold cues, and upload/checksum/scan posture. It records only the
latest bounded reviewer posture on `documents.reviewMetadata.retentionHoldReview` and exposes fixed
non-destructive posture flags in API and web projections.

## Shipped Behavior

- Domain helpers define enum-only retention/hold decisions and reasons, derive blocker/cue counts
  from existing document metadata, and always return `reviewerOnly: true`, `mutating: false`,
  `destructiveAction: false`, `retentionDeadlineEnforced: false`, `legalHoldOverride: false`, and
  `retainedExportBody: false`.
- Memory and Drizzle repositories implement
  `recordDocumentRetentionHoldReviewDecision` by merging nested retention/hold metadata without
  overwriting existing upload-review metadata or upload-review status fields.
- `POST /api/documents/:id/retention-hold-decisions` requires authenticated staff with
  matter-scoped `document:update`, denies client external users and matter-unassigned users, rejects
  `ready_for_reviewer_packet` while legal hold or integrity blockers remain active, returns
  sanitized document metadata plus derived posture, and records
  `document.retention_hold_review.recorded` audit metadata with safe IDs, enum labels, cue counts,
  and posture flags only.
- `GET /api/document-processing/workbench?matterId=` includes `retentionHoldReview` per document
  item while continuing to omit `reviewMetadata`, storage keys, checksums, raw extraction text, and
  provider metadata.
- The staff Documents surface renders retention/hold posture per document and exposes compact
  staff decision controls that call the API and treat server authorization as authoritative.
- The route authorization manifest includes the new endpoint under `registerDocumentRoutes`.

## Preserved Boundaries

This slice does not delete objects, enforce retention deadlines, clear or override legal holds,
store retained export bodies, persist raw document/OCR/provider payloads, add free-form reviewer
notes, change upload-review status fields, add background workers, add migrations, add
dependencies, or claim jurisdiction-certified compliance.

All examples and tests use synthetic data only.

## Final Changed Paths

- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/document-processing/workbench.ts`
- `apps/api/src/routes/documents.test.ts`
- `apps/api/src/routes/documents.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `apps/web/app/document-processing-dashboard.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md`
- `docs/validation/README.md`
- `packages/database/src/repository/documents-contracts.ts`
- `packages/database/src/repository/documents/drizzle.ts`
- `packages/database/src/repository/documents/memory.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/document-suggestions.test.ts`
- `packages/domain/src/document-suggestions.ts`
- `scripts/route-authorization-manifest.mjs`

## Focused Validation

Passed before the final docs/proof edits:

- `pnpm --filter @open-practice/domain test -- document-suggestions audit-taxonomy`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/web test -- app/dashboard/documents-section.test.tsx`
- `pnpm --filter @open-practice/api test -- src/routes/documents.test.ts src/routes/document-processing.test.ts`
  - The API test selector fanned out to 42 files and 574 tests; all passed.

Final selector-driven validation after docs/proof edits:

- `pnpm verify:select -- --files docs/validation/OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/workbench.ts apps/api/src/routes/documents.test.ts apps/api/src/routes/documents.ts apps/web/app/_features/document-processing/models.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/documents-section.tsx apps/web/app/document-processing-dashboard.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/src/repository/documents-contracts.ts packages/database/src/repository/documents/drizzle.ts packages/database/src/repository/documents/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/document-suggestions.test.ts packages/domain/src/document-suggestions.ts scripts/route-authorization-manifest.mjs`

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm migrations:lint`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Selected command results:

- `pnpm architecture:check`: passed; 437 workspace import edges reviewed.
- `pnpm api:contract`: passed; generated 309-path API contract inventory.
- `pnpm format:check`: passed after Prettier normalized
  `apps/web/app/dashboard/documents-section.tsx`, `docs/api-and-state-machines.md`,
  `docs/validation/README.md`, and `packages/domain/src/document-suggestions.ts`.
- `pnpm docs:check`: passed.
- `pnpm policy:check`: passed, including tracked-secret scan, manifest/dependency/toolchain/env,
  architecture, dead-code, migration, OSS reuse, proof-index, Docker-ignore, and boundary checks.
- `pnpm test`: passed; Turbo package tests plus 133 script tests passed.
- `pnpm --filter @open-practice/domain test`: passed; 31 files and 231 tests.
- `pnpm --filter @open-practice/domain typecheck`: passed.
- `pnpm --filter @open-practice/domain build`: passed.
- `pnpm --filter @open-practice/database test`: passed; 25 files and 148 tests.
- `pnpm --filter @open-practice/database db:check`: passed.
- `pnpm migrations:check`: passed; 70 SQL files match 70 journal entries.
- `pnpm migrations:lint`: passed; 0 changed SQL migration files reviewed.
- `pnpm --filter @open-practice/database typecheck`: passed.
- `pnpm --filter @open-practice/database build`: passed.
- `pnpm --filter @open-practice/api test`: passed; 42 files and 574 tests.
- `pnpm --filter @open-practice/api typecheck`: passed.
- `pnpm --filter @open-practice/providers test`: passed; 11 files and 22 tests.
- `pnpm --filter @open-practice/worker test`: passed; 5 files and 46 tests.
- `pnpm --filter @open-practice/web test`: passed; 41 files and 217 tests.
- `pnpm --filter @open-practice/web typecheck`: failed once because
  `apps/web/app/dashboard-client.tsx` imported the retention decision/reason types from
  `./types`; fixed by importing those types from `./_features/document-processing/models`, then
  reran and passed.
- `pnpm build`: passed; 6 package builds completed, with 3 cached package builds and fresh API,
  worker, and Next web builds.

Post-proof reconciliation:

- `pnpm verify:select -- --files <final changed paths...>`: rerun after proof update; command set
  remained unchanged.
- `node scripts/reconcile-validation-proof.mjs --proof docs/validation/OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md --files <final changed paths...>`:
  passed; 25 paths reconciled with the selected command set.
- `git diff --check`: passed.
