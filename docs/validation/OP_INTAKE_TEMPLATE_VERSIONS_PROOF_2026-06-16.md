# Immutable Intake Template Versions Proof - 2026-06-16

## Scope

- Branch: `feature/immutable-intake-template-versions`
- Goal: separate mutable staff intake-template drafts from immutable published versions while
  preserving active public-link token/header/path semantics and caller-compatible create/patch
  payloads.
- Clean-room posture: no third-party source, schemas, tests, fixtures, assets, or distinctive prose
  were copied. Heyform and OpnForm remain reference-only backlog context.

## Implementation Summary

- Added `intake_template_versions` and `intake_sessions.published_template_version_id` with SQL
  backfill from current template definitions.
- Kept `intake_templates` as the mutable staff draft row; `PATCH /api/intake-templates/:id` updates
  only that draft.
- Kept `POST /api/intake-templates` compatible while creating an initial published version, and
  added `POST /api/intake-templates/:id/publish` for explicit staff publishing.
- Updated public intake reads, uploads, signatures, submissions, and staff answer snapshots to use
  the session-pinned published definition, with legacy unpinned sessions falling back to the
  template row.

## Validation

Selector input:

```bash
pnpm verify:select -- --files apps/api/src/routes/intake-forms.test.ts apps/api/src/routes/intake-forms/public.ts apps/api/src/routes/intake-forms/shared.ts apps/api/src/routes/intake-forms/templates.ts apps/api/src/routes/intake.test.ts apps/api/src/routes/intake.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP_INTAKE_TEMPLATE_VERSIONS_PROOF_2026-06-16.md packages/database/migrations/0056_intake_template_versions.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/intake-templates-contracts.ts packages/database/src/repository/intake-templates/drizzle.ts packages/database/src/repository/intake-templates/memory.ts packages/database/src/repository/memory.ts packages/database/src/repository/setup/drizzle.ts packages/database/src/repository/setup/memory.ts packages/database/src/schema/intake.ts packages/database/src/seed.ts packages/database/test/repository.first-run.test.ts packages/database/test/repository.intake.test.ts packages/domain/src/practice-presets.ts packages/domain/src/sample-data.ts packages/domain/src/signatures.ts scripts/route-authorization-manifest.mjs
```

Selector output:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`

| Command                                           | Result                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain test`        | Passed: 27 files, 172 tests.                                         |
| `pnpm --filter @open-practice/domain typecheck`   | Passed.                                                              |
| `pnpm --filter @open-practice/domain build`       | Passed.                                                              |
| `pnpm --filter @open-practice/database test`      | Passed: 18 files, 116 tests.                                         |
| `pnpm --filter @open-practice/database db:check`  | Passed: Drizzle schema check clean.                                  |
| `pnpm migrations:check`                           | Passed: 57 SQL files match 57 journal entries.                       |
| `pnpm --filter @open-practice/database typecheck` | Passed.                                                              |
| `pnpm --filter @open-practice/database build`     | Passed.                                                              |
| `pnpm --filter @open-practice/api test`           | Passed on rerun: 41 files, 515 tests.                                |
| `pnpm --filter @open-practice/api typecheck`      | Passed.                                                              |
| `pnpm --filter @open-practice/providers test`     | Passed: 9 files, 20 tests.                                           |
| `pnpm --filter @open-practice/worker test`        | Passed: 5 files, 40 tests.                                           |
| `pnpm format:check`                               | Passed.                                                              |
| `pnpm docs:check`                                 | Passed.                                                              |
| `pnpm policy:check`                               | Passed after adding the publish route to the authorization manifest. |
| `pnpm test`                                       | Passed: package suites plus 63 Node script contract tests.           |
| `git diff --check`                                | Passed.                                                              |
| `pnpm ci:local`                                   | Passed: verify, `git diff --check`, and production build completed.  |

Notes:

- The first full `pnpm --filter @open-practice/api test` run timed out once in an unrelated CalDAV
  unsupported-filter test. A focused rerun of that test passed, and the full API suite passed on
  rerun before `pnpm test` and `pnpm ci:local` also passed.
- The first `pnpm policy:check` run identified the newly added publish endpoint as missing from the
  route authorization manifest. The manifest entry was added and the gate passed on rerun.
