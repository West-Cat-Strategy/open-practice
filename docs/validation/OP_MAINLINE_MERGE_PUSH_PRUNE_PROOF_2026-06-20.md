# OP Mainline Merge Push Prune Proof - 2026-06-20

This proof records the 2026-06-20 Open Practice active-lane consolidation from base
`2873e38f` (`origin/main`) into integration branch
`merge/open-practice-mainline-20260620`.

## Scope

All 11 dirty Open Practice lanes were committed on their existing branches before integration.
The integration branch merged runtime/data lanes first, the dead-code prune after those runtime
surfaces were present, and docs/audit/self-hosting readiness last so the docs reflected the final
combined behavior. Initial stash count was `42`; stashes are intentionally preserved.

| Branch                                                        | Commit     | Scope                                                           |
| ------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `feat/deposit-match-review-records-20260620`                  | `d4afdb95` | Deposit-match review records and migration `0070`.              |
| `feat/document-retention-hold-review-surface-20260620`        | `f1a6f56b` | Staff retention/hold review cues and workbench/UI posture.      |
| `recovery/inbound-email-operator-replay-20260620`             | `6383fc03` | Metadata-only inbound-email replay request recovery.            |
| `codex/matter-lifecycle-close-command-20260620`               | `9aa7d93b` | Review-gated matter lifecycle close command behavior.           |
| `codex/provider-document-conversion-metadata-2026-06-20`      | `b943eb9f` | Metadata-only provider document conversion review records.      |
| `feat/lifecycle-review-action-descriptor-20260620`            | `2d13c45f` | Domain-owned lifecycle review action descriptors.               |
| `hardening/ai-proposal-authz-matrix-20260620`                 | `2b4ffb39` | AI operational proposal authorization fixture matrix.           |
| `prune/dead-code-bloat`                                       | `7696a32b` | Dead-code/package export and tracked Playwright artifact prune. |
| `docs/api-docs-route-inventory-reconciliation-20260620`       | `4fc1ef23` | API docs route inventory reconciliation.                        |
| `audit/incomplete-implementation-inventory-20260620`          | `0bbfab3f` | Exhaustive incomplete-implementation audit proof.               |
| `chore/self-hosting-release-readiness-20260620`               | `6bd8d8c1` | Self-hosting release-readiness drill evidence.                  |
| `merge/open-practice-mainline-20260620` integration follow-up | `731aac49` | Import/export repair after dead-code export pruning.            |

## Merge Reconciliation

- `0070_deposit_match_review_records.sql` and the Drizzle journal remained aligned; no migration
  renumbering was needed after fetching `origin/main`.
- Dead-code export pruning was reconciled with later feature lanes by keeping only required public
  provider/domain subpath exports, including `authorization-fixtures`, provider testing helpers,
  and the document conversion review provider instance used by API queue routes.
- Docs/proof conflicts were resolved additively. Every lane proof note, validation index entry,
  and workboard summary was preserved, with the API route inventory note closing the only new
  incomplete-implementation audit follow-up.
- Self-hosting readiness evidence from the lane was preserved, then mainline validation added fresh
  Docker app smoke and Docker Chromium E2E proof on the integrated result.
- Public interfaces and data surfaces for deposit match review records, document retention review
  cues, inbound-email replay request recovery, lifecycle close behavior, lifecycle action
  descriptors, AI proposal authorization fixtures, and provider document conversion metadata were
  preserved.
- Boundary posture remains synthetic-data-only, matter-scoped, metadata-only for provider document
  conversion, no raw provider payload retention, no live settlement, no automatic trust posting,
  and no destructive lifecycle cleanup.

## Selector Output

The final integrated proof path set has 176 paths against `origin/main`, including this proof note.
The selector command was:

```bash
pnpm verify:select -- --base-plus-dirty origin/main
```

It emitted:

```text
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
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                        | Result  | Notes                                                                                                                                      |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --base origin/main`     | Passed  | Selected the broad integrated command set before the proof note was added.                                                                 |
| `pnpm ci:local`                                | Passed  | Final rerun passed after resolving a Prettier drift and import/export breakage introduced by the dead-code export prune.                   |
| `pnpm --filter @open-practice/domain build`    | Passed  | Focused integration repair check.                                                                                                          |
| `pnpm --filter @open-practice/providers build` | Passed  | Focused integration repair check.                                                                                                          |
| `pnpm --filter @open-practice/api typecheck`   | Passed  | Focused integration repair check for AI proposal fixtures and document conversion provider imports.                                        |
| `pnpm migrations:check`                        | Passed  | Migration parity passed: 71 SQL files match 71 journal entries.                                                                            |
| `pnpm migrations:lint`                         | Passed  | Migration lint passed: 0 changed SQL migration files reviewed.                                                                             |
| `pnpm migrations:replay`                       | Passed  | First attempt found no local Postgres on `localhost:35432`; after `docker compose up -d postgres`, 71 migrations replayed and cleaned up.  |
| `pnpm deps:audit`                              | Passed  | Production and dev audits found no known vulnerabilities.                                                                                  |
| `pnpm deps:licenses`                           | Passed  | Dependency license report reviewed 564 packages and 591 versions; review-required groups unchanged.                                        |
| `pnpm deps:supply-chain`                       | Passed  | Lockfile supply-chain policy passed with 5 native-build approval entries reviewed.                                                         |
| `pnpm deps:osv`                                | Skipped | Skipped because `osv-scanner` is not installed locally; artifact `.tmp/security/osv/2026-06-20T23-14-53Z/osv-review.json`.                 |
| `pnpm license:scan`                            | Skipped | Skipped because `scancode` is not installed locally; artifact `.tmp/license/scancode/2026-06-20T23-14-53Z/license-source-scan.json`.       |
| `pnpm api:contract`                            | Passed  | Wrote `.tmp/api-contract/openapi.json` with 310 paths.                                                                                     |
| `pnpm architecture:check`                      | Passed  | Architecture import policy passed with 442 workspace import edges reviewed.                                                                |
| `pnpm docker:app-smoke`                        | Passed  | Containerized API health was PostgreSQL-backed, web served, setup-status returned API JSON, and the disposable stack was torn down.        |
| `pnpm e2e:docker`                              | Passed  | Docker Chromium suite passed 3/3, including dashboard sweep and external-upload receipt layout; disposable stack and volumes were removed. |
| `pnpm verify:select -- --base-plus-dirty main` | Pending | To rerun after the final post-prune evidence update.                                                                                       |
| `pnpm format:check`                            | Pending | To rerun after proof/index/workboard edits.                                                                                                |
| `pnpm docs:check`                              | Pending | To rerun after proof/index/workboard edits.                                                                                                |
| `pnpm policy:check`                            | Pending | To rerun after proof/index/workboard edits.                                                                                                |
| `pnpm proof:reconcile -- --proof <this proof>` | Pending | To rerun after proof/index/workboard edits.                                                                                                |

Validation forced one integration follow-up commit:

- `fix: resolve mainline integration exports` (`731aac49`): restored the AI proposal test's
  authorization fixture import from the explicit domain subpath and exported the document
  conversion provider instance required by the API document-processing queue route.

## Publish And Prune

Pending final validated proof commit, `main` fast-forward, `origin/main` push, parity verification,
clean merged worktree and branch pruning, and final stash-count confirmation. This section will be
updated after those operations complete.

## Final Changed Paths

