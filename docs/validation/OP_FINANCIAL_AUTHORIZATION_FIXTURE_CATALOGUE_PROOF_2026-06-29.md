# Financial Authorization Fixture Catalogue Proof - 2026-06-29

## Scope

Extended the descriptive authorization fixture catalogue for current financial review/export
surfaces:

- `payment_import_refund_chargeback_review`
- `trust_transfer_review`
- `staff_report_export`
- `audit_export`
- `billing_export`
- `jurisdictional_trust_export`

The fixture catalogue remains test coverage for current authorization posture only. This change does
not add roles, policies, OpenFGA runtime integration, dependencies, routes, route behavior, or client
portal exposure.

## Coverage

Focused API route assertions consume the new fixtures to prove:

- assigned staff retain existing matter-scoped list and allowed command/export behavior where the
  current routes already allow it;
- auditors retain current list/read/export visibility while refund/chargeback and trust-transfer
  mutation commands remain denied;
- billing bookkeepers retain current billing/trust read/export behavior while trust-transfer
  approval/rejection/link commands remain denied;
- `client_external` users remain denied from staff financial review/export routes;
- denied commands do not create review records, report jobs, billing jobs, ledger links, or audit
  side effects.

## Changed Paths

- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/permissions.test.ts`
- `apps/api/src/routes/billing.test.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/audit.test.ts`
- `apps/api/src/routes/ledger.test.ts`
- `docs/api-and-state-machines.md`
- `docs/validation/OP_FINANCIAL_AUTHORIZATION_FIXTURE_CATALOGUE_PROOF_2026-06-29.md`
- `docs/validation/README.md`

## Validation

Selector:

- PASS `pnpm verify:select -- --files packages/domain/src/authorization-fixtures.ts packages/domain/src/permissions.test.ts apps/api/src/routes/billing.test.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/audit.test.ts apps/api/src/routes/ledger.test.ts docs/api-and-state-machines.md docs/validation/OP_FINANCIAL_AUTHORIZATION_FIXTURE_CATALOGUE_PROOF_2026-06-29.md docs/validation/README.md`
  - Recommended `pnpm architecture:check`, `pnpm api:contract`, `pnpm format:check`,
    `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/domain test`,
    `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
    `pnpm --filter @open-practice/providers test`, and
    `pnpm --filter @open-practice/worker test`.

Selected checks:

- PASS `pnpm architecture:check`
  - Architecture import policy passed: 467 workspace import edges reviewed.
- PASS `pnpm api:contract`
  - API contract inventory wrote `.tmp/api-contract/openapi.json` with 346 paths.
- PASS `pnpm format:check`
  - All matched files use Prettier code style.
- PASS `pnpm docs:check`
  - Documentation link validation passed.
- FAIL `pnpm policy:check`
  - Passed tracked-secret scan, package manifest dependency policy, lockfile supply-chain policy,
    toolchain policy, environment surface, architecture import policy, deadcode, migration parity,
    and migration lint.
  - Blocked at `node scripts/validate-oss-reuse.mjs` because existing OSS reference-lock commits
    do not match the central reference index for multiple reference repos, including
    `activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`,
    `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`,
    `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `nextcloud__server`,
    `open-source-legal__opencontracts`, `opencollective__opencollective`,
    `opencollective__opencollective-api`, `opencollective__opencollective-frontend`,
    `openfga__openfga`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`,
    `unstructured-io__unstructured`, and `zulip__zulip`.
- PASS `pnpm --filter @open-practice/domain test`
  - 33 test files passed; 279 tests passed.
- PASS `pnpm --filter @open-practice/domain typecheck`
  - `tsc -p tsconfig.json --noEmit` completed successfully.
- PASS `pnpm --filter @open-practice/domain build`
  - `tsc -p tsconfig.build.json` completed successfully.
- PASS `pnpm --filter @open-practice/api test`
  - 43 test files passed; 635 tests passed.
- PASS `pnpm --filter @open-practice/api typecheck`
  - `tsc -p tsconfig.json --noEmit` completed successfully.
- PASS `pnpm --filter @open-practice/providers test`
  - 13 test files passed; 37 tests passed.
- PASS `pnpm --filter @open-practice/worker test`
  - 6 test files passed; 54 tests passed.

Focused authorization route proof:

- PASS `pnpm --dir apps/api exec vitest run src/routes/billing.test.ts src/routes/reports.test.ts src/routes/audit.test.ts src/routes/ledger.test.ts`
  - 4 test files passed; 86 tests passed.

Policy tail checks run separately after the OSS reference-lock failure:

- PASS `node scripts/validate-validation-proof-index.mjs`
  - Validation proof index check passed.
- PASS `node scripts/validate-local-evidence-dockerignore.mjs`
  - Local evidence Docker ignore validation passed.
- PASS `node scripts/validate-open-practice-boundaries.mjs`
  - Open Practice boundary policy passed.
- PASS `git diff --check`
  - No whitespace errors.

Skipped checks:

- None. `pnpm policy:check` was run and failed on the OSS reference-lock drift noted above.
