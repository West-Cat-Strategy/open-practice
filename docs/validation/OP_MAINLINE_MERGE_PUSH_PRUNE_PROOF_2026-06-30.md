# Open Practice Mainline Merge Push Prune Proof - 2026-06-30

Date: 2026-06-30
Repair pass: 2026-07-01
Integration branch: `integrate/open-practice-all-worktrees-20260630`
Base: `origin/main` at `17fa4098ae73b84ae77ff66c56f848be24342d38`
Validation head before this proof update: `0780bafbc1d73c3ff234741ad54023c04be13f75`
Status: final selector and selected validation passed on 2026-07-01. Merge, push, and
metadata prune were not attempted before this proof/index/workboard update.

## Scope

This proof covers the user-selected all-worktree closeout for billing/auth evidence, billing lock
impact, calendar follow-up tasks, contact duplicate decisions, deposit-match manual reconcile,
document disposition rollup, email-template preview handoff, export audit events, financial
auth/fresh-auth, inbound privacy/review cues, legal research readiness, policy secret-scan skips,
refund/chargeback preview and records, self-host env validation, semantic review checkpoints,
selected-validation plan mode, and Docker validation closeout.

The integrated branch preserves synthetic-only proof data, matter-scoped/privacy boundaries,
provider-neutral and review-only posture, no provider activation, no raw client/provider payload
retention, no live settlement or funds movement, no automatic invoice mutation, no automatic
reconciliation, no trust posting, no automatic contact merge, and no compliance/certification claim.

## Preservation Snapshot

| Item        | Result                                                     | Notes                                                                                |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Branch      | `integrate/open-practice-all-worktrees-20260630`           | Still checked out before proof publication steps.                                    |
| Remote base | `origin/main` = `17fa4098ae73b84ae77ff66c56f848be24342d38` | Rechecked before proof update.                                                       |
| Worktrees   | 26                                                         | `git worktree list --porcelain` was read; no sibling worktree directory was removed. |
| Stashes     | 70                                                         | `git stash list \| wc -l` returned `70`; no stash entry was dropped or rewritten.    |
| Docker      | Server `29.6.1`                                            | Docker Desktop was started with `open -a Docker`; `docker info` succeeded.           |

## Final Changed Paths

