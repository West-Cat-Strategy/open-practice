# Signature Request Envelope Metadata Proof

Date: 2026-06-16

## Scope

Implemented the first OP-authored signature request envelope metadata slice over existing embedded
and manual signature request records:

- Added provider-neutral signer-order, field-placement, validation-status, and safe validation
  summary helpers in the signature domain.
- Added request-level `signer_order`, `field_placements`, and `validation_status` persistence with
  `unchecked` defaults for legacy records.
- Extended `POST /api/signature-requests` with optional `envelopeMetadata`; invalid metadata is
  rejected before provider submission, repository writes, signer email queueing, or route audit
  events.
- Extended staff evidence packets with safe envelope validation status/counts/issues only.
- Updated the dashboard signature section to show compact envelope posture for active matter
  signatures.

## Boundaries

- No provider-specific validation rules, SDK fields, signing URLs, provider evidence, raw consent
  evidence, document text, or private deployment details were added to domain rules.
- OP-T133 `signature_envelopes` remain the document-assembly package projection; this slice stores
  canonical request-level validation metadata on `signature_requests` and does not migrate or remove
  the assembly-envelope table.
- Client portal signature routes remain signer-action surfaces and do not expose field placements.
- Fixtures and tests use synthetic data only.

## Focused Validation

| Command                                                                          | Result                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                      | Passed.                                                                         |
| `pnpm --filter @open-practice/database build`                                    | Passed after the domain build completed in the fresh sibling worktree.          |
| `pnpm --filter @open-practice/providers build`                                   | Passed.                                                                         |
| `pnpm --filter @open-practice/domain test -- signatures`                         | Passed: 27 files, 175 tests.                                                    |
| `pnpm --filter @open-practice/domain test`                                       | Passed: 27 files, 175 tests.                                                    |
| `pnpm --filter @open-practice/domain typecheck`                                  | Passed.                                                                         |
| `pnpm --filter @open-practice/database test -- repository.signatures schema`     | Passed: 19 files, 117 tests.                                                    |
| `pnpm --filter @open-practice/database test`                                     | Passed: 19 files, 117 tests.                                                    |
| `pnpm --filter @open-practice/database db:check`                                 | Passed.                                                                         |
| `pnpm --filter @open-practice/database typecheck`                                | Passed.                                                                         |
| `pnpm --filter @open-practice/api exec vitest run src/routes/signatures.test.ts` | Passed: 1 file, 16 tests.                                                       |
| `pnpm --filter @open-practice/api test`                                          | Passed: 41 files, 516 tests.                                                    |
| `pnpm --filter @open-practice/api typecheck`                                     | Passed.                                                                         |
| `pnpm --filter @open-practice/web test -- dashboard/signatures-section`          | Passed: 35 files, 188 tests.                                                    |
| `pnpm --filter @open-practice/web test`                                          | Passed: 35 files, 188 tests.                                                    |
| `pnpm --filter @open-practice/web typecheck`                                     | Passed.                                                                         |
| `pnpm --filter @open-practice/providers test`                                    | Passed: 9 files, 20 tests.                                                      |
| `pnpm --filter @open-practice/worker test`                                       | Passed: 5 files, 40 tests.                                                      |
| `pnpm migrations:check`                                                          | Passed: 57 SQL files match 57 journal entries.                                  |
| `pnpm format:check`                                                              | Passed after formatting the edited proof, API, web, database, and domain files. |
| `pnpm docs:check`                                                                | Passed.                                                                         |
| `pnpm policy:check`                                                              | Passed.                                                                         |
| `pnpm build`                                                                     | Passed: 6 packages built successfully.                                          |
| `git diff --check`                                                               | Passed.                                                                         |

Initial database/API/web test attempts in the fresh sibling worktree failed before package builds
because downstream workspaces could not resolve newly generated `dist` exports; rerunning after the
domain/database/provider builds passed. A full API suite rerun initially exposed a brittle evidence
packet assertion that searched for raw coordinate numbers also present in unrelated UUID/timestamp
text; the test was narrowed to assert absence of raw placement keys and then passed.

## Selector Validation

Selector-driven closeout validation was run with the exact changed path set:

```sh
pnpm verify:select -- --files apps/api/src/routes/signatures.test.ts apps/api/src/routes/signatures.ts apps/web/app/dashboard/signatures-section.test.tsx apps/web/app/dashboard/signatures-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/database/migrations/meta/_journal.json packages/database/src/repository/drizzle-mappers.ts packages/database/src/schema/signatures.ts packages/database/test/schema.test.ts packages/domain/src/sample-data.ts packages/domain/src/signatures.test.ts packages/domain/src/signatures.ts docs/validation/OP_SIGNATURE_REQUEST_ENVELOPE_METADATA_PROOF_2026-06-16.md packages/database/migrations/0056_signature_request_envelope_metadata.sql packages/database/test/repository.signatures.test.ts
```

The selector completed and recommended the domain, database, API, provider, worker, web, docs,
policy, migration, format, and build gates recorded above.
