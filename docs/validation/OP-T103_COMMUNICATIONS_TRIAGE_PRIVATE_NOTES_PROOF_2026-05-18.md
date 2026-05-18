# OP-T103 Communications Triage Private Notes Proof

Date: 2026-05-18

## Scope

Added the first communications triage ownership/private-note slice without adding a new route,
table, realtime channel, delivery queue, notification path, provider setup, or conversation-message
delivery behavior. The existing inbound email triage update route now accepts one internal staff
note per triage update plus consent/channel follow-up state inside the constrained
`metadata.staffTriage` envelope.

The communications inbox aggregate exposes only derived internal-note posture:

- `privateNoteCount`
- `latestPrivateNoteAt`
- safe follow-up fields: channel, consent status, and due time

It does not expose private note text in the aggregate response or audit metadata. Existing
assignment ownership, contact-link validation, matter scoping, and assignee access checks remain in
place.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/communications.ts apps/api/src/routes/communications.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts docs/api-and-state-machines.md docs/validation/README.md docs/validation/OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md
```

Passed:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/communications.ts apps/api/src/routes/communications.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts docs/api-and-state-machines.md docs/validation/README.md docs/validation/OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md
pnpm install --frozen-lockfile --offline
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts src/routes/communications.test.ts
pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm docs:check
pnpm policy:check
pnpm format:check
git diff --check
```

Results:

- Selector recommended `format:check`, `docs:check`, `policy:check`, API/domain tests and
  typechecks, providers tests, and worker tests.
- Fresh-worktree package setup required the offline install plus local domain/database/providers
  builds before API tests could resolve workspace package exports.
- Focused API route tests: 2 files, 22 tests passed.
- Focused domain taxonomy test: 1 file, 9 tests passed.
- Full API tests: 33 files, 310 tests passed.
- Full domain tests: 15 files, 98 tests passed.
- Providers tests: 3 files, 11 tests passed.
- Worker tests: 3 files, 19 tests passed.
- API/domain typechecks, docs, policy, formatting, and diff whitespace checks passed.

Skipped checks: none.
