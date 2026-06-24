# Video Meetings Control-Plane Proof - 2026-06-23

## Scope

- Branch: `feat/video-meetings-control-plane-20260623`
- Worktree: `/Users/bryan/projects/open-practice-video-meetings-control-plane-20260623`
- Surface: Calendar workspace scheduling review/readiness controls, public guest-session refresh,
  CalDAV/iCalendar meeting-link non-disclosure, guest-session conflict hardening, and safe audit
  metadata.

## Implemented Boundary

- Calendar workspace staff can review scheduling requests through the existing
  `PATCH /api/calendar/scheduling-requests/:requestId/review` route with `reviewed`, `dismissed`,
  and `scheduled` decisions.
- `scheduled` decisions require an explicitly selected existing same-matter, non-cancelled event.
  If the request references `calendarReminderId`, the selected event must be the event that owns the
  reminder; otherwise the API returns `409 CALENDAR_REMINDER_EVENT_MISMATCH`. The UI and API do not
  create, reschedule, cancel, enqueue, sync, send invitations, or create time entries from review
  actions.
- Matterless calendars keep scheduling requests display-only and render explicit next-step copy for
  matter-required, no-eligible-event, event-not-selected, and already-reviewed states.
- Calendar events show safe readiness labels for invitation handoff, hosted-lobby readiness,
  attendee presence, saved meeting-link posture, guest access, lobby state, and invitation-email
  boundary status. The strip includes blocker counts without rendering stored meeting URLs, raw
  guest tokens, token hashes, attendee emails, invitation bodies, room IDs, or provider secrets.
- Public guest-session pages include a manual `Refresh` control, safe last-checked timestamp, and
  waiting-only 30-second polling that stops for admitted, denied, revoked, expired, or ended states.
  Host E2E checks in publicly, admits through the staff/API helper, clicks refresh, and verifies
  admitted status without `page.reload()`.
- Guest-session token transport remains header-token and legacy path-token compatible. Mismatched
  header-plus-path tokens return generic `404 GUEST_SESSION_NOT_FOUND` before lookup. Staff and
  public attempts against ended sessions, expired or revoked links, or terminal guest states return
  `409 GUEST_SESSION_TRANSITION_UNAVAILABLE` without raw token, meeting URL, matter title, or count
  disclosure.
- CalDAV `GET`/`REPORT` and matter `.ics` feeds do not emit stored meeting URLs, room IDs, provider
  keys, raw tokens, token hashes, or guest-session state. CalDAV `PUT` preserves existing Open
  Practice meeting-link fields and ignores inbound meeting-like URL/conference properties.
- Audit taxonomy now classifies calendar event updates, invitation queue/skip events, meeting
  sessions, and guest links using safe IDs, statuses, booleans, counts, timestamps, and boundary
  labels only. Tests reject raw meeting URL, token, token hash, attendee email, and invitation body
  metadata keys.
- The internal invitation helper naming now describes boundary-only metadata behavior rather than
  token issuance; public response shapes stay unchanged.
- No native media, signaling, chat, recordings, uploads, public booking pages, provider sync, new
  dependencies, migrations, database tables, or external integrations were added.
- All examples and tests use synthetic data only. This branch does not add or expose real client,
  matter, credential, payment, private deployment, raw provider payload, settlement, trust-posting,
  or confidential audit details.

## Final Changed Paths

```text
apps/api/src/routes/caldav.test.ts
apps/api/src/routes/caldav.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/calendar/feed.ts
apps/api/src/routes/calendar/guest-sessions.ts
apps/api/src/routes/calendar/invitations.ts
apps/web/app/_features/calendar/models.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/guest-sessions/GuestSessionRunner.tsx
apps/web/app/guest-sessions/runner-utils.test.ts
apps/web/app/guest-sessions/runner-utils.ts
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md
docs/validation/README.md
e2e/host.spec.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
```

## Selector

Final selector command:

```sh
pnpm verify:select -- --files docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md apps/api/src/routes/caldav.test.ts apps/api/src/routes/caldav.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/feed.ts apps/api/src/routes/calendar/guest-sessions.ts apps/api/src/routes/calendar/invitations.ts apps/web/app/_features/calendar/models.ts apps/web/app/calendar-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/guest-sessions/GuestSessionRunner.tsx apps/web/app/guest-sessions/runner-utils.test.ts apps/web/app/guest-sessions/runner-utils.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md e2e/host.spec.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts
```

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
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

Result: selector passed and produced the command set above for the final 23-path set.

## Validation Results

- `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts` - Pass; 1 file
  and 34 tests passed.
- `pnpm --filter @open-practice/api exec vitest run src/routes/calendar.test.ts src/routes/caldav.test.ts` -
  Pass; 2 files and 48 tests passed.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/dashboard/calendar-section.test.tsx app/guest-sessions/runner-utils.test.ts` -
  Pass; 3 files and 89 tests passed.
- `pnpm architecture:check` - Pass; 443 workspace import edges reviewed.
- `pnpm api:contract` - Pass; generated ignored OpenAPI inventory under `.tmp/api-contract` with
  310 paths.
- Initial `pnpm format:check` - Failed on Prettier drift in `apps/web/app/calendar-dashboard.ts`
  and `docs/validation/README.md`.
- `pnpm exec prettier --write apps/web/app/calendar-dashboard.ts docs/validation/README.md` -
  Pass.
- `pnpm format:check` after formatting - Pass.
- `pnpm docs:check` - Pass.
- `pnpm policy:check` - Pass.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/domain test` - Pass; 31 files and 241 tests passed.
- `pnpm --filter @open-practice/database build` - Pass; hydrated downstream build output.
- `pnpm --filter @open-practice/providers build` - Pass.
- `pnpm --filter @open-practice/providers test` - Pass; 11 files and 23 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 5 files and 46 tests passed.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/api test` - Pass; 42 files and 585 tests passed.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- `pnpm --filter @open-practice/web test` - Pass; 41 files and 224 tests passed.
- `pnpm build` - Pass; six package build tasks succeeded, including Next.js production build.
- `pnpm e2e:host` - Pass; 36 Playwright checks passed in about 3.0 minutes.
- `pnpm e2e:a11y` - Pass; 2 rendered accessibility checks passed in 11.6 seconds.
- `pnpm e2e:matterless` - Pass; 2 screenshot QA checks passed in 8.7 seconds.
- `node scripts/run-e2e.mjs first-run` - Pass; 1 first-run setup check passed in 13.0 seconds.
- `pnpm e2e:client-portal` - Pass; 2 client-portal checks passed in 4.0 seconds.

## Checks Not Run

- `pnpm e2e:docker` skipped. Reason: the selector recommended it because an E2E host spec changed,
  but the final implementation did not touch Docker, container, database schema, migration,
  provider runtime, dependency, or external integration paths.

## Post-Proof Reconciliation Commands

To run after this proof/index/planning update:

```sh
pnpm verify:select -- --files docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md apps/api/src/routes/caldav.test.ts apps/api/src/routes/caldav.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/feed.ts apps/api/src/routes/calendar/guest-sessions.ts apps/api/src/routes/calendar/invitations.ts apps/web/app/_features/calendar/models.ts apps/web/app/calendar-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/guest-sessions/GuestSessionRunner.tsx apps/web/app/guest-sessions/runner-utils.test.ts apps/web/app/guest-sessions/runner-utils.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md e2e/host.spec.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts
pnpm proof:reconcile -- --proof docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md --files docs/validation/OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md apps/api/src/routes/caldav.test.ts apps/api/src/routes/caldav.ts apps/api/src/routes/calendar.test.ts apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/feed.ts apps/api/src/routes/calendar/guest-sessions.ts apps/api/src/routes/calendar/invitations.ts apps/web/app/_features/calendar/models.ts apps/web/app/calendar-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/calendar-section.test.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/guest-sessions/GuestSessionRunner.tsx apps/web/app/guest-sessions/runner-utils.test.ts apps/web/app/guest-sessions/runner-utils.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md e2e/host.spec.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```
