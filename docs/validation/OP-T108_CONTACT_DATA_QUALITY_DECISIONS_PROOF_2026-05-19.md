# OP-T108 Contact Data-Quality Review Decisions Proof

Date: 2026-05-19

Branch: `codex/op-t108-contact-quality-decisions`

Worktree: `/Users/bryan/projects/open-practice-op-t107-contact-quality-decisions`

## Scope

This slice adds append-only reviewer decision records for exactly three contact dossier signal kinds:

- duplicate candidates
- protected-party cues
- conflict-check revalidation prompts

The slice stays review-only. It does not add automatic contact merges, contact rewrites,
conflict-check disposition mutation, dashboard controls, raw matched values, or reviewer evidence in
audit metadata.

## Selector

Command:

```bash
pnpm verify:select -- --files $(git diff --name-only main) $(git ls-files --others --exclude-standard)
```

Result: pass. The selector recommended format, docs, policy, domain/database/API focused tests and
typechecks, database migration checks, provider and worker tests, and broad test coverage for the
touched backend and migration paths.

## Focused Validation

Command:

```bash
pnpm --filter @open-practice/domain test -- contacts.test.ts audit-taxonomy.test.ts
```

Output:

```text
Test Files  16 passed (16)
Tests  112 passed (112)
```

Command:

```bash
pnpm --filter @open-practice/domain typecheck
```

Output:

```text
tsc -p tsconfig.json --noEmit
```

Result: pass.

Command:

```bash
pnpm --filter @open-practice/database test -- repository.contact-dossier.test.ts schema.test.ts
```

Output:

```text
Test Files  14 passed (14)
Tests  71 passed (71)
```

Command:

```bash
pnpm --filter @open-practice/database db:check
```

Output:

```text
Everything's fine
```

Command:

```bash
pnpm --filter @open-practice/database typecheck
```

Output:

```text
tsc -p tsconfig.json --noEmit
```

Result: pass.

Command:

```bash
pnpm --filter @open-practice/api test -- src/routes/contacts.test.ts
```

Output:

```text
Test Files  33 passed (33)
Tests  329 passed (329)
```

Command:

```bash
pnpm --filter @open-practice/api typecheck
```

Output:

```text
tsc -p tsconfig.json --noEmit
```

Result: pass.

## Selector Follow-Through

Command:

```bash
pnpm --filter @open-practice/providers test
```

Output:

```text
Test Files  3 passed (3)
Tests  11 passed (11)
```

Command:

```bash
pnpm --filter @open-practice/worker test
```

Output:

```text
Test Files  3 passed (3)
Tests  20 passed (20)
```

Command:

```bash
pnpm migrations:check
```

Output:

```text
Migration parity passed: 36 SQL files match 36 journal entries.
```

## Broad Validation

Command:

```bash
pnpm format:check
```

Output:

```text
All matched files use Prettier code style!
```

Command:

```bash
pnpm docs:check
```

Output:

```text
Documentation link validation passed.
```

Command:

```bash
pnpm policy:check
```

Output:

```text
No high-confidence tracked secrets found.
Package manifest dependency policy passed.
Migration parity passed: 36 SQL files match 36 journal entries.
OSS reuse policy validation passed.
Documentation link validation passed.
Open Practice boundary policy passed.
```

Command:

```bash
git diff --check
```

Result: pass.

Command:

```bash
pnpm ci:local
```

Output:

```text
All matched files use Prettier code style!
Tasks:    9 successful, 9 total
Tasks:    9 successful, 9 total
Test Files  16 passed (16)
Tests  112 passed (112)
Test Files  14 passed (14)
Tests  71 passed (71)
Test Files  33 passed (33)
Tests  329 passed (329)
tests 35
pass 35
Everything's fine
No high-confidence tracked secrets found.
Package manifest dependency policy passed.
Migration parity passed: 36 SQL files match 36 journal entries.
OSS reuse policy validation passed.
Documentation link validation passed.
Open Practice boundary policy passed.
Tasks:    6 successful, 6 total
```

Result: pass.

## Bootstrap Notes

The fresh sibling worktree initially did not have built local package entrypoints. Early focused
database/API checks before local package builds failed with module-resolution errors for local
workspace packages. After running the needed package builds, the same focused checks were rerun and
passed as recorded above. No validation was skipped.

## Post-Proof Documentation Closeout

After adding this proof note and closing OP-T108 in the live docs, the selector was rerun against
the final changed path set.

Command:

```bash
pnpm verify:select -- --files $(git diff --name-only main) $(git ls-files --others --exclude-standard)
```

Output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

The post-proof documentation checks also passed:

```text
pnpm format:check
All matched files use Prettier code style!

pnpm docs:check
Documentation link validation passed.

pnpm policy:check
No high-confidence tracked secrets found.
Package manifest dependency policy passed.
Migration parity passed: 36 SQL files match 36 journal entries.
OSS reuse policy validation passed.
Documentation link validation passed.
Open Practice boundary policy passed.

git diff --check
pass
```

## Integration Closeout

The final improvement-batch closeout corrected the proof branch label and aligned the dossier API
serializer with the already-redacted review queue serializer. `GET /api/contacts/dossiers` now
returns `matchedValueRedacted` instead of raw `matchedValue` for quality signals, and the Contacts
dashboard displays only the redacted cue state.

Focused follow-through passed:

```text
pnpm --filter @open-practice/api test -- src/routes/contacts.test.ts
Test Files  33 passed (33)
Tests  340 passed (340)

pnpm --filter @open-practice/web test -- app/dashboard-client.test.ts
Test Files  11 passed (11)
Tests  93 passed (93)

pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
tsc -p tsconfig.json --noEmit
```
