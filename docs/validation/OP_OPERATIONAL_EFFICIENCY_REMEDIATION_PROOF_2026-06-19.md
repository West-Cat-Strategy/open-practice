# Operational Efficiency Remediation Proof

Date: 2026-06-19 PDT

## Scope

Implemented the accepted operational-efficiency review remediation on
`remediate/ops-efficiency-20260619` in the clean sibling worktree
`/Users/bryan/projects/open-practice-ops-efficiency-remediation`. The branch first carried forward
the dirty source checkout's Docker-local same-origin web rewrite, then added focused runtime,
database/API, and web SSR changes:

- Docker-local browser API calls use the Next same-origin rewrite and the selector now routes web
  API routing changes through Docker app smoke and Docker E2E proof.
- `pnpm docker:app-smoke` now checks web-origin `/api/setup/status` against the API setup-status
  shape, and Docker E2E sets `OPEN_PRACTICE_DOCKER_LOCAL_DEV=true`.
- Filtered audit reads use internal `listFilteredAuditEvents` with ordered event results only;
  full-chain validation remains limited to firm-wide `listAuditEvents`.
- Client portal workspace hydration uses batched grant/contact and workspace read models plus a
  focused signature detail lookup.
- Communications inbox hydration batches inbound attachments, conversation messages, and
  notifications from already-authorized parent rows.
- Staff dashboard and operations SSR resource loading starts independent post-gate requests in
  parallel while preserving setup, session, and client-external gate order.

## Boundaries Preserved

- No public HTTP route, response shape, authorization rule, provider behavior, queue/retry behavior,
  payment settlement behavior, trust posting behavior, or public-token behavior was changed.
- Audit filtered views preserve `chainValidation: "not_shown_for_filtered_view"` and metadata-key
  redaction; only firm-wide audit reads can return a full-chain validity result.
- Client portal batching derives matter IDs from existing grant/contact visibility and continues to
  serialize through the existing redaction helpers. It does not expose raw document storage keys,
  tokens, email bodies, invoice internals, signing URLs, provider evidence, IP addresses, or user
  agents.
- Communications child-row batches are scoped by `firmId` and by already-visible parent IDs; empty
  ID arrays return `[]` instead of falling back to broad reads.
- Docker routing remains local-dev only through `OPEN_PRACTICE_DOCKER_LOCAL_DEV=true` and the
  Compose/Next rewrite path. Production browser defaults remain unchanged.
- Proof data and test fixtures are synthetic.

## Findings Addressed

| Finding                                              | Status    | Remediation                                                                                                                                       |
| ---------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker-local same-origin API routing proof           | Addressed | Selector, smoke script, E2E environment, web config tests, and testing docs now require/prove `/api/setup/status` through the web origin.         |
| Filtered audit reads                                 | Addressed | Added ordered filtered repository reads and supporting indexes without changing full-chain validation semantics.                                  |
| Client portal batching                               | Addressed | Added internal grant/contact and workspace batch reads, reused them from workspace/doc/signature flows, and added focused signature detail reads. |
| Non-outbox communications child-row fan-out          | Addressed | Added bulk inbound attachment, conversation message, and notification filters with singular precedence and empty-array safeguards.                |
| Operational dashboard/report resource fetch cost     | Addressed | Parallelized independent staff dashboard and operations SSR loads while preserving existing fallback behavior and gate order.                     |
| Validation friction for Docker-local routing changes | Addressed | `apps/web/next.config.mjs` and `apps/web/app/api-base-urls.ts` now select web, build, Docker app smoke, and Docker E2E commands.                  |

## Changed Paths

Final changed paths were selected from `git ls-files -m -o --exclude-standard` after the proof and
docs updates were stable. The final inventory contained 52 paths:

