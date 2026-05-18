# OP-T92 Intake Authoring Diagnostics Proof

Date: 2026-05-16

## Scope

OP-T92 adds non-persistent staff-side diagnostics to the structured intake builder. Diagnostics flag
duplicate IDs, empty sections, missing question references, unsupported mapping targets, broken
branch/package/document references, and signature document references that still require server-side
preview checks for matter availability. Saving remains advisory and unchanged.

Actual handoff paths reconciled on `codex/testing-strategy-strengthening`:

- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/intake-forms-dashboard.ts`
- `apps/web/app/intake-forms/StructuredIntakeBuilder.tsx`
- `apps/web/app/styles/30-feature-surfaces.css`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md`

## Validation

Passing checks:

- `pnpm verify:select -- --files apps/web/app/intake-forms/StructuredIntakeBuilder.tsx apps/web/app/intake-forms-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/styles/30-feature-surfaces.css docs/planning-and-progress.md docs/validation/OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md`
- `pnpm --filter @open-practice/web test -- app/dashboard-client.test.ts`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

Notes:

- Diagnostics are browser-safe helper output and are not persisted through the intake API.
- Advanced JSON with a missing question reference no longer crashes the builder render path.
