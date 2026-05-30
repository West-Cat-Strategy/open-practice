# OP-T130 Contact Relationship Graph Proof

Date: 2026-05-29

## Scope

Implemented the first read-only OP-T130 slice inside the existing contact dossier surface:

- Added derived contact-to-contact relationship summaries from visible matter-party links.
- Added CRM taxonomy cues for contact type, visible matter roles, relationship context,
  confidential/adverse posture, and portal-contact posture.
- Rendered the relationship and taxonomy cues in the existing Contacts dashboard detail panel.
- Kept duplicate resolution, external CRM sync, contact merge automation, conflict disposition
  automation, schema changes, and new mutation routes out of scope.

## Redaction And Boundary Proof

- Relationship records are derived only from already authorized matter-party links returned by the
  contact dossier repository path.
- Related-contact summaries expose only display name and kind; tests assert they do not expose
  related contact IDs, aliases, identifiers, or notes.
- API/domain/web tests assert matched conflict values, duplicate-signal matched values,
  inaccessible contacts, and hidden matters stay out of the relationship and dossier payloads.
- The dashboard uses existing read-only Contacts section patterns and does not add contact editing,
  merge, sync, or conflict-disposition controls.

## Validation

| Command                                                                                             | Result                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)` | Passed; selected format, docs, policy, domain/database/API/web/provider/worker tests and typechecks, database migration checks, and build for the OP-T130 path set. |
| `pnpm format:check`                                                                                 | Passed.                                                                                                                                                             |
| `pnpm docs:check`                                                                                   | Passed.                                                                                                                                                             |
| `pnpm migrations:check`                                                                             | Passed: 42 SQL files match 42 journal entries.                                                                                                                      |
| `pnpm policy:check`                                                                                 | Passed, including secret scan, package manifest inventory, migration parity, OSS reuse, docs, and route-boundary checks.                                            |
| `pnpm --filter @open-practice/domain test`                                                          | Passed: 22 files, 141 tests.                                                                                                                                        |
| `pnpm --filter @open-practice/domain build`                                                         | Passed; refreshed ignored domain `dist` output before downstream database/API checks consumed the updated dossier type.                                             |
| `pnpm --filter @open-practice/domain typecheck`                                                     | Passed.                                                                                                                                                             |
| `pnpm --filter @open-practice/database test`                                                        | Passed: 16 files, 85 tests.                                                                                                                                         |
| `pnpm --filter @open-practice/database db:check`                                                    | Passed.                                                                                                                                                             |
| `pnpm --filter @open-practice/database typecheck`                                                   | Passed.                                                                                                                                                             |
| `pnpm --filter @open-practice/api test`                                                             | Passed: 39 files, 407 tests.                                                                                                                                        |
| `pnpm --filter @open-practice/api typecheck`                                                        | Passed.                                                                                                                                                             |
| `pnpm --filter @open-practice/providers test`                                                       | Passed: 5 files, 15 tests.                                                                                                                                          |
| `pnpm --filter @open-practice/worker test`                                                          | Passed: 3 files, 23 tests.                                                                                                                                          |
| `pnpm --filter @open-practice/web test`                                                             | Passed: 14 files, 121 tests.                                                                                                                                        |
| `pnpm --filter @open-practice/web typecheck`                                                        | Passed.                                                                                                                                                             |
| `pnpm build`                                                                                        | Passed: all 6 package builds completed successfully.                                                                                                                |
| `git diff --check`                                                                                  | Passed.                                                                                                                                                             |
