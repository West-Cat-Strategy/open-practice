# OP-T130 Contact Relationship Graph And CRM Taxonomy Proof

Date: 2026-05-29 PDT

## Scope

Adds the first read-only contact relationship graph and CRM taxonomy slice over contact dossiers:

- Added persistent `contact_relationships` records with relationship kind, source, status, optional
  visible matter linkage, and repository support across in-memory and PostgreSQL implementations.
- Added pure domain taxonomy and graph projections for contact dossiers, including entity type,
  conflict-safe labels, related-matter counts, relationship counts, and display-safe related contact
  summaries.
- Extended `GET /api/contacts/dossiers` and the Contacts dashboard so relationship graph and CRM
  taxonomy information appear with the existing contact dossier surface.
- Kept duplicate resolution, external CRM sync, contact merge automation, contact editing, and
  conflict disposition automation out of scope.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/web/app/contact-dossiers-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/contacts-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T130_CONTACT_RELATIONSHIP_GRAPH_CRM_TAXONOMY_PROOF_2026-05-29.md packages/database/migrations/0042_contact_relationship_graph.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/seed.ts packages/database/test/repository.contact-dossier.test.ts packages/database/test/schema.test.ts packages/domain/src/contacts.test.ts packages/domain/src/contacts.ts packages/domain/src/operational-views.test.ts packages/domain/src/sample-data.ts
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/web/app/contact-dossiers-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/contacts-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T130_CONTACT_RELATIONSHIP_GRAPH_CRM_TAXONOMY_PROOF_2026-05-29.md packages/database/migrations/0042_contact_relationship_graph.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/database/src/seed.ts packages/database/test/repository.contact-dossier.test.ts packages/database/test/schema.test.ts packages/domain/src/contacts.test.ts packages/domain/src/contacts.ts packages/domain/src/operational-views.test.ts packages/domain/src/sample-data.ts
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

2026-05-30 branch-ready rerun results:

- Domain tests passed: 22 files and 143 tests, including contact taxonomy, relationship graph, and
  relationship-record validation.
- Database tests passed: 16 files and 87 tests, including relationship graph scoping,
  hidden-contact redaction, schema/index/check coverage, and repository behavior.
- API tests passed: 39 files and 407 tests, including `GET /api/contacts/dossiers` relationship
  graph output and `relatedContact.id` exclusion.
- Providers, worker, and web tests passed: 5 provider files/15 tests, 3 worker files/23 tests, and
  14 web files/121 tests.
- Formatting, docs links, policy gates, migration parity, `drizzle-kit check`, package typechecks,
  production build, and whitespace checks passed.
- Fresh-worktree database/API tests and typechecks initially stopped on unresolved local workspace
  package entrypoints; after building `@open-practice/domain`, `@open-practice/database`, and
  `@open-practice/providers`, the selected checks above were rerun and passed.
- The branch-ready rerun also tightened stale domain/database assertions to the final display-safe
  relationship summary and CRM taxonomy shape without changing production code or schema.

## Redaction And Scope Proof

- Domain, database, API, and web tests assert relationship summaries expose the related contact kind
  and display name but not `relatedContact.id`.
- Relationship graph summaries are derived only from the current user's visible matter dossiers and
  same-firm relationship records; relationships tied to hidden matters or hidden contacts are not
  surfaced in the dossier payload.
- The graph slice reuses the existing `GET /api/contacts/dossiers` read boundary and does not add
  contact editing, merge decisions, external CRM sync, or automatic conflict disposition.
- Existing contact data-quality matched values remain redacted from review queue summaries,
  resolution payloads, and rendered Contacts dashboard output.

## Notes

- All sample data and validation fixtures are synthetic.
- No dependencies, copied reference code, provider integrations, external CRM connectors, merge
  automation, or conflict-disposition mutations were added.
- This proof was produced in the isolated
  `/Users/bryan/projects/open-practice-op-t130` worktree on
  `codex/op-t130-contact-graph-2026-05-29` because
  `/Users/bryan/projects/open-practice` already contained unrelated OP-T133 document-assembly work.
- During all-branch consolidation, the migration was renumbered to
  `0042_contact_relationship_graph.sql` so it follows the already-merged
  `0041_document_assembly_envelopes.sql` migration.