```text
.semgrep/open-practice.yml
apps/api/src/routes/audit.test.ts
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/api/src/routes/billing/payments.ts
apps/api/src/routes/billing/trust-transfer-requests.ts
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/contacts.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/review.ts
apps/api/src/routes/document-processing/semantic-checkpoints.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/email.test.ts
apps/api/src/routes/email/templates.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/ledger/posting-requests.ts
apps/api/src/routes/legal-research.test.ts
apps/api/src/routes/legal-research.ts
apps/api/src/routes/reports.test.ts
apps/api/src/routes/reports.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/billing/server-resources.ts
apps/web/app/_features/contacts/models.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/_features/email-templates/models.ts
apps/web/app/_features/email-templates/server-resources.test.ts
apps/web/app/_features/email-templates/server-resources.ts
apps/web/app/billing-dashboard.ts
apps/web/app/communications-inbox-dashboard.ts
apps/web/app/contact-dossiers-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/communications-section.test.tsx
apps/web/app/dashboard/communications-section.tsx
apps/web/app/dashboard/contacts-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/dashboard/email-template-drafts-panel.test.tsx
apps/web/app/dashboard/email-template-drafts-panel.tsx
apps/web/app/dashboard/reports-section.test.tsx
apps/web/app/dashboard/reports-section.tsx
apps/web/app/dashboard/research-section.test.tsx
apps/web/app/dashboard/research-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/legal-research-dashboard.test.ts
apps/web/app/legal-research-dashboard.ts
apps/web/app/types.ts
apps/worker/src/processors.test.ts
apps/worker/src/processors/reports.ts
docker-compose.yml
docker/mailpit/Dockerfile
docs/api-and-state-machines.md
docs/contact-history-export-retention-privacy-decision-packet.md
docs/development/github-maintenance.md
docs/improvement-opportunities.md
docs/oss-references.lock.json
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_BILLING_PERIOD_LOCK_IMPACT_PROJECTION_PROOF_2026-06-29.md
docs/validation/OP_CALENDAR_AGING_FOLLOW_UP_TASK_PROOF_2026-06-30.md
docs/validation/OP_CONTACT_DUPLICATE_RESOLUTION_DECISIONS_PROOF_2026-06-30.md
docs/validation/OP_DEPOSIT_MATCH_MANUAL_PAYMENT_RECONCILE_COMMAND_PROOF_2026-06-30.md
docs/validation/OP_EMAIL_TEMPLATE_REVIEWED_OUTBOUND_PREVIEW_HANDOFF_PROOF_2026-06-30.md
docs/validation/OP_FINANCIAL_AUTHORIZATION_FIXTURE_CATALOGUE_PROOF_2026-06-29.md
docs/validation/OP_FINANCIAL_COMMAND_FRESH_AUTH_PROOF_2026-06-29.md
docs/validation/OP_LEGAL_RESEARCH_CITATION_PACKET_READINESS_PROOF_2026-06-29.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-30.md
docs/validation/OP_POLICY_SECRET_SCAN_SKIPPED_TRACKED_FILES_PROOF_2026-06-29.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_CHECKPOINTS_PROOF_2026-06-29.md
docs/validation/OP_REFUND_CHARGEBACK_RESOLUTION_PACKET_PREVIEW_PROOF_2026-06-30.md
docs/validation/OP_REFUND_CHARGEBACK_RESOLUTION_RECORDS_PROOF_2026-06-30.md
docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md
docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md
docs/validation/README.md
package.json
packages/database/migrations/0078_contact_duplicate_resolution_decisions.sql
packages/database/migrations/0079_email_template_reviewed_outbound_previews.sql
packages/database/migrations/0080_payment_import_refund_chargeback_resolution_records.sql
packages/database/migrations/meta/0078_snapshot.json
packages/database/migrations/meta/0079_snapshot.json
packages/database/migrations/meta/0080_snapshot.json
packages/database/migrations/meta/_journal.json
packages/database/src/repository/contacts-contracts.ts
packages/database/src/repository/contacts/drizzle.ts
packages/database/src/repository/contacts/memory.ts
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/email-template-drafts-contracts.ts
packages/database/src/repository/email-template-drafts/drizzle.ts
packages/database/src/repository/email-template-drafts/memory.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/billing.ts
packages/database/src/schema/contacts.ts
packages/database/src/schema/email-template-drafts.ts
packages/database/test/repository.contact-dossier.test.ts
packages/database/test/repository.drafts.test.ts
packages/database/test/repository.email-template-drafts.test.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/authorization-fixtures.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
packages/domain/src/contact-models.ts
packages/domain/src/contacts.test.ts
packages/domain/src/contacts.ts
packages/domain/src/email-template-drafts.test.ts
packages/domain/src/email-template-drafts.ts
packages/domain/src/legal-research.test.ts
packages/domain/src/legal-research.ts
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
packages/domain/src/permissions.test.ts
packages/domain/src/permissions.ts
packages/domain/src/reports.test.ts
packages/domain/src/reports.ts
packages/domain/src/tasks.test.ts
packages/domain/src/tasks.ts
scripts/check-env-surface.mjs
scripts/check-env-surface.test.mjs
scripts/route-authorization-manifest.mjs
scripts/route-authorization/billing.mjs
scripts/run-selected-validation.mjs
scripts/run-selected-validation.test.mjs
scripts/run-semgrep-privacy-rules.test.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/scan-tracked-secrets.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```

## Selector Evidence

```text
$ npm exec --yes pnpm@11.5.3 -- pnpm verify:select -- --base-plus-dirty origin/main
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm security:review
pnpm security:secrets-history
pnpm security:privacy-rules
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:docker
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
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Repair Results

| Command                                                                                                                                               | Result | Notes                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec --yes pnpm@11.5.3 -- pnpm exec prettier --write packages/domain/src/operational-actions.ts packages/domain/src/operational-actions.test.ts` | Pass   | Repaired the documented Prettier drift only in the two operational action files.                                                                                                |
| `open -a Docker`; `docker info`                                                                                                                       | Pass   | Docker Desktop became available; server version `29.6.1`.                                                                                                                       |
| `node --test scripts/watch-docker-residuals.test.mjs scripts/scan-docker-images.test.mjs scripts/create-security-review.test.mjs`                     | Pass   | 26 script tests passed after Docker validation tooling repairs.                                                                                                                 |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/domain lint`                                                                              | Pass   | Repaired one final `@typescript-eslint/no-unused-vars` lint finding in `packages/domain/src/reports.ts`; warnings remain existing non-fatal lint warnings.                      |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/database lint`                                                                            | Pass   | Repaired one final `@typescript-eslint/no-unused-vars` lint finding in `packages/database/src/repository/contacts/memory.ts`; warnings remain existing non-fatal lint warnings. |
| `npm exec --yes pnpm@11.5.3 -- pnpm ci:local`                                                                                                         | Pass   | The previously failing selected `ci:local` command passed after the two lint repairs.                                                                                           |

Docker validation tooling repairs were limited to local validation reliability: wrapped service image
builds now receive a bounded 20 minute timeout, default `docker:scan` resolves the current
app-smoke API/web/worker images when stale `open-practice-dev-*` tags are absent, and the MinIO
GitHub archive-metadata curl probe has a small retry/User-Agent so one transient GitHub API 403 does
not invalidate an otherwise complete Docker proof.

