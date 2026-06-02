# OP-T139 Legal Research Workspace Proof

Date: 2026-06-01 PDT

## Scope

OP-T139 adds the first staff-only, review-only legal research workspace shell. The slice covers five
artifact families:

- Cited-source notes.
- Matter-context attachments.
- Document-analysis artifact status.
- Strategy/timeline notes.
- Review checkpoints.

Review decisions are status-only. They mark an artifact reviewed or rejected and append safe audit
metadata, but they do not create tasks, documents, drafts, messages, calendar entries, provider
records, citation-verification evidence, or legal-advice automation output.

## Clean-Room And Privacy Posture

- Synthetic examples only.
- No Clio prose, screenshots, schemas, API examples, templates, assets, or UI structure were copied.
- Bounded staff-authored note text is stored only on authorized `legal_research_artifacts` records.
- Audit metadata stores IDs, kind/status values, counts, title/note lengths, source types,
  creator/reviewer IDs, and review-only posture only.
- No source excerpts, scraped authority text, extracted document text, prompts, generated research,
  storage keys, private URLs, provider evidence, privileged content, credentials, payment details,
  or private deployment data were added to audit metadata.

## Delivered Boundaries

- Provider-neutral legal research artifact domain types, validators, workspace summaries,
  status-only review transition, and safe audit metadata helpers.
- Matter-scoped `legal_research_artifacts` persistence with Drizzle schema, migration, repository
  methods, in-memory behavior, seed data, and database tests.
- API routes for workspace listing, artifact create/update, and status-only review.
- `legal_research` permission resource with owner/admin, licensee, and firm-member create/read/update
  and review access; auditor read/export posture; and no client or billing-only access.
- Research dashboard section at `/?section=research`, positioned between Documents/Drafting and
  Calendar, with counters, disabled provider posture, grouped artifact rows, and review controls
  hidden for read-only users.
- Route authorization and boundary manifests for `/api/legal-research/*`.

Out of scope: live research providers, queues, scraped authority storage, legal-advice automation,
citation-verification claims, public/client-facing research surfaces, and downstream
task/document/draft/message/calendar mutations.

## Owned Paths