- `apps/api/src/routes/audit.test.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal/shared.ts`
- `apps/api/src/routes/client-portal/signatures.ts`
- `apps/api/src/routes/client-portal/workspace.ts`
- `apps/api/src/routes/communications.test.ts`
- `apps/api/src/routes/communications/inbox.ts`
- `apps/web/app/_features/operations/server-resources.test.ts`
- `apps/web/app/_features/operations/server-resources.ts`
- `apps/web/app/api-base-urls.ts`
- `apps/web/app/login-client-utils.test.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/security-headers.test.ts`
- `apps/web/next.config.mjs`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP_OPERATIONAL_EFFICIENCY_REMEDIATION_PROOF_2026-06-19.md`
- `docs/validation/README.md`
- `packages/database/migrations/0066_inbound_attachment_message_index.sql`
- `packages/database/migrations/0067_filtered_audit_read_indexes.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/audit-contracts.ts`
- `packages/database/src/repository/audit/drizzle.ts`
- `packages/database/src/repository/audit/memory.ts`
- `packages/database/src/repository/client-portal-workspace-contracts.ts`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/conversation-threads-contracts.ts`
- `packages/database/src/repository/conversation-threads/drizzle.ts`
- `packages/database/src/repository/conversation-threads/memory.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/inbound-email-contracts.ts`
- `packages/database/src/repository/inbound-email/drizzle.ts`
- `packages/database/src/repository/inbound-email/memory.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/repository/portal-access/drizzle.ts`
- `packages/database/src/repository/signatures-contracts.ts`
- `packages/database/src/repository/signatures/drizzle.ts`
- `packages/database/src/repository/signatures/memory.ts`
- `packages/database/src/schema/audit-events.ts`
- `packages/database/src/schema/inbound-email.ts`
- `packages/database/test/repository.audit-matter-setup.test.ts`
- `packages/database/test/repository.conversation-threads.test.ts`
- `packages/database/test/repository.inbound-email.test.ts`
- `packages/database/test/schema.test.ts`
- `scripts/docker-app-smoke.mjs`
- `scripts/docker-app-smoke.test.mjs`
- `scripts/run-e2e.mjs`
- `scripts/run-e2e.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`

## Validation

### Focused Checks Before Final Proof

| Command                                                                                                     | Result | Notes                                                              |
| ----------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `pnpm --filter @open-practice/database test`                                                                | Pass   | 23 files / 140 tests passed.                                       |
| `pnpm --filter @open-practice/api test`                                                                     | Pass   | 42 files / 562 tests passed.                                       |
| `pnpm --filter @open-practice/web test`                                                                     | Pass   | 38 files / 209 tests passed.                                       |
| `node --test scripts/select-validation.test.mjs scripts/docker-app-smoke.test.mjs scripts/run-e2e.test.mjs` | Pass   | 16 script tests passed.                                            |
| `pnpm --filter @open-practice/database build`                                                               | Pass   | Built updated package output for downstream API type resolution.   |
| `pnpm --filter @open-practice/api typecheck`                                                                | Pass   | Passed after the updated database package build was available.     |
| `pnpm --filter @open-practice/web typecheck`                                                                | Pass   | Web typecheck passed with the same-origin routing and SSR changes. |

### Final Selector

`pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)`

Result: Pass. Selector required:

- `pnpm docker:app-smoke`
- `pnpm e2e:docker`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

### Final Command Results

| Command                                           | Result | Notes                                                                                                                         |
| ------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm docker:app-smoke`                           | Pass   | Built app images, started the disposable Compose stack, checked API/web readiness, and proved web-origin `/api/setup/status`. |
| `pnpm e2e:docker`                                 | Pass   | Docker Chromium suite passed: 3 tests, including dashboard layout and external-upload receipt coverage.                       |
| `pnpm format:check`                               | Pass   | Prettier check passed.                                                                                                        |
| `pnpm docs:check`                                 | Pass   | Documentation link validation passed.                                                                                         |
| `pnpm policy:check`                               | Pass   | Secrets, manifests, deadcode, migration parity, OSS reuse, docs, proof index, local-evidence, and boundary checks passed.     |
| `pnpm test`                                       | Pass   | Turbo package tests passed and script contract tests passed.                                                                  |
| `pnpm --filter @open-practice/database test`      | Pass   | 23 files / 140 tests passed.                                                                                                  |
| `pnpm --filter @open-practice/database db:check`  | Pass   | Drizzle schema check passed.                                                                                                  |
| `pnpm migrations:check`                           | Pass   | Migration parity passed: 68 SQL files match 68 journal entries.                                                               |
| `pnpm --filter @open-practice/database typecheck` | Pass   | Database typecheck passed.                                                                                                    |
| `pnpm --filter @open-practice/database build`     | Pass   | Database build passed.                                                                                                        |
| `pnpm --filter @open-practice/api test`           | Pass   | 42 files / 562 tests passed.                                                                                                  |
| `pnpm --filter @open-practice/api typecheck`      | Pass   | API typecheck passed.                                                                                                         |
| `pnpm --filter @open-practice/web test`           | Pass   | 38 files / 209 tests passed.                                                                                                  |
| `pnpm --filter @open-practice/web typecheck`      | Pass   | Web typecheck passed.                                                                                                         |
| `pnpm build`                                      | Pass   | Turbo build passed across API, database, domain, providers, web, and worker packages.                                         |
| `git diff --check`                                | Pass   | Whitespace check passed.                                                                                                      |
