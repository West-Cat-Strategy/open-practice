# Trust Controls Policy Preview Matrix Proof - 2026-06-29

## Scope

This branch adds a read-only maker-checker policy preview matrix to the existing Trust Controls
readiness payload and dashboard. The matrix is exposed as
`makerCheckerReadiness.policyPreviewMatrix` on `GET /api/ledger/controls`, and it cross-tabs the
existing Trust Controls category columns against safe matter IDs that already appear in readiness
matter rows.

No schema, migration, route, command, approval behavior, rejection behavior, direct posting
semantics, settlement, bank-feed connection, bank-feed matching, auto-match, auto-posting, provider
command, or jurisdiction-certified accounting claim is added or changed.

All tests, fixtures, examples, and proof evidence for this branch use synthetic data only and do not
add client, matter-private, credential, payment, provider, or deployment details.

## Changed Paths

- `packages/domain/src/ledger.ts`
- `packages/domain/src/ledger.test.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/trust-controls-section.tsx`
- `apps/web/app/dashboard/trust-controls-section.test.tsx`
- `apps/web/app/styles/20-dashboard-panels.css`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/trust-funds-caveats.md`
- `docs/validation/OP_TRUST_CONTROLS_POLICY_PREVIEW_MATRIX_PROOF_2026-06-29.md`
- `docs/validation/README.md`

## Boundary Proof

- `makerCheckerPolicyEnabled` remains `false`.
- `directPostingSemantics` remains `"unchanged"`.
- `approvalMutation`, `automaticTrustPosting`, `settlementAutomation`, `bankFeedMatching`, and
  `jurisdictionCertifiedAccounting` remain `false`.
- The preview matrix contains only existing category labels, safe matter IDs already visible in
  readiness rows, counts, amounts, reason codes, timestamps, and `reviewOnly: true`.
- Account- or firm-level cues such as statement import or reconciliation exception evidence remain
  category-only unless current matter-bearing evidence supports a safe matrix cell.
- The projection does not copy preparation notes, rejection reasons, trust-transfer reasons, private
  evidence, normalized evidence fingerprints, provider payloads, statement-row bodies, or raw
  financial evidence.
- The dashboard matrix is informational only and adds no approve/reject buttons, action keys,
  command calls, posting controls, settlement controls, bank-feed controls, or accounting
  certification claims.

## Selector

- `pnpm verify:select -- --files packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts apps/api/src/routes/ledger.test.ts apps/web/app/trust-controls-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/styles/20-dashboard-panels.css docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/OP_TRUST_CONTROLS_POLICY_PREVIEW_MATRIX_PROOF_2026-06-29.md docs/validation/README.md`
  - Passed after the final changed path set was known. The selector recommended architecture,
    contract, format, docs, policy, package test/typecheck/build, full build, and proof
    reconciliation checks for this API/UI/docs change.

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Selected Validation

Focused changed-area proof passed before final selector-driven validation:

- `pnpm --filter @open-practice/domain exec vitest run src/ledger.test.ts`
  - Passed: 1 file, 21 tests.
- `pnpm --filter @open-practice/domain build`
  - Passed after tightening the clear matrix-cell literal type.
- `pnpm --filter @open-practice/database build`
  - Passed; required in this fresh sibling worktree so API tests could resolve workspace package
    exports.
- `pnpm --filter @open-practice/providers build`
  - Passed; required in this fresh sibling worktree before downstream checks.
- `pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts`
  - Passed: 1 file, 29 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/trust-controls-section.test.tsx`
  - Passed: 1 file, 4 tests.

Fresh-worktree setup context:

- The first `pnpm --filter @open-practice/api exec vitest run src/routes/ledger.test.ts` attempt
  failed before collecting tests because `@open-practice/database` build output was absent in the
  new sibling worktree. After building upstream packages, the same focused API command passed.

Selector-driven proof:

- `pnpm architecture:check`
  - Passed: 462 workspace import edges reviewed.
- `pnpm api:contract`
  - Passed: OpenAPI contract emitted to `.tmp/api-contract/openapi.json` with 342 paths.
- `pnpm format:check`
  - Initially failed on files touched by this branch. After running Prettier on the flagged files,
    the same command passed.
- `pnpm docs:check`
  - Passed docs link validation.
- `pnpm policy:check`
  - Blocked by existing OSS reuse reference-lock drift unrelated to this branch. The branch adds no
    dependencies, copied excerpts, vendored assets, provider calls, migrations, routes, or
    reference-derived code. The failing entries were:
    `activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`, `civicrm__civicrm-core`,
    `documenso__documenso`, `docusealco__docuseal`, `jitsi__jitsi-meet`,
    `jlawyerorg__j-lawyer-org`, `kimai__kimai`, `ledgersmb__ledgersmb`, `lerianstudio__midaz`,
    `nextcloud__server`, `open-source-legal__opencontracts`,
    `opencollective__opencollective`, `opencollective__opencollective-api`,
    `opencollective__opencollective-frontend`, `openfga__openfga`,
    `paperless-ngx__paperless-ngx`, `temporalio__temporal`, `unstructured-io__unstructured`,
    and `zulip__zulip`.
- `pnpm --filter @open-practice/domain test`
  - Passed: 33 files, 266 tests.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - One parallel-load attempt failed on two existing unrelated 5s timeouts in
    `src/routes/e2e-support.test.ts` and `src/routes/webauthn.test.ts`. Rerunning the same selected
    command by itself passed: 43 files, 623 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - Passed: 13 files, 37 tests.
- `pnpm --filter @open-practice/worker test`
  - Passed: 6 files, 54 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 46 files, 243 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 Turbo build tasks successful.
- `git diff --check`
  - Passed.
- `pnpm proof:reconcile -- --proof docs/validation/OP_TRUST_CONTROLS_POLICY_PREVIEW_MATRIX_PROOF_2026-06-29.md --files packages/domain/src/ledger.ts packages/domain/src/ledger.test.ts apps/api/src/routes/ledger.test.ts apps/web/app/trust-controls-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx apps/web/app/styles/20-dashboard-panels.css docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/trust-funds-caveats.md docs/validation/OP_TRUST_CONTROLS_POLICY_PREVIEW_MATRIX_PROOF_2026-06-29.md docs/validation/README.md`
  - Passed: 14 paths reconciled against selector recommendations.
