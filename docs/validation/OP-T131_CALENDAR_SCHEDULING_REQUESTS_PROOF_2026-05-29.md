# OP-T131 Calendar Scheduling Requests Proof - 2026-05-29

## Scope

OP-T131 adds the first calendar deadline and scheduling-depth slice as persistent, read-only
`calendar_scheduling_requests` records.

The slice stores reviewed scheduling/deadline request posture with matter-scoped links to existing
task deadlines, calendar events, optional dashboard reminders, source labels, owner assignment,
privacy, and bounded time-capture cues. `GET /api/calendar/events?matterId=` now includes safe
`schedulingRequests` summaries for the requested matter, and the Calendar dashboard renders those
rows before Event lifecycle controls.

## Boundaries

- No write API for scheduling requests in this slice.
- No court-rule automation, provider calendar sync, public room URLs, meeting media, automatic
  deadline creation, automatic reminder cancellation, delivery queueing, or time-entry creation.
- Review posture is metadata-only through explicit `reviewBoundary` flags.
- Scheduling request summaries omit reminder notes, attendee emails, meeting URLs, time narratives,
  raw source payloads, provider metadata, hidden matters, private audit metadata, and private
  document/client content.
- Time-capture cues are bounded to posture/count/minute suggestions and are redacted when the caller
  cannot read time entries.

## Changed Paths

- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/calendar.test.ts`
- `apps/web/app/calendar-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/test/repository.calendar.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/calendar.test.ts`
- `packages/domain/src/calendar.ts`
- `packages/domain/src/models.ts`
- `packages/domain/src/sample-data.ts`
- `docs/validation/OP-T131_CALENDAR_SCHEDULING_REQUESTS_PROOF_2026-05-29.md`
- `packages/database/migrations/0041_calendar_scheduling_requests.sql`

## Validation

Fresh-worktree setup note: focused API/database checks needed the standard package build prep after
domain and database exports changed.

- `pnpm --filter @open-practice/domain build` - passed.
- `pnpm --filter @open-practice/database build` - passed.
- Focused smokes while replacing the initial task-workbench draft with the persistent Calendar seam:
  - `pnpm --filter @open-practice/domain exec vitest run src/calendar.test.ts src/tasks.test.ts` -
    passed, 2 files / 12 tests.
  - `pnpm --filter @open-practice/database exec vitest run test/schema.test.ts test/repository.calendar.test.ts` -
    passed after rebuilding domain exports, 2 files / 42 tests.
  - `pnpm --filter @open-practice/api exec vitest run src/routes/calendar.test.ts src/routes/tasks.test.ts` -
    passed after rebuilding database exports, 2 files / 29 tests.
  - `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts` - passed,
    1 file / 65 tests.
- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)` -
  recommended format/docs/policy, domain/database/API/web tests and typechecks, database
  `db:check`, `pnpm migrations:check`, provider/worker tests, and `pnpm build`.
- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed, including migration parity, OSS reuse, docs links, and route
  boundary policy.
- `pnpm --filter @open-practice/domain test` - passed, 21 files / 139 tests.
- `pnpm --filter @open-practice/domain typecheck` - passed.
- `pnpm --filter @open-practice/database test` - passed, 15 files / 83 tests.
- `pnpm --filter @open-practice/database db:check` - passed.
- `pnpm migrations:check` - passed, 42 SQL files match 42 journal entries.
- `pnpm --filter @open-practice/database typecheck` - passed.
- `pnpm --filter @open-practice/api test` - passed, 38 files / 404 tests. Expected negative-path
  API logs appeared during the suite.
- `pnpm --filter @open-practice/api typecheck` - passed.
- `pnpm --filter @open-practice/providers test` - passed, 5 files / 15 tests.
- `pnpm --filter @open-practice/worker test` - passed, 3 files / 23 tests.
- `pnpm --filter @open-practice/web test` - passed, 14 files / 119 tests.
- `pnpm --filter @open-practice/web typecheck` - passed.
- `pnpm build` - passed, 6 packages.
- `git diff --check` - passed.
