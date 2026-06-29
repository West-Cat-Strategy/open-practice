# Open Practice Branch Integration Validation Draft - 2026-06-28

Date: 2026-06-28/2026-06-29
Branch: `feat/deposit-match-review-command-boundary-20260627`
Base: local `main` and `origin/main` at `9cb1f25e`
Status: Branch validation complete before publication. `pnpm policy:check` remains blocked by
unrelated central reference-index lock drift. Final `main` publication, push parity, and
branch/worktree prune evidence are reported in the closeout response after this validation commit is
published.

## Scope

This closeout consolidates review-decision/runtime boundary slices from the dirty root branch and
adopted reopen sibling:

- OP-T162 deposit-match reviewer decisions over existing payment import review records.
- Refund/chargeback metadata-only review cues over existing payment import review records.
- Provider document-conversion review decisions over existing ready conversion-review artifacts.
- Provider document-conversion latest-decision/history cues over existing terminal review artifacts.
- Matter lifecycle closed/archived status-only reopen through the existing lifecycle command route.
- Legal-research artifact review action descriptors for the existing Research workspace controls.
- Appointment booking and calendar scheduling review-aging cues for still-open staff review rows.

The closeout adds no dependencies, provider activation, provider calls, raw provider payload
retention, live settlement, trust posting, client notification, worker processor, new queue, raw
client text retention, automatic appointment confirmation, automatic request expiry, private-data
examples, or copied reference-derived code.

## Consolidation Notes

- The dirty sibling worktree `/Users/bryan/projects/open-practice-reopen-boundary` was adopted by
  bringing its reopen proof and shared docs wording into the root branch without overwriting the
  OP-T162 or provider document-conversion shared-doc additions.
- Provider-status and self-host operations-readiness residue was preserved separately and is not
  part of this branch-integration draft.
- Existing unrelated stashes were left untouched.
- The validation evidence below uses synthetic test fixtures and bounded metadata only.

## Final Path Set

```text
apps/api/src/routes/appointment-booking.test.ts
apps/api/src/routes/appointment-booking.ts
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/review.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/appointment-booking-panel.test.tsx
apps/web/app/dashboard/appointment-booking-panel.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/research-section.test.tsx
apps/web/app/dashboard/research-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/legal-research-dashboard.test.ts
apps/web/app/legal-research-dashboard.ts
apps/web/app/types.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md
docs/validation/OP_CALENDAR_AGING_REVIEW_CUES_PROOF_2026-06-28.md
docs/validation/OP_LEGAL_RESEARCH_ARTIFACT_REVIEW_ACTION_DESCRIPTORS_PROOF_2026-06-29.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md
docs/validation/OP_MATTER_LIFECYCLE_REOPEN_BOUNDARY_PROOF_2026-06-27.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_CUES_PROOF_2026-06-29.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_DECISION_PROOF_2026-06-27.md
docs/validation/OP_REFUND_CHARGEBACK_REVIEW_CUES_PROOF_2026-06-28.md
docs/validation/README.md
packages/database/migrations/0073_deposit_match_review_decisions.sql
packages/database/migrations/meta/0073_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/matter-lifecycle/drizzle.ts
packages/database/src/repository/matter-lifecycle/memory.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/billing.ts
packages/database/test/repository.matter-lifecycle.test.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/domain/src/appointment-booking.test.ts
packages/domain/src/appointment-booking.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
packages/domain/src/calendar.test.ts
packages/domain/src/calendar.ts
packages/domain/src/index.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
packages/domain/src/models.ts
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
packages/domain/src/review-aging.test.ts
packages/domain/src/review-aging.ts
scripts/route-authorization-manifest.mjs
scripts/route-authorization/billing.mjs
```

## Selector Output

