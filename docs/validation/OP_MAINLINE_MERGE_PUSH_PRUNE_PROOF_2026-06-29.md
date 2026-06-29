# Open Practice Mainline Merge Push Prune Proof - 2026-06-29

Date: 2026-06-29
Integration branch: `integrate/mainline-consolidation-20260629-active-lanes`
Base: `origin/main` at `0d850772d7053f38b9d139a50dff871126b2eadf`
Status: Integration validation complete with accepted known blockers; final `main` publication,
push parity, and clean-lane prune evidence will be recorded here after those commands complete.

## Scope

This proof covers the all-active-lane closeout for report export profile alignment, appointment-booking and calendar aging decisions, document disposition schedule profile, email template compare, OP-T162 readiness reason details, payment-import authorization fixtures, refund/chargeback review decisions, semantic-review readiness metadata, Trust Controls policy preview matrix, and the proof-reconcile lane.

The deterministic migration reconciliation keeps `0075_calendar_aging_review_decisions`, renames document disposition schedule profile to `0076_document_disposition_review_schedule_profile`, renames refund/chargeback review decisions to `0077_payment_import_refund_chargeback_reviews`, and keeps SQL, Drizzle snapshots, and `_journal.json` cumulative and contiguous after `0074_email_template_published_versions`.

The closeout preserves synthetic-only proof data, matter-scoped/privacy boundaries, provider-neutral and review-only posture, no provider activation, no raw client/provider payload retention, no live settlement or funds movement, no automatic invoice mutation, no automatic reconciliation, no trust posting, and no jurisdiction-certified accounting or retention-compliance claim.

## Final Changed Paths

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
apps/api/src/routes/document-processing/settings.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/reports.test.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/billing/server-resources.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/billing-dashboard.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/appointment-booking-panel.test.tsx
apps/web/app/dashboard/appointment-booking-panel.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/dashboard/email-template-drafts-panel.test.tsx
apps/web/app/dashboard/email-template-drafts-panel.tsx
apps/web/app/dashboard/reports-section.test.tsx
apps/web/app/dashboard/reports-section.tsx
apps/web/app/dashboard/trust-controls-section.test.tsx
apps/web/app/dashboard/trust-controls-section.tsx
apps/web/app/reporting-dashboard.ts
apps/web/app/styles/20-dashboard-panels.css
apps/web/app/trust-controls-dashboard.ts
docs/api-and-state-machines.md
docs/document-retention-hold-workflow-design.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/trust-funds-caveats.md
docs/validation/OP-T158_EMAIL_TEMPLATE_COMPARE_PROOF_2026-06-29.md
docs/validation/OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md
docs/validation/OP_CALENDAR_AGING_REVIEW_DECISIONS_PROOF_2026-06-29.md
docs/validation/OP_DOCUMENT_DISPOSITION_SCHEDULE_PROFILE_PROOF_2026-06-29.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-29.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_READINESS_PROOF_2026-06-29.md
docs/validation/OP_REFUND_CHARGEBACK_REVIEW_DECISIONS_PROOF_2026-06-29.md
docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md
docs/validation/OP_TRUST_CONTROLS_POLICY_PREVIEW_MATRIX_PROOF_2026-06-29.md
docs/validation/README.md
packages/database/migrations/0075_calendar_aging_review_decisions.sql
packages/database/migrations/0076_document_disposition_review_schedule_profile.sql
packages/database/migrations/0077_payment_import_refund_chargeback_reviews.sql
packages/database/migrations/meta/0075_snapshot.json
packages/database/migrations/meta/0076_snapshot.json
packages/database/migrations/meta/0077_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/appointment-booking-contracts.ts
packages/database/src/repository/appointment-booking/drizzle.ts
packages/database/src/repository/appointment-booking/mappers.ts
packages/database/src/repository/appointment-booking/memory.ts
packages/database/src/repository/calendar-aging-review.test.ts
packages/database/src/repository/calendar-events-contracts.ts
packages/database/src/repository/calendar-events/drizzle.ts
packages/database/src/repository/calendar-events/memory.ts
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/firm-settings-contracts.ts
packages/database/src/repository/firm-settings/drizzle.ts
packages/database/src/repository/firm-settings/memory.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/appointment-booking.ts
packages/database/src/schema/billing.ts
packages/database/src/schema/calendar.ts
packages/database/src/schema/firm-settings.ts
packages/database/src/seed.ts
packages/database/test/repository.first-run.test.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/database/test/schema.test.ts
packages/domain/package.json
packages/domain/src/appointment-booking.test.ts
packages/domain/src/appointment-booking.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/authorization-fixtures.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
packages/domain/src/calendar.test.ts
packages/domain/src/calendar.ts
packages/domain/src/document-suggestions.test.ts
packages/domain/src/document-suggestions.ts
packages/domain/src/email-template-draft-comparison.ts
packages/domain/src/email-template-drafts.test.ts
packages/domain/src/email-template-drafts.ts
packages/domain/src/ledger.test.ts
packages/domain/src/ledger.ts
packages/domain/src/models.ts
packages/domain/src/permissions.test.ts
packages/domain/src/reports.test.ts
packages/domain/src/reports.ts
packages/domain/src/review-aging.test.ts
packages/domain/src/review-aging.ts
scripts/route-authorization-manifest.mjs
scripts/route-authorization/billing.mjs
```

## Selector Evidence

The first local wrapper attempt used unavailable Bash `readarray` and passed zero paths, so it is
not validation evidence. The successful selector run used the 113-path final set above.

```text
$ pnpm verify:select -- --files <113 final changed paths>
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
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