```text
apps/api/src/http/fresh-auth.ts
apps/api/src/http/http.test.ts
apps/api/src/http/response.ts
apps/api/src/http/validation.ts
apps/api/src/routes/ai-operational-proposals.test.ts
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/payment-import-review-records.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/documents.test.ts
apps/api/src/routes/documents.ts
apps/api/src/routes/draft-assist.test.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email/parser-jobs.ts
apps/api/src/routes/intake.test.ts
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/matters.test.ts
apps/api/src/routes/operational-views.test.ts
apps/api/src/routes/public-token-rate-limits.ts
apps/api/src/routes/shares.test.ts
apps/api/src/server.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/billing/server-resources.ts
apps/web/app/_features/calendar/server-resources.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/_features/email-delivery/server-resources.ts
apps/web/app/_shared/server-api.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/dashboard/matter-overview-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/external-uploads/ExternalUploadRunner.tsx
apps/web/app/external-uploads/runner-utils.test.ts
apps/web/app/external-uploads/runner-utils.ts
apps/web/app/guest-sessions/GuestSessionRunner.tsx
apps/web/app/guest-sessions/runner-utils.test.ts
apps/web/app/guest-sessions/runner-utils.ts
apps/web/app/publicTokenClient.test.ts
apps/web/app/publicTokenClient.ts
apps/web/app/share-link-portal.ts
apps/web/app/share-links/ShareLinkRunner.tsx
apps/web/app/styles/50-setup-auth.css
apps/web/app/styles/90-responsive-motion.css
apps/web/next.config.d.mts
apps/web/tsconfig.json
apps/worker/src/processors.test.ts
apps/worker/src/processors.ts
apps/worker/src/processors/inbound-email-poll.test.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/processors/inbound-email.ts
apps/worker/src/processors/metadata.ts
apps/worker/src/processors/ocr.ts
apps/worker/src/provider-mail-sender.ts
apps/worker/src/worker.ts
docs/api-and-state-machines.md
docs/archive/planning-completed-archive.md
docs/improvement-opportunities.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/validation/OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md
docs/validation/OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md
docs/validation/OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md
docs/validation/OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md
docs/validation/OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md
docs/validation/OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md
docs/validation/OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md
docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md
docs/validation/OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md
docs/validation/OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md
docs/validation/OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md
docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md
docs/validation/OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-20.md
docs/validation/OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md
docs/validation/OP_SELF_HOSTING_RELEASE_READINESS_DRILL_PROOF_2026-06-20.md
docs/validation/README.md
output/playwright/matterless-open-practice/calendar-desktop.png
output/playwright/matterless-open-practice/calendar-mobile.png
output/playwright/matterless-open-practice/contacts-desktop.png
output/playwright/matterless-open-practice/contacts-mobile.png
output/playwright/matterless-open-practice/screenshot-results.json
output/playwright/op-t102/dashboard-calendar-desktop.png
output/playwright/op-t102/dashboard-calendar-mobile.png
output/playwright/op-t102/public-admitted-desktop.png
output/playwright/op-t102/public-admitted-mobile.png
output/playwright/op-t102/public-denied-desktop.png
output/playwright/op-t102/public-denied-mobile.png
output/playwright/op-t102/public-ended-desktop.png
output/playwright/op-t102/public-ended-mobile.png
output/playwright/op-t102/public-expired-desktop.png
output/playwright/op-t102/public-expired-mobile.png
output/playwright/op-t102/public-issued-desktop.png
output/playwright/op-t102/public-issued-mobile.png
output/playwright/op-t102/public-locked-desktop.png
output/playwright/op-t102/public-locked-mobile.png
output/playwright/op-t102/public-not-configured-desktop.png
output/playwright/op-t102/public-not-configured-mobile.png
output/playwright/op-t102/public-revoked-desktop.png
output/playwright/op-t102/public-revoked-mobile.png
output/playwright/op-t102/public-waiting-desktop.png
output/playwright/op-t102/public-waiting-mobile.png
output/playwright/op-t108-t112/billing-desktop.png
output/playwright/op-t108-t112/billing-mobile.png
output/playwright/op-t108-t112/contacts-desktop.png
output/playwright/op-t108-t112/contacts-mobile.png
output/playwright/op-t108-t112/receipt-confirmation-desktop.png
output/playwright/op-t108-t112/receipt-confirmation-mobile.png
output/playwright/op-t108-t112/saved-views-desktop.png
output/playwright/op-t108-t112/saved-views-mobile.png
output/playwright/op-t114/desktop-created.png
output/playwright/op-t114/desktop-zero.png
output/playwright/op-t114/mobile-zero.png
output/playwright/op-t84-t86-queues-smoke.png
output/playwright/op-t89/external-upload-desktop.png
output/playwright/op-t89/external-upload-mobile.png
output/playwright/op-t89/intake-desktop.png
output/playwright/op-t89/intake-mobile.png
output/playwright/op-t89/share-desktop.png
output/playwright/op-t89/share-mobile.png
output/playwright/op-t89/share-verified-mobile.png
packages/database/migrations/0070_deposit_match_review_records.sql
packages/database/migrations/meta/_journal.json
packages/database/package.json
packages/database/src/index.ts
packages/database/src/repository.ts
packages/database/src/repository/documents-contracts.ts
packages/database/src/repository/documents/drizzle.ts
packages/database/src/repository/documents/memory.ts
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/payment-import-review-records-contracts.ts
packages/database/src/repository/payment-import-review-records/drizzle.ts
packages/database/src/repository/payment-import-review-records/memory.ts
packages/database/src/schema/billing.ts
packages/database/test/repository.matter-lifecycle.test.ts
packages/database/test/repository.payment-import-review-records.test.ts
packages/database/test/schema.test.ts
packages/domain/package.json
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/authorization-fixtures.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
packages/domain/src/document-suggestions.test.ts
packages/domain/src/document-suggestions.ts
packages/domain/src/index.ts
packages/domain/src/matter-lifecycle.test.ts
packages/domain/src/matter-lifecycle.ts
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
packages/domain/src/permissions.test.ts
packages/domain/src/permissions.ts
packages/providers/package.json
packages/providers/src/document-conversion.ts
packages/providers/src/draft-assist.ts
packages/providers/src/index.ts
packages/providers/src/operations.ts
packages/providers/src/signatures.ts
packages/providers/src/testing.ts
packages/providers/test/providers.test.ts
pnpm-workspace.yaml
scripts/dev-seed.mjs
scripts/route-authorization-manifest.mjs
```
