# Email Outbox Child-Row Bulk Reads Proof

Date: 2026-06-18

## Scope

This branch narrows database access for outbound email history reads without changing HTTP response
shapes. `GET /api/mail/outbox` and the outbound portion of `GET /api/communications/inbox` now load
email events and receipt-token rows once per already-authorized email page instead of once per email.

## Boundary

- No HTTP route, response-shape, permission, provider, queue, retry, receipt-recording, settlement,
  trust-posting, or public-token behavior changed.
- The new repository filters are optional and preserve existing broad/single-email behavior when
  `emailIds` is omitted.
- Explicit `emailIds: []` returns `[]` and never falls back to firm-wide or matter-wide child-row
  reads.
- API callers derive `emailIds` only from already visible outbox rows, keep `firmId` scoped on every
  repository call, and continue using existing serializers/redaction.
- Proof examples are synthetic and do not include raw email bodies, recipients, token hashes,
  provider payloads, credentials, storage keys, client details, or matter details beyond fixture IDs.

## Implementation Notes

- Added optional `emailIds?: string[]` filters to `listEmailEvents` and
  `listEmailReceiptTokens`.
- Memory and Drizzle jobs-email providers apply the batch filter with firm scope, preserve
  single-`emailId` precedence for existing callers, and keep event/token ordering stable.
- `/api/mail/outbox` batches events and receipt tokens for the selected outbox page, groups rows by
  `emailId`, and preserves `serializeDeliveryHistory`.
- `/api/communications/inbox` batches outbound email child rows for the selected aggregate and
  preserves redacted outbound/channel-history serialization.
- No schema, migration, dependency, route-authorization manifest, provider, worker, or public API
  changes were needed.

## Changed Paths

- `apps/api/src/routes/communications.test.ts`
- `apps/api/src/routes/communications/inbox.ts`
- `apps/api/src/routes/email.test.ts`
- `apps/api/src/routes/email/outbox.ts`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md`
- `docs/validation/README.md`
- `packages/database/src/repository/jobs-email-contracts.ts`
- `packages/database/src/repository/jobs-email/drizzle.ts`
- `packages/database/src/repository/jobs-email/memory.ts`
- `packages/database/test/repository.providers-jobs-email.test.ts`

## Validation

### Initial Focused Checks

| Command                                                                                                       | Result  | Notes                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/database test -- test/repository.providers-jobs-email.test.ts`                  | Pass    | 22 files / 129 tests passed, including memory/Drizzle batch-filter parity.                                                   |
| `pnpm --filter @open-practice/api test -- src/routes/email.test.ts src/routes/communications.test.ts`         | Blocked | Fresh sibling worktree had not built `@open-practice/providers`, so Vitest import resolution failed before route assertions. |
| `pnpm --filter @open-practice/domain build`                                                                   | Pass    | Built upstream package output for fresh-worktree resolution.                                                                 |
| `pnpm --filter @open-practice/database build`                                                                 | Pass    | Built database package output for fresh-worktree resolution.                                                                 |
| `pnpm --filter @open-practice/providers build`                                                                | Pass    | Built provider package output for API test imports.                                                                          |
| `pnpm --filter @open-practice/api exec vitest run src/routes/email.test.ts src/routes/communications.test.ts` | Pass    | 2 files / 32 tests passed after upstream package builds.                                                                     |
| `git diff --check`                                                                                            | Pass    | Whitespace check passed before proof/doc updates.                                                                            |

### Final Selector

`pnpm verify:select -- --files docs/validation/OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md apps/api/src/routes/communications.test.ts apps/api/src/routes/communications/inbox.ts apps/api/src/routes/email.test.ts apps/api/src/routes/email/outbox.ts docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/src/repository/jobs-email-contracts.ts packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/test/repository.providers-jobs-email.test.ts`

Result: Pass. Selector required:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`

### Final Command Results

| Command                                           | Result | Notes                                                                                              |
| ------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `pnpm exec prettier --write <6 touched files>`    | Pass   | Applied formatting after the first `pnpm format:check` identified touched-file drift.              |
| `pnpm format:check`                               | Pass   | Final Prettier check passed after formatting.                                                      |
| `pnpm docs:check`                                 | Pass   | Documentation link validation passed.                                                              |
| `pnpm policy:check`                               | Pass   | Security, manifest, deadcode, migration, OSS reuse, docs, proof-index, and boundary checks passed. |
| `pnpm --filter @open-practice/database test`      | Pass   | 22 files / 129 tests passed.                                                                       |
| `pnpm --filter @open-practice/database db:check`  | Pass   | Drizzle schema check passed.                                                                       |
| `pnpm migrations:check`                           | Pass   | Migration parity passed: 65 SQL files match 65 journal entries.                                    |
| `pnpm --filter @open-practice/database typecheck` | Pass   | Database typecheck passed.                                                                         |
| `pnpm --filter @open-practice/database build`     | Pass   | Database build passed.                                                                             |
| `pnpm --filter @open-practice/api test`           | Pass   | 42 files / 560 tests passed.                                                                       |
| `pnpm --filter @open-practice/api typecheck`      | Pass   | API typecheck passed.                                                                              |
| `git diff --check`                                | Pass   | Final whitespace check passed.                                                                     |
