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
| `private-pilot/minio-hardening-proof-20260624`     | `338c5d0`  | Bundled-MinIO hardening and refreshed accepted residual-watch proof. |

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
- After the first `main` push, the MinIO lane still held a clean-room docs-only refresh for its
  private-pilot proof artifacts. That refresh was committed as `338c5d0` and merged into `main` as
  `1c964b68` before branch/worktree pruning.

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

| Command                                                                                                                                            | Result                   | Notes                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main`                                                                                                         | Pass                     | Selected the broad integrated command set for the merged branch.                                                                                                                                                            |
| `pnpm verify:select -- --base-plus-dirty origin/main`                                                                                              | Pass                     | Selected the same broad command set before proof/index closeout edits.                                                                                                                                                      |
| `pnpm verify:select -- --files <105 final changed paths>`                                                                                          | Pass                     | Reconfirmed the final exact path set after proof and validation-fix edits.                                                                                                                                                  |
| `pnpm --filter @open-practice/providers lint`                                                                                                      | Pass                     | Focused rerun after the OCR provider lint fix.                                                                                                                                                                              |
| `pnpm --filter @open-practice/database exec vitest run test/repository.first-run.test.ts test/repository.document-assembly.test.ts --reporter=dot` | Pass                     | Focused rerun after aligning Canadian sample title/version assertions.                                                                                                                                                      |
| `node --test scripts/selfhost-check.test.mjs`                                                                                                      | Pass                     | Covered the new self-host public API origin validation and Compose rendering requirement.                                                                                                                                   |
| `node --test scripts/selfhost-restore-drill.test.mjs`                                                                                              | Pass                     | Covered the restore-drill fixture after adding the self-host public API origin key.                                                                                                                                         |
| `pnpm --filter @open-practice/web exec vitest run app/client-portal-workspace.test.tsx --reporter=dot`                                             | Pass                     | Covered the stricter client-portal signature action surface.                                                                                                                                                                |
| `pnpm ci:local`                                                                                                                                    | Pass after fixes         | Initial runs caught OCR lint, stale Canadian sample DB assertions, and restore-drill fixture gaps. Final pass also ran format, lint, typecheck, tests, `db:check`, policy, build, and `git diff --check`.                   |
| `pnpm deps:audit`                                                                                                                                  | Pass                     | Dependency audit completed.                                                                                                                                                                                                 |
| `pnpm deps:licenses`                                                                                                                               | Pass                     | License evidence completed; review-required license groups remain recorded, with zero disallowed groups.                                                                                                                    |
| `pnpm deps:supply-chain`                                                                                                                           | Pass                     | Lockfile and native-build approval review completed.                                                                                                                                                                        |
| `pnpm deps:osv`                                                                                                                                    | Pass                     | Artifact: `.tmp/security/osv/2026-06-26T05-17-45Z`.                                                                                                                                                                         |
| `pnpm license:scan`                                                                                                                                | Pass                     | Artifact: `.tmp/license/scancode/2026-06-26T05-17-45Z`.                                                                                                                                                                     |
| `pnpm security:review`                                                                                                                             | Pass                     | Artifact: `.tmp/open-practice-security-review/2026-06-26T05-19-28Z`.                                                                                                                                                        |
| `pnpm security:secrets-history`                                                                                                                    | Review required          | Local Gitleaks history artifact `.tmp/security/gitleaks/2026-06-26T05-25-00Z`; command exited `0` and did not expose tracked proof secrets.                                                                                 |
| `pnpm architecture:check`                                                                                                                          | Pass                     | 449 workspace import edges reviewed.                                                                                                                                                                                        |
| `pnpm api:contract`                                                                                                                                | Pass                     | 310 OpenAPI paths emitted to `.tmp/api-contract/openapi.json`.                                                                                                                                                              |
| `pnpm docker:lint`                                                                                                                                 | Pass                     | Artifact: `.tmp/docker/lint/2026-06-26T05-25-10Z`.                                                                                                                                                                          |
| `pnpm docker:residual-watch`                                                                                                                       | Pass                     | Artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-26T05-25-22Z`; bundled MinIO residuals accepted only through the hardening proof path.                                                     |
| `pnpm docker:app-smoke`                                                                                                                            | Pass after retry         | First run hit Docker VM free-space exhaustion in Postgres. Reclaimed unused Docker build cache, then PostgreSQL-backed API/web smoke passed.                                                                                |
| `pnpm docker:scan`                                                                                                                                 | Pass                     | Artifact: `.tmp/docker/trivy/2026-06-26T05-33-22Z`.                                                                                                                                                                         |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                                          | Pass after fix           | Added `OPEN_PRACTICE_SELFHOST_PUBLIC_API_ORIGIN` and require rendered API `OPEN_PRACTICE_PUBLIC_API_ORIGIN` for production readiness.                                                                                       |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                                  | Pass after fix           | First run failed because production API origin was missing. Rerun passed with artifact `.tmp/open-practice-selfhost-restore-drill/2026-06-26T05-37-26Z`.                                                                    |
| `pnpm e2e:host`                                                                                                                                    | Pass after fix           | Updated public intake labels and signature dashboard sentinel for Canadian sample wording.                                                                                                                                  |
| `pnpm e2e:docker`                                                                                                                                  | Pass after retry         | First run failed with MinIO `507 XMinioStorageFull` due Docker VM free-space exhaustion. After unused build-cache prune, direct MinIO checksum probe and Docker E2E passed.                                                 |
| `node scripts/run-e2e.mjs first-run`                                                                                                               | Pass                     | First-run setup proof passed.                                                                                                                                                                                               |
| `pnpm e2e:matterless`                                                                                                                              | Pass                     | Matterless starter workspace proof passed.                                                                                                                                                                                  |
| `pnpm e2e:client-portal`                                                                                                                           | Pass after fix           | First run exposed stale terminal signature buttons. UI now only records `viewed`; completed/declined remain provider-evidence events.                                                                                       |
| `pnpm e2e:a11y`                                                                                                                                    | Pass                     | Accessibility sweep passed.                                                                                                                                                                                                 |
| `pnpm migrations:replay`                                                                                                                           | Pass after service start | Initial release attempt found no local Postgres on `localhost:35432`. After `docker compose up -d postgres`, 71 migrations replayed into a disposable database and cleaned up.                                              |
| `pnpm release:local -- --private-pilot`                                                                                                            | Pass after retry         | First artifact `artifacts/release-local/2026-06-26T06-07-35Z` failed on local CI fixture and missing local Postgres. Final artifact `artifacts/release-local/2026-06-26T06-12-46Z` passed with no recorded check omissions. |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md --base-plus-dirty origin/main`                   | Pass                     | Reconciled 105 final paths and the selected command set.                                                                                                                                                                    |
| `pnpm proof:reconcile -- --proof docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md --base 79e35ece076bf0e6d2ed37c565fee24304cdc7c5` | Pass                     | Reconciled the post-prune proof update against the original closeout base.                                                                                                                                                  |
| `pnpm format:check`                                                                                                                                | Pass                     | Rerun after merging the refreshed MinIO proof evidence.                                                                                                                                                                     |
| `pnpm docs:check`                                                                                                                                  | Pass                     | Rerun after merging the refreshed MinIO proof evidence.                                                                                                                                                                     |
| `pnpm policy:check`                                                                                                                                | Pass                     | Rerun after merging the refreshed MinIO proof evidence.                                                                                                                                                                     |
| `git diff --check`                                                                                                                                 | Pass                     | Whitespace check passed after proof formatting.                                                                                                                                                                             |

## Publish And Prune

`main` was fast-forwarded to the validated integration branch and pushed once at `8c031c72`. After
the docs-only MinIO proof refresh merge, `main` was pushed again to `1c964b68`.

```text
To https://github.com/West-Cat-Strategy/open-practice.git
   8c031c72..1c964b68  main -> main
