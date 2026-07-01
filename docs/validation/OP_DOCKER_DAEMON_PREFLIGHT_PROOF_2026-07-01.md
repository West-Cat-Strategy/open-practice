# Docker Daemon Preflight Blocker Proof

Date: 2026-07-01
Branch: `chore/docker-daemon-preflight-blocker-20260701`
Worktree: `/Users/bryan/projects/open-practice-docker-daemon-preflight-20260701`
Base: `0780bafbc1d73c3ff234741ad54023c04be13f75`
Status: Focused script contracts, Docker app-smoke, format, and docs checks pass; Docker
residual-watch, Docker scan, and policy gate are blocked by existing local image/reference posture
outside this slice.

## Scope

This branch adds a deterministic local Docker daemon preflight for Docker-heavy local validation
wrappers. The shared preflight reports blocker code `docker_daemon_unavailable`, reason
`docker_unreachable`, and kind `local-environment` when Docker is not reachable, with operator
guidance to start Docker Desktop or set `DOCKER_HOST` to a reachable daemon.

The preflight is wired into:

- `pnpm docker:app-smoke`, through the existing Docker storage preflight before image build/startup.
- `pnpm docker:residual-watch`, before Docker Scout/build command execution while still writing a
  daemon-unavailable blocker artifact when Docker is not reachable.
- `pnpm docker:scan`, after Trivy availability is confirmed and before attempting image scans.

The branch preserves Compose contracts, image pins, ports, credentials, runtime APIs, schemas,
dependencies, app behavior, Docker storage semantics, synthetic-only proof, privacy boundaries, and
clean-room posture. It adds no client, matter, credential, payment, private deployment, privileged
document, raw audit, or provider payload data to tracked files.

## Final Path Set

Selector and validation use this final changed-path set:

```text
docs/development/github-maintenance.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_DOCKER_DAEMON_PREFLIGHT_PROOF_2026-07-01.md
docs/validation/README.md
scripts/docker-storage-preflight.mjs
scripts/docker-storage-preflight.test.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```

## Selector Output

`npm exec --yes pnpm@11.5.3 -- pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm security:review
pnpm security:secrets-history
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

## Validation

| Command                                                                                                                                                 | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec --yes pnpm@11.5.3 -- pnpm verify:select -- --files <final path set>`                                                                          | Pass   | Selected the security-review, Docker, docs, policy, and script-test lanes listed above.                                                                                                                                                                                                                                                                                                                                   |
| `npm exec --yes pnpm@11.5.3 -- pnpm exec prettier --write <final path set>`                                                                             | Pass   | Formatted the touched docs/proof/scripts; only docs/proof wrapping changed.                                                                                                                                                                                                                                                                                                                                               |
| `node --test scripts/docker-storage-preflight.test.mjs scripts/watch-docker-residuals.test.mjs scripts/scan-docker-images.test.mjs`                     | Pass   | 30 focused Node script tests passed, covering daemon preflight pass/fail, app-smoke storage preflight hard-blocking when Docker is unreachable, residual-watch blocker artifacts with `commands: []`, Docker scan blocker artifacts, and preserved missing-Trivy skip behavior.                                                                                                                                           |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:residual-watch`                                                                                              | Failed | Reason: Docker was reachable, so the command entered the real Scout/source lane and wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-07-01T00-49-47Z`; it reported the existing Mailpit `v1.30.3` source-tag candidate, existing bundled-MinIO `11C`/`16H` plus archived-source readiness blockers, and a `postgres-scout-quickview` blocker because Scout could not inspect `sha256:7611f3...`. |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:app-smoke`                                                                                                   | Pass   | Docker was reachable; pre-build storage preflight found 36.9 GiB free, post-build preflight found 29.3 GiB free, the disposable Compose stack passed PostgreSQL-backed API health/web/setup-status checks, and the stack/volumes/network were removed.                                                                                                                                                                    |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:scan`                                                                                                        | Failed | Reason: post-smoke scan artifact `.tmp/docker/trivy/2026-07-01T00-58-55Z` found missing default `open-practice-dev-{api,web,worker}` image tags, reported bundled MinIO `3C`/`28H`, and reported `0C`/`0H` for Postgres and Mailpit.                                                                                                                                                                                      |
| `npm exec --yes pnpm@11.5.3 -- pnpm format:check`                                                                                                       | Pass   | Full repository Prettier check passed after path-scoped formatting.                                                                                                                                                                                                                                                                                                                                                       |
| `npm exec --yes pnpm@11.5.3 -- pnpm docs:check`                                                                                                         | Pass   | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm exec --yes pnpm@11.5.3 -- pnpm policy:check`                                                                                                       | Failed | Reason: all earlier policy steps passed through migration lint, then OSS reuse validation failed because 21 `docs/oss-references.lock.json` entries do not match the central reference index. This is existing reference-lock drift outside the Docker preflight path set.                                                                                                                                                |
| `npm exec --yes pnpm@11.5.3 -- pnpm proof:reconcile -- --proof docs/validation/OP_DOCKER_DAEMON_PREFLIGHT_PROOF_2026-07-01.md --files <final path set>` | Pass   | Reconciled 11 final paths and the selector-chosen command list.                                                                                                                                                                                                                                                                                                                                                           |
| `git diff --check`                                                                                                                                      | Pass   | Whitespace check passed.                                                                                                                                                                                                                                                                                                                                                                                                  |

## Boundaries

- The blocker is local validation ergonomics only; it does not change runtime contracts or Compose
  behavior.
- Docker blocker artifacts contain command status, redacted previews, and synthetic/local metadata
  only.
- Docker daemon unavailability remains an environment blocker; it is not treated as an application
  regression or a removed CVE/residual finding.

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
