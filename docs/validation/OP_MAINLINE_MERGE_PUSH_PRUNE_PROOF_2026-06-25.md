# OP Mainline Merge Push Prune Proof - 2026-06-25

This proof records the Open Practice active-lane closeout from `origin/main` at
`79e35ece076bf0e6d2ed37c565fee24304cdc7c5` into integration branch
`merge/open-practice-mainline-20260625`.

## Scope

Five active lanes were committed or adopted before integration. Initial stash count was `42`; stashes
are intentionally preserved throughout this closeout.

| Branch                                             | Commit     | Scope                                                                |
| -------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `codex/canadian-templates-samples-20260624`        | `c944c07`  | Canadian starter templates, presets, samples, and proof.             |
| `codex/reliable-local-pdf-ocr-20260624`            | `f2891c7`  | Local OCRmyPDF/Tesseract provider and OCR worker profile.            |
| `security/deep-scan-main-20260624`                 | `af5ab9b9` | Deep security remediation proof after two runtime hardening commits. |
| `private-pilot/external-s3-restore-drill-20260624` | `00d5af0`  | External HTTPS S3 restore-drill code path and manual handoff proof.  |
| `private-pilot/minio-hardening-proof-20260624`     | `143b001`  | Bundled-MinIO hardening and accepted residual-watch proof path.      |

## Merge Reconciliation

- `codex/canadian-templates-samples-20260624` merged first and kept synthetic Canadian operational
  wording while preserving preset IDs, sample IDs, API shapes, schemas, dependencies, and legal
  advice boundaries.
- `codex/reliable-local-pdf-ocr-20260624` merged second. The proof-index conflict was resolved
  additively so Canadian and OCR proof notes both remain current.
- `security/deep-scan-main-20260624` merged third. Runtime overlaps auto-merged; the proof-index
  conflict was resolved additively so the deep-security proof remains visible.
- `private-pilot/external-s3-restore-drill-20260624` merged fourth. The workboard conflict was
  resolved so external HTTPS S3 operator evidence remains pending because the ignored operator env
  currently contains placeholder values.
- `private-pilot/minio-hardening-proof-20260624` merged last. Conflicts were resolved so Admin
  Readiness, self-hosting docs, selector guidance, validation proof index, and `selfhost-check`
  preserve both paths: bundled MinIO residuals are accepted only through the hardening proof gate,
  while external HTTPS S3 restore-drill evidence remains manual handoff evidence for the alternate
  object-storage path.

The merge preserves local-only self-hosting boundaries, synthetic proof, no client or matter data,
no credential/payment/private deployment details, no runtime API/schema migrations beyond the
merged lanes, no live settlement, no automatic trust posting, and no raw private document text in
public metadata.

## Selector Output

The initial integrated selector commands were:

```bash
pnpm verify:select -- --base origin/main
pnpm verify:select -- --base-plus-dirty origin/main
```

Both emitted:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm security:review
pnpm security:secrets-history
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
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