## Validation Results

| Command                                                                                                                                                                                                                                                                                   | Result                                              | Notes                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm ci:local`                                                                                                                                                                                                                                                                           | Accepted failure                                    | Failed because the broad API test graph hit existing 5s route-suite timeouts after formatting was fixed; focused reruns passed and standalone `pnpm test` passed.                                                                                           |
| `pnpm deps:audit`                                                                                                                                                                                                                                                                         | Pass                                                | Dependency audit passed.                                                                                                                                                                                                                                    |
| `pnpm deps:licenses`                                                                                                                                                                                                                                                                      | Pass                                                | License manifest check passed.                                                                                                                                                                                                                              |
| `pnpm deps:supply-chain`                                                                                                                                                                                                                                                                  | Pass                                                | Lockfile supply-chain policy passed.                                                                                                                                                                                                                        |
| `pnpm deps:osv`                                                                                                                                                                                                                                                                           | Pass                                                | OSV check passed.                                                                                                                                                                                                                                           |
| `pnpm license:scan`                                                                                                                                                                                                                                                                       | Blocked because optional scanner made no progress   | Required dependency, license, supply-chain, and OSV checks passed; `packages/domain/package.json` only adds a local export subpath and no new dependency or copied-source surface. The scanner was stopped after no output beyond startup.                  |
| `pnpm architecture:check`                                                                                                                                                                                                                                                                 | Pass                                                | Architecture import policy passed.                                                                                                                                                                                                                          |
| `pnpm api:contract`                                                                                                                                                                                                                                                                       | Pass                                                | API contract check passed.                                                                                                                                                                                                                                  |
| `pnpm format:check`                                                                                                                                                                                                                                                                       | Pass                                                | Passed after Prettier normalized merged docs and generated snapshots.                                                                                                                                                                                       |
| `pnpm docs:check`                                                                                                                                                                                                                                                                         | Pass                                                | Documentation checks passed.                                                                                                                                                                                                                                |
| `pnpm policy:check`                                                                                                                                                                                                                                                                       | Blocked by known unrelated OSS reference-lock drift | Earlier policy subchecks passed: tracked-secret scan, package manifest policy, supply-chain, toolchain, env surface, architecture, dead-code, migration parity, and migration lint. `validate-oss-reuse.mjs` stopped on central reference-index lock drift. |
| `pnpm test`                                                                                                                                                                                                                                                                               | Pass                                                | Full workspace test command passed on rerun.                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                                                                                                                | Pass                                                | Domain tests passed.                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                                                                                                                           | Pass                                                | Domain typecheck passed.                                                                                                                                                                                                                                    |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                                               | Pass                                                | Domain build passed.                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database test`                                                                                                                                                                                                                                              | Pass                                                | Database tests passed.                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/database db:check`                                                                                                                                                                                                                                          | Pass                                                | Drizzle check passed.                                                                                                                                                                                                                                       |
| `pnpm migrations:check`                                                                                                                                                                                                                                                                   | Pass                                                | Migration parity passed with 78 SQL files and 78 journal entries.                                                                                                                                                                                           |
| `pnpm migrations:lint`                                                                                                                                                                                                                                                                    | Pass                                                | Dirty-tree migration lint passed; final-diff SQL lint separately reviewed the three changed SQL files.                                                                                                                                                      |
| `pnpm --filter @open-practice/database typecheck`                                                                                                                                                                                                                                         | Pass                                                | Database typecheck passed.                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/database build`                                                                                                                                                                                                                                             | Pass                                                | Database build passed.                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/api test`                                                                                                                                                                                                                                                   | Accepted failure                                    | Failed because the broad API route suite hit existing 5s timeouts in `server.test.ts` and CalDAV; focused reruns for `server.test.ts`, CalDAV, and the original timeout files passed.                                                                       |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                                              | Pass                                                | API typecheck passed.                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/providers test`                                                                                                                                                                                                                                             | Pass                                                | Provider tests passed.                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/worker test`                                                                                                                                                                                                                                                | Pass                                                | Worker tests passed.                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                   | Pass                                                | Web tests passed.                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                              | Pass                                                | Web typecheck passed.                                                                                                                                                                                                                                       |
| `pnpm build`                                                                                                                                                                                                                                                                              | Pass                                                | Workspace build passed.                                                                                                                                                                                                                                     |
| `pnpm exec vitest run src/routes/billing.test.ts src/routes/caldav.test.ts src/routes/documents.test.ts src/routes/drafts.test.ts src/routes/external-uploads.test.ts src/routes/intake-forms.test.ts src/routes/draft-assist.test.ts src/routes/intake-pipeline.test.ts` from `apps/api` | Pass                                                | Focused rerun for original and accidental broad-suite timeout files passed.                                                                                                                                                                                 |
| `pnpm exec vitest run src/server.test.ts` from `apps/api`                                                                                                                                                                                                                                 | Pass                                                | Focused rerun for the later broad API timeout file passed.                                                                                                                                                                                                  |
| final-diff SQL lint with `lintMigrationFiles` over `origin/main...HEAD` SQL migrations                                                                                                                                                                                                    | Pass                                                | Reviewed `0075_calendar_aging_review_decisions`, `0076_document_disposition_review_schedule_profile`, and `0077_payment_import_refund_chargeback_reviews`.                                                                                                  |

Skipped checks: none.

## Publication And Prune Evidence

Pending merge to `main`, push parity, and clean merged worktree/branch prune proof.
