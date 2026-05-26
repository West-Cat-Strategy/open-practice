# OP-T119 Staff-Only Conversation Export Artifact Proof

Date: 2026-05-26

## Scope

Implemented the first backend-only staff conversation export artifact slice:

- Added staff-only `POST`, status, and download routes under `/api/conversation-threads/:id/export-requests`.
- Reused the existing `reports` job lifecycle with `conversation_thread_export` jobs, queued when the reports worker queue is configured and completed inline when it is not.
- Regenerated the redacted JSON artifact at download time from authorized repository reads instead of storing export bodies in job metadata.
- Kept message bodies, metadata values, public delivery, realtime chat, PDF/DOCX export formats, external integrations, new dependencies, and migrations out of scope.
- Blocked export creation, status reads, and downloads after conversation access is revoked.

Existing branch context note: this checkout also contains a separate OP-T120 document
retention-review hints lane. The OP-T119 conversation export work preserved those files and added a
separate Done row/proof entry for this requested artifact slice.

## Selector

Ran:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Recommended:

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
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Results

Passed:

- `pnpm --filter @open-practice/domain exec vitest run src/conversations.test.ts src/permissions.test.ts`
- `pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts`
- `pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm docs:check`
- `node scripts/validate-doc-links.mjs`
- `node scripts/validate-open-practice-boundaries.mjs`
- `git diff --check`

Attempted with blockers outside this slice:

- `pnpm format:check` failed after the OP-T119-owned files were formatted because unrelated dirty
  files still need Prettier: `apps/api/src/routes/connectors.test.ts`,
  `apps/api/src/routes/connectors.ts`, `apps/web/app/dashboard/queues-section.tsx`,
  `packages/database/src/repository/drizzle.ts`, and `packages/database/src/repository/memory.ts`.
- `pnpm policy:check` passed tracked-secret scan, package manifest validation, and migration parity,
  then failed in `node scripts/validate-oss-reuse.mjs` because existing OSS reference lock commits
  do not match the central reference index.
- `node scripts/validate-oss-reuse.mjs` reproduced the same existing OSS reference lock/index parity
  failures for `activepieces__activepieces`, `apache__fineract`, `civicrm__civicrm-core`,
  `documenso__documenso`, `docusealco__docuseal`, `kimai__kimai`, `ledgersmb__ledgersmb`,
  `lerianstudio__midaz`, `microsoft__markitdown`, `nextcloud__server`,
  `open-source-legal__opencontracts`, `opencollective__opencollective-api`,
  `opencollective__opencollective-frontend`, `temporalio__temporal`,
  `unstructured-io__unstructured`, and `zulip__zulip`.

Skipped broader selector recommendations: the full repo/package suites selected because this
worktree includes separate connector, document-retention, database, and web changes. The focused
conversation-export API/domain/worker checks, docs links, route-boundary validation, and whitespace
check passed as recorded above.
