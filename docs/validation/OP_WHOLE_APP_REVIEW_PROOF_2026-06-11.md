# Open Practice Whole-App Review Proof - 2026-06-11

## Scope

- Worktree: `/Users/bryan/projects/open-practice-whole-app-review-2026-06-11`
- Branch: `codex/op-whole-app-review-2026-06-11`
- Base: `origin/main` at `30a26a17822c0a8482caaba9d6de3c9b37112701`
- Scan id: `30a26a17_20260611T230554Z`
- Codex Security artifact root:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z`
- Review posture: documentation/proof branch only. No application source remediation, public API
  changes, dependency additions, schema changes, or test fixture changes were made.
- Data posture: synthetic local fixtures and static repository evidence only. No client, matter,
  credential, payment, private deployment, provider-account, or secret material was added.

This proof records the repository-wide security scan, code-review findings, UI/UX review findings,
and validation outcomes for the isolated whole-application review worktree. The original dirty
dependency-refresh checkout at `/Users/bryan/projects/open-practice` was not modified.

## Security Scan Artifacts

- Final Markdown report: `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/report.md`
- Final HTML report: `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/report.html`
- Threat model:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/01_context/threat_model.md`
- Discovery worklist:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/rank_input.csv`
- Deep-review worklist:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/deep_review_input.csv`
- Coverage ledger:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/03_coverage/repository_coverage_ledger.md`
- Dedupe ledger:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/04_reconciliation/dedupe_report.md`
- Validation summary:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/05_findings/validation_summary.md`
- Aggregate attack-path report:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/05_findings/attack_path_analysis_report.md`

The scan followed the Codex Security phase order: threat model, finding discovery, validation,
attack-path analysis, and final report generation. `rank_input.csv` was generated with
`generate_rank_input.py make-repo-rank-input` and produced 701 repository rows. The full set was
copied into `deep_review_input.csv`, then explicit runtime/config/governance add-backs were added
for `package.json`, `pnpm-workspace.yaml`, Docker/Compose config, `apps/web/next.config.mjs`,
`docs/threat-model.md`, `docs/deployment-hardening.md`, `docs/api-and-state-machines.md`, and
`docs/development/github-maintenance.md`, for 709 deep-review rows.

## Subagent Shards

Six read-only subagents reviewed bounded surfaces and wrote reports under the scan artifact root:

