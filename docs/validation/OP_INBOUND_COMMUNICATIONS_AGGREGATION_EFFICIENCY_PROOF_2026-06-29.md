# Inbound Communications Aggregation Efficiency Closeout Proof

Date: 2026-06-29 PDT

Refresh: 2026-07-01 PDT; started on
`chore/inbound-comms-aggregation-closeout-20260701` from clean `main`. The final mainline closeout
fast-forwarded the stacked dashboard branches into `main`, so this proof note now records the
combined 25-path closeout set while preserving the inbound proof-only boundary.

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

## 2026-07-01 Refresh Addendum

The 2026-07-01 refresh reconciles the stale candidate wording in
`docs/improvement-opportunities.md` with current `main` behavior. Runtime code remains unchanged:
`/api/communications/inbox` still derives authorized parent IDs first, batches child-row repository
reads by those visible IDs, and serializes only redacted aggregate counts and safe IDs.

The refreshed proof keeps inbound aggregation separate from client-portal batch projections and
operational-view read-model inputs. It adds no dependency, copied excerpt, vendored asset,
reference-derived code, migration, schema, route, provider, queue, worker, permission, or response
shape change, and uses only synthetic proof data.

## Changed Paths

Mainline closeout final changed paths are:

```text
apps/api/src/routes/billing.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/communications-section.tsx
apps/web/app/dashboard/dashboard-shell.test.tsx
apps/web/app/dashboard/dashboard-shell.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/dashboard/matter-overview-section.tsx
apps/web/app/dashboard/queues-section.tsx
apps/web/app/dashboard/shared-panels.test.tsx
apps/web/app/dashboard/shared-panels.tsx
apps/web/app/dashboard/tasks-section.tsx
apps/web/app/styles/00-tokens-base.css
apps/web/app/styles/10-shell-navigation.css
apps/web/app/styles/20-dashboard-panels.css
apps/web/app/styles/90-responsive-motion.css
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md
docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md
docs/validation/README.md
```

## Validation

### Selector

`pnpm verify:select -- --files docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`

Result: Pass. Recommended validation commands:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

2026-07-01 refresh selector:

`pnpm verify:select -- --files docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`

Result: Pass. Recommended validation commands:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

2026-07-01 mainline closeout selector:

`pnpm verify:select -- --base-plus-dirty origin/main`

Result: Pass. Recommended validation commands:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

### Focused Behavior Proof

| Command                                                                                                                                    | Result  | Notes                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                | Pass    | Built upstream domain package output for downstream focused checks.                                                                                                                                                                         |
| `pnpm --filter @open-practice/database build`                                                                                              | Pass    | Built database package output for API test import resolution.                                                                                                                                                                               |
| `pnpm --filter @open-practice/providers build`                                                                                             | Pass    | Built provider package output for API test import resolution.                                                                                                                                                                               |
| `pnpm --filter @open-practice/database test -- test/repository.inbound-email.test.ts test/repository.conversation-threads.test.ts`         | Pass    | Command completed successfully; the package script ran 27 database files / 155 tests.                                                                                                                                                       |
| `pnpm --filter @open-practice/database exec vitest run test/repository.inbound-email.test.ts test/repository.conversation-threads.test.ts` | Pass    | Direct focused rerun passed 2 files / 10 tests, covering inbound attachment and conversation child-row batch filters.                                                                                                                       |
| `pnpm --filter @open-practice/api test -- src/routes/communications.test.ts`                                                               | Blocked | Reason: the package script expanded to the full API suite and failed unrelated 5s timeouts in `server`, `caldav`, `documents`, `drafts`, `signatures`, and `ai-operational-proposals` tests. It was not a communications aggregate failure. |
| `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts`                                                       | Pass    | Direct focused rerun passed 1 file / 6 tests, including the communications child-row batching and redaction aggregate test.                                                                                                                 |

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

### 2026-07-01 Refresh Proof