- `apps/api/src/routes/legal-research.ts`
- `apps/api/src/routes/legal-research.test.ts`
- `apps/api/src/server.ts`
- `apps/api/src/server.test.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/dashboard-shell.test.tsx`
- `apps/web/app/dashboard/research-section.tsx`
- `apps/web/app/dashboard/research-section.test.tsx`
- `apps/web/app/legal-research-dashboard.ts`
- `apps/web/app/legal-research-dashboard.test.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `apps/web/routes/routeCatalog.ts`
- `apps/web/routes/routeCatalog.test.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T139_LEGAL_RESEARCH_WORKSPACE_PROOF_2026-06-01.md`
- `docs/validation/README.md`
- `packages/database/migrations/0047_legal_research_artifacts.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/test/repository.drafts.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/legal-research.test.ts`
- `packages/domain/src/legal-research.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/sample-data.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/validate-open-practice-boundaries.mjs`

## Validation

| Command                                                                                           | Result | Notes                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <changed paths>`                                                   | Pass   | Rerun after the branch split against the exact 41-path OP-T139 diff; selected format, docs, policy, tests, typechecks, database checks, migration parity, and build. |
| `pnpm --filter @open-practice/domain test -- legal-research permissions audit-taxonomy`           | Pass   | Artifact validation, review-only transitions, permissions, and safe audit taxonomy.                                                                                  |
| `pnpm --filter @open-practice/database test -- repository.drafts schema`                          | Pass   | Schema/repository coverage for create/list/get/update/review behavior and constraints.                                                                               |
| `pnpm --filter @open-practice/api test -- legal-research`                                         | Pass   | Workspace, create/update/review, authorization, read-only auditor, and audit metadata checks.                                                                        |
| `pnpm --filter @open-practice/web test -- legal-research-dashboard research-section routeCatalog` | Pass   | Dashboard helpers, Research section rendering, hidden read-only controls, and route catalog.                                                                         |
| `pnpm format:check`                                                                               | Pass   | Prettier clean after formatting touched OP-T139 files.                                                                                                               |
| `pnpm docs:check`                                                                                 | Pass   | Documentation links passed.                                                                                                                                          |
| `pnpm policy:check`                                                                               | Pass   | Secret scan, package policy, migration parity, OSS reuse, docs links, and boundaries passed.                                                                         |
| `pnpm --filter @open-practice/database db:check`                                                  | Pass   | Drizzle schema check passed.                                                                                                                                         |
| `pnpm migrations:check`                                                                           | Pass   | 48 SQL files match 48 journal entries.                                                                                                                               |
| `pnpm --filter @open-practice/domain test`                                                        | Pass   | Domain package passed: 24 files, 166 tests.                                                                                                                          |
| `pnpm --filter @open-practice/database test`                                                      | Pass   | Database package passed: 16 files, 92 tests.                                                                                                                         |
| `pnpm --filter @open-practice/api test`                                                           | Pass   | API package passed: 41 files, 439 tests.                                                                                                                             |
| `pnpm --filter @open-practice/providers test`                                                     | Pass   | Providers package passed: 7 files, 18 tests.                                                                                                                         |
| `pnpm --filter @open-practice/worker test`                                                        | Pass   | Worker package passed: 3 files, 29 tests.                                                                                                                            |
| `pnpm --filter @open-practice/web test`                                                           | Pass   | Web package passed: 18 files, 132 tests.                                                                                                                             |
| `pnpm test`                                                                                       | Pass   | Workspace tests plus 38 script-contract tests passed.                                                                                                                |
| `pnpm --filter @open-practice/domain typecheck`                                                   | Pass   | Domain typecheck passed.                                                                                                                                             |
| `pnpm --filter @open-practice/database typecheck`                                                 | Pass   | Database typecheck passed.                                                                                                                                           |
| `pnpm --filter @open-practice/api typecheck`                                                      | Pass   | API typecheck passed.                                                                                                                                                |
| `pnpm --filter @open-practice/providers typecheck`                                                | Pass   | Providers typecheck passed.                                                                                                                                          |
| `pnpm --filter @open-practice/worker typecheck`                                                   | Pass   | Worker typecheck passed.                                                                                                                                             |
| `pnpm --filter @open-practice/web typecheck`                                                      | Pass   | Web typecheck passed.                                                                                                                                                |
| `pnpm build`                                                                                      | Pass   | Full workspace build passed.                                                                                                                                         |
| `git diff --check`                                                                                | Pass   | No whitespace errors.                                                                                                                                                |

## Split Reconciliation

The final OP-T139 branch is based on
`codex/op-t138-ai-operational-proposals-2026-06-01` and contains only the 41
legal-research paths listed above. The unrelated Clio parity closeout
proof/documentation updates are not part of this OP-T139 diff.

For the split pass, `pnpm verify:select -- --files <changed paths>` was rerun
against the committed 41-path diff. `pnpm format:check`, `pnpm docs:check`, and
`git diff --check` were rerun after proof reconciliation. The implementation
validation rows above remain the OP-T139 slice proof.

Package builds were refreshed with `pnpm --filter @open-practice/domain build` and
`pnpm --filter @open-practice/database build` before rerunning downstream tests so the test runners
could see the newly exported domain and database methods.

No validation checks were skipped.

## Stacked Integration Closeout

OP-T139 was applied after OP-T136 and OP-T138 on
`codex/op-clio-parity-t135-t136-2026-06-01`. The selected OP-T139 validation suite was rerun on the
stacked branch and passed:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

The stacked rerun kept migration parity at 48 SQL files and 48 journal entries. Package evidence in
the output included domain 24 files/166 tests, database 16 files/92 tests, API 41 files/439 tests,
providers 7 files/18 tests, worker 3 files/29 tests, web 18 files/132 tests, workspace tests, 38
script-contract tests, and the full workspace build.