- API auth/public routes:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/api-auth-public.md`
- Public tokens/uploads:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/public-token-uploads.md`
- Domain/database invariants:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/domain-database-invariants.md`
- Worker/provider/connectors:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/worker-provider-connectors.md`
- Authenticated route families:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/api-authenticated-routes.md`
- UI/UX review:
  `/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/artifacts/02_discovery/subagents/ui-ux-review.md`

## Security Findings

The final Codex Security report contains six reportable findings:

| Finding                                                                                     | Severity | Confidence | Primary evidence                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production first-run setup can be remotely claimed while the database is empty              | High     | High       | `apps/api/src/routes/setup.ts:120-122`, `apps/api/src/routes/setup.ts:218-242`, `apps/api/src/routes/setup.ts:365-447`, `apps/api/src/http/auth-helpers.ts:197-204`                                                                       |
| Legal clinic program endpoints expose raw arbitrary metadata to firm-wide readers           | Medium   | Medium     | `apps/api/src/routes/legal-clinics.ts:36-44`, `apps/api/src/routes/legal-clinics.ts:106-108`, `apps/api/src/routes/legal-clinics.ts:133-166`                                                                                              |
| Memory-backed invoices can attach cross-firm lines and allocations when invoice IDs collide | Medium   | Medium     | `packages/database/src/repository/billing-invoices-payments/memory.ts:22-38`, `packages/database/src/repository/billing-invoices-payments/memory.ts:42-66`, `packages/database/src/repository/billing-invoices-payments/memory.ts:97-108` |
| Submitted public intake-form tokens remain usable after expiry                              | Medium   | High       | `apps/api/src/routes/intake-forms/shared.ts:21-24`, `apps/api/src/routes/intake-forms/public.ts:318-343`, `apps/api/src/routes/intake-forms/public.ts:389-429`, `apps/api/src/routes/intake-forms/public.ts:482-523`                      |
| Draft export responses expose internal storage keys and raw generated-document records      | Low      | High       | `apps/api/src/routes/drafts/exports.ts:137-164`, `apps/api/src/routes/drafts/exports.ts:171-187`, `apps/api/src/routes/drafts/exports.ts:207-216`                                                                                         |
| Mailgun raw MIME replay can write orphan S3 objects before idempotency conflict detection   | Low      | Medium     | `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts:105-124`, `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts:157-211`, `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts:260-287`                                         |

Validated non-findings and closures included dev-header/JWT production bypass, WebAuthn/session
lifecycle, shares/guest/external-upload token expiry, public consultation auth/origin controls,
S3 scan gates, worker metadata redaction, provider config encryption, connector SSRF/DNS/redirect
guards, trust-ledger posting, audit hash-chain mechanics, and rich document rendering sanitization.

## Code Review Findings

- P2: Report and conversation export idempotency conflicts fall through as 500-class errors instead
  of returning a stable conflict response. `apps/api/src/routes/reports.ts:183-242` also defaults
  the idempotency key without including grouping, so semantically different report requests can
  collide under the same default key. `apps/api/src/routes/conversation-threads/export-requests.ts:109-149`
  has the same conflict-handling gap.
- Follow-up candidate: memory-backed matter-workspace duplicate-id parity remains worth a focused
  test pass, but it was not promoted into the final security report because standard route
  reachability was weak relative to the invoice collision issue.

## UI/UX Review Findings

- UIUX-01: Unknown or disabled dashboard deep links silently fall back instead of surfacing a clear
  unavailable-section state.
- UIUX-02: Conflict-check result updates are not exposed through a live status region.
- UIUX-03: Intake-link create/revoke status is not exposed through a live status region.
- UIUX-04: Public intake submit errors can announce raw item ids and do not mark the invalid
  fields/items directly.
- UIUX-05: Public-consultation rotated submission-token status copy interpolates the generated
  token into generic UI text, making the state harder to scan safely.

The UI/UX review was source-led and used `apps/web/routes/routeCatalog.ts`,
`apps/web/app/page.tsx`, `apps/web/app/dashboard-client.tsx`, dashboard section components, public
token pages, setup/login/client-portal surfaces, `e2e/ui-ux.spec.ts`, and
`e2e/helpers/ui-ux-assertions.ts` as anchors. Host/browser screenshot validation was attempted
through the existing e2e gates and recorded below.

## Validation Evidence

| Command                                                                                                                                       | Result                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch` in the sibling worktree                                                                                         | Passed before doc edits; branch was `codex/op-whole-app-review-2026-06-11...origin/main`.                                                                                                                                                 |
| `pnpm install --frozen-lockfile`                                                                                                              | Passed.                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/domain build`                                                                                                   | Passed.                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/database build`                                                                                                 | Passed.                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/providers build`                                                                                                | Passed.                                                                                                                                                                                                                                   |
| Codex Security report validator                                                                                                               | Passed for `report.md`.                                                                                                                                                                                                                   |
| Codex Security HTML renderer                                                                                                                  | Passed and wrote `report.html` at 43,309 bytes.                                                                                                                                                                                           |
| `pnpm security:scan`                                                                                                                          | Passed; no high-confidence tracked secrets found.                                                                                                                                                                                         |
| `pnpm deps:audit`                                                                                                                             | Passed; no known vulnerabilities found for production or development audit.                                                                                                                                                               |
| `pnpm deps:licenses -- --json-output /tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/dependency-licenses.json`              | Passed; review-required groups were `(MIT OR EUPL-1.1+)`, `(MIT OR GPL-3.0-or-later)`, `BlueOak-1.0.0`, `CC-BY-3.0`, `CC-BY-4.0`, `LGPL-3.0-or-later`, and `Unlicense`.                                                                   |
| `pnpm --filter @open-practice/api test`                                                                                                       | Passed: 41 files, 505 tests.                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api typecheck`                                                                                                  | Passed.                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/database test`                                                                                                  | Passed: 18 files, 110 tests.                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database db:check`                                                                                              | Passed.                                                                                                                                                                                                                                   |
| `pnpm migrations:check`                                                                                                                       | Passed: 53 SQL files matched 53 journal entries.                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web test`                                                                                                       | Passed: 34 files, 177 tests.                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/web typecheck`                                                                                                  | Passed.                                                                                                                                                                                                                                   |
| `pnpm build`                                                                                                                                  | Passed: 6 workspace tasks.                                                                                                                                                                                                                |
| `node scripts/security-hot-path-rescan.mjs --artifact-root /tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/hot-path-rescan` | Partially passed; hot-path selector, scoped secret scan, focused API/database regressions, database checks, typechecks, build, and package tests passed, then `selector-policy-check` failed on OSS reference-lock drift.                 |
| `pnpm docker:residual-watch`                                                                                                                  | Passed; wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-11T23-42-51Z`.                                                                                                                                       |
| `pnpm docker:app-smoke`                                                                                                                       | Passed; built images, migrated PostgreSQL, and verified containerized API `/health` plus web root.                                                                                                                                        |
| `pnpm policy:check`                                                                                                                           | Failed at `node scripts/validate-oss-reuse.mjs` after passing secret scan, package-manifest policy, and migration parity. The blocker is active OSS lock commits drifting from the central reference index for 24 reference repositories. |
| `pnpm e2e:host`                                                                                                                               | Interrupted after three consecutive Playwright `Test timeout of 60000ms exceeded while setting up "page"` failures in `e2e/host.spec.ts`; artifacts were written under `test-results/e2e/host-*`.                                         |
| `DEV_AUTH_FIRM_ID=firm-matterless-e2e DEV_AUTH_USER_ID=user-matterless-admin pnpm e2e:host -- --grep @matterless`                             | Failed before Playwright because the local web runtime was not ready at `http://localhost:33110`.                                                                                                                                         |
| `node scripts/run-e2e.mjs first-run`                                                                                                          | Failed before Playwright because the local web runtime was not ready at `http://localhost:33130`; the dev server also logged a Turbopack task-type panic.                                                                                 |
| `pnpm e2e:docker`                                                                                                                             | Passed: 5 Docker-backed Playwright checks in 2.5 minutes, including the external-upload receipt layout QA.                                                                                                                                |
| `pnpm verify:select -- --files docs/validation/README.md docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md`                             | Passed; selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.                                                                                                                                                         |
| `pnpm format:check`                                                                                                                           | Passed after targeted Prettier wrapping for this proof note.                                                                                                                                                                              |
| `pnpm docs:check`                                                                                                                             | Passed.                                                                                                                                                                                                                                   |
| `node scripts/validate-validation-proof-index.mjs`                                                                                            | Passed.                                                                                                                                                                                                                                   |
| `git diff --check`                                                                                                                            | Passed.                                                                                                                                                                                                                                   |
| `pnpm ci:local`                                                                                                                               | Failed at the `policy:check` OSS reuse step after passing global formatting, lint, typecheck, package tests, script tests, database `db:check`, secret scan, package-manifest policy, and migration parity.                               |

