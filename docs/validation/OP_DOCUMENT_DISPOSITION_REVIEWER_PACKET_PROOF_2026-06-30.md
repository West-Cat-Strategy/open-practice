# Document Disposition Reviewer Packet Proof 2026-06-30

**Branch:** `feat/document-disposition-reviewer-packet-20260630`
**Worktree:** `/Users/bryan/projects/open-practice-document-disposition-reviewer-packet-20260630`

## Scope

This slice adds the smallest staff-only, matter-scoped disposition reviewer packet command under
document processing:

- `POST /api/document-processing/documents/:documentId/disposition-reviewer-packet` accepts only
  enum `decision` and `reason` fields.
- Decisions are limited to `ready_for_reviewer_packet`, `reviewed_keep`, and
  `reviewed_superseded`; reasons reuse the existing retention/hold review reason enum.
- The command requires staff access plus matter-scoped `document_processing:read` and
  `document:update`.
- The command records only bounded `documents.reviewMetadata.retentionHoldReview` posture and
  reprojects the result through `retentionHoldReview.dispositionMetadata`.
- Documents with hold, upload/checksum/scan, or review-state blockers return
  `DOCUMENT_DISPOSITION_REVIEWER_PACKET_BLOCKED`.

## Preserved Boundaries

- No object deletion, destructive disposition workflow, background purge, or storage mutation.
- No retention-deadline enforcement, deadline computation, or automatic expiry.
- No legal-hold release or override.
- No raw OCR text, provider payload, storage key, export body, generated summary, free-form note,
  or raw metadata in the response or audit metadata.
- No public/client controls and no jurisdiction-certified compliance claim.
- No schema, migration, dependency, provider, worker, queue, or export-surface change.

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
