# Appointment Booking Tentative Holds Proof - 2026-06-26

## Scope

- Branch: `feature/appointment-booking-tentative-holds-20260626`
- Worktree: `/Users/bryan/projects/open-practice-appointment-booking-20260626`
- Surface: booking profiles, website booking APIs, staff direct links, tentative calendar holds,
  staff confirm/dismiss review, public appointment runner, intake appointment status reporting,
  route/policy/audit documentation, and migration/repository support.

## Implemented Boundary

- Staff can create and update booking profiles with public-safe labels, timezone, duration, slot
  interval, lead-time bounds, weekly windows, and active/paused state.
- Staff can create direct booking links for a profile, optionally tied to an authorized matter or
  visible client contact. The database stores token hashes only; the raw token and
  `/appointment-booking#token` URL are returned once.
- Website booking APIs are guarded by enabled public consultation settings, allowed origins, bearer
  token verification, and route rate limits. Public responses expose only profile labels, timezone,
  duration, slots, tentative status, submitted time, and requested slot.
- Direct-link booking APIs support the existing `x-open-practice-public-token` header and legacy
  path-token shape with URL-token redaction. Revoked, expired, used, missing, or mismatched tokens
  fail before matter/contact details are disclosed.
- Slot computation uses profile weekly windows minus all non-cancelled firm calendar busy intervals,
  including tentative holds.
- Booking creation flows through one repository method that locks the profile in the Drizzle path,
  rechecks availability, creates the tentative calendar event, creates the booking request, marks
  direct links used, and writes redacted audit/access evidence.
- Direct-link freshness is rechecked inside tentative-hold creation so a raced duplicate submission
  cannot spend the same link against a different open slot.
- Website bookings create a public consultation intake plus a firm-scope tentative event titled
  `Tentative consultation hold`. Direct matter links create a matter-scope tentative event and add a
  matter attendee only when requester email is supplied.
- Staff review keeps the v1 lifecycle explicit: `tentative_hold -> confirmed` sets the linked event
  to `confirmed`; `tentative_hold -> dismissed` sets it to `cancelled`.
- The calendar dashboard now includes staff controls for profiles, direct-link generation, and
  tentative-hold review. The public `/appointment-booking#token` runner uses the existing public
  token shell.
- Public consultation lead reporting can include safe appointment-link counts/statuses from booking
  requests without exposing requester emails, phone numbers, notes, event titles, token hashes,
  attendees, meeting URLs, or audit metadata.
- Audit taxonomy covers booking profile, link, hold creation, and hold review actions with safe IDs,
  statuses, source labels, timestamps, booleans, and counts only.
- No provider sync, public room URLs, native media, signaling, chat, recordings, automatic final
  confirmation, hold auto-expiry, automatic matter creation, live provider calls, or new
  dependencies were added.
- All examples and tests use synthetic data only. This branch does not add real client, matter,
  credential, payment, private deployment, raw token, provider payload, meeting URL, or confidential
  audit details.

## Final Changed Paths

```text
apps/api/src/http/auth-helpers.ts
apps/api/src/http/http.test.ts
apps/api/src/routes/appointment-booking.test.ts
apps/api/src/routes/appointment-booking.ts
apps/api/src/routes/intake-pipeline.ts
apps/api/src/server.ts
apps/web/app/PublicTokenHashEntry.tsx
apps/web/app/appointment-booking/AppointmentBookingRunner.tsx
apps/web/app/appointment-booking/page.tsx
apps/web/app/appointment-booking/runner-utils.test.ts
apps/web/app/appointment-booking/runner-utils.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/appointment-booking-panel.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/public-token-routes.test.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md
docs/validation/README.md
packages/database/migrations/0071_appointment_booking_tentative_holds.sql
packages/database/migrations/meta/_journal.json
packages/database/src/repository/appointment-booking-contracts.ts
packages/database/src/repository/appointment-booking/drizzle.ts
packages/database/src/repository/appointment-booking/mappers.ts
packages/database/src/repository/appointment-booking/memory.ts
packages/database/src/repository/calendar-events-contracts.ts
packages/database/src/repository/calendar-events/drizzle.ts
packages/database/src/repository/calendar-events/memory.ts
packages/database/src/repository/contracts.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/schema.ts
packages/database/src/schema/appointment-booking.ts
packages/database/test/repository.appointment-booking.test.ts
packages/domain/src/appointment-booking.test.ts
packages/domain/src/appointment-booking.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/index.ts
packages/domain/src/intake-pipeline.ts
scripts/route-authorization-manifest.mjs
scripts/validate-open-practice-boundaries.mjs
```