The OSS reuse drift named by `policy:check` and hot-path rescan covered:
`activepieces__activepieces`, `apache__fineract`, `blnkfinance__blnk`, `calcom__cal.diy`,
`civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
`jhpyle__docassemble`, `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`,
`ledgersmb__ledgersmb`, `lerianstudio__midaz`, `microsoft__markitdown`,
`nextcloud__server`, `open-source-legal__opencontracts`,
`opencollective__opencollective`, `opencollective__opencollective-api`,
`opencollective__opencollective-frontend`, `openfga__openfga`,
`paperless-ngx__paperless-ngx`, `temporalio__temporal`, `unstructured-io__unstructured`, and
`zulip__zulip`.

## Current OSS Policy Follow-Up

The OSS reference-lock blocker recorded above was branch-local historical evidence. On 2026-06-12,
the current project lock already matched the central reference index at
`/Users/bryan/projects/reference-repos/docs/index.json`; no `docs/oss-references.lock.json` edit was
needed for this follow-up.

| Command                                                         | Result                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm refs:clone -- --check`                                    | Passed; `docs/oss-references.lock.json` matched 28 Open Practice index entries.                                                           |
| `node scripts/validate-oss-reuse.mjs`                           | Passed.                                                                                                                                   |
| `pnpm verify:select -- --files <current proof/index doc paths>` | Passed; selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.                                                         |
| `pnpm policy:check`                                             | Passed after the current lock/index parity check, validating secret scan, package manifests, migrations, OSS reuse, docs, and boundaries. |
| `pnpm ci:local`                                                 | Passed; the broad local CI gate is no longer blocked by OSS reference-lock drift.                                                         |

