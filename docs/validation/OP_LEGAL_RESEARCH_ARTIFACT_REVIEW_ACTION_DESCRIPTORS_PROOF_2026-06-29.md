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

| Command                                                                                                       | Status  | Notes                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain exec vitest run src/operational-actions.test.ts --reporter=verbose`      | Pass    | Focused descriptor tests covered available, busy, cross-action busy, permission, non-ready, workspace unavailable, compact reason text, and synthetic-data redaction. |
| `pnpm --filter @open-practice/domain build`                                                                   | Pass    | Rebuilt `@open-practice/domain/operational-actions` for web subpath consumers.                                                                                        |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/research-section.test.tsx --reporter=verbose` | Pass    | Focused static render tests covered descriptor-backed action keys, aria/title status text, busy labels, disabled buttons, and hidden read-only controls.              |
| `pnpm verify:select -- --files <final changed paths>`                                                         | Pending | Run after final path confirmation.                                                                                                                                    |
| `pnpm --filter @open-practice/domain test`                                                                    | Pending | Required package test sweep.                                                                                                                                          |
| `pnpm --filter @open-practice/domain typecheck`                                                               | Pending | Required package typecheck.                                                                                                                                           |
| `pnpm --filter @open-practice/domain build`                                                                   | Pending | Required package build rerun after final path confirmation.                                                                                                           |
| `pnpm --filter @open-practice/web test`                                                                       | Pending | Required web package test sweep.                                                                                                                                      |
| `pnpm --filter @open-practice/web typecheck`                                                                  | Pending | Required web package typecheck.                                                                                                                                       |
| `pnpm proof:reconcile`                                                                                        | Pending | Required proof reconciliation.                                                                                                                                        |
| `pnpm docs:check`                                                                                             | Pending | Required docs check.                                                                                                                                                  |
| `pnpm policy:check`                                                                                           | Pending | Required policy check.                                                                                                                                                |

## Selector Notes

Pending selector output will be recorded here after `pnpm verify:select -- --files` is run against
the exact final changed paths above.
