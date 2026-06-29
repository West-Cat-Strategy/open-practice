# Document Disposition Schedule Profile Proof

**Date:** 2026-06-29
**Branch:** `feat/document-disposition-schedule-profile-20260629`
**Worktree:** `/Users/bryan/projects/open-practice-disposition-schedule-profile-20260629`

## Scope

This branch was created in a clean sibling worktree because the root checkout at
`/Users/bryan/projects/open-practice` was occupied by unrelated report/export alignment edits.

The shipped slice adds a single default, firm-configured disposition review schedule profile and
projects it as reviewer context inside the existing
`retentionHoldReview.dispositionMetadata.scheduleProfile` workbench packet. The profile is stored
as bounded nullable firm settings JSON and is not used to compute deletion eligibility, deadlines,
legal-hold release, or compliance posture.

## Shipped Behavior

- `FirmSettings.dispositionReviewScheduleProfile` stores an optional default profile with label,
  cadence, and optional reviewer hint offsets.
- Staff can read the bounded profile through
  `GET /api/document-processing/disposition-review-schedule-profile`.
- `PUT /api/document-processing/disposition-review-schedule-profile` requires `firm:update`, can
  update or clear the profile, and writes safe
  `firm.disposition_review_schedule_profile.updated` audit metadata only.
- The document-processing workbench reads firm settings once per request and projects the normalized
  profile into `retentionHoldReview.dispositionMetadata.scheduleProfile` with `source:
"firm_settings"` and fixed false destructive/deadline/compliance flags.
- The Documents dashboard renders profile label, cadence, and offsets as reviewer context only.

## Preserved Boundaries

This slice does not delete objects, enforce retention deadlines, override or release legal holds,
retain raw payloads, retain export bodies, retain free-form notes, add public/client disposition
controls, derive destructive eligibility, add dependencies, or make compliance claims.

All examples and tests use synthetic data only. Profile serialization allow-lists the bounded
profile fields and drops arbitrary unknown JSON keys.

## Final Changed Paths

- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing.ts`
- `apps/api/src/routes/document-processing/settings.ts`
- `apps/api/src/routes/document-processing/workbench.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/document-retention-hold-workflow-design.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_DOCUMENT_DISPOSITION_SCHEDULE_PROFILE_PROOF_2026-06-29.md`
- `docs/validation/README.md`
- `packages/database/migrations/0075_document_disposition_review_schedule_profile.sql`
- `packages/database/migrations/meta/0075_snapshot.json`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/firm-settings-contracts.ts`
- `packages/database/src/repository/firm-settings/drizzle.ts`
- `packages/database/src/repository/firm-settings/memory.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema/firm-settings.ts`
- `packages/database/test/repository.first-run.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/document-suggestions.test.ts`
- `packages/domain/src/document-suggestions.ts`
- `packages/domain/src/models.ts`
- `scripts/route-authorization-manifest.mjs`

## Focused Validation

Passed before final selector validation:

- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/database build`
  - Passed after domain build completed in the fresh sibling worktree.
- `pnpm --filter @open-practice/providers build`
  - Passed after domain build completed in the fresh sibling worktree.
- `pnpm --filter @open-practice/domain test -- document-suggestions.test.ts audit-taxonomy.test.ts`
  - Passed: 33 files, 268 tests.
- `pnpm --filter @open-practice/database exec vitest run test/repository.first-run.test.ts test/schema.test.ts`
  - Passed: 2 files, 54 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx`
  - Passed: 1 file, 5 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts`
  - Passed: 1 file, 30 tests.

Fresh-worktree setup notes:

- The first database/web/API focused test attempts failed before exercising this slice because built
  workspace package outputs were missing in the fresh sibling worktree. Building `domain`,
  `database`, and `providers` resolved those import-resolution failures.

## Final Selector Validation

Selector command:

```bash
paths=($(git diff --name-only --diff-filter=ACMRT) $(git ls-files --others --exclude-standard)); pnpm verify:select -- --files "${paths[@]}"
```

Selected checks:

- `pnpm architecture:check`
  - Passed: 463 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: API contract inventory generated with 343 paths.
- `pnpm format:check`
  - Passed: all matched files use Prettier style.
- `pnpm docs:check`
  - Passed: documentation link validation passed.
- `pnpm migrations:check`
  - Passed: 76 SQL files match 76 journal entries.
- `pnpm migrations:lint`
  - Passed with the selector caveat that the script only sees tracked `git diff HEAD` SQL files
    before staging and therefore reported 0 changed SQL files.
- `node --input-type=module -e 'import { lintMigrationFiles } from "./scripts/lint-migrations.mjs"; const file = "packages/database/migrations/0075_document_disposition_review_schedule_profile.sql"; const findings = lintMigrationFiles({ files: [file] }); if (findings.length) { for (const finding of findings) console.error(`${finding.type}: ${finding.message}`); process.exit(1); } console.log(`Migration lint passed: ${file}`);'`
  - Passed: `packages/database/migrations/0075_document_disposition_review_schedule_profile.sql`.
- `pnpm --filter @open-practice/domain test`
  - Passed: 33 files, 268 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 27 files, 160 tests.
- `pnpm --filter @open-practice/database db:check`
  - Passed: Drizzle check reported everything fine.
- `pnpm --filter @open-practice/database typecheck`
  - Passed.
- `pnpm --filter @open-practice/database build`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 43 files, 624 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - Passed: 13 files, 37 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 6 files, 54 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 46 files, 243 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 package builds succeeded, including the Next production build.

Selector checks with unrelated repo-wide blockers:

- `pnpm policy:check`
  - Blocked by pre-existing OSS reuse lock drift unrelated to this branch. The failing lock commits
    were `activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`,
    `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`,
    `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `nextcloud__server`,
    `open-source-legal__opencontracts`, `opencollective__opencollective`,
    `opencollective__opencollective-api`, `opencollective__opencollective-frontend`,
    `openfga__openfga`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`,
    `unstructured-io__unstructured`, and `zulip__zulip`.
- `pnpm test`
  - Blocked by a broad-suite 5s timeout in unchanged `apps/api/src/routes/mfa.test.ts`:
    `enforces MFA if enabled and allows bypass with recovery code`. The selected standalone
    `pnpm --filter @open-practice/api test` passed 43 files and 624 tests, and a solo rerun of
    `pnpm --filter @open-practice/api exec vitest run src/routes/mfa.test.ts` passed 1 file and
    1 test, confirming the timeout was broad-suite load related rather than this slice.