## Validation Results

| Command                                                                                                             | Result | Notes                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec --yes pnpm@11.5.3 -- pnpm format:check`                                                                   | Pass   | All matched files use Prettier code style.                                                                                                                                                                                                                                                                       |
| `npm exec --yes pnpm@11.5.3 -- pnpm policy:check`                                                                   | Pass   | Tracked-secret scan, package manifest policy, supply chain, toolchain, env surface, architecture, dead-code, migrations, OSS reuse, docs links, proof index, local-evidence ignore, and boundary policy passed.                                                                                                  |
| `npm exec --yes pnpm@11.5.3 -- pnpm migrations:check`                                                               | Pass   | Migration parity passed: 81 SQL files match 81 journal entries.                                                                                                                                                                                                                                                  |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/api exec vitest run src/routes/contacts.test.ts`        | Pass   | 1 file and 12 tests passed.                                                                                                                                                                                                                                                                                      |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/domain exec vitest run src/operational-actions.test.ts` | Pass   | 1 file and 12 tests passed.                                                                                                                                                                                                                                                                                      |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/web typecheck`                                          | Pass   | Web TypeScript check passed.                                                                                                                                                                                                                                                                                     |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:residual-watch`                                                          | Pass   | Final selected artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-07-01T01-59-55Z`; accepted 3 bundled MinIO residuals.                                                                                                                                                               |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:app-smoke`                                                               | Pass   | Final selected run built project `open-practice-app-smoke-91080`, pre/post storage preflight had 25.7 GiB free, API health was PostgreSQL-backed, web root served, setup status returned JSON, and disposable containers/volumes/network were cleaned up by the smoke harness.                                   |
| `npm exec --yes pnpm@11.5.3 -- pnpm docker:scan`                                                                    | Pass   | Final selected artifact: `.tmp/docker/trivy/2026-07-01T02-01-23Z`; app-smoke API/web/worker, Postgres, and Mailpit scanned clean. Bundled MinIO Trivy residuals were accepted only with the passed residual-watch basis at `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-07-01T02-01-23Z`. |
| `npm exec --yes pnpm@11.5.3 -- pnpm security:review -- --base-plus-dirty origin/main`                               | Pass   | Standalone artifact: `.tmp/open-practice-security-review/2026-07-01T01-12-46Z`; selected-run artifact: `.tmp/open-practice-security-review/2026-07-01T01-54-43Z`; failed required command IDs were empty.                                                                                                        |
| `npm exec --yes pnpm@11.5.3 -- pnpm verify:select -- --base-plus-dirty origin/main`                                 | Pass   | Selected the 39 commands listed above.                                                                                                                                                                                                                                                                           |
| `npm exec --yes pnpm@11.5.3 -- pnpm verify:run -- --base-plus-dirty origin/main`                                    | Pass   | Final artifact: `.tmp/validation-runs/2026-07-01T01-52-26Z`; status `passed`, 39 commands, failed command IDs `[]`.                                                                                                                                                                                              |

Skipped checks: none.

## Docker Residual Outcome

Final `docker:scan` accepted only the bundled MinIO residual:

- `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4`: Trivy reported 3 critical and 27 high findings.
- Residual-watch basis: local and self-host Compose MinIO use read-only root filesystems and `/tmp` tmpfs, the MinIO source tag is current, official current-source container manifests are unavailable, no same-contract MinIO remediation candidate was reported, and Docker/Scout/registry/source probes completed.
- Residual-watch accepted `minio-scout-quickview` and `minio-scout-critical-high-cves` with 11 critical and 16 high Scout findings, plus `minio-source-repository-metadata` because the upstream source repository is archived.

## Publication And Prune Evidence

| Command                                                              | Result                                                                                | Notes                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `git switch main`                                                    | Not run before this proof update because proof/index/workboard must be updated first. | The integration branch stayed checked out for proof reconciliation.                            |
| `git merge --ff-only integrate/open-practice-all-worktrees-20260630` | Not run before this proof update because proof/index/workboard must be updated first. | Local `main` has not been changed by this proof update.                                        |
| `git push origin main`                                               | Not run before this proof update because proof/index/workboard must be updated first. | Remote `origin/main` remained `17fa4098ae73b84ae77ff66c56f848be24342d38` while validation ran. |
| `git worktree prune`                                                 | Not run before this proof update because proof/index/workboard must be updated first. | Sibling worktree directories and stashes were preserved.                                       |

After this proof/index/workboard update passes reconciliation and docs/policy/diff checks, publication
may proceed by committing the repair/proof changes on the integration branch, rechecking
`origin/main`, fast-forwarding local `main`, pushing `main`, confirming remote parity, and running
only safe Git metadata prune. Sibling worktree directories, branches attached to worktrees, and
stashes remain out of scope for removal.
