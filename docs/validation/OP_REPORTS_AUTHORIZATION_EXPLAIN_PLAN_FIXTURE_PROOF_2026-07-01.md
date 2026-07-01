# Reports Authorization Explain-Plan Fixture Proof - 2026-07-01

## Scope

Added a provider-neutral, read-only authorization explain-plan fixture matrix for
`GET /api/reports/workspace`.

The matrix is descriptive test coverage for the current staff Reports workspace list posture only.
It does not add roles, policies, OpenFGA runtime integration, dependencies, routes, response fields,
route behavior, matter-scope behavior, provider behavior, persistence, migrations, export creation
semantics, or client portal exposure.

## Coverage

Focused domain and API route assertions consume the new matrix to prove:

- auditors and billing bookkeepers retain existing Reports workspace list visibility;
- assigned matter staff remain denied despite matter assignment;
- `client_external` users remain denied from the staff Reports workspace;
- denied workspace list reads do not create report jobs, queue entries, or audit side effects;
- visible workspace payload assertions stay bounded to safe response keys such as definitions,
  export profiles, report projections, history, and workspace policy;
- synthetic proof avoids client-private emails, narratives, report bodies, payment details,
  credentials, provider payloads, and private deployment details.

## Changed Paths

- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/permissions.test.ts`
- `apps/api/src/routes/reports.test.ts`
- `docs/api-and-state-machines.md`
- `docs/validation/OP_REPORTS_AUTHORIZATION_EXPLAIN_PLAN_FIXTURE_PROOF_2026-07-01.md`
- `docs/validation/README.md`

## Validation

Selector:

- PASS `pnpm verify:select -- --files apps/api/src/routes/reports.test.ts docs/api-and-state-machines.md docs/validation/README.md packages/domain/src/authorization-fixtures.ts packages/domain/src/permissions.test.ts docs/validation/OP_REPORTS_AUTHORIZATION_EXPLAIN_PLAN_FIXTURE_PROOF_2026-07-01.md`
  - Recommended `pnpm architecture:check`, `pnpm api:contract`, `pnpm format:check`,
    `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/domain test`,
    `pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
    `pnpm --filter @open-practice/providers test`, and
    `pnpm --filter @open-practice/worker test`.

Selected checks:

- PASS `pnpm --filter @open-practice/domain build`
  - `tsc -p tsconfig.build.json` completed successfully.
- PASS `pnpm --dir packages/domain exec vitest run src/permissions.test.ts`
  - 1 test file passed; 28 tests passed.
- PASS `pnpm --dir apps/api exec vitest run src/routes/reports.test.ts`
  - 1 test file passed; 11 tests passed.
- PASS `pnpm architecture:check`
  - Architecture import policy passed: 468 workspace import edges reviewed.
- PASS `pnpm api:contract`
  - API contract inventory wrote `.tmp/api-contract/openapi.json` with 353 paths.
- PASS `pnpm format:check`
  - All matched files use Prettier code style.
- PASS `pnpm docs:check`
  - Documentation link validation passed.
- PASS `pnpm --filter @open-practice/domain typecheck`
  - `tsc -p tsconfig.json --noEmit` completed successfully.
- PASS `pnpm --filter @open-practice/api typecheck`
  - `tsc -p tsconfig.json --noEmit` completed successfully.
- PASS `pnpm --filter @open-practice/domain test`
  - 33 test files passed; 295 tests passed.
- PASS `pnpm --filter @open-practice/providers test`
  - 13 test files passed; 37 tests passed.
- PASS `pnpm --filter @open-practice/worker test`
  - 6 test files passed; 54 tests passed.
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
- FAIL `pnpm --filter @open-practice/api test`
  - 42 test files passed; 1 test file failed.
  - 655 tests passed; 2 CalDAV tests failed on the default 5000 ms timeout in
    `src/routes/caldav.test.ts`.
  - The failing CalDAV tests are unrelated to the reports authorization explain-plan path.

Diagnostic and tail checks:

- PASS `pnpm --filter @open-practice/database build`
  - Built the database package before rerunning API checks in the fresh sibling worktree.
- PASS `pnpm --filter @open-practice/providers build`
  - Built the providers package before rerunning API checks in the fresh sibling worktree.
- PASS `pnpm --dir apps/api exec vitest run src/routes/caldav.test.ts --testTimeout=15000`
  - 1 test file passed; 8 tests passed, confirming the selected API-suite failure is the existing
    default-timeout sensitivity in CalDAV coverage.
- PASS `node scripts/validate-validation-proof-index.mjs`
  - Validation proof index check passed.
- PASS `node scripts/validate-local-evidence-dockerignore.mjs`
  - Local evidence Docker ignore validation passed.
- PASS `node scripts/validate-open-practice-boundaries.mjs`
  - Open Practice boundary policy passed.
- PASS `git diff --check`
  - No whitespace errors.

Skipped checks:

- None. `pnpm policy:check` and `pnpm --filter @open-practice/api test` were run and failed on the
  unrelated blockers noted above.
