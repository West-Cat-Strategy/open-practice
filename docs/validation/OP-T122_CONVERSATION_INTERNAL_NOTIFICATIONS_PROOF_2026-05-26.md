# OP-T122 Conversation Internal Notifications Proof

Date: 2026-05-26

## Scope

Implemented the first staff-only conversation notification slice:

- Added `ConversationMessageNotificationRecord` support with firm, matter, thread, message, and
  recipient scope plus `readAt` and `mutedAt` posture timestamps.
- Added database storage, repository contracts, in-memory/drizzle fan-out, and a manual posture
  update path for `mark_read`, `mute`, and `unmute`.
- Fan out notifications only for `internal_only` conversation threads.
- Surface the current user's notification posture summary in the communications inbox response.
- Extend conversation audit metadata with notification boundary and notification counts.

Realtime chat, portal delivery, public notifications, and cross-thread notification automation stay
out of scope for this slice.

## Validation

Selector gate:

```bash
pnpm verify:select -- --files apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads.test.ts apps/api/src/routes/communications.ts apps/api/src/routes/communications.test.ts apps/web/app/types.ts packages/domain/src/models.ts packages/domain/src/conversations.ts packages/domain/src/conversations.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/permissions.ts packages/domain/src/permissions.test.ts packages/database/src/schema.ts packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/test/repository.conversation-threads.test.ts packages/database/migrations/0038_conversation_message_notifications.sql packages/database/migrations/meta/_journal.json docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T122_CONVERSATION_INTERNAL_NOTIFICATIONS_PROOF_2026-05-26.md
```

The selector recommended the broad API/domain/database/web/docs/policy/build set because the slice
touches API routes, domain models, database schema/repository code, web response types, and docs.

Focused row checks:

```bash
pnpm --filter @open-practice/domain exec vitest run src/conversations.test.ts src/audit-taxonomy.test.ts src/permissions.test.ts
pnpm --filter @open-practice/database exec vitest run test/repository.conversation-threads.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts src/routes/communications.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm docs:check
pnpm exec prettier --check apps/api/src/routes/communications.ts apps/api/src/routes/communications.test.ts apps/api/src/routes/conversation-threads.test.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/test/repository.conversation-threads.test.ts
git diff --check -- apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads.test.ts apps/api/src/routes/communications.ts apps/api/src/routes/communications.test.ts apps/web/app/types.ts packages/domain/src/models.ts packages/domain/src/conversations.ts packages/domain/src/conversations.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/permissions.ts packages/domain/src/permissions.test.ts packages/database/src/schema.ts packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/test/repository.conversation-threads.test.ts packages/database/migrations/0038_conversation_message_notifications.sql packages/database/migrations/meta/_journal.json docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T122_CONVERSATION_INTERNAL_NOTIFICATIONS_PROOF_2026-05-26.md
```

Broader dirty-tree checks:

```bash
pnpm --filter @open-practice/api typecheck
pnpm format:check
```

`pnpm --filter @open-practice/api typecheck` is blocked by existing dirty-tree calendar reminder
delivery errors in `apps/api/src/routes/calendar.ts` and `apps/api/src/routes/calendar.test.ts`.
`pnpm format:check` is blocked by existing dirty-tree formatting drift in
`apps/api/src/routes/calendar.ts` and `apps/web/app/dashboard/queues-section.tsx`.

## Results

Passed:

- `pnpm verify:select -- --files ...`
- `pnpm --filter @open-practice/domain exec vitest run src/conversations.test.ts src/audit-taxonomy.test.ts src/permissions.test.ts`
- `pnpm --filter @open-practice/database exec vitest run test/repository.conversation-threads.test.ts`
- `pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts src/routes/communications.test.ts`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm docs:check`
- `pnpm exec prettier --check ...`
- `git diff --check -- ...`

Blocked outside this slice:

- `pnpm --filter @open-practice/api typecheck`
- `pnpm format:check`

## Privacy And Boundaries

- Synthetic test data only.
- Notification records only capture firm, matter, thread, message, recipient, and posture
  timestamps.
- Audit metadata remains bounded to notification boundary and count summaries.
- Realtime chat, portal delivery, public notifications, and raw message bodies stay out of scope.
