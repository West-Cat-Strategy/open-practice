# OP-T102 Native Guest Session Controls Proof

Date: 2026-05-18

## Scope

Implemented the bounded hosted guest-session control-plane slice:

- Persistent `calendar_meeting_sessions` and `calendar_guest_links` records with HMAC token hashes,
  explicit expiry/retention fields, and no raw token storage.
- Staff calendar routes for session create/read, lobby open/lock/end, guest-link issue, and guest
  admit/deny/revoke under existing matter-scoped `calendar_event` authorization.
- Public token routes and `/guest-sessions/[token]` web page for status-only lobby state and
  check-in.
- Dashboard guest-lobby controls for hosted WebRTC calendar events.

Out of scope by design: WebRTC media, signaling, chat, recordings, temporary uploads, stored meeting
URL delivery through the public page, and new runtime dependencies.

## Privacy And Boundary Notes

- Raw guest tokens are returned once and are not stored.
- Public responses expose lobby/session/guest state, safe counts, and event time bounds only.
- Public responses and audit/access-log metadata do not include token hashes, stored meeting URLs,
  room IDs, attendee email, matter/client details, private notes, or client data.
- Ended sessions revoke active guest access records.

## Local Proof

- `pnpm verify:select -- --files <changed paths...>` recommended format, docs, policy, package
  tests/typechecks, database checks, build, and local CI.
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm --filter @open-practice/domain test -- calendar.test.ts audit-taxonomy.test.ts`
- `pnpm --filter @open-practice/database test -- test/repository.calendar.test.ts test/schema.test.ts`
- `pnpm --filter @open-practice/api test -- src/routes/calendar.test.ts src/http/http.test.ts`
- `pnpm --filter @open-practice/web test -- app/dashboard-client.test.ts app/guest-sessions/runner-utils.test.ts`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `git diff --check`
- `pnpm ci:local`

## Browser Proof

Ran against the actual in-memory API and Next.js dev server with synthetic data, hosted meeting
configuration, and guest-token signing enabled:

- API: `OPEN_PRACTICE_USE_MEMORY_REPO=true AUTH_JWT_SECRET=... WEBRTC_MEETING_PROVIDER_KEY=browser-proof WEBRTC_MEETING_BASE_URL=http://localhost:3100/meeting PUBLIC_WEB_BASE_URL=http://localhost:3100 API_PORT=4000 pnpm --filter @open-practice/api dev`
- Web: `API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 WEB_PORT=3100 pnpm --filter @open-practice/web dev`
- Dashboard Calendar section rendered at desktop and mobile widths with hosted guest-lobby controls
  visible.
- Public `/guest-sessions/[token]` page rendered at desktop and mobile widths for issued, waiting,
  admitted, denied, revoked, locked, ended, expired, and guest-access-not-configured states.
- Screenshots were captured as local browser evidence and are no longer retained as tracked
  generated artifacts.

No remaining handoff checks are currently blocked.
