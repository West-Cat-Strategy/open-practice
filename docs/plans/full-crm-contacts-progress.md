# Full CRM Contacts Progress

## Checkpoint: Mainline merge

- Current checkpoint: Full CRM Contacts was merged to `main` at `c34d578e` and is now mainline behavior.
- Validation proof: `docs/validation/OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md` records the focused and broad validation evidence for the shipped CRM work.

## Checkpoint: Branch setup and context review

- Historical checkpoint: implementation started on `feature/full-crm-contacts`.
- Sync status: `git status --short --branch` was clean on `main`, `git fetch origin` completed, and `feature/full-crm-contacts` was created from `origin/main` at `894ee5f4`.
- Files and areas reviewed: `AGENTS.md`, root package scripts/workspace config, docs index, architecture, API/state-machine, planning, live workboard, improvement backlog, testing, validation index, development guides, OSS/reuse/license policy, reference repo guide/lock, OP-T130 contact graph proof, OP-T156 client portal proof, contacts/conflicts/portal/matter/auth/audit/domain/database/API/web source, and existing focused tests.
- Missing required guidance: root `README.md` does not exist; `docs/README.md` is the canonical first-stop guide.
- Architecture decisions made:
  - Keep `Contact` as the CRM root and use `Contact.kind = "organization"` for first-class organizations.
  - Evolve existing contact relationships, `matter_parties`, conflict checks, and `portal_grants` instead of introducing disconnected CRM tables.
  - Keep optional external CRM sync, live outbound email/SMS/AI calls, copied reference implementations, and unsafe automatic merges out of scope.
  - Use CiviCRM, j-lawyer.org, and ArkCase only as clean-room vocabulary/workflow references; EspoCRM, SuiteCRM, and Twenty are documented in Open Practice policy but are not locally indexed in the central reference corpus.
- Tests/checks run:
  - `git status --short --branch`
  - `git fetch origin`
  - Read-only docs/source/reference inspection.
- Failures and fixes: none yet.
- Skipped checks and reasons: no validation commands run yet because no product code changes existed before this checkpoint.
- Remaining work: domain model widening, migration/schema/repository parity, API routes, conflict/portal behavior, web CRM surface, docs/proof updates, validation, and self-review.

## Checkpoint: Domain, database, and API CRM spine

- Current checkpoint: the backend CRM spine compiles across domain, database, and API.
- Files and areas changed:
  - `packages/domain/src/models.ts`, `contacts.ts`, `conflicts.ts`, `permissions.ts`, `participant-roles.ts`, `audit-taxonomy.ts`
  - `packages/database/src/schema/contacts.ts`, `schema/portal-links.ts`, migration `0055_full_crm_contacts.sql`, migration journal, contact/portal/conflict repositories, mappers, setup, and seed paths
  - `apps/api/src/routes/contacts.ts` and `apps/api/src/routes/client-portal/shared.ts`
- Architecture decisions made:
  - Added CRM fields to `contacts` and kept structured methods/identifiers/former names in JSON with indexed scalar search fields for common firm-scoped paths.
  - Kept `matter_parties` as the matter-contact association table and added status, side, dates, notes, conflict inclusion, and audit timestamps.
  - Kept `portal_grants` as the portal-access primitive and added grant lifecycle state plus expanded permissions without live outbound email.
  - Added a domain `validateContactRecord` guard so API/database tests can exercise contact invariants without React-only validation.
  - Extended conflict matching with contacts, organizations, aliases, former names, identifiers, contact methods, relationships, and matter-contact roles.
- Tests/checks run:
  - `pnpm --filter @open-practice/domain typecheck` passed.
  - `pnpm --filter @open-practice/domain build` passed to refresh downstream declarations.
  - `pnpm --filter @open-practice/database typecheck` passed.
  - `pnpm --filter @open-practice/database build` passed to refresh downstream declarations.
  - `pnpm --filter @open-practice/api typecheck` passed.
