# Open Practice Mainline Consolidation Proof - 2026-06-28/2026-06-29

Date: 2026-06-28/2026-06-29
Integration branch: `integrate/mainline-consolidation-20260629`
Base: `origin/main` at `da5628863a8dbf27d9303fac3cd5448ef2d390f7`
Status: Published on `main` at `0d850772d7053f38b9d139a50dff871126b2eadf` (`Merge 2026-06-29
active lanes`) with local/origin parity confirmed by `git rev-list --left-right --count
main...origin/main` returning `0 0`. `pnpm policy:check` is blocked by known unrelated central
reference-index lock drift after earlier policy subchecks pass.

## Scope

This closeout consolidates the currently active local lanes:

- Legal-research artifact review action descriptors for the existing Research workspace controls.
- Read-only document disposition metadata inside the document-processing retention/hold review
  packet.
- OP-T158 email template publish/version history, including the integrated
  `0074_email_template_published_versions` migration after current
  `0073_deposit_match_review_decisions`.
- Read-only Trust Controls maker-checker readiness indicators.
- Proof-only inbound communications aggregation efficiency closeout over already-shipped batching.

The closeout preserves synthetic-only proof data, provider-neutral/review-only posture, no provider
activation, no raw provider/client payload retention, no settlement or trust-posting automation, no
automatic bank-feed matching, no jurisdiction-certified accounting claim, and no copied
reference-derived code.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/email.test.ts
apps/api/src/routes/email/templates.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/ledger/read.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/_features/email-templates/models.ts
apps/web/app/_features/email-templates/server-resources.test.ts
apps/web/app/_features/email-templates/server-resources.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/dashboard/email-template-drafts-panel.test.tsx
apps/web/app/dashboard/email-template-drafts-panel.tsx
apps/web/app/dashboard/trust-controls-section.test.tsx
apps/web/app/dashboard/trust-controls-section.tsx
apps/web/app/trust-controls-dashboard.ts
apps/web/app/types.ts
docs/api-and-state-machines.md
docs/document-retention-hold-workflow-design.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/trust-funds-caveats.md
docs/validation/OP-T158_EMAIL_TEMPLATE_PUBLISH_HISTORY_PROOF_2026-06-29.md
docs/validation/OP_DOCUMENT_DISPOSITION_METADATA_PROOF_2026-06-29.md
docs/validation/OP_INBOUND_COMMUNICATIONS_AGGREGATION_EFFICIENCY_PROOF_2026-06-29.md
docs/validation/OP_LEGAL_RESEARCH_ARTIFACT_REVIEW_ACTION_DESCRIPTORS_PROOF_2026-06-29.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md
docs/validation/OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md
docs/validation/README.md
packages/database/migrations/0074_email_template_published_versions.sql
packages/database/migrations/meta/0074_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/email-template-drafts-contracts.ts
packages/database/src/repository/email-template-drafts/drizzle.ts
packages/database/src/repository/email-template-drafts/memory.ts
packages/database/src/repository/memory.ts
packages/database/src/schema/email-template-drafts.ts
packages/database/test/repository.email-template-drafts.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/document-suggestions.test.ts
packages/domain/src/document-suggestions.ts
packages/domain/src/email-template-drafts.test.ts
packages/domain/src/email-template-drafts.ts
packages/domain/src/ledger.test.ts
packages/domain/src/ledger.ts
scripts/route-authorization-manifest.mjs
```

## Selector Output

```text
$ pnpm verify:select -- --files <actual final path set>
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

## Validation

All commands were run through pinned `pnpm@11.5.3` with
`npm exec --yes pnpm@11.5.3 -- pnpm ...`.