## OP-SEC-001 Remediation Follow-Up - 2026-06-12

This branch remediates the high-severity finding "Production first-run setup can be remotely
claimed while the database is empty" without reintroducing a setup key. First-run setup remains
unauthenticated and keyless, but production setup availability is now operator-local only. Remote or
proxy-forwarded production requests against an empty database receive a blocked setup status, and
`POST /api/setup/webauthn-options` plus `POST /api/setup/complete` return `403` before challenge
creation or owner-admin persistence.

The production setup gate now requires loopback socket IP, loopback `Host`, loopback `Origin` when
present, and no proxy client headers such as `Forwarded`, `X-Forwarded-For`, or `X-Real-IP`.
Non-production loopback behavior and the explicit local Docker bridge setup allowance are unchanged.

Remediation branch delta:

```text
apps/api/src/routes/setup.ts
apps/api/src/server.test.ts
docs/api-and-state-machines.md
docs/deployment-hardening.md
docs/development/getting-started.md
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
e2e/first-run.spec.ts
```

Validation evidence:

| Command                                                                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files apps/api/src/routes/setup.ts apps/api/src/server.test.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/development/getting-started.md docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md e2e/first-run.spec.ts` | Passed; selected `pnpm e2e:host`, `pnpm e2e:docker`, `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck`.                                                  |
| `pnpm format:check`                                                                                                                                                                                                                                                    | Passed: all matched files use Prettier code style.                                                                                                                                                                                                            |
| `pnpm docs:check`                                                                                                                                                                                                                                                      | Passed: documentation link validation passed.                                                                                                                                                                                                                 |
| `pnpm policy:check`                                                                                                                                                                                                                                                    | Passed: secret scan, package manifest dependency policy, migration parity for 54 SQL files and 54 journal entries, OSS reuse policy, documentation links, validation proof index, local-evidence Docker ignore, and Open Practice boundary policy all passed. |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                | Passed: 41 test files and 504 tests passed.                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                           | Passed: `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                      |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                   | Passed: 1 first-run Playwright test passed and setup completed without a setup key over loopback.                                                                                                                                                             |
| `pnpm e2e:host`                                                                                                                                                                                                                                                        | Passed: 29 Playwright tests passed and 11 suite-managed tests were skipped.                                                                                                                                                                                   |
| `pnpm e2e:docker`                                                                                                                                                                                                                                                      | Passed: 3 Docker-backed Playwright tests passed; Docker was available, migrations ran, and compose cleanup removed the temporary PostgreSQL, Redis, MinIO, Mailpit, network, and volumes.                                                                     |
| `git diff --check`                                                                                                                                                                                                                                                     | Passed after the proof refresh.                                                                                                                                                                                                                               |

No validation command was manually skipped. `pnpm e2e:host` reported 11 expected
suite-managed skips, and `pnpm e2e:docker` was available for this closeout.

## Legal Clinic Metadata DTO Remediation Follow-Up - 2026-06-15

This branch remediates the medium-severity finding "Legal clinic program endpoints expose raw
arbitrary metadata to firm-wide readers" with a route-layer DTO change only. Legal-clinic program
and matter-profile records may still store internal metadata for review-first fiscal-host workflows,
but `GET/POST /api/legal-clinic/programs` and
`GET/PUT /api/legal-clinic/profiles` now preserve the `metadata` response property while exposing
only allowlisted fiscal-host program fields or restricted-fund matter fields. Malformed metadata and
extra arbitrary keys are dropped from response DTOs instead of being echoed to firm-wide readers.

Remediation branch delta:

```text
apps/api/src/routes/legal-clinics.ts
apps/api/src/routes/legal-clinics.test.ts
docs/api-and-state-machines.md
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
```

Validation evidence:

| Command                                                                                                                                                                                                                         | Result                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`                                                                                      | Passed in the fresh sibling worktree to hydrate workspace package `dist` entrypoints before API tests.                                               |
| `pnpm --filter @open-practice/api test -- legal-clinics`                                                                                                                                                                        | Passed: 41 API test files and 507 tests passed, including focused legal-clinic DTO redaction assertions.                                             |
| `pnpm verify:select -- --files apps/api/src/routes/legal-clinics.ts apps/api/src/routes/legal-clinics.test.ts docs/api-and-state-machines.md docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md docs/validation/README.md` | Passed; selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/api test`, and API typecheck.            |
| `pnpm format:check`                                                                                                                                                                                                             | Passed: all matched files use Prettier code style.                                                                                                   |
| `pnpm docs:check`                                                                                                                                                                                                               | Passed: documentation link validation passed.                                                                                                        |
| `pnpm policy:check`                                                                                                                                                                                                             | Passed: secret scan, package manifests, migration parity, OSS reuse, docs links, validation proof index, local-evidence, and boundary policy passed. |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                         | Passed: 41 API test files and 507 tests passed.                                                                                                      |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                    | Passed: `tsc -p tsconfig.json --noEmit`.                                                                                                             |
| `git diff --check`                                                                                                                                                                                                              | Passed.                                                                                                                                              |

No validation command was manually skipped.

## Matter Workspace Duplicate-ID Parity Follow-Up - 2026-06-13

This branch closes the code-review follow-up candidate for memory-backed matter-workspace
duplicate-id parity after OP-T156 closeout context was reviewed. OP-T156 covered client-portal
document visibility and dashboard proof, but it did not close the older matter-workspace activity
candidate. The confirmed gap was in shared matter activity assembly: helper maps for contacts,
share-link IDs, external-upload-link IDs, and ledger account IDs were built from unscoped inputs.
Memory repositories can hold same-ID records for different firms, while the Drizzle path usually
receives firm-scoped dependency outputs. The shared mapper now scopes those lookup maps, and the
portal-shareable grant check, to the requested firm before assembling activity rows.

Focused coverage adds a synthetic two-firm regression with colliding child IDs for contacts,
share links, external upload links, and ledger accounts. It verifies that the first firm's activity
keeps its own contact title, share/upload access rows, and ledger account type labels while
excluding the second firm's matter ID, contact display name, and ledger account type.

Follow-up branch delta:

```text
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
packages/database/src/repository/drizzle-mappers.ts
packages/database/test/repository.audit-matter-setup.test.ts
```

Validation evidence:

