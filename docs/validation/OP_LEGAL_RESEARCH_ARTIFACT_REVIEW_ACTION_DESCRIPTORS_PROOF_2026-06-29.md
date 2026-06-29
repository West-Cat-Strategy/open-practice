# Legal Research Artifact Review Action Descriptors Proof - 2026-06-29

## Scope

This proof records the behavior-preserving descriptor follow-up for the existing Research workspace
legal-research artifact `Review` and `Reject` controls.

Shipped behavior:

- Domain-owned operational action descriptors now provide the legal-research artifact review action
  keys, labels, busy labels, disabled reasons, tones, compact reason text, and busy-key helpers.
- Research workspace review buttons now render descriptor-backed `data-action-key`, `aria-label`,
  `title`, visible labels, and disabled states while preserving the existing hidden-control gate for
  unauthorized staff, non-ready artifacts, and unavailable workspaces.
- Dashboard local busy state now records the descriptor busy key so the UI can distinguish
  `reviewed` in progress from `rejected` in progress.

Preserved boundaries:

- No legal-research or document-processing route/API paths changed.
- No request body, response handling, authorization, repository persistence, provider behavior,
  document conversion behavior, or review-only posture changed.
- No provider payloads, raw document text, generated summaries, private evidence, payment details,
  or client/matter data were added.
- No dependencies, migrations, copied source, or vendored assets were added.

## Final Changed Paths

- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/research-section.test.tsx`
- `apps/web/app/dashboard/research-section.tsx`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_LEGAL_RESEARCH_ARTIFACT_REVIEW_ACTION_DESCRIPTORS_PROOF_2026-06-29.md`
- `docs/validation/README.md`
- `packages/domain/src/operational-actions.test.ts`
- `packages/domain/src/operational-actions.ts`

## Validation

- Pass: `pnpm verify:select -- --files <final changed paths>`. Selector recommended
  `pnpm architecture:check`, `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
  domain test/typecheck/build, API/provider/worker/web tests, web typecheck, and `pnpm build`.
- Pass: `pnpm architecture:check`. Architecture import policy passed with 461 workspace import
  edges reviewed.
- Blocked because unrelated dirty proof formatting remains outside this slice: `pnpm format:check`
  fails on `docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md`.
- Pass: `pnpm exec prettier --check <final changed paths>`. All owned final files use Prettier
  style after formatting `apps/web/app/dashboard/research-section.test.tsx`.
- Pass:
  `pnpm --filter @open-practice/domain exec vitest run src/operational-actions.test.ts --reporter=verbose`.
  Focused descriptor tests covered available, busy, cross-action busy, permission, non-ready,
  workspace unavailable, compact reason text, and synthetic-data redaction.
- Pass: `pnpm --filter @open-practice/domain test`. 33 test files passed; 261 tests passed.
- Pass: `pnpm --filter @open-practice/domain typecheck`. Domain typecheck completed with no errors.
- Pass: `pnpm --filter @open-practice/domain build`. Domain build completed with no errors and
  rebuilt `@open-practice/domain/operational-actions` for web subpath consumers.
- Blocked because the full API suite reported one timeout in `src/routes/caldav.test.ts`:
  `pnpm --filter @open-practice/api test`. 42 files and 620 tests passed, 1 test timed out.
- Pass:
  `pnpm --filter @open-practice/api exec vitest run src/routes/caldav.test.ts --reporter=verbose`.
  Isolated retry passed the previously timed-out CalDAV route test file with 8 tests passed.
- Pass: `pnpm --filter @open-practice/providers test`. 13 test files passed; 37 tests passed.
- Pass: `pnpm --filter @open-practice/worker test`. 6 test files passed; 54 tests passed.
- Pass:
  `pnpm --filter @open-practice/web exec vitest run app/dashboard/research-section.test.tsx --reporter=verbose`.
  Focused static render tests covered descriptor-backed action keys, aria/title status text, busy
  labels, disabled buttons, and hidden read-only controls.
- Pass: `pnpm --filter @open-practice/web test`. 46 test files passed; 241 tests passed.
- Pass: `pnpm --filter @open-practice/web typecheck`. Web typecheck completed with no errors.
- Pass: `pnpm build`. Initial attempts were blocked by an active concurrent Next build lock in this
  checkout; after the live build exited and the lock cleared, root Turbo build completed with all 6
  package builds successful.
- Pass: `pnpm docs:check`. Documentation link validation passed after final proof-note updates.
- Blocked because the toolchain policy failed before later policy stages: `pnpm policy:check`.
  Local `pnpm --version` is `11.7.0`, but `packageManager` requires `11.5.3`.
- Blocked because the bare command now requires `--proof` and a file/base/dirty selector:
  `pnpm proof:reconcile`. Scoped proof reconciliation is recorded separately.
- Pass:
  `pnpm proof:reconcile -- --proof docs/validation/OP_LEGAL_RESEARCH_ARTIFACT_REVIEW_ACTION_DESCRIPTORS_PROOF_2026-06-29.md --files <final changed paths>`.
  Validation proof reconciliation passed for the exact final path set.

## Selector Notes

`pnpm verify:select -- --files apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/research-section.test.tsx apps/web/app/dashboard/research-section.tsx
docs/improvement-opportunities.md docs/planning-and-progress.md
docs/validation/OP_LEGAL_RESEARCH_ARTIFACT_REVIEW_ACTION_DESCRIPTORS_PROOF_2026-06-29.md
docs/validation/README.md packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts`

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
