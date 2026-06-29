# Calendar Aging Review Decisions Proof - 2026-06-29

## Scope

Branch: `feat/calendar-aging-review-decisions-20260629`

This proof covers the staff-only review decision layer for aging/stale appointment booking
tentative holds and calendar scheduling requests. Decisions are enum-only:
`acknowledged`, `follow_up_required`, or `defer_review`.

The shipped posture is review-only:

- Appointment aging decisions require the request to remain `tentative_hold` and the current cue to
  be `aging` or `stale`.
- Calendar scheduling aging decisions require the request to remain `needs_review`, the current cue
  to be `aging` or `stale`, and the caller to have matter-scoped calendar update access.
- The latest decision is stored on the source row; audit events provide append-only history.
- Public booking, portal booking, and public runner responses omit aging-review decisions.

## Preserved Non-Goals

The decision layer does not confirm, dismiss, schedule, expire, sync providers, create public rooms,
add native media, add chat, add recording, create tasks, queue reminders, or create matters.

Audit metadata is limited to safe IDs, enum decision, cue status/age, and fixed false boundary
flags. It does not include requester contact details, tokens, titles, source labels, raw dates,
provider payloads, meeting URLs, notes, public-room data, or private audit context.

All examples, tests, and proof evidence use synthetic data only and preserve the existing
matter-scoped privacy boundary.

## Final Changed Paths

- `apps/api/src/routes/appointment-booking.test.ts`
- `apps/api/src/routes/appointment-booking.ts`
- `apps/api/src/routes/calendar.test.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/web/app/calendar-dashboard.test.ts`
- `apps/web/app/calendar-dashboard.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/appointment-booking-panel.test.tsx`
- `apps/web/app/dashboard/appointment-booking-panel.tsx`
- `apps/web/app/dashboard/calendar-section.test.tsx`
- `apps/web/app/dashboard/calendar-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_CALENDAR_AGING_REVIEW_DECISIONS_PROOF_2026-06-29.md`
- `docs/validation/README.md`
- `packages/database/migrations/0075_calendar_aging_review_decisions.sql`
- `packages/database/migrations/meta/0075_snapshot.json`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/appointment-booking-contracts.ts`
- `packages/database/src/repository/appointment-booking/drizzle.ts`
- `packages/database/src/repository/appointment-booking/mappers.ts`
- `packages/database/src/repository/appointment-booking/memory.ts`
- `packages/database/src/repository/calendar-aging-review.test.ts`
- `packages/database/src/repository/calendar-events-contracts.ts`
- `packages/database/src/repository/calendar-events/drizzle.ts`
- `packages/database/src/repository/calendar-events/memory.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema/appointment-booking.ts`
- `packages/database/src/schema/calendar.ts`
- `packages/database/src/seed.ts`
- `packages/domain/src/appointment-booking.test.ts`
- `packages/domain/src/appointment-booking.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/calendar.test.ts`
- `packages/domain/src/calendar.ts`
- `packages/domain/src/models.ts`
- `packages/domain/src/review-aging.test.ts`
- `packages/domain/src/review-aging.ts`
- `scripts/route-authorization-manifest.mjs`

## Selector Output

`pnpm verify:select -- --files <final path set>`:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                 | Result                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm architecture:check`                                                                               | Pass                                            | 462 workspace import edges reviewed.                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm api:contract`                                                                                     | Pass                                            | API contract inventory generated with 344 paths.                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm format:check`                                                                                     | Pass                                            | All matched files use Prettier code style.                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm docs:check`                                                                                       | Pass                                            | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm policy:check`                                                                                     | Failed (reason: unrelated reference lock drift) | Security scan, package manifests, supply-chain, toolchain, env surface, architecture, deadcode, migration parity, and migration lint completed first; `validate-oss-reuse.mjs` then failed because existing OSS lock commits do not match the central reference index for 21 reference repositories. This lane added no dependencies, copied excerpts, vendored assets, or reference-derived code. |
| `pnpm test`                                                                                             | Pass                                            | Turbo package tests plus script tests passed; includes 33 domain files/271 tests, 29 database files/163 tests, 43 API files/625 tests, 13 provider files/37 tests, 6 worker files/54 tests, 46 web files/245 tests, and 182 script tests.                                                                                                                                                          |
| `pnpm --filter @open-practice/domain test`                                                              | Pass                                            | 33 files, 271 tests.                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/domain typecheck`                                                         | Pass                                            | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/domain build`                                                             | Pass                                            | `tsc -p tsconfig.build.json`.                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/database test`                                                            | Pass                                            | 29 files, 163 tests.                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/database db:check`                                                        | Pass                                            | Drizzle schema check passed.                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm migrations:check`                                                                                 | Pass                                            | 76 SQL files match 76 journal entries.                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm migrations:lint`                                                                                  | Pass                                            | Stock lint passed and reported 0 changed SQL files because the new migration is untracked before commit.                                                                                                                                                                                                                                                                                           |
| `node --input-type=module -e 'import { lintMigrationFiles } from "./scripts/lint-migrations.mjs"; ...'` | Pass                                            | Direct migration lint reviewed `packages/database/migrations/0075_calendar_aging_review_decisions.sql` and found no destructive SQL or unsafe not-null additions.                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/database typecheck`                                                       | Pass                                            | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/database build`                                                           | Pass                                            | `tsc -p tsconfig.build.json`.                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/api test`                                                                 | Pass                                            | 43 files, 625 tests. Initial fresh-worktree run failed until `@open-practice/providers` was built; rerun passed.                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/api typecheck`                                                            | Pass                                            | Initial fresh-worktree run failed until `@open-practice/providers` was built; rerun passed.                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/providers test`                                                           | Pass                                            | 7 source files/21 tests before build; broad `pnpm test` also ran dist/source provider tests after build.                                                                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/worker test`                                                              | Pass                                            | 6 files, 54 tests. Initial fresh-worktree run failed until `@open-practice/providers` was built; rerun passed.                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/web test`                                                                 | Pass                                            | 46 files, 245 tests.                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/web typecheck`                                                            | Pass                                            | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm build`                                                                                            | Pass                                            | Turbo build completed for all 6 packages, including Next.js production build.                                                                                                                                                                                                                                                                                                                      |
| `node scripts/validate-validation-proof-index.mjs`                                                      | Pass                                            | Validation proof index check passed after adding this proof note.                                                                                                                                                                                                                                                                                                                                  |
| `node scripts/validate-open-practice-boundaries.mjs`                                                    | Pass                                            | Open Practice boundary policy passed.                                                                                                                                                                                                                                                                                                                                                              |