- Failures and fixes:
  - Initial domain typecheck failed on conflict category literal inference, expanded portal permission labels, and one CRM taxonomy test fixture; fixed all.
  - Initial database/API typechecks saw stale declarations until domain/database builds were rerun.
  - Database typecheck then failed on JSON domain type mismatch and ISO timestamp inserts; fixed with schema JSON types and reusable Drizzle insert mappers.
- Skipped checks and reasons: broader tests, docs checks, policy checks, UI validation, and e2e lanes are pending while implementation continues.
- Remaining work: targeted tests, web CRM surface, matter-page associated contacts surface verification, docs/proof updates, selected/broad validation, and self-review.

## Checkpoint: Web CRM surface and focused validation

- Current checkpoint: Contacts and matter dashboard surfaces are implemented, focused tests pass, and docs/proof updates are in progress.
- Files and areas changed:
  - `apps/web/app/contact-dossiers-dashboard.ts`
  - `apps/web/app/dashboard-client.tsx`
  - `apps/web/app/dashboard/contacts-section.tsx`
  - `apps/web/app/dashboard/matter-overview-section.tsx`
  - `apps/api/src/routes/contacts.test.ts`
  - `packages/domain/src/contacts.test.ts`
  - `packages/domain/src/conflicts.test.ts`
  - `docs/api-and-state-machines.md`, `docs/architecture.md`, `docs/planning-and-progress.md`, `docs/improvement-opportunities.md`, `docs/oss-references.md`, `docs/validation/README.md`, and `docs/validation/OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md`
- Architecture decisions made:
  - Keep the UI operational and legal-workflow-oriented: no sales pipeline, no marketing landing surface, and no copied CRM UI.
  - Surface associated contacts on matter views from existing authorization-filtered matter-party projections.
  - Let the Contacts dashboard create richer person/organization records without adding broad custom-field support in v1.
  - Document CiviCRM, j-lawyer.org, and ArkCase as clean-room references only; no dependency or source reuse was introduced.
- Tests/checks run:
  - `pnpm --filter @open-practice/domain test -- contacts.test.ts conflicts.test.ts permissions.test.ts participant-roles.test.ts` passed: 27 files, 172 tests.
  - `pnpm --filter @open-practice/api test -- contacts.test.ts` passed: 41 files, 514 tests.
  - `pnpm --filter @open-practice/web test -- dashboard-client.test.ts participant-role-labels.test.ts routeCatalog.test.ts` passed: 35 files, 187 tests.
- Failures and fixes:
  - Domain conflict test initially missed address contact-method matches because structured addresses only produced full-address tokens; fixed by indexing address components.
  - Domain relationship summary expectation was too exact for new optional relationship metadata; fixed the assertion to check the stable public contract.
  - API dossier test expected no conflict history for Ada; fixed it to assert the new authorized conflict-history projection without hidden matter leakage.
- Skipped checks and reasons: selected validation, format/docs/policy/database/broad/e2e checks are pending until doc closeout and final changed-path collection.
- Remaining work: post-doc typechecks/builds, selected validation, format/docs/policy/database checks, browser smoke, broad checks as environment permits, final diff/self-review, and final progress-log/proof updates.

## Checkpoint: Broad validation, documentation, and self-review closeout

- Current checkpoint: implementation, validation, and self-review are complete for the branch-local
  goal.
- Files and areas changed:
  - Contact CRM domain models, validation, conflict matching, participant roles, portal
    permissions, and audit taxonomy.
  - Drizzle schema, migration `0055_full_crm_contacts`, memory/PostgreSQL repositories, mappers,
    setup, seed, portal access, and conflict-check repository paths.
  - Fastify contact CRM routes, existing contact dossier/review/data-quality routes, client-portal
    active-grant handling, and route authorization manifest entries.
  - Contacts dashboard, contact dossier dashboard helpers, dashboard create-contact state, and
    matter overview associated-contact rendering.
  - API/state-machine, architecture, planning/progress, improvement backlog, OSS reference,
    validation index, validation proof, and this progress log.
