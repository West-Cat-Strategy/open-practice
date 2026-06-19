# Filtered Audit Repository Reads Proof - 2026-06-19

## Scope

Branch: `refactor/filtered-audit-repository-reads-20260619`

This slice adds internal filtered audit repository reads for bounded report and trust-review
surfaces without changing public payload contracts. The new repository capability is
`listFilteredAuditEvents(firmId, filter)`, with optional `actions`, `matterId`, `resourceType`, and
`resourceId` filters.

## Preserved Boundaries

- `listAuditEvents(firmId)` remains the only repository read that returns `{ events, valid }` and
  performs full audit-chain verification.
- Filtered reads return matching audit events only and make no independent chain-validity claim.
- Matter-scoped `/api/audit?matterId=...` keeps the existing scoped response shape and continues to
  omit hash-chain internals.
- Firm-wide `/api/audit`, audit export requests, and audit export downloads keep the full-log,
  full-chain read path.
- `GET /api/ledger/controls` still computes `financialCommandJournal.chainValid` from the full
  chain verifier, while journal entries are read through the filtered action/matter path.
- No authorization, redaction, audit-chain posture, trust posting, settlement, payment allocation,
  provider behavior, public route, or HTTP response-shape behavior changes are introduced.
- All examples and tests use synthetic data only.

## Implementation Notes

- Memory and Drizzle repositories implement `listFilteredAuditEvents` with firm scoping and stable
  sequence ordering.
- Empty `actions: []` returns `[]` without falling back to an unfiltered audit read.
- Matter matching mirrors the existing audit route semantics: matter resource rows plus
  `metadata.matterId`, `metadata.matterIds`, and `metadata.previousMatterId`.
- Drizzle pushdowns cover firm/action/resource columns; JSONB matter predicates remain
  behavior-preserving without adding speculative JSONB matter indexes in this slice.
- Added audit-event indexes:
  - `audit_events_firm_action_sequence_idx`
  - `audit_events_firm_resource_sequence_idx`

## Focused Validation

Prerequisite builds after creating the fresh worktree:

- `pnpm --filter @open-practice/domain build` - passed.
- `pnpm --filter @open-practice/database build` - passed after the domain build completed.
- `pnpm --filter @open-practice/providers build` - passed after the domain build completed.

Initial focused test attempt:

- `pnpm --filter @open-practice/database test -- repository.audit-matter-setup.test.ts schema.test.ts`
  failed before the domain build because the fresh worktree lacked `@open-practice/domain` `dist`.
- `pnpm --filter @open-practice/api test -- audit.test.ts ledger.test.ts` failed before upstream
  builds because the fresh worktree lacked `@open-practice/database`/`@open-practice/domain` `dist`.
- `pnpm --filter @open-practice/domain test -- financial-command-journal.test.ts` passed.

Focused reruns after upstream builds:

- `pnpm --dir packages/database exec vitest run test/repository.audit-matter-setup.test.ts test/schema.test.ts`
  - passed, 2 files / 50 tests.
- `pnpm --dir packages/domain exec vitest run src/financial-command-journal.test.ts`
  - passed, 1 file / 3 tests.
- `pnpm --dir apps/api exec vitest run src/routes/audit.test.ts src/routes/ledger.test.ts`
  - passed, 2 files / 38 tests.

## Selector Validation

Final changed path set:

- `apps/api/src/routes/audit.test.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger/read.ts`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_FILTERED_AUDIT_REPOSITORY_READS_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `packages/database/migrations/0066_filtered_audit_read_indexes.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/audit-contracts.ts`
- `packages/database/src/repository/audit/drizzle.ts`
- `packages/database/src/repository/audit/memory.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema/audit-events.ts`
- `packages/database/test/repository.audit-matter-setup.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/financial-command-journal.test.ts`
- `packages/domain/src/financial-command-journal.ts`

Selector command:

```sh
pnpm verify:select -- --files docs/validation/OP_FILTERED_AUDIT_REPOSITORY_READS_PROOF_2026-06-19.md packages/database/migrations/0066_filtered_audit_read_indexes.sql apps/api/src/routes/audit.test.ts apps/api/src/routes/audit.ts apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger/read.ts docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/migrations/meta/_journal.json packages/database/src/repository/audit-contracts.ts packages/database/src/repository/audit/drizzle.ts packages/database/src/repository/audit/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema/audit-events.ts packages/database/test/repository.audit-matter-setup.test.ts packages/database/test/schema.test.ts packages/domain/src/financial-command-journal.test.ts packages/domain/src/financial-command-journal.ts
```

Selector result:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
```

Completed selector-required validation:

- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed.
- `pnpm --filter @open-practice/database test` - passed, 23 files / 138 tests.
- `pnpm --filter @open-practice/database db:check` - passed.
- `pnpm migrations:check` - passed.
- `pnpm --filter @open-practice/database typecheck` - passed.
- `pnpm --filter @open-practice/database build` - passed.
- `pnpm --filter @open-practice/api test` - passed, 42 files / 560 tests.

Additional validation:

- `pnpm --filter @open-practice/api typecheck` - passed.
- `pnpm --filter @open-practice/api build` - passed.
- `pnpm --filter @open-practice/domain typecheck` - passed.
- `pnpm --filter @open-practice/domain build` - passed.
- `pnpm --filter @open-practice/domain test -- financial-command-journal.test.ts` - passed.
- `git diff --check` - passed.
