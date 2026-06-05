# Open Practice Audit Event Sequence Hardening Proof - 2026-06-05

## Scope

- Branch: `security/audit-event-sequence-2026-06-05`
- Worktree: `/Users/bryan/projects/open-practice-audit-event-sequence`
- Base: `origin/main` at `696df7c`
- Source branch inspected for the candidate slice:
  `security/full-scan-remediation-2026-06-05`
- Data posture: synthetic fixtures only. No client, matter, credential, payment, private
  deployment, raw MIME, signing, storage-key, or private-note material was added to proof or tests.

This proof records the standalone audit-event sequencing hardening slice extracted from the broader
full-scan remediation branch. It intentionally excludes the unrelated full-scan fixes for CORS,
guest-session access logging, inbound-email serialization, OCR/provider posture, Docker image
follow-up, and duplicate-document checksum locking.

## Main Containment Check

- `git cherry -v main HEAD` on the source branch showed both full-scan commits still ahead of
  `main`.
- `packages/database/migrations/0051_audit_event_sequence.sql` was absent from `main`.
- `main` did not define an `audit_events_firm_sequence_idx` audit-event index or audit-event
  `sequence` schema column.
- This branch starts from `origin/main` and ports only the audit-event sequencing slice.

## Changed Paths

```text
docs/planning-and-progress.md
docs/validation/README.md
docs/validation/OP_AUDIT_EVENT_SEQUENCE_HARDENING_PROOF_2026-06-05.md
packages/database/migrations/0051_audit_event_sequence.sql
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/schema.ts
packages/database/test/repository.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit.ts
```

## Implementation

- Added a required per-firm `sequence` field to domain audit events, while keeping audit hashes based
  on the event payload plus `previousHash` rather than the sequence value.
- Added migration `0051_audit_event_sequence.sql` to backfill sequence values by walking each firm
  hash chain from the genesis hash, fail closed on unwalked rows, require the column, and add a
  unique `(firm_id, sequence)` index.
- Updated Drizzle and in-memory repositories to list and append audit events by sequence, and to
  recompute legacy `recordAuditEvent` sequence/hash fields through append semantics.
- Added a firm-level PostgreSQL advisory transaction lock for Drizzle audit appends and the existing
  transactional matter-creation audit writes.
- Added targeted domain, repository, schema, and migration tests for sequence monotonicity,
  tamper detection, legacy recomputation, schema/index presence, and hash-chain migration backfill.

## Validation

Selector:

```bash
pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_AUDIT_EVENT_SEQUENCE_HARDENING_PROOF_2026-06-05.md packages/database/migrations/0051_audit_event_sequence.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/test/repository.test.ts packages/database/test/schema.test.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit.ts
```

Prerequisite workspace builds for fresh-worktree package resolution:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/database build
```

Selected gates and results:

```bash
pnpm format:check # passed
pnpm docs:check # passed
pnpm policy:check # passed; migration parity passed with 52 SQL files and 52 journal entries
pnpm --filter @open-practice/domain test # passed; 24 files, 173 tests
pnpm --filter @open-practice/domain typecheck # passed
pnpm --filter @open-practice/database test # passed; 18 files, 105 tests
pnpm --filter @open-practice/database db:check # passed
pnpm migrations:check # passed; 52 SQL files and 52 journal entries
pnpm --filter @open-practice/database typecheck # passed
pnpm --filter @open-practice/api test # passed; 41 files, 482 tests
pnpm --filter @open-practice/providers test # passed; 7 files, 18 tests
pnpm --filter @open-practice/worker test # passed; 3 files, 35 tests
git diff --check # passed
```

Final status: all selected validation gates passed.

## Residual Blockers

- No validation blockers remain for this standalone slice.
- The broad `security/full-scan-remediation-2026-06-05` branch remains intentionally unpruned
  because it still contains unrelated security and Docker follow-up work outside this slice.
