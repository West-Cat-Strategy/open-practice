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

Skipped checks: none because this row proof retained its lane validation context.

- None. `pnpm policy:check` and `pnpm --filter @open-practice/api test` were run and failed on the
  unrelated blockers noted above.

## Final Changed Paths

- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing.ts`
- `apps/api/src/routes/document-processing/disposition-reviewer-packet.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/inbound-email/parser-jobs.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/web/app/_features/communications/models.ts`
- `apps/web/app/_features/communications/server-resources.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/communications-inbox-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/communications-section.test.tsx`
- `apps/web/app/dashboard/communications-section.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/inbound-parser-replay-inventory-panel.test.tsx`
- `apps/web/app/dashboard/inbound-parser-replay-inventory-panel.tsx`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `apps/web/app/dashboard/tasks-section.test.tsx`
- `apps/web/app/dashboard/tasks-section.tsx`
- `apps/web/app/document-processing-dashboard.ts`
- `apps/web/app/reporting-dashboard.ts`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/development/github-maintenance.md`
- `docs/document-retention-hold-workflow-design.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP_DOCKER_DAEMON_PREFLIGHT_PROOF_2026-07-01.md`
- `docs/validation/OP_DOCUMENT_DISPOSITION_REVIEWER_PACKET_PROOF_2026-06-30.md`
- `docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md`
- `docs/validation/OP_INBOUND_PARSER_REPLAY_INVENTORY_PROOF_2026-07-01.md`
- `docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md`
- `docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_PREFLIGHT_PACKET_PROOF_2026-07-01.md`
- `docs/validation/OP_REPORTS_AUTHORIZATION_EXPLAIN_PLAN_FIXTURE_PROOF_2026-07-01.md`
- `docs/validation/README.md`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/billing.ts`
- `packages/domain/src/document-suggestions.test.ts`
- `packages/domain/src/document-suggestions.ts`
- `packages/domain/src/legal-research.test.ts`
- `packages/domain/src/legal-research.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/docker-storage-preflight.mjs`
- `scripts/docker-storage-preflight.test.mjs`
- `scripts/route-authorization-manifest.mjs`
- `scripts/scan-docker-images.mjs`
- `scripts/scan-docker-images.test.mjs`
- `scripts/validate-open-practice-boundaries.test.mjs`
- `scripts/watch-docker-residuals.mjs`
- `scripts/watch-docker-residuals.test.mjs`

## Mainline Closeout Validation

Selector:

- PASS `pnpm verify:select -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/disposition-reviewer-packet.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email/parser-jobs.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/_features/communications/models.ts apps/web/app/_features/communications/server-resources.ts apps/web/app/_features/document-processing/models.ts apps/web/app/communications-inbox-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/communications-section.test.tsx apps/web/app/dashboard/communications-section.tsx apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.test.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx apps/web/app/document-processing-dashboard.ts apps/web/app/reporting-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/development/github-maintenance.md docs/document-retention-hold-workflow-design.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/testing/TESTING.md docs/validation/OP_DOCKER_DAEMON_PREFLIGHT_PROOF_2026-07-01.md docs/validation/OP_DOCUMENT_DISPOSITION_REVIEWER_PACKET_PROOF_2026-06-30.md docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md docs/validation/OP_INBOUND_PARSER_REPLAY_INVENTORY_PROOF_2026-07-01.md docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_PREFLIGHT_PACKET_PROOF_2026-07-01.md docs/validation/OP_REPORTS_AUTHORIZATION_EXPLAIN_PLAN_FIXTURE_PROOF_2026-07-01.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/authorization-fixtures.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/document-suggestions.test.ts packages/domain/src/document-suggestions.ts packages/domain/src/legal-research.test.ts packages/domain/src/legal-research.ts packages/domain/src/permissions.test.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/docker-storage-preflight.mjs scripts/docker-storage-preflight.test.mjs scripts/route-authorization-manifest.mjs scripts/scan-docker-images.mjs scripts/scan-docker-images.test.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/watch-docker-residuals.mjs scripts/watch-docker-residuals.test.mjs`
  - Recommended validation commands:
    - `pnpm security:review`
    - `pnpm security:secrets-history`
    - `pnpm architecture:check`
    - `pnpm api:contract`
    - `pnpm docker:residual-watch`
    - `pnpm docker:app-smoke`
    - `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`
    - `pnpm e2e:docker`
    - `pnpm format:check`
    - `pnpm docs:check`
    - `pnpm policy:check`
    - `pnpm test`
    - `pnpm --filter @open-practice/domain test`
    - `pnpm --filter @open-practice/domain typecheck`
    - `pnpm --filter @open-practice/domain build`
    - `pnpm --filter @open-practice/api test`
    - `pnpm --filter @open-practice/api typecheck`
    - `pnpm --filter @open-practice/providers test`
    - `pnpm --filter @open-practice/worker test`
    - `pnpm --filter @open-practice/web test`
    - `pnpm --filter @open-practice/web typecheck`
    - `pnpm build`

Selected checks:

- PASS `pnpm verify:run -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/disposition-reviewer-packet.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email/parser-jobs.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/_features/communications/models.ts apps/web/app/_features/communications/server-resources.ts apps/web/app/_features/document-processing/models.ts apps/web/app/communications-inbox-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/communications-section.test.tsx apps/web/app/dashboard/communications-section.tsx apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.test.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.tsx apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx apps/web/app/document-processing-dashboard.ts apps/web/app/reporting-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/development/github-maintenance.md docs/document-retention-hold-workflow-design.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/testing/TESTING.md docs/validation/OP_DOCKER_DAEMON_PREFLIGHT_PROOF_2026-07-01.md docs/validation/OP_DOCUMENT_DISPOSITION_REVIEWER_PACKET_PROOF_2026-06-30.md docs/validation/OP_EXPENSE_CATEGORY_ACCOUNTING_EXPORT_PROFILE_PREVIEW_PROOF_2026-07-01.md docs/validation/OP_INBOUND_PARSER_REPLAY_INVENTORY_PROOF_2026-07-01.md docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_PREFLIGHT_PACKET_PROOF_2026-07-01.md docs/validation/OP_REPORTS_AUTHORIZATION_EXPLAIN_PLAN_FIXTURE_PROOF_2026-07-01.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/authorization-fixtures.ts packages/domain/src/billing.test.ts packages/domain/src/billing.ts packages/domain/src/document-suggestions.test.ts packages/domain/src/document-suggestions.ts packages/domain/src/legal-research.test.ts packages/domain/src/legal-research.ts packages/domain/src/permissions.test.ts packages/domain/src/reports.test.ts packages/domain/src/reports.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/docker-storage-preflight.mjs scripts/docker-storage-preflight.test.mjs scripts/route-authorization-manifest.mjs scripts/scan-docker-images.mjs scripts/scan-docker-images.test.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/watch-docker-residuals.mjs scripts/watch-docker-residuals.test.mjs`
  - Artifact: `.tmp/validation-runs/2026-07-01T03-17-04Z`.
  - All 22 selected commands passed, including security review, Docker residual watch, Docker app smoke, self-host restore drill, Docker e2e, format, docs, policy, package tests, package typechecks, and build.
- PASS `pnpm ci:local`
  - Broad local CI passed after selected validation on the same integrated tree.
- PASS `pnpm security:review`
  - Current rerun artifact `.tmp/open-practice-security-review/2026-07-01T03-11-18Z` passed after rebuilding local package outputs for the hot-path rescan lane.

Skipped checks: none because final selected validation and `pnpm ci:local` ran without skipped checks.

Privacy and data boundary: final validation and proof reconciliation used synthetic metadata only; no client, matter, credential, payment, privileged document, private deployment, or private audit details were added.
