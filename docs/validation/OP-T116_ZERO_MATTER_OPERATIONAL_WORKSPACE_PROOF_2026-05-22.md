# OP-T116 Zero-Matter Operational Workspace Proof

Date: 2026-05-22

## Scope

Implemented the zero-matter operational workspace slice:

- Added authenticated `POST /api/matters` for authorized internal users with server-generated
  matter, contact, party, assignment, matter number, and safe audit metadata.
- Kept `matter:create` available without an existing `matterId` only for roles that already have
  the create action; unauthorized roles remain denied.
- Let owner-admin and auditor firm-wide readers list firm matters without assignment rows while
  keeping matter-scoped users assignment-limited.
- Replaced the blank no-accessible-matters dashboard return with the full dashboard shell, metrics,
  operational focus, contact/audit/queue surfaces, route-catalog-based matter-section disabling, and
  a guided first-matter panel that switches into the existing matter command centre after creation.

## Local Proof

- `pnpm exec vitest run src/permissions.test.ts` from `packages/domain`
  - Passed: 1 test file, 7 tests.
- `pnpm exec vitest run src/routes/matters.test.ts src/routes/contacts.test.ts` from `apps/api`
  - Passed: 2 test files, 12 tests.
- `pnpm exec vitest run app/dashboard-client.test.ts routes/routeCatalog.test.ts` from `apps/web`
  - Passed: 2 test files, 67 tests.
- `pnpm --filter @open-practice/database typecheck`
  - Passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after fixing the `ContactIdentifier[]` narrowing in `apps/api/src/routes/matters.ts`.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm verify:select -- --files <changed paths>`
  - Passed and selected focused domain, database, API, web, docs, policy, build, and diff checks for
    this full-stack slice.
- `pnpm format:check`
  - Passed after formatting the touched TypeScript and Markdown files.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm test`
  - Passed: domain 121 tests, providers 15 tests, web 98 tests, database 73 tests, worker 21 tests,
    API 352 tests, and 36 Node script tests.
- `pnpm typecheck`
  - Passed across all packages.
- `pnpm --filter @open-practice/database db:check`
  - Passed with Drizzle schema check clean.
- `pnpm migrations:check`
  - Passed with migration parity clean.
- `pnpm build`
  - Passed across all six packages, including the Next.js web build.
- `git diff --check`
  - Passed.

## Browser Proof

Ran Playwright against a synthetic zero-matter `licensee` on a local in-memory API at
`http://127.0.0.1:34114` and the web app at `http://localhost:30114`.

- Desktop zero-matter workspace rendered the dashboard shell, metrics, operations focus, first-matter
  panel, non-matter contacts/audit/queue surfaces, and disabled matter-required navigation without the
  old `No accessible matters were returned` blank state.
  - Screenshot: `output/playwright/op-t114/desktop-zero.png`
  - Horizontal overflow: `0`
- Mobile zero-matter workspace rendered the same operational shell in a single-column layout without
  text overlap or horizontal overflow.
  - Screenshot: `output/playwright/op-t114/mobile-zero.png`
  - Horizontal overflow: `0`
- First-matter creation submitted synthetic data, returned `201`, prepended the created matter,
  selected it, and opened the matter command centre with matter-scoped navigation re-enabled.
  - Screenshot: `output/playwright/op-t114/desktop-created.png`
  - Horizontal overflow: `0`

## Notes

- Initial parallel `pnpm` validation attempts in the fresh sibling worktree raced while linking
  `node_modules`; a single `pnpm install` pass restored the workspace before rerunning focused
  checks serially.
- The local browser proof used only synthetic matter and contact data.
