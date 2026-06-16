# OP-T158 Email Template Drafts Proof

Date: 2026-06-16

## Scope

OP-T158 adds provider-neutral saved email template drafts and persisted preview snapshots without
live delivery automation. Template drafts are firm-scoped reusable records. Preview snapshots are
matter-scoped persisted render outputs with sanitized/truncated body previews, recipient counts
only, warning codes, related-resource IDs, and explicit `persisted: true` / `queued: false` posture.

## Boundary

- Preserved existing SMTP/IMAP settings, `/api/email/previews`, `/api/mail/outbox`, worker email
  delivery, provider packages, and send-confirmation behavior.
- Added no campaign automation, bulk sends, subscription management, provider delivery side
  effects, route-catalog entry, queue/send jobs, or provider settings changes.
- Template preview snapshot routes never call `queueRouteEmailOutbox`, never inspect SMTP provider
  settings, and never enqueue BullMQ jobs.
- Audit/job metadata stores only IDs, counts, lengths, warning counts, and posture fields. Raw
  subject/body/recipient addresses stay out of audit and job metadata.
- `usewaypoint__email-builder-js` remained clean-room backlog context only; no dependency, copied
  excerpt, vendored asset, or reference-derived code was added.

## Implementation Notes

- Domain:
  - `EmailTemplateDraftRecord`
  - `EmailTemplatePreviewSnapshotRecord`
  - preview normalization, HTML sanitization, truncation warnings, recipient counts, and snapshot
    metadata helpers.
- Database:
  - Migration `0061_email_template_drafts.sql`
  - Tables `email_template_drafts` and `email_template_preview_snapshots`
  - Memory and Drizzle repository methods for list/get/create/update drafts and create/list
    preview snapshots.
- API:
  - `GET /api/email/template-drafts`
  - `POST /api/email/template-drafts`
  - `PATCH /api/email/template-drafts/:templateDraftId`
  - `POST /api/email/template-drafts/:templateDraftId/preview-snapshots`
  - `GET /api/email/template-drafts/:templateDraftId/preview-snapshots?matterId=...`
  - Firm-scoped draft routes use the existing `email` permission resource; preview snapshots also
    require matter-scoped `email:create`/`email:read` and reuse related-resource matter matching.
- Web:
  - Added a compact matter-workspace email template panel near email delivery history.
  - The panel lists saved drafts, edits/creates one draft, saves a preview snapshot for the active
    matter, and shows recent snapshots. It has no delivery confirmation panel or send control.

## Validation

### Final Changed Path Selector

`pnpm verify:select -- --files apps/api/src/routes/email.test.ts apps/api/src/routes/email.ts apps/api/src/routes/email/outbox.ts apps/api/src/routes/email/shared.ts apps/api/src/routes/email/templates.ts apps/web/app/_features/email-templates/models.ts apps/web/app/_features/email-templates/server-resources.test.ts apps/web/app/_features/email-templates/server-resources.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/email-template-drafts-panel.test.tsx apps/web/app/dashboard/email-template-drafts-panel.tsx apps/web/app/dashboard/matter-overview-section.tsx apps/web/app/page.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T158_EMAIL_TEMPLATE_DRAFTS_PROOF_2026-06-16.md docs/validation/README.md packages/database/migrations/0061_email_template_drafts.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/email-template-drafts-contracts.ts packages/database/src/repository/email-template-drafts/drizzle.ts packages/database/src/repository/email-template-drafts/memory.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/schema/email-template-drafts.ts packages/database/test/repository.email-template-drafts.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/email-template-drafts.test.ts packages/domain/src/email-template-drafts.ts packages/domain/src/index.ts scripts/route-authorization-manifest.mjs`

Result: Pass. Selector required:

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
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Provider-neutral proof added the explicit provider `typecheck` and `build` lanes too.

### Command Results

| Command                                                                                                  | Result | Notes                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @open-practice/domain test -- email-template-drafts.test.ts`                              | Pass   | Targeted domain preview normalization/snapshot-safe metadata coverage passed while iterating.                                        |
| `pnpm --filter @open-practice/domain build`                                                              | Pass   | Built domain artifacts needed by fresh-worktree package resolution.                                                                  |
| `pnpm --filter @open-practice/database build`                                                            | Pass   | Passed after correcting the new schema import to use `schema/core.ts` for `users`.                                                   |
| `pnpm --filter @open-practice/providers build`                                                           | Pass   | Proves provider package still compiles unchanged and unblocks API package test imports.                                              |
| `pnpm --filter @open-practice/database test -- repository.email-template-drafts.test.ts schema.test.ts`  | Pass   | Targeted database repository/schema coverage passed while iterating.                                                                 |
| `pnpm --filter @open-practice/web test -- email-template-drafts-panel.test.tsx server-resources.test.ts` | Pass   | Targeted web panel/resource coverage passed while iterating.                                                                         |
| `pnpm --filter @open-practice/api test -- email.test.ts`                                                 | Pass   | Targeted email route coverage passed while iterating; includes settings/preview/outbox/receipt behavior.                             |
| `pnpm format:check`                                                                                      | Pass   | Formatting gate passed for the changed TypeScript/Markdown paths; SQL migration has no Prettier parser and is covered by migrations. |
| `pnpm docs:check`                                                                                        | Pass   | Proof index, planning, opportunity, and API/state-machine docs passed.                                                               |
| `pnpm policy:check`                                                                                      | Pass   | Route authorization manifest and repository boundary checks passed.                                                                  |
| `pnpm test`                                                                                              | Pass   | Full workspace package tests plus script contract tests passed.                                                                      |
| `pnpm --filter @open-practice/domain test`                                                               | Pass   | 29 test files / 191 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/domain typecheck`                                                          | Pass   | Domain typecheck passed.                                                                                                             |
| `pnpm --filter @open-practice/database test`                                                             | Pass   | 22 test files / 125 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/database db:check`                                                         | Pass   | Database schema check passed.                                                                                                        |
| `pnpm migrations:check`                                                                                  | Pass   | Migration SQL/journal parity passed.                                                                                                 |
| `pnpm --filter @open-practice/database typecheck`                                                        | Pass   | Database typecheck passed.                                                                                                           |
| `pnpm --filter @open-practice/database build`                                                            | Pass   | Database build passed.                                                                                                               |
| `pnpm --filter @open-practice/api test`                                                                  | Pass   | 41 test files / 541 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/api typecheck`                                                             | Pass   | API typecheck passed.                                                                                                                |
| `pnpm --filter @open-practice/providers test`                                                            | Pass   | 9 test files / 20 tests passed.                                                                                                      |
| `pnpm --filter @open-practice/providers typecheck`                                                       | Pass   | Provider package typecheck passed unchanged.                                                                                         |
| `pnpm --filter @open-practice/providers build`                                                           | Pass   | Provider package build passed unchanged.                                                                                             |
| `pnpm --filter @open-practice/worker test`                                                               | Pass   | 5 test files / 42 tests passed.                                                                                                      |
| `pnpm --filter @open-practice/web test`                                                                  | Pass   | 37 test files / 196 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/web typecheck`                                                             | Pass   | Web typecheck passed.                                                                                                                |
| `pnpm build`                                                                                             | Pass   | Full Turbo build passed for API, database, domain, providers, web, and worker.                                                       |
| `git diff --check`                                                                                       | Pass   | Whitespace check passed before and after the final proof update.                                                                     |
