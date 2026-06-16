# Full CRM Contacts Proof

Date: 2026-06-15 PDT

## Scope

The Full CRM Contacts mainline work expands the existing Contacts foundation into a legal-practice CRM for
Canadian legal service providers while preserving the established dossiers, review queue,
data-quality resolution, conflict-check, matter-party, portal-grant, authorization, and audit
surfaces.

Runtime changes:

- `Contact` now supports person and organization records with lifecycle status, structured person
  and organization names, aliases, former names, legal-practice role categories, identifiers,
  structured email/phone/address/website contact methods, communication preferences, internal notes,
  risk flags, conflict-sensitive/adverse/confidential markers, do-not-contact posture, and audit
  timestamps.
- Organizations remain first-class CRM records through `Contact.kind = "organization"`, so the same
  contact boundary works for matters, relationships, portal grants, conflict checks, timelines, and
  audit events.
- Contact relationships now support expanded typed directional links, optional matter scope,
  reciprocal labels, effective/end dates, status, notes, and conflict-check inclusion.
- `matter_parties` is the matter-contact association surface and now records role, side/alignment,
  status, dates, notes, confidentiality, adverse/protected-party posture, conflict-check inclusion,
  and audit timestamps.
- Contact portal access continues to use `portal_grants`, now with invited/active/suspended/revoked/
  expired state, expanded matter-scoped permissions, invitation timestamps, and account-bound grant
  behavior. The branch creates invitation records/tokens only and does not send live email.
- Conflict checks now include contacts, organizations, aliases, former names, identifiers, contact
  methods, relationship graph links, matter-contact associations, current/historical party roles, and
  conflict-sensitive flags with match categories, scores, risk levels, and explanations.
- The Contacts dashboard now renders legal CRM list/search/filter controls, richer create payloads,
  lifecycle/role summaries, methods, structured names, identifiers, relationships, associated
  matters, portal posture, conflict cues, review/data-quality summaries, and timeline-ready panels.
  Matter overview panels show associated contacts subject to authorization.

## Authorization And Privacy Boundaries

- All new API routes are authenticated and enforce firm scoping plus server-side contact or matter
  authorization.
- Users who can see a contact but not a related matter receive redacted association summaries rather
  than hidden matter details.
- Conflict-check results keep owner-admin/auditor detailed visibility and aggregate/redacted output
  for other authorized readers.
- Portal grants do not bypass matter authorization, document authorization, scan/checksum status,
  legal holds, sharing rules, document classification restrictions, or confidential-party account
  binding.
- The implementation uses synthetic fixture data only and adds no external CRM sync, live outbound
  email/SMS, payment, AI, or provider side effects.

## Changed Areas

- Domain: contact CRM models, validation, taxonomy, relationship summaries, conflict matching,
  portal permissions, participant roles, and audit taxonomy.
- Database: Drizzle contact, relationship, matter-party, portal-grant schema updates; migration
  `0055_full_crm_contacts`; repositories and mappers for memory/PostgreSQL parity.
- API: contact CRM routes, existing dossier/review/data-quality routes, conflict integration,
  portal grant lifecycle, and client-portal active-grant checks.
- Web: Contacts dashboard, contact dossier dashboard helpers, matter overview associated contacts,
  and dashboard create-contact state.
- Docs: API/state-machine contracts, architecture, planning/progress, backlog, OSS reference posture,
  validation index, and detailed progress log.

## Clean-Room Reference Use

CiviCRM, j-lawyer.org, and ArkCase were consulted as clean-room vocabulary/workflow references using
local metadata/policy surfaces. EspoCRM, SuiteCRM, and Twenty remain documented reference-only CRM
projects in the Open Practice OSS policy, but this branch did not reuse source, schema, migrations,
tests, UI, copy, assets, or dependencies from any reference repository.

## Validation

Passed:

- `pnpm verify:select -- --files <changed paths>`
  - Passed after documentation closeout and selected the expected focused validation bundle.
- `pnpm --filter @open-practice/domain test -- contacts.test.ts conflicts.test.ts permissions.test.ts participant-roles.test.ts`
  - 27 files, 172 tests passed.
- `pnpm --filter @open-practice/api test -- contacts.test.ts`
  - 41 files, 514 tests passed.
