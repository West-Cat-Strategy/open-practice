# OP-T108 To OP-T112 Improvement Batch Proof

Date: 2026-05-20

## Scope

Implemented the coordinated improvement batch:

- OP-T108 contact data-quality resolution decisions with append-only API/repository records,
  contacts dashboard controls, contact-reader history visibility, read-only capability gating for
  resolution actions, visible contact/matter/signal checks, and safe audit metadata only.
- OP-T109 async billing and jurisdictional-trust export requests using the existing reports job
  lifecycle; downloads regenerate authorized projections and job metadata stays bounded.
- OP-T110 billing period locks and rate rules with start-inclusive/end-exclusive lock guards,
  edit guards for both existing and requested dates, shared overlap predicates, rate-rule
  resolution, time-entry rate snapshots, dashboard summaries, and no invoice-lifecycle rewrite.
- OP-T111 opt-in outbound email receipt tokens with HMAC-hashed token storage, no-store public
  confirmation pages, idempotent public receipt recording, and staff-facing receipt status only.
- OP-T112 additional saved matter view presets for risk review and action required, plus
  API-boundary rejection for missing, empty, or unsupported dashboard matter preset families.

Out of scope by design: automatic contact merge, automatic contact rewrite, conflict disposition
mutation, passive email tracking, automatic trust ledger posting, certification claims, and new
dependencies.

## Local Proof

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  ran before code edits and selected the broad cross-package gate: `pnpm format:check`,
  `pnpm docs:check`, `pnpm policy:check`, `pnpm test`, focused domain/database/API/web tests and
  typechecks, database schema/migration checks, provider and worker checks, `pnpm build`, and
  `git diff --check`.
- Closeout reran the same selector after the proof refresh; follow-up `pnpm format:check`,
  `pnpm docs:check`, `pnpm policy:check`, and `git diff --check` passed.
- 2026-05-22 handoff cleanup separated the guest-session follow-through work from this branch and
  left the handoff set scoped to OP-T108 through OP-T112. The cleaned selector was rerun with
  `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  and selected the same broad cross-package gate family, without calendar guest-session files or the
  guest-session follow-through proof file. `pnpm ci:local` then passed after Prettier normalized
  `docs/planning-and-progress.md`; `git diff --check` also passed.
- OP-T108 remediation proof: `apps/web/app/dashboard-client.test.ts` renders `ContactsSection`
  with read-only contact capability, confirms resolution history remains visible, and confirms the
  resolution action container is absent unless the `contacts:update` capability is present;
  `apps/api/src/routes/contacts.test.ts` confirms contact readers can list only visible resolution
  history while decision writes still require `contact:update`.
- OP-T111 remediation proof: `apps/api/src/routes/email.test.ts` confirms public receipt `GET`
  routes return no-store confirmation HTML without recording receipt state and `POST` remains the
  idempotent recorder; `apps/api/src/http/http.test.ts` and the route authorization manifest cover
  the public receipt view and mutation paths.
- OP-T110 remediation proof: focused billing route tests reject locked-period date-bypass edits,
  domain tests cover the shared overlap predicates, and database tests exercise memory/Drizzle
  parity for billing period locks and active same-scope rate rules.
- OP-T112 remediation proof: operational-view route tests reject missing, empty, and unsupported
  dashboard matter preset families on create and patch, while allowed matter preset families still
  persist.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm --filter @open-practice/domain test` passed: 16 files, 116 tests.
- `pnpm --filter @open-practice/database test` passed: 15 files, 73 tests.
- `pnpm --filter @open-practice/api test` passed: 33 files, 344 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 21 tests.
- `pnpm --filter @open-practice/web test` passed: 11 files, 96 tests.
- `pnpm --filter @open-practice/providers test` passed: 5 files, 15 tests.
- `pnpm migrations:check` passed: 37 SQL files matched 37 journal entries.
- `pnpm migrations:replay --database-url postgresql://open_practice:open_practice@localhost:35433/open_practice`
  passed after starting a throwaway local PostgreSQL 18 container on `localhost:35433`: 37
  migrations applied to disposable database `open_practice_migration_replay_90697_20260520075705`;
  admin client `psql`; database cleaned up; throwaway container stopped.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm --filter @open-practice/worker build` passed.
- `pnpm docs:check` passed.
- `pnpm format:check` passed after formatting `docs/planning-and-progress.md`.
- `pnpm policy:check` passed.
- `pnpm test` passed, including the monorepo package tests and 35 script tests.
- `pnpm build` passed: 6 tasks successful.
- `pnpm ci:local` passed after the closeout doc refresh, including format, lint, typecheck, tests,
  database schema check, policy checks, build, and `git diff --check`.

## Browser Proof

Local browser proof used a memory-backed API server on `http://127.0.0.1:34112` and the web app on
`http://127.0.0.1:33112`. The proof API used synthetic sample data plus a synthetic SMTP provider,
fake local job queue, and seeded receipt token for the public receipt confirmation route.

- Contacts dashboard desktop/mobile proof confirmed non-empty contact dossiers and
  `Resolution history` render without visible overlap.
- Billing dashboard desktop/mobile proof confirmed `Billing controls`, locked-period/rate-rule
  summary fields, and invoice controls render without visible overlap.
- Saved matter view desktop/mobile proof confirmed persisted `Matter follow-up proof`,
  `Matter risk review proof`, and `Matter action required proof` saved matter preset states render
  without visible overlap.
- Receipt confirmation desktop/mobile proof confirmed the no-store public confirmation page renders
  before receipt recording without exposing sessions, recipient lists, message bodies, matter IDs, or
  email IDs.
- Playwright screenshot refresh reported `overflow: 0` for contacts, billing, saved matter views,
  and receipt confirmation at both 1280x900 desktop and 390x844 mobile viewports.

Screenshots were saved under `output/playwright/op-t108-t112/`.

## Skipped Or Blocked Checks

- None after the 2026-05-20 disposable PostgreSQL replay closeout.
- The 2026-05-22 cleanup did not rerun live migration replay: the prior local replay endpoint on
  `localhost:35433` returned no response, and Docker Engine was unavailable from the local socket.
  `pnpm ci:local` still reran migration parity and database schema checks.