| Command                                                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/database exec vitest run test/repository.audit-matter-setup.test.ts`                                                                                                                                                                   | Passed: 1 database test file and 5 tests passed, including the duplicate-id regression.                                                                                                                                                                                                                                                               |
| `pnpm verify:select -- --files docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md docs/validation/README.md packages/database/src/repository/drizzle-mappers.ts packages/database/test/repository.audit-matter-setup.test.ts`                                   | Passed; selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`, `pnpm --filter @open-practice/database typecheck`, `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`. |
| `pnpm exec prettier --write <changed paths>`                                                                                                                                                                                                                         | Passed; only `packages/database/test/repository.audit-matter-setup.test.ts` needed wrapping.                                                                                                                                                                                                                                                          |
| `pnpm format:check`                                                                                                                                                                                                                                                  | Passed: all matched files use Prettier code style.                                                                                                                                                                                                                                                                                                    |
| `pnpm docs:check`                                                                                                                                                                                                                                                    | Passed: documentation link validation passed.                                                                                                                                                                                                                                                                                                         |
| `pnpm policy:check`                                                                                                                                                                                                                                                  | Passed: secret scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, validation proof index, local-evidence Docker ignore, and boundary policy all passed.                                                                                                                                                        |
| `pnpm --filter @open-practice/database test`                                                                                                                                                                                                                         | Passed: 18 test files and 114 tests passed.                                                                                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/database db:check`                                                                                                                                                                                                                     | Passed: Drizzle configuration check reported no issues.                                                                                                                                                                                                                                                                                               |
| `pnpm migrations:check`                                                                                                                                                                                                                                              | Passed: 54 SQL migration files match 54 journal entries.                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database typecheck`                                                                                                                                                                                                                    | Passed: `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                        | Passed: `tsc -p tsconfig.build.json`.                                                                                                                                                                                                                                                                                                                 |
| `git diff --check`                                                                                                                                                                                                                                                   | Passed: no whitespace errors.                                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                              | Failed twice on unrelated API route test timeouts: once during a parallel validation run with 14 timeout failures, then again as a solo exact selector rerun ending `Exit status 143` after timeout symptoms began in unrelated files such as `webauthn.test.ts`.                                                                                     |
| `pnpm --filter @open-practice/api exec vitest run src/routes/webauthn.test.ts src/routes/intake-pipeline.test.ts src/routes/reports.test.ts src/routes/document-assembly.test.ts src/routes/ai-operational-proposals.test.ts src/server.test.ts --testTimeout=30000` | Passed as a diagnostic rerun for representative timed-out files, supporting a timeout/resource interpretation rather than an assertion regression in this mapper slice.                                                                                                                                                                               |

Skipped/blocked validation: the exact selector-selected `pnpm --filter @open-practice/api test`
gate did not pass in this sibling worktree because unrelated API tests exceeded the default 5s
Vitest timeout and the solo rerun was terminated with exit 143. The longer-timeout diagnostic rerun
for representative timed-out files passed without code changes.

## UIUX-01 Remediation Follow-Up - 2026-06-13

This branch remediates `UIUX-01` by carrying the full dashboard route-selection result through the
web shell instead of reducing it to the fallback section key. Unknown, disabled, and non-sidebar
dashboard section deep links now render a clear unavailable-section workspace with a live status
message and a recovery action to the safe fallback section. Unknown query values are not echoed into
the UI. Known disabled sections use the catalog title and existing disabled navigation reason.

The unavailable state is web-only ergonomics; API authorization remains the enforcement boundary.

Remediation branch delta:

```text
apps/web/app/_features/dashboard/dashboard-shell-state.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/dashboard-shell.test.tsx
apps/web/app/dashboard/dashboard-shell.tsx
apps/web/app/page.tsx
apps/web/routes/routeCatalog.test.ts
apps/web/routes/routeCatalog.ts
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
e2e/ui-ux.spec.ts
```

Validation evidence:

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Result                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed.                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/providers build`                                                                                                                                                                                                                                                                                                                                                                                                              | Passed.                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                                                                                                                                                                                               | Passed.                                                                                                                                                                                                                                            |
| `pnpm verify:select -- --files apps/web/app/_features/dashboard/dashboard-shell-state.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/page.tsx apps/web/routes/routeCatalog.test.ts apps/web/routes/routeCatalog.ts docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md docs/validation/README.md e2e/ui-ux.spec.ts` | Passed; selected `pnpm e2e:host`, `pnpm e2e:docker`, `node scripts/run-e2e.mjs first-run`, `pnpm e2e:matterless`, `pnpm e2e:client-portal`, static docs/policy/format checks, web tests/typecheck, and `pnpm build`.                               |
| `pnpm e2e:host`                                                                                                                                                                                                                                                                                                                                                                                                                                             | Passed on quiet retry with stdout/stderr redirected to `/tmp/open-practice-uiux-01-host-e2e.log`: 30 host Playwright tests passed in 3.7 minutes. An earlier noisy attempt exited with code 143 while the dense dashboard sweep was still running. |
| `pnpm e2e:docker`                                                                                                                                                                                                                                                                                                                                                                                                                                           | Passed on retry: 3 Docker-backed Playwright checks passed in 2.7 minutes after the Docker dashboard sweep timeout was raised to match local runtime. The first attempt timed out at 120 seconds on the exhaustive dashboard sweep.                 |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                                                                                                                                                                                                        | Passed: 1 first-run Playwright test passed in 27.2 seconds.                                                                                                                                                                                        |
| `pnpm e2e:matterless`                                                                                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 matterless Playwright test passed in 15.7 seconds.                                                                                                                                                                                       |
| `pnpm e2e:client-portal`                                                                                                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 client-portal Playwright test passed in 21.0 seconds.                                                                                                                                                                                    |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed: 35 files and 182 tests.                                                                                                                                                                                                                    |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                | Passed.                                                                                                                                                                                                                                            |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                         | Passed: all matched files use Prettier code style.                                                                                                                                                                                                 |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                                                                                                                                                                           | Passed: documentation link validation passed.                                                                                                                                                                                                      |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                                                                                                                                                                         | Passed: secret scan, package manifests, migration parity, OSS reuse, docs links, proof index, local-evidence Docker ignore, and Open Practice boundary policy all passed.                                                                          |
| `pnpm build`                                                                                                                                                                                                                                                                                                                                                                                                                                                | Passed: 6 workspace build tasks succeeded.                                                                                                                                                                                                         |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                          | Passed.                                                                                                                                                                                                                                            |

