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
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/matters.test.ts`
- `apps/api/src/routes/matters.ts`
- `apps/api/src/routes/operational-views.ts`
- `apps/api/src/server.test.ts`
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
- `e2e/helpers/e2e-fixtures.ts`
- `e2e/ui-ux.spec.ts`
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
- `packages/database/src/seed.ts`
- `packages/domain/src/calendar-models.ts`
- `packages/domain/src/calendar.ts`
- `packages/domain/src/contacts.test.ts`
- `packages/domain/src/contacts.ts`
- `packages/domain/src/intake-pipeline.ts`
- `packages/domain/src/models.ts`
- `packages/domain/src/operational-views.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/sample-data.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/run-e2e.mjs`

## Review Notes

- API/database review covered schema, repository, authorization, and audit seams. Follow-up fixes
  kept linked hidden-matter contacts out of staff standalone visibility, preserved matter-only
  attendee/guest-session/export behavior, added scope-aware reminder/event matching, and kept
  matterless email reminder delivery disabled.
- UI/UX review covered the no-matter dashboard flow. Follow-up fixes enabled Contacts and Calendar
  as real zero-matter surfaces, showed linked matters at a glance, added create-contact and
  create-matter-from-contact actions, added firm/client calendar scope controls, and replaced the
  old global First Matter fallback with section-specific create/link matter actions.
- E2E review added matterless deep-link coverage and moved the local runner to a non-watch API
  process plus managed web readiness/restart handling for host and Docker browser proof. The final
  follow-up fixed browser navigation for public-token pages to use canonical hash URLs while
  preserving header-token API helpers.

## Validation

- Original 2026-06-10 proof: `pnpm verify:select -- --files <final changed paths>` passed and recommended the broad
  host/Docker E2E plus domain/database/API/web/docs/build gate set for this cross-package slice.
- `pnpm format:check` passed after targeted Prettier formatting for dashboard utility/test files,
  the API contract doc, and the screenshot result JSON.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm test` passed, including all workspace test tasks and 63 script contract tests.
- `pnpm e2e:host` passed: 33 tests passed, 7 skipped.
- `pnpm e2e:docker` passed: 5 tests passed, with Compose services and volumes cleaned up.
- `pnpm --filter @open-practice/domain test` passed: 24 files, 174 tests.
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
- `pnpm --filter @open-practice/web test` passed: 34 files, 177 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed.
- `git diff --check` passed.

### Final Review Audit - 2026-06-11

- `git status --short --branch` started clean on `codex/matterless-open-practice-2026-06-10`.
- `git diff --name-only origin/main...HEAD` returned 66 paths. The proof changed-path list matched
  exactly: `missing: []`, `extra: []`.
- The tracked screenshot files and `screenshot-results.json` were present locally and in the branch
  delta. The JSON still references the four expected Contacts/Calendar desktop/mobile screenshots
  and records zero console errors.
- `pnpm verify:select -- --files $(git diff --name-only origin/main...HEAD)` passed and selected
  the same broad host/Docker E2E plus domain/database/API/web/docs/build gate set.
- `pnpm e2e:host` rerun failed: 27 passed, 5 skipped, and 8 failed. Failures included
  `e2e/ui-ux.spec.ts` dashboard-section coverage timing out or losing web readiness across browser
  projects; earlier attempts also exposed stale local API/web listeners on the default host ports.
- `pnpm e2e:docker` rerun failed: 4 passed and 1 failed. The failure was
  `[docker-chromium] e2e/ui-ux.spec.ts:321`, where `/external-uploads/<synthetic-token>` rendered
  the Next 404 page instead of the external upload receipt surface. Compose services, volumes, and
  the temporary E2E database were cleaned up. Failure artifacts were written under
  `test-results/e2e/ui-ux-UI-UX-screenshot-QA--b0d7a-eceipt-layout-stable-docker-docker-chromium/`.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
  `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`,
  `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`,
  `pnpm migrations:check`, `pnpm --filter @open-practice/database typecheck`,
  `pnpm --filter @open-practice/database build`, `pnpm --filter @open-practice/api test`,
  `pnpm --filter @open-practice/api typecheck`, `pnpm --filter @open-practice/providers test`,
  `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/web test`,
  `pnpm --filter @open-practice/web typecheck`, and `pnpm build` passed.

### Final Review Follow-up - 2026-06-11

- Public-token browser navigations now use the canonical hash URL shape through
  `OpenPracticeE2EClient.publicTokenUrl(path, token)`, including share links, intake forms, guest
  sessions, and external uploads. Header-token API calls continue to use the existing API helper
  paths; public API response shapes, token hashing, and token storage are unchanged.
- The final changed-path set, combining `git diff --name-only origin/main...HEAD` with the local
  E2E/proof follow-up diff, contains 68 unique paths.
- `pnpm verify:select -- --files $(git diff --name-only origin/main...HEAD) $(git diff --name-only)`
  passed and selected the same broad host/Docker E2E plus domain/database/API/web/docs/build gate
  set.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
  `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`,
  `pnpm --filter @open-practice/database test`, `pnpm --filter @open-practice/database db:check`,
  `pnpm migrations:check`, `pnpm --filter @open-practice/database typecheck`,
  `pnpm --filter @open-practice/database build`, `pnpm --filter @open-practice/api test`,
  `pnpm --filter @open-practice/api typecheck`, `pnpm --filter @open-practice/providers test`,
  `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/web test`,
  `pnpm --filter @open-practice/web typecheck`, and `pnpm build` passed.
- `pnpm e2e:host` passed: 33 tests passed and 7 skipped.
- `pnpm e2e:docker` first found the local Docker daemon unavailable at
  `/Users/bryan/.docker/run/docker.sock`; after starting Docker, the rerun passed with 5 tests
  passed and Compose cleanup completed. The previous external-upload 404 did not reproduce.

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

No required focused checks were skipped. The standalone browser screenshots used direct local
API/Web processes with synthetic memory-backed data. Docker was initially unavailable during the
final follow-up, then started successfully; the selected Docker E2E gate was rerun and passed.

## Synthetic Data

Tests and browser proof use synthetic data only, including `Matterless Proof Law`, `Avery Owner`,
`avery@example.test`, `Synthetic Client Cooperative`, `Synthetic firm planning block`, and
`Synthetic client intake call`.