- `pnpm --filter @open-practice/web test -- dashboard-client.test.ts participant-role-labels.test.ts routeCatalog.test.ts`
  - 35 files, 187 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm typecheck`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm migrations:check`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm ci:local`
- `pnpm e2e:host`
  - 35 Playwright tests passed.
- `pnpm e2e:matterless`
  - 1 Playwright test passed.
- `pnpm e2e:client-portal`
  - 2 Playwright tests passed.
- `node scripts/run-e2e.mjs first-run`
  - 1 Playwright test passed.

Skipped/environmental:

- `pnpm e2e:docker` was rerun on 2026-06-15 PDT from branch
  `proof/docker-gaps-2026-06-16`. Docker Engine was reachable and Compose started the disposable
  PostgreSQL/Redis/MinIO/Mailpit stack, but the lane did not reach Playwright because
  `pnpm --filter @open-practice/database db:migrate` exited 1 after starting `drizzle-kit migrate`.
  A focused follow-up reproduction was then blocked by the existing local `open-practice-dev-*`
  stack holding the Docker E2E loopback ports, including `127.0.0.1:35432` for Postgres. No
  product-code, migration, Dockerfile, Compose, or image-pin change is included in this proof
  refresh.
- The Codex Browser plugin smoke could not be run because tool discovery returned no exposed
  Browser automation tool in this session. The UI was still exercised through the repo's Playwright
  host, matterless, client-portal, and first-run lanes.

## Failures And Fixes

- Domain typecheck initially failed on conflict category literal inference and expanded portal
  permission labels; fixed with explicit category typing and permission-label coverage.
- Database/API typechecks initially saw stale downstream declarations until domain/database builds
  were refreshed.
- Database typecheck failed on JSON domain type mismatch and ISO timestamp inserts; fixed with
  schema JSON types and reusable Drizzle insert mappers.
- Domain conflict test initially missed address contact-method matches because structured addresses
  were serialized as full addresses only; fixed by indexing address components as conflict tokens.
- API dossier test initially expected empty conflict history; updated to assert the new
  authorization-filtered visible conflict-history projection.
- `pnpm format:check` initially failed on changed files; fixed by running Prettier over the exact
  changed path set.
- `pnpm policy:check` initially failed because the new contact CRM routes were missing from the
  route authorization manifest; fixed by adding explicit authenticated/admin and matter-aware route
  entries.
- `pnpm lint` initially exposed stale generated workspace ESLint shims in ignored `node_modules`,
  then found two real unused-variable issues in the changed source; fixed the shims with a clean
  package relink/removal of generated `.bin` entries and fixed the source issues directly.

## Remaining Follow-Ups

- Full task/follow-up workflow integration for contact timeline cues was completed in the
  2026-06-16 follow-up noted below.
- Duplicate assistance remains review-only; there is still no unsafe automatic merge.
- Jurisdiction-specific contact-history export, retention, and privacy-policy decisions require
  explicit legal/product review before implementation.

## Contact Timeline Task Cue Follow-Up

Date: 2026-06-16 PDT

Scope:

- Added review-only task and follow-up cue entries to the existing contact timeline projection using
  already visible matter task and scheduling-request surfaces.
- Kept `GET /api/contacts/:contactId/timeline` on the existing `{ timeline }` response shape and
  reused `ActivityTimelineEntry.kind = "task"`.
- Kept cue metadata redacted to IDs, matter ID, due/status/priority/bucket/assignment-scope fields,
  and explicit review-boundary flags. Task descriptions, task titles, scheduling request titles,
  scheduling source labels, contact identifiers, aliases, private notes, hidden matter details, and
  provider/queue mutation claims are not exposed by the cue projection.
- The Contacts dashboard now loads the active contact timeline and renders compact generic
  “Timeline cues” rows. It shows matter numbers only from the already visible active dossier and
  labels all cue actions as review-only.

Validation:

- `pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/web/app/_features/contacts/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/contacts-section.tsx docs/validation/OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/domain/src/contact-models.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts`
  - Passed and selected the broad domain/database/API/web/docs validation bundle.
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test -- tasks.test.ts contacts.test.ts`
  - 27 files, 173 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
  - 18 files, 115 tests passed.
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test -- contacts.test.ts`
  - 41 files, 514 tests passed after building the fresh worktree upstream packages.
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
  - 9 files, 20 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 5 files, 40 tests passed.
- `pnpm --filter @open-practice/web test -- dashboard-client.test.ts`
  - 35 files, 187 tests passed.
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
  - 6 workspace builds passed.

## Contact Timeline Activity Filter Follow-Up

Date: 2026-06-16 PDT

Scope:

- Added optional `activity` filtering to `GET /api/contacts/:contactId/timeline` with the existing
  `{ timeline }` response shape. Supported filters are `all`, `crm_activity`, `task_cues`,
  `open_tasks`, and `follow_ups`.
- Kept filtering as a post-authorization projection over already-redacted contact timeline entries.
  The slice does not add outbound CRM sync, automatic task creation, raw private-history exposure,
  retained export bodies, schema/migrations, workers, providers, or broader permissions.
- The Contacts dashboard now defaults to review-only task/follow-up cues and lets staff switch
  between all safe activity, CRM activity, task/follow-up cues, open tasks, and follow-up reviews.
  Non-task CRM rows render only safe titles, kinds, timestamps, visible matter numbers, and
  allowlisted status/review labels.
- Contact-history export still uses the full authorized timeline projection for the transient
  `staff_review` JSON export and does not inherit the dashboard filter.

Validation:

- `pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/api/src/routes/contacts.ts apps/web/app/_features/contacts/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/contacts-section.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md docs/validation/README.md packages/domain/src/contact-models.ts packages/domain/src/contacts.test.ts packages/domain/src/contacts.ts`
  - Passed and selected the broad domain/database/API/web/docs validation bundle.
- `pnpm --filter @open-practice/domain test -- contacts.test.ts tasks.test.ts`
  - 28 files, 189 tests passed.
- `pnpm --filter @open-practice/domain test`
  - 28 files, 189 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
  - 21 files, 123 tests passed.
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api exec vitest run src/routes/contacts.test.ts`
  - 1 file, 7 tests passed after building the fresh worktree upstream package entrypoints.
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
  - 9 files, 20 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 5 files, 42 tests passed.
- `pnpm --filter @open-practice/web test -- dashboard-client.test.ts`
  - 35 files, 193 tests passed after building the fresh worktree upstream package entrypoints.
- `pnpm --filter @open-practice/web test`
  - 35 files, 193 tests passed.
- `pnpm --filter @open-practice/web typecheck`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm build`
  - 6 workspace builds passed.
- `git diff --check`

Default-timeout caveat:

- `pnpm --filter @open-practice/api test` was rerun in isolation after the focused contact route
  test passed. The suite reached 40 passing files and 533 passing tests, then failed on four
  existing CalDAV tests that exceeded the default 5s test timeout. A targeted CalDAV rerun also
  timed out one test at the default 5s limit; the same file passed with the read-only diagnostic
  command `pnpm --filter @open-practice/api exec vitest run src/routes/caldav.test.ts --testTimeout=15000`
  with 1 file and 8 tests passed. No CalDAV, calendar, or API timeout code was changed in this
  activity-filter slice.