| Command                                                                                                                          | Result  | Notes                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main`                                                                                       | Pass    | Selected the broad integrated command set for the merged branch.       |
| `pnpm verify:select -- --base-plus-dirty origin/main`                                                                            | Pass    | Selected the same broad command set before proof/index closeout edits. |
| `pnpm ci:local`                                                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm deps:audit`                                                                                                                | Pending | To be updated with final command evidence.                             |
| `pnpm deps:licenses`                                                                                                             | Pending | To be updated with final command evidence.                             |
| `pnpm deps:supply-chain`                                                                                                         | Pending | To be updated with final command evidence.                             |
| `pnpm deps:osv`                                                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm license:scan`                                                                                                              | Pending | To be updated with final command evidence.                             |
| `pnpm security:review`                                                                                                           | Pending | To be updated with final command evidence.                             |
| `pnpm security:secrets-history`                                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm architecture:check`                                                                                                        | Pending | To be updated with final command evidence.                             |
| `pnpm api:contract`                                                                                                              | Pending | To be updated with final command evidence.                             |
| `pnpm docker:lint`                                                                                                               | Pending | To be updated with final command evidence.                             |
| `pnpm docker:residual-watch`                                                                                                     | Pending | To be updated with final command evidence.                             |
| `pnpm docker:app-smoke`                                                                                                          | Pending | To be updated with final command evidence.                             |
| `pnpm docker:scan`                                                                                                               | Pending | To be updated with final command evidence.                             |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                        | Pending | To be updated with final command evidence.                             |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                | Pending | To be updated with final command evidence.                             |
| `pnpm e2e:host`                                                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm e2e:docker`                                                                                                                | Pending | To be updated with final command evidence.                             |
| `node scripts/run-e2e.mjs first-run`                                                                                             | Pending | To be updated with final command evidence.                             |
| `pnpm e2e:matterless`                                                                                                            | Pending | To be updated with final command evidence.                             |
| `pnpm e2e:client-portal`                                                                                                         | Pending | To be updated with final command evidence.                             |
| `pnpm e2e:a11y`                                                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm format:check`                                                                                                              | Pending | To be updated with final command evidence.                             |
| `pnpm docs:check`                                                                                                                | Pending | To be updated with final command evidence.                             |
| `pnpm policy:check`                                                                                                              | Pending | To be updated with final command evidence.                             |
| `pnpm test`                                                                                                                      | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/domain test`                                                                                       | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/domain typecheck`                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/domain build`                                                                                      | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/api test`                                                                                          | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/api typecheck`                                                                                     | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/providers test`                                                                                    | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/providers typecheck`                                                                               | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/providers build`                                                                                   | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/worker test`                                                                                       | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/worker typecheck`                                                                                  | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/worker build`                                                                                      | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/web test`                                                                                          | Pending | To be updated with final command evidence.                             |
| `pnpm --filter @open-practice/web typecheck`                                                                                     | Pending | To be updated with final command evidence.                             |
| `pnpm build`                                                                                                                     | Pending | To be updated with final command evidence.                             |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md --base-plus-dirty origin/main` | Pending | To be rerun after this proof and closeout docs settle.                 |
| `git diff --check`                                                                                                               | Pending | To be updated with final command evidence.                             |

## Publish And Prune

Publication and prune evidence will be recorded after the validated integration branch is
fast-forwarded into `main`, pushed to `origin/main`, and clean merged worktrees/branches are pruned.

Required final invariants:

- `main`, `origin/main`, and the GitHub remote head match.
- `git rev-list --left-right --count main...origin/main` reports `0 0`.
- Only `/Users/bryan/projects/open-practice` remains as an Open Practice worktree.
- Merged lane branches and `merge/open-practice-mainline-20260625` are deleted locally.
- Stash count remains `42`.

## Final Changed Paths

```text
.env.example
Dockerfile
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/calendar/credentials.ts
apps/api/src/routes/calendar/feed.ts
apps/api/src/routes/calendar/guest-sessions.ts
apps/api/src/routes/calendar/shared.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/client-portal/accounts.ts
apps/api/src/routes/client-portal/signatures.ts
apps/api/src/routes/client-portal/workspace.ts
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/document-assembly.test.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/documents.test.ts
apps/api/src/routes/email.test.ts
apps/api/src/routes/email.ts
apps/api/src/routes/email/receipts.ts
apps/api/src/routes/email/settings.ts
apps/api/src/routes/external-uploads.test.ts
apps/api/src/routes/external-uploads/public.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email.ts
apps/api/src/routes/inbound-email/imap-settings.ts
apps/api/src/routes/inbound-email/mailgun-raw-mime.ts
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms/public.ts
apps/api/src/routes/intake.test.ts
apps/api/src/routes/provider-egress.ts
apps/api/src/routes/providers-status.test.ts
apps/api/src/routes/signatures.ts
apps/api/src/routes/types.ts
apps/api/src/server.test.ts
apps/api/src/server.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/security-headers.test.ts
apps/web/next.config.mjs
apps/worker/src/processors.test.ts
apps/worker/src/processors.ts
apps/worker/src/processors/inbound-email-poll.test.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/processors/ocr.ts
apps/worker/src/provider-egress.ts
apps/worker/src/provider-mail-sender.test.ts
apps/worker/src/provider-mail-sender.ts
apps/worker/src/worker.test.ts
apps/worker/src/worker.ts
docker-compose.selfhost.yml
docker-compose.yml
docker/selfhost.example.env
docs/api-and-state-machines.md
docs/development/getting-started.md
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/tech-stack.md
docs/testing/TESTING.md
docs/validation/OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md
docs/validation/OP_DEEP_SECURITY_REMEDIATION_PROOF_2026-06-24.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md
docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md
docs/validation/OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md
docs/validation/OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md
docs/validation/README.md
packages/domain/src/contacts.test.ts
packages/domain/src/drafting.test.ts
packages/domain/src/drafting.ts
packages/domain/src/intake.test.ts
packages/domain/src/outbound-webhooks.test.ts
packages/domain/src/outbound-webhooks.ts
packages/domain/src/permissions.ts
packages/domain/src/practice-presets.ts
packages/domain/src/sample-data.ts
packages/providers/package.json
packages/providers/src/document-conversion.ts
packages/providers/src/index.ts
packages/providers/src/ocr/local-cli.test.ts
packages/providers/src/ocr/local-cli.ts
packages/providers/src/ocr/tesseract.ts
packages/providers/test/providers.test.ts
scripts/reconcile-validation-proof.mjs
scripts/reconcile-validation-proof.test.mjs
scripts/run-e2e.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/selfhost-check.mjs
scripts/selfhost-check.test.mjs
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```
