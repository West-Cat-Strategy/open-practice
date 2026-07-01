# Document Disposition Reviewer Packet Proof 2026-06-30

**Branch:** `feat/document-disposition-reviewer-packet-20260630`
**Worktree:** `/Users/bryan/projects/open-practice-document-disposition-reviewer-packet-20260630`

## Scope

This slice adds the smallest staff-only, matter-scoped disposition reviewer packet command under
document processing:

- `POST /api/document-processing/documents/:documentId/disposition-reviewer-packet` accepts only
  enum `decision` and `reason` fields.
- Decisions are limited to `ready_for_reviewer_packet`, `reviewed_keep`, and
  `reviewed_superseded`; reasons reuse the existing retention/hold review reason enum.
- The command requires staff access plus matter-scoped `document_processing:read` and
  `document:update`.
- The command records only bounded `documents.reviewMetadata.retentionHoldReview` posture and
  reprojects the result through `retentionHoldReview.dispositionMetadata`.
- Documents with hold, upload/checksum/scan, or review-state blockers return
  `DOCUMENT_DISPOSITION_REVIEWER_PACKET_BLOCKED`.

## Preserved Boundaries

- No object deletion, destructive disposition workflow, background purge, or storage mutation.
- No retention-deadline enforcement, deadline computation, or automatic expiry.
- No legal-hold release or override.
- No raw OCR text, provider payload, storage key, export body, generated summary, free-form note,
  or raw metadata in the response or audit metadata.
- No public/client controls and no jurisdiction-certified compliance claim.
- No schema, migration, dependency, provider, worker, queue, or export-surface change.

## Final Changed Paths

- `apps/api/src/routes/document-processing/disposition-reviewer-packet.ts`
- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing.ts`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `docs/api-and-state-machines.md`
- `docs/document-retention-hold-workflow-design.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_DOCUMENT_DISPOSITION_REVIEWER_PACKET_PROOF_2026-06-30.md`
- `docs/validation/README.md`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/document-suggestions.test.ts`
- `packages/domain/src/document-suggestions.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation

- `pnpm verify:select -- --files <final changed paths>`
  - Passed. Recommended architecture, API contract, formatting, docs, policy, root test,
    domain/API/providers/worker/web checks, and build.
- `pnpm architecture:check`
  - Passed: 468 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: generated local API contract inventory with 354 paths under `.tmp/api-contract`.
- `pnpm format:check`
  - Passed.
- `pnpm docs:check`
  - Passed.
- `node scripts/validate-validation-proof-index.mjs`
  - Passed.
- `pnpm policy:check`
  - Blocked by unrelated repo-wide OSS reference-lock drift after secret scan, package manifest,
    supply-chain, toolchain, env-surface, architecture, dead-code, migration, and migration-lint
    subchecks passed. The failing lock entries are the existing central reference-index mismatches
    for `activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`,
    `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`, `ledgersmb__ledgersmb`,
    `lerianstudio__midaz`, `nextcloud__server`, `open-source-legal__opencontracts`,
    `opencollective__opencollective`, `opencollective__opencollective-api`,
    `opencollective__opencollective-frontend`, `openfga__openfga`,
    `paperless-ngx__paperless-ngx`, `temporalio__temporal`, `unstructured-io__unstructured`,
    and `zulip__zulip`.
- `pnpm --filter @open-practice/domain test`
  - Passed: 33 files, 295 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts`
  - Passed after fresh-worktree upstream package builds: 1 file, 40 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 43 files, 660 tests.
- `pnpm --filter @open-practice/providers test`
  - Passed: 13 files, 37 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 6 files, 54 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 46 files, 249 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: all 6 package builds.
- `pnpm test`
  - Passed: all package tests plus script tests.
- `git diff --check`
  - Passed.