| Command                                                                                                                                                                                                                                                                         | Result  | Notes                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`                                                                                                | Pass    | Recommended `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the actual three-path refresh set.                                                                                                                    |
| `pnpm verify:select -- --base-plus-dirty origin/main`                                                                                                                                                                                                                           | Pass    | Mainline closeout selector returned the 25-path combined dashboard/proof diff and selected architecture, API contract, format, docs, policy, API/web test, API/web typecheck, and build.                                              |
| `pnpm verify:run -- --plan --base-plus-dirty origin/main`                                                                                                                                                                                                                       | Pass    | Print-only runner plan matched the selector lane and wrote no artifact.                                                                                                                                                               |
| `pnpm verify:run -- --base-plus-dirty origin/main`                                                                                                                                                                                                                              | Blocked | Artifact `.tmp/validation-runs/2026-07-01T18-34-09Z` ran all selected commands. Only `pnpm policy:check` failed at `node scripts/validate-oss-reuse.mjs` because `/Users/bryan/projects/reference-repos/docs/index.json` is absent.   |
| `pnpm format:check`                                                                                                                                                                                                                                                             | Failed  | Initial refreshed-doc run flagged Prettier drift in the proof note and validation README; the touched docs were formatted immediately afterward.                                                                                      |
| `pnpm exec prettier --write docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`                                                                                                   | Pass    | Formatted only the touched docs; `docs/improvement-opportunities.md` was unchanged by Prettier.                                                                                                                                       |
| `pnpm verify:select -- --files docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`                                                                                                | Pass    | Post-format selector output stayed on the same three docs and recommended the same checks.                                                                                                                                            |
| `pnpm format:check`                                                                                                                                                                                                                                                             | Pass    | All matched files used Prettier code style before the later unrelated dashboard branch edits appeared.                                                                                                                                |
| `pnpm exec prettier --check docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md`                                                                                                   | Pass    | Touched-doc formatting check passed after the unrelated dashboard branch edits appeared.                                                                                                                                              |
| `pnpm format:check`                                                                                                                                                                                                                                                             | Blocked | Reason: the final full-repo format check reported unrelated dirty dashboard files in `apps/web/app/dashboard/communications-section.tsx`, `dashboard-shell.tsx`, and `shared-panels.tsx`; this proof branch did not edit those files. |
| `pnpm docs:check`                                                                                                                                                                                                                                                               | Pass    | Documentation link validation passed.                                                                                                                                                                                                 |
| `pnpm policy:check`                                                                                                                                                                                                                                                             | Blocked | Reason: stopped at `node scripts/validate-oss-reuse.mjs` with `ENOENT` for `/Users/bryan/projects/reference-repos/docs/index.json`; earlier policy subchecks through migration lint passed before this environment blocker.           |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                     | Pass    | Built upstream domain package output for downstream focused checks.                                                                                                                                                                   |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                   | Pass    | Built database package output for API test import resolution.                                                                                                                                                                         |
| `pnpm --filter @open-practice/providers build`                                                                                                                                                                                                                                  | Pass    | Built provider package output for API test import resolution.                                                                                                                                                                         |
| `pnpm --filter @open-practice/database exec vitest run test/repository.inbound-email.test.ts test/repository.conversation-threads.test.ts`                                                                                                                                      | Pass    | Direct focused rerun passed 2 files / 10 tests, covering inbound attachment and conversation child-row batch filters.                                                                                                                 |
| `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts`                                                                                                                                                                                            | Pass    | Direct focused rerun passed 1 file / 6 tests, including the communications child-row batching and redaction aggregate test.                                                                                                           |
| `pnpm proof:reconcile -- --proof docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md --files docs/improvement-opportunities.md docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md docs/validation/README.md` | Pass    | Reconciled the proof note against the owned three-path selector set.                                                                                                                                                                  |
| `node scripts/validate-validation-proof-index.mjs`                                                                                                                                                                                                                              | Pass    | Validation proof index check passed after the refresh.                                                                                                                                                                                |
| `node scripts/validate-local-evidence-dockerignore.mjs`                                                                                                                                                                                                                         | Pass    | Local evidence Docker ignore validation passed.                                                                                                                                                                                       |
| `node scripts/validate-open-practice-boundaries.mjs`                                                                                                                                                                                                                            | Pass    | Open Practice boundary policy passed.                                                                                                                                                                                                 |
| `git diff --check`                                                                                                                                                                                                                                                              | Pass    | Final whitespace check passed.                                                                                                                                                                                                        |
