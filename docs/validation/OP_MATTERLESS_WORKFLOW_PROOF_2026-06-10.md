# OP Matterless Workflow Proof - 2026-06-10

## Scope

This branch makes Open Practice usable before any matter exists. It adds standalone contacts,
contact-first matter creation, firm/client-scoped calendar events and dashboard reminders, and a
zero-matter dashboard path where contacts and calendar are real work surfaces while matter-bound
sections open with useful firm/status context and create/link matter actions.

Matter-only boundaries stay intact for this slice: attendees, invitations, hosted guest sessions,
meeting links, iCalendar/CalDAV export, public links, and email reminder delivery remain available
only for matter-scoped events. Audit metadata records safe IDs, counts, status, and scope only.

## Changed Paths

- `apps/api/src/routes/calendar.test.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/calendar/guest-sessions.ts`
- `apps/api/src/routes/calendar/reminders.ts`
- `apps/api/src/routes/calendar/shared.ts`
- `apps/api/src/routes/contacts.test.ts`
- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/matters.test.ts`
- `apps/api/src/routes/matters.ts`
- `apps/api/src/routes/operational-views.ts`
- `apps/web/app/_features/calendar/models.ts`
- `apps/web/app/_features/calendar/server-resources.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-model.test.ts`
- `apps/web/app/calendar-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard-utils.ts`
- `apps/web/app/dashboard/calendar-section.test.tsx`
- `apps/web/app/dashboard/calendar-section.tsx`
- `apps/web/app/dashboard/contacts-section.tsx`
- `apps/web/app/dashboard/dashboard-shell.test.tsx`
- `apps/web/app/styles/40-public-forms-intake-share.css`
- `apps/web/routes/routeCatalog.test.ts`
- `apps/web/routes/routeCatalog.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md`
- `output/playwright/matterless-open-practice/calendar-desktop.png`
- `output/playwright/matterless-open-practice/calendar-mobile.png`
- `output/playwright/matterless-open-practice/contacts-desktop.png`
- `output/playwright/matterless-open-practice/contacts-mobile.png`
- `output/playwright/matterless-open-practice/screenshot-results.json`
- `packages/database/migrations/0052_matterless_contacts_calendar.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/calendar-events-contracts.ts`
- `packages/database/src/repository/calendar-events/drizzle.ts`
- `packages/database/src/repository/calendar-events/memory.ts`
- `packages/database/src/repository/contacts-contracts.ts`
- `packages/database/src/repository/contacts/drizzle.ts`
- `packages/database/src/repository/contacts/memory.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/matter-lifecycle-contracts.ts`
- `packages/database/src/repository/matter-lifecycle/drizzle.ts`
- `packages/database/src/repository/matter-lifecycle/memory.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema/calendar.ts`
- `packages/database/src/schema/contacts.ts`
- `packages/domain/src/calendar-models.ts`
- `packages/domain/src/calendar.ts`
- `packages/domain/src/contacts.test.ts`
- `packages/domain/src/contacts.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/models.ts`
- `packages/domain/src/operational-views.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/sample-data.ts`
- `scripts/route-authorization-manifest.mjs`

## Review Notes

- API/database review covered schema, repository, authorization, and audit seams. Follow-up fixes
  kept linked hidden-matter contacts out of staff standalone visibility, preserved matter-only
  attendee/guest-session/export behavior, added scope-aware reminder/event matching, and kept
  matterless email reminder delivery disabled.
- UI/UX review covered the no-matter dashboard flow. Follow-up fixes enabled Contacts and Calendar
  as real zero-matter surfaces, showed linked matters at a glance, added create-contact and
  create-matter-from-contact actions, added firm/client calendar scope controls, and replaced the
  old global First Matter fallback with section-specific create/link matter actions.

## Validation

- `pnpm verify:select -- --files <final changed paths>` passed and recommended the broad
  domain/database/API/web/docs/build gate set for this cross-package slice.
- `pnpm format:check` passed after targeted Prettier formatting for dashboard utility/test files,
  the API contract doc, and the screenshot result JSON.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm test` passed, including all workspace test tasks and 63 script contract tests.
- `pnpm --filter @open-practice/domain test` passed: 24 files, 173 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database test` passed: 18 files, 110 tests.
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed.
- `pnpm --filter @open-practice/database build` passed.
- `pnpm --filter @open-practice/providers test` passed: 7 files, 18 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 36 tests.
- `pnpm --filter @open-practice/api test` passed: 41 files, 505 tests, including focused coverage
  for firm/client-scoped matterless events, hidden contact denial, disabled matterless reminder
  email delivery, and contact-first matter creation from visible standalone contacts.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/web test` passed: 34 files, 174 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed.
- `git diff --check` passed.

## Browser Proof

Playwright proof used a local memory-backed API and web app with synthetic setup data and no first
matter. The browser script completed setup without a first matter, confirmed `/api/matters`
returned an empty list, created a standalone contact, created firm and client calendar events,
created a dashboard reminder for the client event, and captured contacts/calendar desktop and mobile
views.

Screenshots:

- `output/playwright/matterless-open-practice/contacts-desktop.png`
- `output/playwright/matterless-open-practice/calendar-desktop.png`
- `output/playwright/matterless-open-practice/contacts-mobile.png`
- `output/playwright/matterless-open-practice/calendar-mobile.png`
- `output/playwright/matterless-open-practice/screenshot-results.json`

The screenshot result JSON records zero console errors for Contacts and Calendar. Local
cookie/session setup artifacts were removed from the proof folder and are not part of the tracked
proof.

## Skipped Or Unavailable

No required focused checks were skipped. Browser proof used direct local API/Web processes instead
of the worker runtime because this slice does not require Redis-backed worker execution.

## Synthetic Data

Tests and browser proof use synthetic data only, including `Matterless Proof Law`, `Avery Owner`,
`avery@example.test`, `Synthetic Client Cooperative`, `Synthetic firm planning block`, and
`Synthetic client intake call`.
