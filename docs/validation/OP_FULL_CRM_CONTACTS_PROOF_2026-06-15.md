# Full CRM Contacts Proof

Date: 2026-06-15 PDT

## Scope

The Full CRM Contacts branch expands the existing Contacts foundation into a legal-practice CRM for
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

- `pnpm e2e:docker` could not run because Docker was unavailable locally:
  `Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock`.
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
  branch-owned path set.
- `pnpm policy:check` initially failed because the new contact CRM routes were missing from the
  route authorization manifest; fixed by adding explicit authenticated/admin and matter-aware route
  entries.
- `pnpm lint` initially exposed stale generated workspace ESLint shims in ignored `node_modules`,
  then found two real unused-variable issues in the changed source; fixed the shims with a clean
  package relink/removal of generated `.bin` entries and fixed the source issues directly.

## Remaining Follow-Ups

- Full task/follow-up workflow integration for contact timeline cues remains future work.
- Duplicate assistance remains review-only; there is still no unsafe automatic merge.
- Jurisdiction-specific contact-history export, retention, and privacy-policy decisions require
  explicit legal/product review before implementation.
