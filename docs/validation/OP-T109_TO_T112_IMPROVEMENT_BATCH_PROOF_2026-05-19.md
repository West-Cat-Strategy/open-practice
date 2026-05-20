# OP-T109 To OP-T112 Improvement Batch Integration Proof

Date: 2026-05-19

Branch: `codex/open-practice-improvement-batch`

Commits:

- `6e75204` OP-T109 saved operational view presets
- `477982d` OP-T110 async billing/trust export requests
- `1220073` OP-T111 delivery receipt tokens
- `e8efe80` OP-T112 billing locks and rate rules

## Scope

This proof covers the combined integration branch after OP-T107/OP-T108 stabilization and the
OP-T109 through OP-T112 improvement batch. Row-local proof lives in the individual OP-T109, OP-T110,
OP-T111, and OP-T112 validation notes.

## Selector

Command:

```bash
pnpm verify:select -- --files $(git diff --name-only origin/main) $(git ls-files --others --exclude-standard)
```

Result: pass. The selector recommended format, docs, policy, full test/typecheck/build coverage,
database migration checks, API/database/domain/provider/worker/web checks, and final build.

## Documentation And Policy Checks

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Result:

```text
All matched files use Prettier code style!
Documentation link validation passed.
No high-confidence tracked secrets found.
Package manifest dependency policy passed.
Migration parity passed: 39 SQL files match 39 journal entries.
OSS reuse policy validation passed.
Open Practice boundary policy passed.
```

## Web Follow-Through

The first web test attempt in the fresh integration worktree failed before assertions because local
`@open-practice/domain/*` package entrypoints had not been built yet. After building local packages,
the web follow-through passed.

```bash
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
```

Result:

```text
Test Files  11 passed (11)
Tests  93 passed (93)
tsc -p tsconfig.json --noEmit
```

## Full Local CI

Command:

```bash
pnpm ci:local
```

Result: pass.

Key output:

```text
All matched files use Prettier code style!
Tasks: 9 successful, 9 total
Tasks: 9 successful, 9 total
Test Files  16 passed (16)
Tests  118 passed (118)
Test Files  14 passed (14)
Tests  73 passed (73)
Test Files  33 passed (33)
Tests  340 passed (340)
Test Files  11 passed (11)
Tests  93 passed (93)
Test Files  5 passed (5)
Tests  15 passed (15)
Test Files  3 passed (3)
Tests  21 passed (21)
tests 35
pass 35
Everything's fine
No high-confidence tracked secrets found.
Package manifest dependency policy passed.
Migration parity passed: 39 SQL files match 39 journal entries.
OSS reuse policy validation passed.
Documentation link validation passed.
Open Practice boundary policy passed.
Tasks: 6 successful, 6 total
```

No validation was skipped.

## Final Closeout

After read-only lane checks, the branch received a small final hardening pass:

- corrected the OP-T108 proof branch label
- added the missing OP-T110, OP-T111, and OP-T112 API route table entries
- redacted contact quality `matchedValue` fields from `GET /api/contacts/dossiers`
- extended billing-period lock enforcement to time/expense status-transition routes

Focused follow-through passed:

```text
pnpm --filter @open-practice/api test -- src/routes/contacts.test.ts
Test Files  33 passed (33)
Tests  340 passed (340)

pnpm --filter @open-practice/api test -- src/routes/billing.test.ts
Test Files  33 passed (33)
Tests  340 passed (340)

pnpm --filter @open-practice/web test -- app/dashboard-client.test.ts
Test Files  11 passed (11)
Tests  93 passed (93)

pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
tsc -p tsconfig.json --noEmit
```

Final selector and integrated validation were rerun after these closeout edits. No validation was
skipped.
