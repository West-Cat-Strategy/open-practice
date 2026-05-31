# Incomplete Implementation Audit Proof - 2026-05-31

## Branch And Scope

- Branch: `codex/op-incomplete-implementation-audit-2026-05-31`
- Worktree: `/Users/bryan/projects/open-practice-incomplete-audit`
- Base: fresh sibling worktree from `origin/main`; the dirty
  `codex/ui-ux-readability-pass` checkout was left untouched.

## Confirmed Fixes

- Worker startup now validates memory/Postgres mode before constructing a database runtime.
- OCR queueing now requires object storage anywhere the worker must read document bytes, including
  document-processing routes, inbound-email promotion, provider status, and workbench readiness.
- Public external-upload intent creation now claims upload capacity before creating a pending
  document record.
- Route authorization coverage now expands billing submit/approve/write-off routes from literal
  tuple loops, treats approve as approve access, and reverse-checks auth-helper public samples
  against manifest public entries.
- Secure-share public copy describes metadata records instead of implying token-scoped downloads.
- Dashboard unavailable states now use disabled controls for sidebar navigation, external-upload
  create fields, and public-consultation settings fields.
- Planning, backlog, API docs, validation labels, and public upload route parameters were reconciled
  to shipped behavior and remaining candidate rows.

## Validation

- `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build` - passed; prepared fresh-worktree local package exports for package tests.
- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)` - passed after the proof note was added; recommended `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`, API/worker/web package tests and typechecks, worker build, and `pnpm build`.
- `pnpm --dir apps/worker exec vitest run src/queues.test.ts` - passed, 8 tests.
- `pnpm --dir apps/api exec vitest run src/routes/document-processing.test.ts src/routes/inbound-email.test.ts src/routes/external-uploads.test.ts src/routes/billing.test.ts src/http/http.test.ts` - passed, 85 tests.
- `pnpm --dir apps/web exec vitest run app/dashboard-client.test.ts app/dashboard/dashboard-shell.test.tsx routes/routeCatalog.test.ts app/share-link-portal.test.ts` - passed, 91 tests.
- `pnpm exec node --test scripts/validate-open-practice-boundaries.test.mjs` - passed, 8 tests.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed.
- `pnpm --filter @open-practice/api typecheck` - passed.
- `pnpm --filter @open-practice/worker typecheck` - passed.
- `pnpm --filter @open-practice/web typecheck` - passed.
- `pnpm --filter @open-practice/api test` - passed, 414 tests.
- `pnpm --filter @open-practice/worker test` - passed, 26 tests.
- `pnpm --filter @open-practice/web test` - passed, 127 tests.
- `pnpm --filter @open-practice/worker build` - passed.
- `pnpm format:check` - passed after targeted Prettier cleanup.
- `pnpm test` - passed, including package tests and 38 script tests.
- `pnpm build` - passed.

## Notes

- An initial package-test attempt failed before local workspace package builds populated fresh
  worktree exports; the domain/database/providers build step above resolved that setup issue.
- A full API test pass caught missing `s3` propagation in provider status; the branch now wires that
  dependency and the rerun passed.
- No live secure-share document download, ReBAC engine, SMS/chat/media/transcription, payment
  processing, native mobile, or autonomous AI behavior was added.
