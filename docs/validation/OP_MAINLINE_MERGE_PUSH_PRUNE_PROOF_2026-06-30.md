# Open Practice Mainline Merge Push Prune Proof - 2026-06-30

Date: 2026-06-30
Integration branch: `integrate/open-practice-all-worktrees-20260630`
Base: `origin/main` at `17fa4098ae73b84ae77ff66c56f848be24342d38`
Integration head: `1926318de084f7de268fe4a5e82804afc322a98a`
Status: Blocked before push because required validation did not pass. No merge to local `main`,
no push to `origin/main`, no worktree prune, and no branch deletion were attempted.

## Scope

This proof covers the user-selected all-worktree closeout for billing/auth evidence, billing lock
impact, calendar follow-up tasks, contact duplicate decisions, deposit-match manual reconcile,
document disposition rollup, email-template preview handoff, export audit events, financial
auth/fresh-auth, inbound privacy/review cues, legal research readiness, policy secret-scan skips,
refund/chargeback preview, self-host env validation, semantic review checkpoints, and
selected-validation plan mode.

The migration reconciliation keeps contact duplicate resolution as
`0078_contact_duplicate_resolution_decisions` and keeps email-template reviewed outbound previews
as `0079_email_template_reviewed_outbound_previews`. SQL files, snapshots, and `_journal.json` are
contiguous, and the `0079` journal timestamp is strictly after `0078`.

The integrated branch preserves synthetic-only proof data, matter-scoped/privacy boundaries,
provider-neutral and review-only posture, no provider activation, no raw client/provider payload
retention, no live settlement or funds movement, no automatic invoice mutation, no automatic
reconciliation, no trust posting, no automatic contact merge, and no compliance/certification
claim.

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
docs/api-and-state-machines.md
docs/improvement-opportunities.md
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
docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md
docs/validation/OP_VERIFY_RUN_PLAN_MODE_PROOF_2026-06-30.md
docs/validation/README.md
package.json
packages/database/migrations/0078_contact_duplicate_resolution_decisions.sql
packages/database/migrations/0079_email_template_reviewed_outbound_previews.sql
packages/database/migrations/meta/0078_snapshot.json
packages/database/migrations/meta/0079_snapshot.json
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
packages/database/src/schema/contacts.ts
packages/database/src/schema/email-template-drafts.ts
packages/database/test/repository.contact-dossier.test.ts
packages/database/test/repository.drafts.test.ts
packages/database/test/repository.email-template-drafts.test.ts
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
packages/domain/src/permissions.test.ts
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
scripts/scan-tracked-secrets.test.mjs
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

## Validation Results