```

Post-push parity before pruning:

```text
git rev-list --left-right --count main...origin/main
0 0

git rev-parse main
1c964b682e0b0093475acfd0d335a73b7774c933

git rev-parse origin/main
1c964b682e0b0093475acfd0d335a73b7774c933

git ls-remote --heads origin main
1c964b682e0b0093475acfd0d335a73b7774c933	refs/heads/main

git stash list | wc -l
42

git status --short --branch
## main...origin/main
```

The clean merged sibling worktrees were removed:

```text
/Users/bryan/projects/open-practice-canadian-templates-20260624
/Users/bryan/projects/open-practice-ocr-cli-20260624
/Users/bryan/projects/open-practice-security-deep-main-20260624
/Users/bryan/projects/open-practice-minio-hardening-proof-20260624
```

The merged local branches were deleted:

```text
Deleted branch codex/canadian-templates-samples-20260624 (was c944c078).
Deleted branch codex/reliable-local-pdf-ocr-20260624 (was f2891c75).
Deleted branch private-pilot/external-s3-restore-drill-20260624 (was 00d5af00).
Deleted branch private-pilot/minio-hardening-proof-20260624 (was 338c5d0c).
Deleted branch security/deep-scan-main-20260624 (was af5ab9b9).
Deleted branch merge/open-practice-mainline-20260625 (was 8c031c72).
```

`git worktree prune --verbose` and `git remote prune origin` both completed with no additional
output.

Post-prune evidence:

```text
git worktree list --porcelain
worktree /Users/bryan/projects/open-practice
HEAD 1c964b682e0b0093475acfd0d335a73b7774c933
branch refs/heads/main

git branch --format='%(refname:short)' | rg '^(codex/canadian-templates-samples-20260624|codex/reliable-local-pdf-ocr-20260624|private-pilot/external-s3-restore-drill-20260624|private-pilot/minio-hardening-proof-20260624|security/deep-scan-main-20260624|merge/open-practice-mainline-20260625)$' || true
<no output>

git rev-list --left-right --count main...origin/main
0 0

git rev-parse main
1c964b682e0b0093475acfd0d335a73b7774c933

git rev-parse origin/main
1c964b682e0b0093475acfd0d335a73b7774c933

git ls-remote --heads origin main
1c964b682e0b0093475acfd0d335a73b7774c933	refs/heads/main

git stash list | wc -l
42

git status --short --branch
## main...origin/main
```

Required final invariants:

- `main`, `origin/main`, and the GitHub remote head match at
  `1c964b682e0b0093475acfd0d335a73b7774c933` before this docs-only evidence commit.
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
apps/web/app/client-portal-workspace.test.tsx
apps/web/app/client-portal-workspace.tsx
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
e2e/host.spec.ts
e2e/ui-ux.spec.ts
packages/database/test/repository.document-assembly.test.ts
packages/database/test/repository.first-run.test.ts
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