| Command                                           | Status  | Notes                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final paths>`     | Pass    | Selected architecture, API contract, format/docs/policy, full tests, package tests/typechecks/builds, database/migration checks, provider/worker/web checks, and root build.                                                |
| `pnpm architecture:check`                         | Pass    | Architecture import policy passed with 462 workspace import edges reviewed.                                                                                                                                                 |
| `pnpm api:contract`                               | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 342 paths.                                                                                                                                               |
| `pnpm format:check`                               | Pass    | Initial run flagged merged docs/proof text and generated Drizzle JSON; after targeted Prettier on those five files, rerun passed.                                                                                           |
| `pnpm docs:check`                                 | Pass    | Documentation link validation passed.                                                                                                                                                                                       |
| `pnpm policy:check`                               | Blocked | Blocked by known unrelated OSS reference-lock drift in `node scripts/validate-oss-reuse.mjs`; secrets, manifests, supply-chain, toolchain, env, architecture, dead-code, migration parity, and migration lint passed first. |
| `pnpm test`                                       | Pass    | Turbo reported 9 successful tasks; domain 33 files/266 tests, database 27/159, providers 13/37, worker 6/54, web 46/243, API 43/623, plus 182 script tests.                                                                 |
| `pnpm --filter @open-practice/domain test`        | Pass    | 33 files and 266 tests passed.                                                                                                                                                                                              |
| `pnpm --filter @open-practice/domain typecheck`   | Pass    | Domain TypeScript check passed.                                                                                                                                                                                             |
| `pnpm --filter @open-practice/domain build`       | Pass    | Domain build passed.                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database test`      | Pass    | 27 files and 159 tests passed.                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database db:check`  | Pass    | Drizzle check reported `Everything's fine`.                                                                                                                                                                                 |
| `pnpm migrations:check`                           | Pass    | Migration parity passed with 75 SQL files and 75 journal entries.                                                                                                                                                           |
| `pnpm migrations:lint`                            | Pass    | Migration lint passed; no tracked migration lint findings.                                                                                                                                                                  |
| `pnpm --filter @open-practice/database typecheck` | Pass    | Database TypeScript check passed.                                                                                                                                                                                           |
| `pnpm --filter @open-practice/database build`     | Pass    | Database build passed.                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/api test`           | Pass    | 43 files and 623 tests passed.                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api typecheck`      | Pass    | API TypeScript check passed.                                                                                                                                                                                                |
| `pnpm --filter @open-practice/providers test`     | Pass    | 13 files and 37 tests passed.                                                                                                                                                                                               |
| `pnpm --filter @open-practice/worker test`        | Pass    | 6 files and 54 tests passed.                                                                                                                                                                                                |
| `pnpm --filter @open-practice/web test`           | Pass    | 46 files and 243 tests passed.                                                                                                                                                                                              |
| `pnpm --filter @open-practice/web typecheck`      | Pass    | Web TypeScript check passed.                                                                                                                                                                                                |
| `pnpm build`                                      | Pass    | Turbo build completed with all 6 package builds successful; Next generated 20 static pages.                                                                                                                                 |

## Known Policy Drift

`pnpm policy:check` failed only in `node scripts/validate-oss-reuse.mjs` because these central
reference lock pins drift from `/Users/bryan/projects/reference-repos/docs/index.json`:
`activepieces__activepieces`, `apache__fineract`, `calcom__cal.diy`, `civicrm__civicrm-core`,
`documenso__documenso`, `docusealco__docuseal`, `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`,
`kimai__kimai`, `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `nextcloud__server`,
`open-source-legal__opencontracts`, `opencollective__opencollective`,
`opencollective__opencollective-api`, `opencollective__opencollective-frontend`,
`openfga__openfga`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`,
`unstructured-io__unstructured`, and `zulip__zulip`.

This closeout does not add dependencies, vendored assets, copied excerpts, copied reference-derived
code, or dependency lockfile changes, so the reference-lock refresh remains out of scope.

## Publication And Prune Evidence

Final branch-first publication is complete: `main` and `origin/main` both point at
`0d850772d7053f38b9d139a50dff871126b2eadf` (`Merge 2026-06-29 active lanes`), and `main...origin/main`
returns `0 0`.

The consolidation pruned its completed integration/feature lanes before this docs-only
reconciliation. Later unrelated local worktrees and the docs-only proof-reconciliation branch are
outside this closeout and were left untouched. Stash count remains `70`, preserving provider-status,
self-host operations-readiness, and other unrelated residue outside this closeout.
