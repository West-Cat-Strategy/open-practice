# Document Disposition Metadata Proof

**Date:** 2026-06-29
**Branch:** `feat/document-disposition-metadata-20260629`
**Worktree:** `/Users/bryan/projects/open-practice-document-disposition-metadata-20260629`
**Base:** `9cb1f25e55fb9f8a11bde1d69623b5228a7528bf`

## Scope

This branch was created in a clean sibling worktree because the root checkout at
`/Users/bryan/projects/open-practice` was occupied by unrelated billing, matter-lifecycle,
document-processing, and proof/index edits.

The shipped slice adds a read-only, non-destructive document disposition metadata projection inside
the existing `retentionHoldReview` packet returned by
`GET /api/document-processing/workbench?matterId=`. It derives candidate state, blocker counts,
source cue counts, and optional review schedule fields from existing authorized document
retention/hold posture.

## Shipped Behavior

- `buildDocumentRetentionHoldReview` now returns `dispositionMetadata` with `candidateState`,
  `readyForReviewerPacket`, safe blocker counts, source cue counts, optional `reviewAfter` and
  `minimumRetainThrough`, and fixed false flags for destructive action, object deletion, retention
  deadline enforcement, legal-hold release command, retained export body, raw payload retention, and
  compliance claim.
- Candidate-state mapping is intentionally narrow: active blockers produce `blocked_by_hold`;
  recorded `ready_for_reviewer_packet`, `reviewed_keep`, and `reviewed_superseded` decisions produce
  the matching state; otherwise the disposition candidate state is `not_ready`.
- The document-processing workbench exposes the metadata through the existing matter-scoped,
  server-authorized `retentionHoldReview` object only.
- The Documents dashboard renders the candidate state, blocker counts, optional review schedule,
  and no-deletion/no-deadline posture without adding a new control.

## Preserved Boundaries

This slice adds no route, command, schema, migration, repository write, audit write, background job,
object deletion, retention-deadline enforcement, legal-hold release command, provider/OCR payload
retention, free-form note storage, public/client disposition control, dependency, or
jurisdiction-certified compliance claim.

All examples and tests use synthetic data only.

## Final Changed Paths

- `apps/api/src/routes/document-processing.test.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/document-retention-hold-workflow-design.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_DOCUMENT_DISPOSITION_METADATA_PROOF_2026-06-29.md`
- `docs/validation/README.md`
- `packages/domain/src/document-suggestions.test.ts`
- `packages/domain/src/document-suggestions.ts`

## Focused Validation

Passed before final docs/proof validation:

- `pnpm --filter @open-practice/domain exec vitest run src/document-suggestions.test.ts --reporter=verbose`
  - Passed: 1 file, 7 tests.
- `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`
  - Passed; required in this fresh sibling worktree before downstream API/web tests could resolve built workspace package outputs.
- `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts --reporter=verbose`
  - Passed after upstream builds: 1 file, 22 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx --reporter=verbose`
  - Passed after upstream builds: 1 file, 5 tests.

Fresh-worktree setup notes:

- The first API-focused test attempt failed before executing tests because `@open-practice/database`
  package output had not been built in the fresh sibling worktree; resolved by building domain,
  database, and providers.
- The first web-focused test attempt failed before executing tests because the
  `@open-practice/domain/operational-actions` subpath had not been built in the fresh sibling
  worktree; resolved by building domain, database, and providers.

## Final Selector Validation

Selector command:

```bash
paths=($(git diff --name-only --diff-filter=ACMRT) $(git ls-files --others --exclude-standard)); pnpm verify:select -- --files "${paths[@]}"
```

Selected checks:

- `pnpm architecture:check`
  - Passed: 460 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: OpenAPI contract generated with 338 paths.
- `pnpm format:check`
  - Initial run failed on `docs/api-and-state-machines.md` and `docs/validation/README.md`.
  - Ran `pnpm exec prettier --write docs/api-and-state-machines.md docs/validation/README.md`;
    final rerun passed.
- `pnpm docs:check`
  - Passed before and after this proof note was finalized.
- `pnpm policy:check`
  - Blocked by pre-existing OSS reuse lock drift unrelated to this branch. The failing central
    reference locks were:
    `activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`,
    `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`,
    `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `nextcloud__server`,
    `open-source-legal__opencontracts`, `opencollective__opencollective`,
    `opencollective__opencollective-api`, `opencollective__opencollective-frontend`,
    `openfga__openfga`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`,
    `unstructured-io__unstructured`, and `zulip__zulip`.
- `pnpm --filter @open-practice/domain test`
  - Passed: 32 files, 255 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Blocked by unrelated broad-suite 5s timeouts in route suites outside this slice. A concurrent
    run first timed out eight tests; a solo rerun narrowed the failure to four timeouts in
    `src/routes/caldav.test.ts`, `src/routes/document-assembly.test.ts`, and
    `src/routes/e2e-support.test.ts`.
  - The changed route suite passed:
    `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts --reporter=verbose`
    passed 1 file and 22 tests.
  - Timed-out suites passed in isolation:
    `src/routes/caldav.test.ts` passed 1 file and 8 tests,
    `src/routes/document-assembly.test.ts` passed 1 file and 3 tests, and
    `src/routes/e2e-support.test.ts` passed 1 file and 4 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - Passed: 13 files, 37 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 6 files, 54 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 45 files, 237 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 successful package builds.

Final local-only checks after proof/index edits:

- `pnpm verify:select -- --files <actual final changed paths>`
  - Passed after this proof file was added and docs/index files changed; recommended command set
    remained unchanged.
- `pnpm format:check`
  - Passed after formatting touched docs.
- `pnpm docs:check`
  - Passed after this proof file was finalized.
- `node scripts/validate-validation-proof-index.mjs`
  - Supplemental proof-index check because `pnpm policy:check` is blocked before reaching all proof
    index assertions.
  - Passed.
- `git diff --check`
  - Passed after final proof edits.