## Selector

Final selector command:

```sh
pnpm verify:select -- --files apps/api/src/http/auth-helpers.ts apps/api/src/http/http.test.ts apps/api/src/routes/appointment-booking.test.ts apps/api/src/routes/appointment-booking.ts apps/api/src/routes/intake-pipeline.ts apps/api/src/server.ts apps/web/app/PublicTokenHashEntry.tsx apps/web/app/appointment-booking/AppointmentBookingRunner.tsx apps/web/app/appointment-booking/page.tsx apps/web/app/appointment-booking/runner-utils.test.ts apps/web/app/appointment-booking/runner-utils.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/appointment-booking-panel.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/public-token-routes.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md docs/validation/README.md packages/database/migrations/0071_appointment_booking_tentative_holds.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/appointment-booking-contracts.ts packages/database/src/repository/appointment-booking/drizzle.ts packages/database/src/repository/appointment-booking/mappers.ts packages/database/src/repository/appointment-booking/memory.ts packages/database/src/repository/calendar-events-contracts.ts packages/database/src/repository/calendar-events/drizzle.ts packages/database/src/repository/calendar-events/memory.ts packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/schema/appointment-booking.ts packages/database/test/repository.appointment-booking.test.ts packages/domain/src/appointment-booking.test.ts packages/domain/src/appointment-booking.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/index.ts packages/domain/src/intake-pipeline.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
```

Selector output:

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

Result: selector passed and produced the command set above for the final 42-path set.

## Validation Results

- `pnpm --filter @open-practice/domain exec vitest run src/appointment-booking.test.ts src/intake-pipeline.test.ts src/audit-taxonomy.test.ts` -
  Pass; 3 files and 41 tests passed.
- `pnpm --filter @open-practice/database exec vitest run test/repository.appointment-booking.test.ts test/repository.calendar.test.ts` -
  Pass; 2 files and 16 tests passed.
- `pnpm --filter @open-practice/api exec vitest run src/routes/appointment-booking.test.ts src/http/http.test.ts src/routes/intake-pipeline.test.ts` -
  Pass; 3 files and 14 tests passed.
- `pnpm --filter @open-practice/web exec vitest run app/appointment-booking/runner-utils.test.ts app/public-token-routes.test.ts app/dashboard/calendar-section.test.tsx` -
  Pass; 3 files and 10 tests passed.
- `pnpm --filter @open-practice/domain typecheck` - Pass.
- `pnpm --filter @open-practice/database typecheck` - Pass.
- `pnpm --filter @open-practice/api typecheck` - Pass.
- `pnpm --filter @open-practice/web typecheck` - Pass.
- `pnpm architecture:check` - Pass; 449 workspace import edges reviewed.
- `pnpm api:contract` - Pass; generated ignored OpenAPI inventory under `.tmp/api-contract` with
  321 paths.
- Initial `pnpm format:check` - Failed on Prettier drift in `docs/api-and-state-machines.md`.
- `pnpm exec prettier --write docs/api-and-state-machines.md docs/improvement-opportunities.md` -
  Pass.
