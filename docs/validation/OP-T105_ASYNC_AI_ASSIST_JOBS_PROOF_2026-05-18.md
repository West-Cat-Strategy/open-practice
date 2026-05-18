# OP-T105 Async Local AI Assist Jobs Proof

Date: 2026-05-18
Branch: `codex/op-async-ai-assist-jobs`
Worktree: `/Users/bryan/projects/open-practice-op-t105-async-ai-assist`

## Scope

- Added queue-first async assist endpoints for drafts and documents:
  - `POST /api/drafts/:id/assist/jobs`
  - `POST /api/documents/:id/assist/jobs`
- Reused the existing `ai_triage` BullMQ queue with `jobName: "draft_assist_suggestion"`.
- Kept async assist disabled unless an enabled `ai` provider setting, injected `DraftAssistProvider`,
  and async assist queue are all configured.
- Worker reloads the source draft text or latest completed document extraction by ID, then creates a
  normal non-authoritative `draft_assist_records` suggestion for the existing review flow.
- No schema migration, dependency, web UI, live Ollama/LM Studio adapter, or source draft/document
  mutation was added.

## Redaction Proof

- Durable job metadata and BullMQ metadata carry IDs, provider/task provenance, idempotency presence,
  source text length, instruction length, and evidence key count only.
- Generated text is stored only on the resulting suggested assist record and stays out of BullMQ
  payloads, job metadata, and audit metadata.
- API and worker tests assert that synthetic source text, prompt context, instruction text, and raw
  evidence values are absent from queued payloads, lifecycle metadata, and audit events.

## Validation

Required selector first:

- `pnpm verify:select -- --files $(git diff --name-only)` passed and recommended format, docs,
  policy, domain/API/provider/worker tests and typechecks, plus worker build.

Focused proof:

- `pnpm install --frozen-lockfile` passed to bootstrap the fresh sibling worktree.
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm --filter @open-practice/domain test` passed: 15 files, 99 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/providers test` passed: 5 files, 15 tests.
- `pnpm --filter @open-practice/worker test` passed after building workspace package exports:
  3 files, 20 tests.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/worker build` passed.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/api test` passed: 33 files, 313 tests.
- `pnpm policy:check` passed: tracked-secret scan, package manifest policy, OSS reuse policy,
  documentation links, and Open Practice boundary policy.

Merge gate:

- `pnpm ci:local` passed, including format, lint, typecheck, all tests, database schema check,
  policy checks, build, and `git diff --check`.
- After adding this proof note and marking the board row Done, the full dirty-path
  `pnpm verify:select` command passed and returned the same focused validation recommendations.
- Final proof/board checks passed: `pnpm format:check`, `pnpm docs:check`, and `git diff --check`.

## Notes

- A first worker test attempt in the fresh worktree failed before package builds because workspace
  `dist` exports for `@open-practice/domain` and `@open-practice/database` did not exist yet.
  Building the workspace packages resolved that bootstrap-only issue, and the rerun passed.
- The install emitted pnpm's standard ignored-build-script warning for local dependency bootstrap;
  no dependency or lockfile changes were made.
