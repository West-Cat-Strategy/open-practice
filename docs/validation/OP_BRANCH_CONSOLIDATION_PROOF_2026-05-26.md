# OP Branch Consolidation Proof - 2026-05-26

## Scope

Merged the two active local Open Practice lanes into a consolidation branch from `origin/main`:

- `codex/op-t119-connector-recovery-controls` at `8dd91fe` for connector recovery, conversation export, document retention hints, calendar reminders, conversation notifications, and operational action descriptors.
- `codex/crockett-public-intake` at `752f916` for the public consultation intake review queue.

The merge resolution kept both feature sets, combined the dashboard and docs surfaces, and renumbered the public consultation intake migration to `0039_public_consultation_intakes.sql` after `0038_conversation_message_notifications.sql`.

## Validation

Selector:

```bash
pnpm verify:select -- --base origin/main
```

Recommended dependency, docs, policy, package test/typecheck, migration, worker, web, and build checks for the combined cross-package/database change.

Passed:

```bash
pnpm deps:audit
pnpm deps:licenses
node scripts/validate-doc-links.mjs
node scripts/validate-open-practice-boundaries.mjs
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

The final narrow rerun after the public-consultation email-required/telephone-optional adjustment passed database tests (15 files, 75 tests), API tests (35 files, 380 tests), web tests (11 files, 100 tests), database schema check, migration parity, API/database/web typechecks, and production build.

`pnpm ci:local` passed formatting, lint, typecheck, package tests, script tests, database `db:check`, tracked-secret scan, package-manifest validation, and migration parity before stopping at the existing OSS reuse lock/index mismatch:

```text
OSS reuse policy validation failed:
- activepieces__activepieces lock commit must match the central reference index
- apache__fineract lock commit must match the central reference index
- civicrm__civicrm-core lock commit must match the central reference index
- documenso__documenso lock commit must match the central reference index
- docusealco__docuseal lock commit must match the central reference index
- kimai__kimai lock commit must match the central reference index
- ledgersmb__ledgersmb lock commit must match the central reference index
- lerianstudio__midaz lock commit must match the central reference index
- microsoft__markitdown lock commit must match the central reference index
- nextcloud__server lock commit must match the central reference index
- open-source-legal__opencontracts lock commit must match the central reference index
- opencollective__opencollective-api lock commit must match the central reference index
- opencollective__opencollective-frontend lock commit must match the central reference index
- temporalio__temporal lock commit must match the central reference index
- unstructured-io__unstructured lock commit must match the central reference index
- zulip__zulip lock commit must match the central reference index
```

The consolidation diff does not touch `docs/oss-references.lock.json`, `docs/oss-references.md`, `docs/reference-repos.md`, `scripts/reference-*`, or `.references/**`, so that blocker is tracked as unrelated reference-governance drift.
