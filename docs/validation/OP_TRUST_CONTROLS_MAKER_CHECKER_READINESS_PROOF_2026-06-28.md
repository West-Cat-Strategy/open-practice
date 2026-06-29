# Trust Controls Maker-Checker Readiness Proof - 2026-06-28

## Scope

This branch adds read-only maker-checker readiness indicators to the existing Trust Controls
projection and dashboard. The indicators reuse existing ledger controls data, reconciliation packet
summaries, posting-request statuses, trust-transfer/payment-import review cues, diagnostics, and
safe matter IDs.

No schema, migration, command route, approval behavior, direct posting semantics, settlement,
bank-feed matching, auto-posting, provider command, or jurisdiction-certified accounting claim is
added or changed.

All tests, fixtures, examples, and proof evidence for this branch use synthetic data only and do not
add client, matter-private, credential, payment, provider, or deployment details.

## Changed Paths

- `packages/domain/src/ledger.ts`
- `packages/domain/src/ledger.test.ts`
- `apps/api/src/routes/ledger/read.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/web/app/types.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/trust-controls-section.tsx`
- `apps/web/app/dashboard/trust-controls-section.test.tsx`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md`
- `docs/validation/README.md`

## Boundary Proof

- `makerCheckerPolicyEnabled` remains `false`.
- `directPostingSemantics` remains `"unchanged"`.
- `approvalMutation`, `automaticTrustPosting`, `settlementAutomation`, `bankFeedMatching`, and
  `jurisdictionCertifiedAccounting` remain `false`.
- Matter rows contain only safe matter IDs, category keys, counts, amounts, reason codes,
  timestamps, and `reviewOnly: true`.
- Readiness projections do not copy raw notes, transfer reasons, private evidence, normalized
  evidence fingerprints, or rejection text.
- The dashboard section is informational only and adds no approve/reject buttons, action keys, or
  command calls.

## Selector

- `pnpm verify:select -- --files packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts apps/api/src/routes/ledger/read.ts apps/api/src/routes/ledger.test.ts apps/web/app/types.ts apps/web/app/_features/billing/models.ts apps/web/app/trust-controls-dashboard.ts apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/dashboard-client.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md docs/validation/README.md`
  - Recommended validation commands:
    `pnpm architecture:check`, `pnpm api:contract`, `pnpm format:check`, `pnpm docs:check`,
    `pnpm policy:check`, `pnpm --filter @open-practice/domain test`,
    `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
    `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/worker test`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
    `pnpm build`.

## Selected Validation

Passed:

- `pnpm architecture:check`
  - Passed: 460 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: generated `.tmp/api-contract/openapi.json` with 338 paths.
- `pnpm format:check`
  - Passed: all matched files use Prettier style.
- `pnpm docs:check`
  - Passed: documentation link validation.
- `pnpm --filter @open-practice/domain test`
  - Passed: 32 files, 256 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - Passed: 13 files, 37 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 6 files, 54 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 45 files, 236 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 packages built.
- `pnpm docs:check`
  - Passed again after proof-note edits.
- `git diff --check`
  - Passed.
- `pnpm proof:reconcile -- --proof docs/validation/OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md --files packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts apps/api/src/routes/ledger/read.ts apps/api/src/routes/ledger.test.ts apps/web/app/types.ts apps/web/app/_features/billing/models.ts apps/web/app/trust-controls-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md docs/validation/README.md`
  - Passed.

Focused changed-area proof:

- `pnpm --filter @open-practice/domain exec vitest run src/ledger.test.ts`
  - Passed: 1 file, 21 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts`
  - Passed: 1 file, 29 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/trust-controls-section.test.tsx`
  - Passed: 1 file, 4 tests.

Selected-command blockers:

- `pnpm policy:check`
  - Blocked by existing central reference-index drift in the OSS reuse lock check. The failure names
    reference lock commits such as `activepieces__activepieces`, `apache__fineract`,
    `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `openfga__openfga`, and others that must match
    the central reference index. This branch adds no dependency, vendored code, copied excerpt, or
    reference-derived source.
- `pnpm --filter @open-practice/api test`
  - Blocked by unrelated CalDAV timeout pressure: 42 files and 612 tests passed, then
    `src/routes/caldav.test.ts` timed out in two tests at Vitest's default 5-second per-test limit:
    `discovers a principal and calendar home for iOS-style CalDAV setup` and the create/read/stale
    write/delete matter-event CalDAV flow. The changed `src/routes/ledger.test.ts` file passed
    directly.

Earlier broad-command context:

- `pnpm --filter @open-practice/api test -- ledger.test.ts`
  - This script invocation ran the full API suite instead of only `ledger.test.ts`; 40 files and 608
    tests passed, then unrelated `server`, `caldav`, and `documents` tests timed out at the default
    5-second limit. The direct ledger route file command above passed.
- `pnpm proof:reconcile`
  - The bare script invocation failed because this repository requires `--proof <path>` plus a
    selector input such as `--files <paths...>`. The argument-complete command above passed.