## Export Idempotency Follow-Up - 2026-06-15

This branch closes the code-review follow-up for staff report and conversation-thread export
idempotency. Both route families now translate repository idempotency fingerprint mismatches into
the existing stable `409 IDEMPOTENCY_KEY_CONFLICT` response instead of letting the repository error
fall through as a 500-class failure. Matching replays still return the existing export request, but
they no longer enqueue a second reports job or append a duplicate request audit event.

Staff report default idempotency keys now include the resolved grouping key, so semantically
different same-day report exports for the same definition/profile no longer collide when the client
does not provide an explicit key. Conversation export default keys remain scoped to firm/user/thread.

Follow-up branch delta:

```text
apps/api/src/routes/conversation-threads.test.ts
apps/api/src/routes/conversation-threads/export-requests.ts
apps/api/src/routes/reports.test.ts
apps/api/src/routes/reports.ts
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
```

Validation evidence:

| Command                                                                                                                                                                                                                                                                                           | Result                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                                       | Passed: rebuilt the upstream domain package in the fresh sibling worktree before route tests.                                                                                        |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                                     | Passed after the domain package build was present.                                                                                                                                   |
| `pnpm --filter @open-practice/providers build`                                                                                                                                                                                                                                                    | Passed after the domain package build was present.                                                                                                                                   |
| `pnpm --filter @open-practice/api exec vitest run src/routes/reports.test.ts src/routes/conversation-threads.test.ts`                                                                                                                                                                             | Passed: 2 route test files and 23 tests, including report export replay/conflict/default-key grouping coverage and conversation export replay/conflict coverage.                     |
| `pnpm verify:select -- --files apps/api/src/routes/conversation-threads.test.ts apps/api/src/routes/conversation-threads/export-requests.ts apps/api/src/routes/reports.test.ts apps/api/src/routes/reports.ts docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md docs/validation/README.md` | Passed; selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck`.             |
| `pnpm format:check`                                                                                                                                                                                                                                                                               | Passed: all matched files use Prettier code style.                                                                                                                                   |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                 | Passed: documentation link validation passed.                                                                                                                                        |
| `pnpm policy:check`                                                                                                                                                                                                                                                                               | Passed: secret scan, package manifests, migration parity, OSS reuse, docs links, validation proof index, local-evidence Docker ignore, and Open Practice boundary policy all passed. |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                                           | Passed: 41 API test files and 512 tests completed after the focused route preflight.                                                                                                 |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                                      | Passed: `tsc -p tsconfig.json --noEmit`.                                                                                                                                             |
| `git diff --check`                                                                                                                                                                                                                                                                                | Passed.                                                                                                                                                                              |

## Original Review Diff And Proof Reconciliation

The intended tracked branch delta is limited to this proof note and the validation index entry:

```text
docs/validation/OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md
docs/validation/README.md
```

E2E runtime generation briefly changed `apps/web/next-env.d.ts`; that generated import drift was
restored so the review branch remains documentation-only.

## Follow-Up Queue

- Remediate or explicitly risk-accept the remaining Codex Security findings in separate source
  branches. OP-SEC-001 production setup gating is remediated by the 2026-06-12 follow-up above, and
  legal-clinic metadata DTO redaction is remediated by the 2026-06-15 follow-up above.
- Add focused tests for submitted-token expiry, memory invoice cross-firm duplicate ids,
  draft-export response redaction, and Mailgun altered-body replay idempotency.
- Export idempotency triage is closed by the 2026-06-15 follow-up above.
- Add UI/UX assertions for live-region status updates and public intake field-level error mapping.
- Keep `docs/oss-references.lock.json` aligned with the central reference index during future
  reference-corpus refreshes; the 2026-06-12 parity follow-up shows `policy:check` and `ci:local`
  unblocked on the current project tree.
