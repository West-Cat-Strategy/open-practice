# OP-T121 Reminder Job Reconciliation Proof

Date: 2026-06-16

## Scope

Added durable reconciliation for opt-in calendar reminder email jobs when staff update dashboard
reminder records:

- Pending matter reminders moved to acknowledged, dismissed, or cancelled cancel matching queued
  `calendar.reminder` email outbox rows and mark matching queued email lifecycle jobs skipped.
- Pending matter reminder reschedules cancel stale queued delivery; matching email confirmation
  queues one fresh delayed delivery from the updated dashboard reminder.
- Pending reminder refresh with matching email confirmation replaces the queued delayed delivery
  with one active queued reminder email.
- Deleting a pending matter reminder reconciles stale queued reminder delivery.
- Dashboard reminders remain the source of truth. Firm/client reminders remain dashboard-only, and
  already-started, sent, failed, completed, dead-letter, or unrelated jobs are not retroactively
  cancelled.

No schema migration, BullMQ delayed-job deletion, non-email delivery, user-preference routing, or
matterless email delivery was added.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar/reminders.ts apps/worker/src/processors.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T121_REMINDER_JOB_RECONCILIATION_PROOF_2026-06-16.md packages/database/src/repository/drizzle.ts packages/database/src/repository/jobs-email-contracts.ts packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/src/repository/memory.ts packages/database/test/repository.providers-jobs-email.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/operations.ts
```

Recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
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
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`

Initial focused test attempts in the fresh sibling worktree failed before running tests because
package entrypoints had not been built yet:

```bash
pnpm --filter @open-practice/database exec vitest run test/repository.providers-jobs-email.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/calendar.test.ts
pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts
```

Hydration/build:

```bash
pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build
```

Passed after the package builds:

```bash
pnpm --filter @open-practice/database exec vitest run test/repository.providers-jobs-email.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/calendar.test.ts
pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts
```

Results:

- Database repository: 1 file, 8 tests passed.
- Calendar API routes: 1 file, 32 tests passed.
- Worker processors: 1 file, 22 tests passed.

Final selector-guided validation passed:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
git diff --check
```

Final package results included:

- Domain: 27 files and 172 tests passed.
- Database: 18 files and 116 tests passed; Drizzle check and migration parity passed.
- API: 41 files and 519 tests passed.
- Providers: 9 files and 20 tests passed.
- Worker: 5 files and 41 tests passed.

Post-proof closeout passed with the final changed path set:

```bash
pnpm verify:select -- --files apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar/reminders.ts apps/worker/src/processors.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T121_REMINDER_JOB_RECONCILIATION_PROOF_2026-06-16.md packages/database/src/repository/drizzle.ts packages/database/src/repository/jobs-email-contracts.ts packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/src/repository/memory.ts packages/database/test/repository.providers-jobs-email.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/operations.ts
pnpm exec prettier --check docs/validation/OP-T121_REMINDER_JOB_RECONCILIATION_PROOF_2026-06-16.md
pnpm docs:check
git diff --check
```

## Notes

- Synthetic data only.
- Worker proof includes a stale delayed email job reaching the processor after the outbox row has
  been cancelled; the processor skips it without sending.
