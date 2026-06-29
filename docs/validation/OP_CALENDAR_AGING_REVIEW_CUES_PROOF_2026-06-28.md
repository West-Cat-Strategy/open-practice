# OP Calendar Aging Review Cues Proof - 2026-06-28

Date: 2026-06-28/2026-06-29
Branch: `feat/deposit-match-review-command-boundary-20260627`
Status: Implemented as review-only staff cues. Final mainline publication remains tracked outside
this proof.

## Scope

This slice adds staff-only fresh/aging/stale review cues for two existing open review surfaces:

- Appointment booking `tentative_hold` summaries derive `reviewAging` from `submittedAt`.
- Calendar scheduling request `needs_review` summaries derive `reviewAging` from `createdAt`.
- Shared domain thresholds are `fresh < 24h`, `aging >= 24h`, and `stale >= 72h`.
- Calendar/dashboard surfaces display row cues and scheduling-request stale/aging counts.

## Boundary

- Review metadata only: the cue does not automatically confirm, expire, schedule, reschedule, or
  dismiss anything.
- No provider sync, public room URLs, native media, signaling, chat, recordings, matter creation,
  public response expansion, migrations, background jobs, or dependency changes.
- Public appointment booking responses remain minimal and omit `reviewAging`.
- Synthetic data only.

## Final Changed Paths

```text
apps/api/src/routes/appointment-booking.test.ts
apps/api/src/routes/appointment-booking.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/dashboard/appointment-booking-panel.test.tsx
apps/web/app/dashboard/appointment-booking-panel.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP_CALENDAR_AGING_REVIEW_CUES_PROOF_2026-06-28.md
docs/validation/README.md
packages/domain/src/appointment-booking.test.ts
packages/domain/src/appointment-booking.ts
packages/domain/src/calendar.test.ts
packages/domain/src/calendar.ts
packages/domain/src/index.ts
packages/domain/src/models.ts
packages/domain/src/review-aging.test.ts
packages/domain/src/review-aging.ts
```

## Focused Validation

| Command                                                                                                                                                                    | Status | Notes                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `pnpm exec prettier --write <owned code/test files>`                                                                                                                       | Pass   | Formatted all owned code/test files after adding the domain/API/web cue surface.                    |
| `pnpm --filter @open-practice/domain exec vitest run src/review-aging.test.ts src/appointment-booking.test.ts src/calendar.test.ts`                                        | Pass   | 3 files, 16 tests. Covers threshold boundaries, staff-only summaries, and public response omission. |
| `pnpm --filter @open-practice/domain build`                                                                                                                                | Pass   | Rebuilt domain `dist` so API package tests resolve the updated domain exports.                      |
| `pnpm --filter @open-practice/api exec vitest run src/routes/appointment-booking.test.ts src/routes/calendar.test.ts`                                                      | Pass   | 2 files, 46 tests. Covers fake-time stale cues, public omission, and post-review cue omission.      |
| `pnpm --filter @open-practice/web exec vitest run app/calendar-dashboard.test.ts app/dashboard/calendar-section.test.tsx app/dashboard/appointment-booking-panel.test.tsx` | Pass   | 3 files, 14 tests. Covers helper copy, row render cues, counts, and display-only review semantics.  |

## Selector-Driven Validation

`pnpm verify:select -- --files <Final Changed Paths>` passed and selected:

```text
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

| Command                                         | Status  | Notes                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm architecture:check`                       | Pass    | 461 workspace import edges reviewed.                                                                                                                                                                                                                                                                                  |
| `pnpm api:contract`                             | Pass    | Generated `.tmp/api-contract/openapi.json` with 340 paths.                                                                                                                                                                                                                                                            |
| `pnpm format:check`                             | Pass    | All matched files use Prettier code style.                                                                                                                                                                                                                                                                            |
| `pnpm docs:check`                               | Pass    | Documentation link validation passed.                                                                                                                                                                                                                                                                                 |
| `pnpm policy:check`                             | Blocked | Exact selected command failed at `toolchain:check` because this runtime's `pnpm` is 11.7.0 while `packageManager` requires 11.5.3. Supporting `npm exec --yes --package=pnpm@11.5.3 -- pnpm policy:check` got past toolchain but failed on existing central reference-index lock-commit drift across reference repos. |
| `pnpm --filter @open-practice/domain test`      | Pass    | 33 files, 261 tests.                                                                                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/domain typecheck` | Pass    | No TypeScript errors.                                                                                                                                                                                                                                                                                                 |
| `pnpm --filter @open-practice/domain build`     | Pass    | `tsc -p tsconfig.build.json`.                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/api test`         | Pass    | Initial parallel run had two CalDAV 5s timeouts; standalone rerun passed 43 files, 621 tests.                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/api typecheck`    | Pass    | No TypeScript errors.                                                                                                                                                                                                                                                                                                 |
| `pnpm --filter @open-practice/providers test`   | Pass    | 13 files, 37 tests.                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/worker test`      | Pass    | 6 files, 54 tests.                                                                                                                                                                                                                                                                                                    |
| `pnpm --filter @open-practice/web test`         | Pass    | 46 files, 241 tests.                                                                                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/web typecheck`    | Pass    | No TypeScript errors.                                                                                                                                                                                                                                                                                                 |
| `pnpm build`                                    | Pass    | Initial attempts were blocked by real concurrent Next build locks; retry after the lock holder exited passed all 6 Turbo build tasks.                                                                                                                                                                                 |

## Skipped Checks

- Browser checks: skipped because selector did not choose browser/E2E commands; this change is a
  domain/API/static-render dashboard cue update, not a public booking runner, media, provider, or
  object-storage runtime change.
- Docker checks: skipped because selector did not choose Docker commands; no Docker, Compose,
  container-runtime, database migration, provider-runtime, media, or object-storage path changed.

## Notes

The checkout already contained unrelated dirty billing, document-processing, matter-lifecycle,
database, and proof files. This proof covers only the paths listed above.