| Command                                                                                             | Result                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec --yes pnpm@11.5.3 -- pnpm verify:run -- --base-plus-dirty origin/main`                    | Failed because required checks did not pass                             | Artifact: `.tmp/validation-runs/2026-06-30T03-30-40Z`. Failed commands: `01-pnpm-ci-local`, `07-pnpm-security-review`, `12-pnpm-format-check`, `14-pnpm-policy-check`, `15-pnpm-test`, `21-pnpm-migrations-check`, `25-pnpm-filter-open-practice-api-test`, and `32-pnpm-filter-open-practice-web-typecheck`.                                                    |
| `npm exec --yes pnpm@11.5.3 -- pnpm exec prettier --write ...`                                      | Pass                                                                    | Normalized `apps/web/app/dashboard/documents-section.test.tsx`, `docs/api-and-state-machines.md`, `docs/validation/README.md`, `packages/domain/src/permissions.test.ts`, and `scripts/run-semgrep-privacy-rules.test.mjs`.                                                                                                                                      |
| `npm exec --yes pnpm@11.5.3 -- pnpm format:check`                                                   | Pass                                                                    | All matched files use Prettier code style.                                                                                                                                                                                                                                                                                                                       |
| `npm exec --yes pnpm@11.5.3 -- pnpm migrations:check`                                               | Pass                                                                    | Migration parity passed: 80 SQL files match 80 journal entries.                                                                                                                                                                                                                                                                                                  |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/api test -- src/routes/billing.test.ts` | Pass                                                                    | API test command passed after the trust-transfer approval fixture used a fresh-auth session.                                                                                                                                                                                                                                                                     |
| `npm exec --yes pnpm@11.5.3 -- pnpm --filter @open-practice/web typecheck`                          | Pass                                                                    | Web typecheck passed after the legal research dashboard fixture included `legal_research_artifact: 0`.                                                                                                                                                                                                                                                           |
| `npm exec --yes pnpm@11.5.3 -- pnpm policy:check`                                                   | Failed because of unrelated central OSS reference-lock drift            | Repo-owned subchecks passed through tracked-secret scan, package manifest policy, supply-chain, toolchain, env surface, architecture, dead-code, migration parity, and migration lint. `validate-oss-reuse.mjs` then failed because 21 reference locks do not match the central reference index. The integration diff does not touch reference-lock/index files. |
| `npm exec --yes pnpm@11.5.3 -- pnpm security:review`                                                | Failed because required security review commands did not pass           | Current artifact: `.tmp/open-practice-security-review/2026-06-30T03-42-10Z`, generated from clean integration head `1926318de084f7de268fe4a5e82804afc322a98a`. Failed required commands: `policy-check`, `hot-path-rescan`, and `docker-residual-watch`.                                                                                                         |
| security review `policy-check` subcommand                                                           | Failed because of unrelated central OSS reference-lock drift            | The current artifact shows tracked-secret scan, dependency policy, supply-chain, toolchain, env surface, architecture, migration parity, and migration lint passed before `validate-oss-reuse.mjs` failed on the central reference-index mismatch list.                                                                                                          |
| security review `hot-path-rescan` subcommand                                                        | Failed because selector policy check inherited the reference-lock drift | Current artifact: `.tmp/open-practice-security-review/2026-06-30T03-42-10Z/hot-path-rescan/2026-06-30T03-44-31Z`; failed required command: `selector-policy-check`.                                                                                                                                                                                              |
| security review `docker-residual-watch` subcommand                                                  | Failed because local Docker residual readiness has one review candidate | Current artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-30T03-45-16Z`; the local watch reports Scout readiness blockers for postgres, minio, and mailpit quickview/CVE/recommendation checks.                                                                                                                                   |
| `git ls-remote --heads origin main`                                                                 | Pass                                                                    | Remote `origin/main` remained at `17fa4098ae73b84ae77ff66c56f848be24342d38`; the integration branch was not published to `main`.                                                                                                                                                                                                                                 |
| `git stash list \| wc -l`                                                                           | Pass                                                                    | Returned `70`; no stash entries were dropped or rewritten.                                                                                                                                                                                                                                                                                                       |

Skipped checks: none. Push and prune were not attempted because required validation failed for the
explicit reasons above.

## Publication And Prune Evidence

| Command                                                              | Result                            | Notes                                                                                    |
| -------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `git switch main`                                                    | Not run because validation failed | The integration branch stayed checked out at `1926318de084f7de268fe4a5e82804afc322a98a`. |
| `git merge --ff-only integrate/open-practice-all-worktrees-20260630` | Not run because validation failed | Local `main` was not changed.                                                            |
| `git push origin main`                                               | Not run because validation failed | Remote `origin/main` stayed at `17fa4098ae73b84ae77ff66c56f848be24342d38`.               |
| clean merged worktree/branch prune                                   | Not run because validation failed | No sibling worktrees or local branches were removed.                                     |
| `git worktree prune`                                                 | Not run because validation failed | Worktree metadata was preserved.                                                         |

## Repair Notes

The integration branch is ready for the next repair pass at
`integrate/open-practice-all-worktrees-20260630`. Before publication, refresh or otherwise resolve
the central reference-index lock drift, clear the Docker residual watch readiness candidate, rerun
`npm exec --yes pnpm@11.5.3 -- pnpm verify:run -- --base-plus-dirty origin/main`, and only then
merge to `main`, push, confirm remote parity, and prune clean merged worktrees/branches.
