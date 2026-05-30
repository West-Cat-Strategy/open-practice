# OP-T133 Document Assembly And Signature Envelopes Proof

Date: 2026-05-29

## Scope

Implemented the first read-only OP-T133 slice over existing documents, generated draft exports, and
embedded signature records:

- Added OP-authored document-set definitions, matter assembly packages, and signature-envelope
  metadata for signer order and field-placement validation.
- Added `GET /api/document-assembly/workbench?matterId=` with matter-scoped document/signature
  access checks and dashboard-safe package/envelope summaries.
- Added a Documents dashboard assembly block with package, population, generated-document,
  signature, and envelope validation posture.
- Kept third-party template import, copied forms, automatic legal drafting, public signing UX
  rewrites, automatic envelope mutation, and new provider behavior out of scope.

## Redaction And Boundary Proof

- Domain, database, API, and web tests assert storage keys, signer emails, consent text, populated
  matter values, and raw evidence do not appear in the workbench payload or dashboard helpers.
- The workbench returns IDs, titles, role/order metadata, counts, statuses, and validation issues
  only.
- Route authorization uses existing matter-scoped `document:read` and `signature_request:read`
  checks before aggregating package/envelope state.

## Validation

The local worktree was cleaned to the OP-T133 path set before final validation. Unrelated OP-T134
time/expense capture work, OP-T144 ReBAC matrix work, and other mixed-branch files were preserved
in local stashes instead of being reverted. The document assembly migration is numbered
`0041_document_assembly_envelopes.sql`, with the Drizzle journal kept in parity.

| Command                                                                                             | Result                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)` | Passed; selected format, docs, policy, test, domain/database/API/web typechecks, database migration checks, provider/worker/web/API/domain/database tests, and build for the OP-T133 paths. |
| `pnpm format:check`                                                                                 | Passed.                                                                                                                                                                                     |
| `pnpm docs:check`                                                                                   | Passed.                                                                                                                                                                                     |
| `pnpm migrations:check`                                                                             | Passed: 42 SQL files match 42 journal entries.                                                                                                                                              |
| `pnpm --filter @open-practice/database db:check`                                                    | Passed.                                                                                                                                                                                     |
| `pnpm policy:check`                                                                                 | Passed, including secret scan, package manifest inventory, migration parity, OSS reuse, docs, and route-boundary checks.                                                                    |
| `pnpm test`                                                                                         | Passed; covers the domain, database, API, providers, worker, and web package tests plus script contract tests.                                                                              |
| `pnpm --filter @open-practice/domain typecheck`                                                     | Passed.                                                                                                                                                                                     |
| `pnpm --filter @open-practice/database typecheck`                                                   | Passed.                                                                                                                                                                                     |
| `pnpm --filter @open-practice/api typecheck`                                                        | Passed.                                                                                                                                                                                     |
| `pnpm --filter @open-practice/web typecheck`                                                        | Passed.                                                                                                                                                                                     |
| `pnpm build`                                                                                        | Passed; covers package builds and refreshed ignored `dist` outputs used by cross-package tests.                                                                                             |
| Desktop/mobile browser smoke                                                                        | Passed against `OPEN_PRACTICE_USE_MEMORY_REPO=1 API_PORT=44133` plus `WEB_PORT=33134`; screenshots: `/tmp/op-t133-documents-desktop.png`, `/tmp/op-t133-documents-mobile.png`.              |
| `git diff --check`                                                                                  | Passed.                                                                                                                                                                                     |

The browser smoke loaded `/?section=documents` at 1440x900 and 390x844, verified the
`Document assembly` block and `Retainer signature package` summary were present, and checked that
representative redacted strings such as signer email, `signingUrl`, and `storageKey` were absent.

## Follow-Up Safety Tightening

After review, the workbench projection was tightened to explicit safe summary DTOs for document-set
definitions, assembly packages, and signature envelopes. Poisoned domain/API fixtures now assert
that raw metadata, creator/requester IDs, source draft/intake IDs, storage keys, evidence, consent
text, raw field anchors/coordinates, provider package IDs, and signer user IDs do not serialize.
The route authorization manifest now supports multi-guard authenticated routes and records that the
document assembly workbench requires both `document:read` and `signature_request:read`.
