# OP-T97 Conversation Message Records V1 Proof

Date: 2026-05-17

## Scope

Implemented the first additive conversation message records V1 slice:

- Added matter-scoped `conversation_messages` persistence and repository read/create methods.
- Added authorized `GET`/`POST /api/conversation-threads/:id/messages` routes for persisted records only.
- Added redacted `conversation_message.created` audit metadata with IDs, kind, body length, and author-presence only.
- Blocked message body reads after access revocation and new message creation after retention expiry.
- Added communications inbox topic summaries with message count/latest-message timestamp, without message bodies.
- Kept realtime chat, delivery queues, notifications, portal composers, retry controls, and export artifacts out of scope.

## Selector

Ran:

```sh
pnpm verify:select -- --files apps/api/src/routes/communications.test.ts apps/api/src/routes/communications.ts apps/api/src/routes/conversation-threads.test.ts apps/api/src/routes/conversation-threads.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md packages/database/migrations/0032_conversation_message_records.sql packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/test/repository.conversation-threads.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/conversations.ts packages/domain/src/models.ts
```

Recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

After updating this note and the API/state-machine boundary text, reran:

```sh
pnpm verify:select -- --files docs/api-and-state-machines.md docs/validation/OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md
```

Recommended and passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

## Results

All selected checks passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts src/routes/communications.test.ts`
- `pnpm --filter @open-practice/database exec vitest run test/repository.conversation-threads.test.ts test/schema.test.ts`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Fresh-worktree setup note: package tests initially could not resolve workspace package entrypoints
until local package build output existed. After building `@open-practice/domain`,
`@open-practice/database`, and `@open-practice/providers`, the selected test/typecheck/build suite
passed.

Skipped checks: none.

After adding this proof note and moving OP-T97 to review-ready in the workboard, reran:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md
```

Recommended and passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

After tightening the retained/revoked message boundaries, reran:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Recommended and passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts src/routes/communications.test.ts`
- `pnpm --filter @open-practice/database exec vitest run test/repository.conversation-threads.test.ts test/schema.test.ts`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