```text
$ pnpm verify:select -- --files <actual dirty path set>
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

| Command                                                                                                                                                                                                                                                                                        | Status           | Notes                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <actual dirty path set>`                                                                                                                                                                                                                                        | Pass             | Selected architecture/API contract, format/docs/policy, full tests, package tests/typechecks/builds, database/migration checks, provider/worker/web checks, and build for the combined dirty diff.                                                            |
| `pnpm architecture:check`                                                                                                                                                                                                                                                                      | Pass             | Architecture import policy passed with 461 workspace import edges reviewed.                                                                                                                                                                                   |
| `pnpm api:contract`                                                                                                                                                                                                                                                                            | Pass             | API contract inventory wrote `.tmp/api-contract/openapi.json` with 340 paths.                                                                                                                                                                                 |
| `pnpm format:check`                                                                                                                                                                                                                                                                            | Pass             | After targeted Prettier fixes for owned code and proof/docs files, the full repository format check passed with all matched files using Prettier style.                                                                                                       |
| `pnpm docs:check`                                                                                                                                                                                                                                                                              | Pass             | Documentation link validation passed.                                                                                                                                                                                                                         |
| `node scripts/validate-validation-proof-index.mjs`                                                                                                                                                                                                                                             | Pass             | Validation proof index check passed after index wording was changed from final mainline proof to draft integration proof.                                                                                                                                     |
| `pnpm policy:check`                                                                                                                                                                                                                                                                            | Blocked          | Reason: known unrelated OSS reference-lock drift after secret scan, package manifests, supply-chain, toolchain, env, architecture, dead-code, migration parity, and migration lint subchecks passed.                                                          |
| `pnpm test`                                                                                                                                                                                                                                                                                    | Pass             | Turbo package tests and script tests passed on the live integration: domain 33 files/261 tests, providers 13 files/37 tests, web 46 files/241 tests, database 27 files/158 tests, worker 6 files/54 tests, API 43 files/621 tests, and script lane 182 tests. |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                                                                                                                     | Pass             | Covered by the `pnpm test` turbo subtask: domain suite reported 33 files and 261 tests passing.                                                                                                                                                               |
| `pnpm --filter @open-practice/domain exec vitest run src/operational-actions.test.ts src/billing.test.ts --pool forks --fileParallelism=false`                                                                                                                                                 | Pass             | Focused post-reconciliation domain coverage passed: 2 files and 28 tests.                                                                                                                                                                                     |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                                                                                                                                | Pass             | Domain TypeScript check passed.                                                                                                                                                                                                                               |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                                    | Pass             | Domain build passed, including the post-reconciliation generated-output refresh used by API/web tests.                                                                                                                                                        |
| `pnpm --filter @open-practice/database test`                                                                                                                                                                                                                                                   | Pass             | Database suite reported 27 files and 158 tests passing.                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/database db:check`                                                                                                                                                                                                                                               | Pass             | Drizzle schema check passed.                                                                                                                                                                                                                                  |
| `pnpm migrations:check`                                                                                                                                                                                                                                                                        | Pass             | Migration parity passed with 74 SQL files and 74 journal entries.                                                                                                                                                                                             |
| `pnpm migrations:lint`                                                                                                                                                                                                                                                                         | Pass             | Tracked-diff migration lint passed and reported 0 tracked SQL files; supplemental direct lint for `packages/database/migrations/0073_deposit_match_review_decisions.sql` passed with 1 SQL migration reviewed.                                                |
| `pnpm --filter @open-practice/database typecheck`                                                                                                                                                                                                                                              | Pass             | Database TypeScript check passed.                                                                                                                                                                                                                             |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                                  | Pass             | Database build passed.                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                                        | Pass             | Covered by the `pnpm test` turbo subtask: API suite reported 43 files and 621 tests passing.                                                                                                                                                                  |
| `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts --pool forks --fileParallelism=false`                                                                                                                                                                             | Pass             | Focused post-reconciliation Billing API coverage passed: 1 file and 32 tests.                                                                                                                                                                                 |
| `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts --pool forks --fileParallelism=false`                                                                                                                                                                 | Pass             | Focused provider document-conversion cue API coverage passed: 1 file and 29 tests.                                                                                                                                                                            |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                                   | Pass             | API TypeScript check passed.                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/providers test`                                                                                                                                                                                                                                                  | Pass             | Covered by the `pnpm test` turbo subtask: providers suite reported 13 files and 37 tests passing.                                                                                                                                                             |
| `pnpm --filter @open-practice/worker test`                                                                                                                                                                                                                                                     | Pass             | Covered by the `pnpm test` turbo subtask: worker suite reported 6 files and 54 tests passing.                                                                                                                                                                 |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                        | Pass             | Covered by the `pnpm test` turbo subtask: web suite reported 46 files and 241 tests passing.                                                                                                                                                                  |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx app/dashboard/research-section.test.tsx app/dashboard/appointment-booking-panel.test.tsx app/calendar-dashboard.test.ts app/dashboard/calendar-section.test.tsx --pool forks --fileParallelism=false` | Pass             | Focused post-reconciliation web coverage passed: 4 files and 13 tests, including Billing and Research review surfaces.                                                                                                                                        |
| `pnpm --filter @open-practice/web exec vitest run app/legal-research-dashboard.test.ts --pool forks --fileParallelism=false`                                                                                                                                                                   | Pass             | Focused legal-research dashboard coverage passed: 1 file and 3 tests.                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx app/legal-research-dashboard.test.ts --pool forks --fileParallelism=false`                                                                                                                          | Pass             | Focused provider document-conversion cue web coverage passed: 2 files and 7 tests.                                                                                                                                                                            |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                                   | Pass             | Web TypeScript check passed.                                                                                                                                                                                                                                  |
| `pnpm build`                                                                                                                                                                                                                                                                                   | Pass after retry | Initial retries collided with live leftover root `next build`/Turbo processes and the generated `.next/lock`; after those root build processes exited and the lock cleared, the clean rerun passed with 6 successful package build tasks.                     |
| `git diff --check`                                                                                                                                                                                                                                                                             | Pass             | Whitespace/error check passed after proof/index wording updates.                                                                                                                                                                                              |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md --base-plus-dirty origin/main`                                                                                                                                                               | Pass             | Proof reconciliation passed for 77 live dirty paths and the selected validation commands.                                                                                                                                                                     |

## Known Policy Drift

`pnpm policy:check` only failed in `node scripts/validate-oss-reuse.mjs` because these central
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

## Publication And Prune Gate

This proof records pre-publication validation. Final branch-first publication, local/origin `main`
parity, and local branch/worktree pruning are reported in the closeout response after the validation
commit is published.