- Architecture decisions made:
  - No separate organization table was introduced; organization records remain first-class contacts
    through `Contact.kind = "organization"`.
  - `matter_parties` remains the matter-contact association table, with new CRM fields added
    compatibly.
  - `portal_grants` remains the client-portal primitive, with state and permissions expanded
    without sending live invitations.
  - Contact timeline data is assembled from existing auditable CRM inputs instead of introducing a
    parallel task/follow-up system.
  - Clean-room reference use stayed limited to vocabulary/workflow comparison; no reference source,
    schemas, migrations, tests, UI, copy, assets, dependencies, or provider integrations were
    reused.
- Tests/checks run:
  - `pnpm verify:select -- --files <changed paths>` passed after documentation closeout.
  - `pnpm --filter @open-practice/domain test -- contacts.test.ts conflicts.test.ts permissions.test.ts participant-roles.test.ts` passed: 27 files, 172 tests.
  - `pnpm --filter @open-practice/api test -- contacts.test.ts` passed: 41 files, 514 tests.
  - `pnpm --filter @open-practice/web test -- dashboard-client.test.ts participant-role-labels.test.ts routeCatalog.test.ts` passed: 35 files, 187 tests.
  - Package typechecks and focused builds passed for domain, database, API, and web paths.
  - `pnpm typecheck` passed.
  - `pnpm --filter @open-practice/database db:check` passed.
  - `pnpm --filter @open-practice/database test` passed: 18 files, 115 tests.
  - `pnpm --filter @open-practice/providers test` passed: 9 files, 20 tests.
  - `pnpm --filter @open-practice/worker test` passed: 5 files, 40 tests.
  - `pnpm migrations:check` passed.
  - `pnpm format:check` passed after formatting the branch-owned files.
  - `pnpm docs:check` passed.
  - `pnpm policy:check` passed after route-manifest updates.
  - `git diff --check` passed.
  - `pnpm lint` passed after resolving stale local ESLint shims and source lint issues.
  - `pnpm test` passed.
  - `pnpm build` passed.
  - `pnpm ci:local` passed.
  - `pnpm e2e:host` passed: 35 Playwright tests.
  - `pnpm e2e:matterless` passed: 1 Playwright test.
  - `pnpm e2e:client-portal` passed: 2 Playwright tests.
  - `node scripts/run-e2e.mjs first-run` passed: 1 Playwright test.
- Failures and fixes:
  - Domain typecheck initially failed on conflict category literal inference and expanded portal
    permission labels; fixed with explicit category typing and permission-label coverage.
  - Database/API typechecks initially saw stale downstream declarations until domain/database builds
    were refreshed.
  - Database typecheck failed on JSON domain type mismatch and ISO timestamp inserts; fixed with
    schema JSON types and reusable Drizzle insert mappers.
  - Domain conflict test initially missed address contact-method matches because structured
    addresses only produced full-address tokens; fixed by indexing address components.
  - API dossier test initially expected no conflict history for Ada; fixed it to assert the new
    authorization-filtered visible conflict-history projection.
  - `pnpm format:check` initially failed on changed files; fixed with Prettier over the exact
    changed path set.
  - `pnpm policy:check` initially failed because new contact CRM routes were missing from
    `scripts/route-authorization-manifest.mjs`; fixed with explicit route entries.
  - `pnpm lint` initially exposed stale generated workspace ESLint shims in ignored `node_modules`,
    then two changed-source unused-variable issues; fixed the generated shim state locally and the
    source issues directly.
- Skipped checks and reasons:
  - `pnpm e2e:docker` was attempted and failed because Docker was unavailable locally:
    `Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock`.
  - A Codex Browser plugin smoke was not available because tool discovery exposed no Browser
    automation tool in this session; the UI was covered by the repo's Playwright lanes.
- Remaining work:
  - No branch-local implementation work remains. Docker E2E and Codex Browser smoke are documented
    as environment-limited skips; merge handoff can use this proof packet.
- Final summary:
  - The branch implements the full legal CRM contact spine across domain, database, API, web,
    conflict checking, portal access, audit taxonomy, docs, and validation proof. Final self-review
    inspected the branch path set for secrets, generated junk, copied reference code, unrelated
    churn, broken docs links, missing policy entries, migration integrity, and whitespace issues.