- `pnpm format:check` after formatting - Pass.
- `pnpm docs:check` - Pass.
- `pnpm policy:check` - Pass.
- `pnpm --filter @open-practice/database db:check` - Pass; Drizzle check reported everything fine.
- `pnpm migrations:check` - Pass; 72 SQL files match 72 journal entries.
- `pnpm migrations:lint` - Pass; 0 changed SQL migration file(s) reviewed.
- `pnpm --filter @open-practice/domain test` - Pass; 32 files and 252 tests passed.
- `pnpm --filter @open-practice/database test` - Pass; 26 files and 152 tests passed.
- `pnpm --filter @open-practice/api test` - Pass; 43 files and 606 tests passed.
- `pnpm --filter @open-practice/providers test` - Pass; 13 files and 37 tests passed.
- `pnpm --filter @open-practice/worker test` - Pass; 6 files and 52 tests passed.
- `pnpm --filter @open-practice/web test` - Pass; 45 files and 232 tests passed.
- `pnpm test` - Pass; Turbo reported 9 successful tasks, and Node script tests reported 167
  passing tests.
- `pnpm --filter @open-practice/domain build` - Pass.
- `pnpm --filter @open-practice/database build` - Pass.
- `pnpm build` - Pass; six package build tasks succeeded, including the Next.js production build
  with `/appointment-booking`.

## Checks Not Run

- None. All selector-recommended commands were run.

## Post-Proof Reconciliation Commands

To run after this proof/index update:

```sh
pnpm verify:select -- --files apps/api/src/http/auth-helpers.ts apps/api/src/http/http.test.ts apps/api/src/routes/appointment-booking.test.ts apps/api/src/routes/appointment-booking.ts apps/api/src/routes/intake-pipeline.ts apps/api/src/server.ts apps/web/app/PublicTokenHashEntry.tsx apps/web/app/appointment-booking/AppointmentBookingRunner.tsx apps/web/app/appointment-booking/page.tsx apps/web/app/appointment-booking/runner-utils.test.ts apps/web/app/appointment-booking/runner-utils.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/appointment-booking-panel.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/public-token-routes.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md docs/validation/README.md packages/database/migrations/0071_appointment_booking_tentative_holds.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/appointment-booking-contracts.ts packages/database/src/repository/appointment-booking/drizzle.ts packages/database/src/repository/appointment-booking/mappers.ts packages/database/src/repository/appointment-booking/memory.ts packages/database/src/repository/calendar-events-contracts.ts packages/database/src/repository/calendar-events/drizzle.ts packages/database/src/repository/calendar-events/memory.ts packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/schema/appointment-booking.ts packages/database/test/repository.appointment-booking.test.ts packages/domain/src/appointment-booking.test.ts packages/domain/src/appointment-booking.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/index.ts packages/domain/src/intake-pipeline.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
pnpm proof:reconcile -- --proof docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md --files apps/api/src/http/auth-helpers.ts apps/api/src/http/http.test.ts apps/api/src/routes/appointment-booking.test.ts apps/api/src/routes/appointment-booking.ts apps/api/src/routes/intake-pipeline.ts apps/api/src/server.ts apps/web/app/PublicTokenHashEntry.tsx apps/web/app/appointment-booking/AppointmentBookingRunner.tsx apps/web/app/appointment-booking/page.tsx apps/web/app/appointment-booking/runner-utils.test.ts apps/web/app/appointment-booking/runner-utils.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/appointment-booking-panel.tsx apps/web/app/dashboard/calendar-section.tsx apps/web/app/public-token-routes.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md docs/validation/README.md packages/database/migrations/0071_appointment_booking_tentative_holds.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/appointment-booking-contracts.ts packages/database/src/repository/appointment-booking/drizzle.ts packages/database/src/repository/appointment-booking/mappers.ts packages/database/src/repository/appointment-booking/memory.ts packages/database/src/repository/calendar-events-contracts.ts packages/database/src/repository/calendar-events/drizzle.ts packages/database/src/repository/calendar-events/memory.ts packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/schema/appointment-booking.ts packages/database/test/repository.appointment-booking.test.ts packages/domain/src/appointment-booking.test.ts packages/domain/src/appointment-booking.ts packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/index.ts packages/domain/src/intake-pipeline.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```
