# OP-T157 Staff Submissions Operations Proof

Date: 2026-06-15 PDT

## Scope

OP-T157 shipped the first redacted staff submissions operations surface as an additive extension of
the existing staff-only intake pipeline.

Runtime changes:

- `GET /api/intake-pipeline` now returns `submissionsOperations` with derived status counts,
  prioritized operations rows, request/appointment count mixes, safe last-activity timestamps,
  assignment posture, source-quality posture, and export-safe summaries.
- Assignment posture is read-only and derived from the configured public-consultation review owner
  plus the current staff user's visible matter assignments. No claim/reassign model was added.
- The dashboard renders a dedicated Submissions operations block inside the existing Intake
  section.

## Boundaries Preserved

- No schema, migration, persisted queue, assignment mutation, public route, dependency, provider,
  worker, or delivery-channel change.
- No automatic matter creation, campaign automation, SMS delivery, bulk delivery, ad-spend
  ingestion, automatic client contact, or live reminder delivery.
- Operations rows and summaries omit requester email, request bodies, raw answers, private
  follow-up/review reasons, token values/hashes, raw source/interview URLs, appointment titles,
  provider-setting email addresses, raw provider metadata, and private audit/job content.
- Reference projects named in the backlog remained reference-only; no copied reference code,
  schema, UI, tests, assets, or distinctive prose was used.

## Owned Path Set

- `apps/api/src/routes/intake-pipeline.test.ts`
- `apps/api/src/routes/intake-pipeline.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/intake-section.test.tsx`
- `apps/web/app/dashboard/intake-section.tsx`
- `apps/web/app/intake-pipeline-dashboard.ts`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md`
- `docs/validation/README.md`
- `packages/domain/src/intake-pipeline.test.ts`
- `packages/domain/src/intake-pipeline.ts`

## Validation

Fresh-worktree hydration:

- Pass: `pnpm --filter @open-practice/domain build`
- Pass after domain build: `pnpm --filter @open-practice/database build`
- Pass after domain build: `pnpm --filter @open-practice/providers build`

Focused validation:

- Pass: `pnpm --filter @open-practice/domain test -- intake-pipeline.test.ts`
  - The command ran the domain package suite: 27 files, 172 tests.
- Pass: `pnpm --filter @open-practice/api test -- src/routes/intake-pipeline.test.ts`
  - The command ran the API package suite: 41 files, 514 tests.
- Pass: `pnpm --filter @open-practice/web test -- app/dashboard/intake-section.test.tsx app/dashboard-client.test.ts`
  - The command ran the web package suite: 35 files, 187 tests.

Selector and browser validation:

- Pass: `pnpm verify:select -- --files apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/intake-pipeline.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/intake-section.test.tsx apps/web/app/dashboard/intake-section.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md docs/validation/README.md packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts`
  - Selector recommended: `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    domain/API/web tests and typechecks, provider/worker tests, and `pnpm build`.
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test`
  - 9 files, 20 tests.
- Pass: `pnpm --filter @open-practice/worker test`
  - 5 files, 40 tests.
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
  - Turbo reported 6 successful package builds.
- Pass: browser desktop/mobile dashboard checks against the built web app and local API:
  - Setup used only synthetic owner and matter data in the in-memory API.
  - Screenshots:
    - `/tmp/op-t157-browser/intake-desktop-submissions-operations.png`
    - `/tmp/op-t157-browser/intake-mobile-submissions-operations.png`
    - `/tmp/op-t157-browser/intake-desktop.png`
    - `/tmp/op-t157-browser/intake-mobile.png`
  - Verified the Intake dashboard rendered the Submissions operations block, summary counters,
    empty-state row posture, and non-overlapping desktop/mobile layouts.
  - Verified forbidden strings were absent from the rendered dashboard check set:
    `requesterEmail`, `rawAnswers`, `privateFollowUpReason`, `tokenHash`, `automatic matter creation`,
    and `appointment title`.
