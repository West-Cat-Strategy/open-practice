# OP-T117 Portal Access Activity And Anomaly Panel Proof

Date: 2026-05-22

## Scope

Implemented the first read-only Operations focus panel slice for public-token access posture:

- `GET /api/operational-views` now includes built-in `portal_access_activity`,
  `portal_access_anomalies`, and `portal_links_expiring` view keys without adding a new endpoint,
  table, dependency, navigation route, or mutable action.
- The domain projection normalizes safe activity across secure share links, external upload links,
  intake form links, and hosted guest sessions.
- Repeated denied or blocked attempts are counted at `3+` events for the same link inside the last
  `24 hours`.
- Active public links expiring within `7 days` appear in the expiring-link view, with high priority
  at `48 hours` or less.
- The API filters links to matters visible through `listMattersForUser`; public-token logs that do
  not resolve to a visible stored link stay out of the response.
- The web Operations focus panel renders compact latest activity, repeated denied attempt, and
  expiring-link rows for review only.

## Safety Boundaries

- No raw tokens, token hashes, IP addresses, user agents, email addresses, storage keys, message
  bodies, or private metadata are exposed in the operational view results or focus-panel summary.
- Result rows expose only safe family, normalized outcome, reason/status, count, timestamp, matter
  ID, and non-secret resource identifiers needed for review.
- Invalid public tokens that cannot resolve to a stored link remain out of scope because existing
  routes cannot associate them with a matter-safe record.
- No revoke, block, notification, retention, remediation, or automatic escalation controls were
  added.

## Local Proof

- `pnpm verify:select -- --files packages/domain/src/operational-views.ts packages/domain/src/operational-views.test.ts apps/api/src/routes/operational-views.ts apps/api/src/routes/operational-views.test.ts apps/web/app/types.ts apps/web/app/operational-focus-panel.ts apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md`
  - Recommended `format:check`, `docs:check`, `policy:check`, domain/API/provider/worker/web tests,
    domain/API/web typechecks, and `pnpm build`.
- `pnpm verify:select -- --files packages/domain/src/operational-views.ts packages/domain/src/operational-views.test.ts apps/api/src/routes/operational-views.ts apps/api/src/routes/operational-views.test.ts apps/web/app/types.ts apps/web/app/operational-focus-panel.ts apps/web/app/dashboard-client.test.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T117_PORTAL_ACCESS_ACTIVITY_ANOMALY_PANEL_PROOF_2026-05-22.md`
  - Rerun after docs/proof updates recommended the same closeout set:
    `format:check`, `docs:check`, `policy:check`, domain/API/provider/worker/web tests,
    domain/API/web typechecks, and `pnpm build`.
- `pnpm --filter @open-practice/domain exec vitest run src/operational-views.test.ts`
  - Passed: 1 test file, 2 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/operational-views.test.ts`
  - Initial result in the fresh worktree failed during workspace package import resolution before
    shared package build hydration.
  - Rerun after building shared packages passed: 1 test file, 7 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`
  - Initial result in the fresh worktree failed during workspace package import resolution for a
    built domain export before shared package build hydration.
  - Rerun after building shared packages passed: 1 test file, 54 tests.
- `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`
  - Passed; used only to hydrate workspace package builds in the fresh sibling worktree before
    rerunning focused API/web tests.
- `pnpm format:check`
  - Initial result failed after the first code/doc patch: Prettier reported
    `docs/api-and-state-machines.md`, `docs/planning-and-progress.md`, and
    `packages/domain/src/operational-views.ts`.
  - `pnpm exec prettier --write docs/api-and-state-machines.md docs/planning-and-progress.md packages/domain/src/operational-views.ts`
    normalized those files.
  - Rerun passed: `All matched files use Prettier code style!`
- `pnpm docs:check`
  - Passed: `Documentation link validation passed.`
- `pnpm policy:check`
  - Passed: no high-confidence tracked secrets found; package manifest dependency policy passed;
    migration parity passed with 37 SQL files and 37 journal entries; OSS reuse, doc links, and
    Open Practice boundary policy passed.
- `pnpm --filter @open-practice/domain test`
  - Passed: 16 test files, 119 tests.
- `pnpm --filter @open-practice/api test`
  - Passed: 34 test files, 347 tests.
- `pnpm --filter @open-practice/providers test`
  - Passed: 5 test files, 15 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 3 test files, 21 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 11 test files, 97 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/web typecheck`
  - Initial result found the new web `OperationalViewResult` type was stricter than existing
    synthetic operational-view fixtures. The type was adjusted to match the existing flexible,
    redacted result-row contract.
  - Rerun passed.
- `pnpm build`
  - Passed: 6 workspace package builds.

## Skipped Checks

- Browser screenshot proof was skipped because this slice adds a compact read-only summary inside
  the existing Operations focus panel and is covered by focused dashboard rendering tests rather
  than a new route or interaction.
