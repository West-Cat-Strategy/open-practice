# OP-T161 Calendar Tickler Review Bridge Proof

Date: 2026-06-26 PDT

## Scope

This branch-first follow-up extends the existing calendar scheduling-request review layer so staff
can create review-only tickler cues from task/deadline rows and pending dashboard reminder rows.

- `POST /api/calendar/scheduling-requests` keeps its response shape and rejects duplicate open
  review requests for the same active task, event, reminder, or source link with
  `409 CALENDAR_SCHEDULING_REQUEST_DUPLICATE`.
- Web calendar helpers build typed scheduling-request payloads for task-deadline, calendar-event,
  calendar-reminder, and manual review sources.
- The dashboard creates scheduling requests through the existing endpoint, upserts the returned
  request, refreshes the task workbench, and shares the scheduling-review busy/status surface.
- Calendar reminder rows and Tasks rows expose review-request actions only when staff matter context
  and duplicate-open-request state allow it.

## Boundaries Preserved

- No new table, migration, dependency, public booking, provider sync, court-rule automation, or
  automatic event/task/reminder mutation.
- Ticklers are metadata-only scheduling-request review records over existing task deadlines,
  calendar events, and dashboard reminders.
- Review outcomes remain `reviewed`, `dismissed`, or `scheduled` by linking an existing same-matter,
  non-cancelled event.
- Synthetic data only; no client, matter, credential, payment, private deployment, provider payload,
  or raw reminder-note evidence was added.

## OP-T161-Owned Path Set

- `apps/api/src/routes/calendar.test.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/web/app/calendar-dashboard.test.ts`
- `apps/web/app/calendar-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/calendar-section.test.tsx`
- `apps/web/app/dashboard/calendar-section.tsx`
- `apps/web/app/dashboard/tasks-section.test.tsx`
- `apps/web/app/dashboard/tasks-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md`
- `docs/validation/README.md`

## Validation Selection

Initial selector command:

```sh
pnpm verify:select -- --files apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar.ts apps/web/app/calendar-dashboard.test.ts apps/web/app/calendar-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx
```

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

The fresh sibling worktree needed upstream workspace builds before package entrypoints resolved:

```sh
pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build
```

Result: passed.

## Focused Validation

```sh
pnpm --filter @open-practice/api exec vitest run src/routes/calendar.test.ts
```

Result: passed. `42` tests passed.

```sh
pnpm --filter @open-practice/web exec vitest run app/calendar-dashboard.test.ts app/dashboard/calendar-section.test.tsx app/dashboard/tasks-section.test.tsx app/dashboard-client.test.ts
```

Result: passed. `4` test files and `89` tests passed.

```sh
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
```

Result: passed.

## Final Validation

Final selector command:

```sh
pnpm verify:select -- --files docs/validation/OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar.ts apps/web/app/calendar-dashboard.test.ts apps/web/app/calendar-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md
```

Result: passed. Recommended validation remained:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Executed commands:

```sh
pnpm --filter @open-practice/api test
```

Result: passed. `42` test files and `603` tests passed.

```sh
pnpm --filter @open-practice/web test
```

Result: passed. `44` test files and `233` tests passed.

```sh
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
```

Result: passed.

```sh
pnpm api:contract
pnpm architecture:check
pnpm docs:check
pnpm format:check
git diff --check
```

Result: passed. API contract inventory wrote `.tmp/api-contract/openapi.json` with `310` paths;
architecture reviewed `449` workspace import edges.

```sh
pnpm policy:check
```

Result: passed. Policy checks covered tracked secrets, package manifest policy, lockfile supply
chain, toolchain/env surface, architecture, dead-code, migrations, OSS reuse, doc links, validation
proof index, local evidence Docker ignore, and Open Practice boundaries.

```sh
pnpm build
```

Result: passed. Turbo built all `6` workspace packages.
