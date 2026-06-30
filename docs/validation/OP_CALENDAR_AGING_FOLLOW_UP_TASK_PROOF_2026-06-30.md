# Calendar Aging Follow-Up Task Proof

Date: 2026-06-30
Branch: `feat/calendar-aging-follow-up-task-20260630`

## Scope

This slice adds one explicit staff action that creates one normal internal task from the latest
eligible calendar-aging decision with `follow_up_required`.

All examples, tests, and proof data are synthetic. The privacy boundary for this slice is that task
content and audit metadata stay operational and redacted, with no client-identifying source text or
provider payload copied into generated task records.

Eligible source records are limited to:

- Appointment booking requests that remain `tentative_hold`, have complete aging-review decision
  metadata, and are scoped to the requested matter.
- Calendar scheduling requests that remain `needs_review`, have complete aging-review decision
  metadata, and are scoped to the requested matter.

Matterless appointment holds are excluded because task creation must remain matter-scoped.

## Implementation Notes

- `POST /api/tasks/calendar-aging-follow-up` accepts `{ matterId }`.
- The route requires staff access plus existing matter-scoped `task:create` authorization.
- Source lookups are limited to the requested matter.
- Existing tasks with `sourceType: "calendar_scheduling"` and the same source ID make that source
  ineligible.
- The created task is unassigned, high priority, internal-only task data with
  `sourceType: "calendar_scheduling"` and `sourceId` set to the selected source record ID.
- The generated title and body are fixed redacted operational copy. They do not include client
  names, request titles, source labels, requested times, provider payloads, meeting links, tokens,
  or notes.
- Public booking and portal responses continue to omit aging-review decisions.

## Preserved Boundaries

This slice does not auto-confirm appointment holds, auto-expire requests, sync providers, queue
reminders, create public rooms, add native media/chat/recording, or create matters.

It also does not mark scheduling requests reviewed, link calendar events, cancel reminders, create
time entries, add dependencies, assign users, add comments, apply templates, or ask the browser to
generate task title/body content.

## Changed Paths

```text
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP_CALENDAR_AGING_FOLLOW_UP_TASK_PROOF_2026-06-30.md
docs/validation/README.md
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/tasks.test.ts
packages/domain/src/tasks.ts
scripts/route-authorization-manifest.mjs
```

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP_CALENDAR_AGING_FOLLOW_UP_TASK_PROOF_2026-06-30.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
```

Result: Passed. Recommended `architecture:check`, `api:contract`, format/docs/policy checks,
domain/API/web package checks, and `pnpm build`.

Selector output evidence:

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
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Suite scope notes:

- `pnpm test`: skipped because this branch changed a bounded calendar/task slice and the selected
  package/domain/repository/API/web tests below exercise the touched surfaces directly.
- `pnpm --filter @open-practice/api test`: skipped because the focused task, calendar, and
  appointment-booking API route tests below cover the changed route and adjacent calendar-aging
  behavior without running unrelated API suites.
- `pnpm --filter @open-practice/providers test`: skipped because no provider package source or
  provider behavior changed; provider build was run to supply linked package outputs for API
  typecheck/build.
- `pnpm --filter @open-practice/worker test`: skipped because this branch does not add jobs,
  queues, provider sync, reminder queueing, or worker behavior.
- `pnpm --filter @open-practice/web test`: skipped because the focused Calendar, appointment
  booking panel, Tasks section, and dashboard-client web tests below cover the changed dashboard
  action and task refresh behavior.

Focused domain checks:

```bash
pnpm --filter @open-practice/domain test -- src/tasks.test.ts src/review-aging.test.ts src/appointment-booking.test.ts src/calendar.test.ts src/audit-taxonomy.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
```

Result: Passed. The focused domain test command reported 33 files and 282 tests passed; typecheck
and build passed.

Repository checks:

```bash
pnpm --filter @open-practice/database test -- test/repository.tasks-structure.test.ts test/repository.calendar.test.ts test/repository.appointment-booking.test.ts test/repository.calendar-aging-review.test.ts
pnpm --filter @open-practice/database typecheck
```

Result: Passed. The focused repository test command reported 29 files and 167 tests passed;
typecheck passed.

API checks:

```bash
pnpm --dir apps/api exec vitest run src/routes/tasks.test.ts src/routes/calendar.test.ts src/routes/appointment-booking.test.ts
pnpm --filter @open-practice/api typecheck
```

Result: Passed. The focused API test command reported 3 files and 66 tests passed. API typecheck
passed after building linked workspace package outputs. An earlier pre-build run failed to resolve
the linked database package in the fresh worktree; the rerun after package build passed.

Web checks:

```bash
pnpm --filter @open-practice/web exec vitest run app/dashboard/calendar-section.test.tsx app/dashboard/appointment-booking-panel.test.tsx app/dashboard/tasks-section.test.tsx app/dashboard-client.test.ts
pnpm --filter @open-practice/web typecheck
```

Result: Passed. The focused web test command reported 4 files and 89 tests passed; typecheck
passed.

Route and architecture checks:

```bash
pnpm api:contract
pnpm architecture:check
```

Result: Passed. `pnpm api:contract` generated the local contract inventory with 347 paths.
`pnpm architecture:check` passed with 466 workspace import edges reviewed.

Policy, docs, and build proof:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm build
pnpm proof:reconcile -- --proof docs/validation/OP_CALENDAR_AGING_FOLLOW_UP_TASK_PROOF_2026-06-30.md --files apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP_CALENDAR_AGING_FOLLOW_UP_TASK_PROOF_2026-06-30.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
git diff --check
```

Result:

- `pnpm format:check`: Passed after formatting touched files.
- `pnpm docs:check`: Passed.
- `pnpm policy:check`: Failed at the existing OSS reuse/reference-lock drift after tracked-secret,
  package-manifest, lockfile supply-chain, toolchain, env-surface, architecture, deadcode, migration
  parity, and migration lint subchecks passed. The failing lock entries were the pre-existing
  central reference index drift for activepieces, fineract, cal.com, civicrm-core, documenso,
  docuseal, jitsi-meet, j-lawyer-org, kimai, ledgersmb, midaz, nextcloud server, opencontracts,
  opencollective, openfga, paperless-ngx, temporal, unstructured, and zulip.
- Because `pnpm policy:check` stopped at OSS reuse, `node scripts/validate-validation-proof-index.mjs`
  and `node scripts/validate-open-practice-boundaries.mjs` were run directly afterward. Both passed;
  route authorization manifest coverage is checked through the Open Practice boundary validator.
- `pnpm build`: Passed.
- `pnpm proof:reconcile`: Passed after this proof note update.
- `git diff --check`: Passed.
