# Inbound Communications Aggregation Efficiency Closeout Proof

Date: 2026-06-29 PDT

## Scope

This proof-only closeout was completed on
`refactor/inbound-comms-aggregation-efficiency-20260629` in the clean sibling worktree
`/Users/bryan/projects/open-practice-inbound-comms-efficiency-20260629`.

No runtime code changed in this branch. The current `main` implementation already contains the
smallest behavior-preserving inbound communications aggregation efficiency slice:

- `GET /api/communications/inbox` derives visible inbound message IDs from the authorized
  matter-scoped parent list, reads inbound attachments once with `inboundMessageIds`, and groups the
  rows in memory before serialization.
- The same aggregate derives visible conversation thread IDs from authorized parent threads, reads
  conversation messages and current-user notifications once with `threadIds`, and groups those rows
  before serialization.
- Repository filters preserve singular-ID precedence and explicit empty-array semantics, so
  `inboundMessageIds: []` or `threadIds: []` returns `[]` instead of falling back to broad child-row
  reads.
- Existing API coverage spies on the repository methods and proves the aggregate uses one
  attachment read, one message read, and one notification read for the visible parent sets.

## Boundaries Preserved

- No HTTP route, response shape, authorization rule, redaction posture, provider behavior,
  queue/retry behavior, schema, migration, dependency, worker behavior, settlement behavior, trust
  posting behavior, or public-token behavior changed.
- Child-row reads stay scoped by `firmId` and already-authorized parent IDs; this branch adds no
  broad child-row fallback and no new API surface.
- API serializers continue to omit raw email bodies, raw conversation bodies, storage keys,
  provider payloads, token material, private notes, and attachment storage paths.
- Proof data remains synthetic.

## Existing Coverage Rechecked

- `apps/api/src/routes/communications/inbox.ts` contains the already-shipped parent-derived bulk
  reads for inbound attachments, conversation messages, and conversation notifications.
- `apps/api/src/routes/communications.test.ts` includes
  `bulk-loads inbound and conversation child rows from authorized inbox parents`, which proves the
  aggregate batches child rows and preserves redaction.
- `packages/database/test/repository.inbound-email.test.ts` covers inbound attachment
  `inboundMessageIds` filtering, singular precedence, and empty-array semantics.
- `packages/database/test/repository.conversation-threads.test.ts` covers conversation message and
  notification `threadIds` filtering, singular precedence, and empty-array semantics.

## Changed Paths

Final changed paths are:

- `docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md`
- `docs/validation/README.md`

## Validation

### Selector

`pnpm verify:select -- --files docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`

Result: Pass. Recommended validation commands:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

### Focused Behavior Proof

| Command                                                                                                                                    | Result  | Notes                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                | Pass    | Built upstream domain package output for downstream focused checks.                                                                                                                                                                 |
| `pnpm --filter @open-practice/database build`                                                                                              | Pass    | Built database package output for API test import resolution.                                                                                                                                                                       |
| `pnpm --filter @open-practice/providers build`                                                                                             | Pass    | Built provider package output for API test import resolution.                                                                                                                                                                       |
| `pnpm --filter @open-practice/database test -- test/repository.inbound-email.test.ts test/repository.conversation-threads.test.ts`         | Pass    | Command completed successfully; the package script ran 27 database files / 155 tests.                                                                                                                                               |
| `pnpm --filter @open-practice/database exec vitest run test/repository.inbound-email.test.ts test/repository.conversation-threads.test.ts` | Pass    | Direct focused rerun passed 2 files / 10 tests, covering inbound attachment and conversation child-row batch filters.                                                                                                               |
| `pnpm --filter @open-practice/api test -- src/routes/communications.test.ts`                                                               | Blocked | The package script expanded to the full API suite and failed unrelated 5s timeouts in `server`, `caldav`, `documents`, `drafts`, `signatures`, and `ai-operational-proposals` tests. It was not a communications aggregate failure. |
| `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts`                                                       | Pass    | Direct focused rerun passed 1 file / 6 tests, including the communications child-row batching and redaction aggregate test.                                                                                                         |

### Docs And Policy Proof

| Command                                                                                                                                     | Result       | Notes                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`                                                                                                                         | Inconclusive | Initial run correctly flagged the new proof note for Prettier wrapping. After formatting the touched docs, reruns had no active Prettier process visible but the PTY wrapper did not return a summary. |
| `pnpm exec prettier --write docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md` | Pass         | Formatted the new proof note; README was unchanged.                                                                                                                                                    |
| `pnpm exec prettier --check docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md` | Pass         | Touched-file formatting proof passed.                                                                                                                                                                  |
| `pnpm docs:check`                                                                                                                           | Pass         | Documentation link validation passed.                                                                                                                                                                  |
| `pnpm policy:check`                                                                                                                         | Blocked      | Failed at `node scripts/validate-oss-reuse.mjs` because existing OSS reference lock commits do not match the central reference index for 21 reference repos; this branch did not touch reuse metadata. |
| `node scripts/validate-validation-proof-index.mjs`                                                                                          | Pass         | Validation proof index check passed after adding this proof note and README entry.                                                                                                                     |
| `node scripts/validate-local-evidence-dockerignore.mjs`                                                                                     | Pass         | Local evidence Docker ignore validation passed.                                                                                                                                                        |
| `node scripts/validate-open-practice-boundaries.mjs`                                                                                        | Pass         | Open Practice boundary policy passed.                                                                                                                                                                  |
| `git diff --check`                                                                                                                          | Pass         | Final whitespace check passed.                                                                                                                                                                         |
