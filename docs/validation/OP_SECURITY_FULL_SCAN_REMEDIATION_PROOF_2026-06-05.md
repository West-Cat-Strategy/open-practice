# Open Practice Security Full-Scan Remediation Proof - 2026-06-05

## Scope

- Branch: `security/full-scan-remediation-2026-06-05`
- Worktree: `/Users/bryan/projects/open-practice`
- Scan id: `696df7c_20260605T215920Z`
- Formal scan directory:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z`
- Data posture: synthetic fixtures only. No client, matter, credential, payment, private
  deployment, raw MIME, signing, storage-key, or private note material was added to proof or tests.

This proof closes the repository-wide Codex Security remediation lane for the 2026-06-05 full scan.
The final report is local validation evidence, while this tracked proof records the repo-facing
changes and validation receipts.

## Formal Scan Bundle

- Threat model source:
  `/tmp/codex-security-scans/open-practice/threat_model.md`
- Copied threat model:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/01_context/threat_model.md`
- Rank input:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/02_discovery/rank_input.csv`
- Deep-review input:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/02_discovery/deep_review_input.csv`
- Work ledger:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/02_discovery/work_ledger.jsonl`
- Raw candidates:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/02_discovery/raw_candidates.jsonl`
- Deduped candidates:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/04_reconciliation/deduped_candidates.jsonl`
- Dedupe report:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/04_reconciliation/dedupe_report.md`
- Repository coverage ledger:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/03_coverage/repository_coverage_ledger.md`
- Reviewed surfaces:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/03_coverage/reviewed_surfaces.md`
- Validation summary:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/validation_summary.md`
- Attack-path summary:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/attack_path_analysis_report.md`
- Final report:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/report.md`
- Rendered report:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/report.html`

The final Codex Security worklist contains 4499 rows after adding touched deployment, security,
docs, Docker, and config surfaces. The deep-review input covers 100% of that worklist. The report
validator passed, and the HTML report rendered successfully; no `report_validation.md` blocker note
was needed.

Candidate ledgers are present under:

```text
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-001
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-002
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-003
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-004
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-005
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-006
/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/artifacts/05_findings/OPSEC-2026-06-05-007
```

## Fixed Candidates

- Inbound-email list/detail serialization now redacts staff-triage private-note text by replacing
  raw `metadata.staffTriage` with `serializeStaffTriageDetail(...)`.
- Known expired or revoked public guest-session token probes keep the generic `410` response and
  now write redacted `calendar_guest_link` access logs before loading session timing/count/lobby
  details.
- Memory and Drizzle `recordAuditEvent` legacy calls now delegate through `appendAuditEvent`
  semantics, ignoring caller-supplied sequence and hash-chain fields.
- Migration `0051_audit_event_sequence.sql` backfills audit sequence by walking each firm chain
  from the 64-zero genesis hash and fails if any row remains unchained.
- Drizzle duplicate checksum checks for direct document upload completion and inbound attachment
  promotion now run inside transactions guarded by the same PostgreSQL advisory transaction lock
  keyed by `firmId|matterId|checksumSha256`.
- Staff aggregate denials now cover broad `/api/matters`, `/api/overview`, `/api/queues`,
  `/api/tasks/workbench`, `/api/operational-views`, `/api/intake-sessions`,
  `/api/signature-requests`, and broad billing list routes for `client_external` contexts.

The two read-only subagent reviews found no blocking code issues. One residual test gap for expired
guest-token logging and one static coverage gap for duplicate-check locking were closed in this
lane.

## Changed Paths

```text
apps/api/src/http/auth-guards.ts
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/email.test.ts
apps/api/src/routes/email.ts
apps/api/src/routes/external-uploads.test.ts
apps/api/src/routes/external-uploads.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email.ts
apps/api/src/routes/intake.test.ts
apps/api/src/routes/intake.ts
apps/api/src/routes/matters.test.ts
apps/api/src/routes/matters.ts
apps/api/src/routes/operational-views.test.ts
apps/api/src/routes/operational-views.ts
apps/api/src/routes/queues.test.ts
apps/api/src/routes/queues.ts
apps/api/src/routes/shares.test.ts
apps/api/src/routes/shares.ts
apps/api/src/routes/signatures.test.ts
apps/api/src/routes/signatures.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/routes/tasks.ts
apps/api/src/server.test.ts
apps/api/src/server.ts
apps/web/app/page.tsx
apps/worker/src/processors.test.ts
apps/worker/src/processors.ts
docker-compose.yml
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docs/api-and-state-machines.md
docs/development/github-maintenance.md
docs/planning-and-progress.md
docs/validation/OP_SECURITY_FULL_SCAN_REMEDIATION_PROOF_2026-06-05.md
docs/validation/README.md
packages/database/migrations/0051_audit_event_sequence.sql
packages/database/migrations/meta/_journal.json
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/schema.ts
packages/database/test/repository.inbound-email.test.ts
packages/database/test/repository.test.ts
packages/database/test/schema.test.ts
packages/domain/src/audit-taxonomy.test.ts
packages/domain/src/audit.ts
```

## Validation

Selector and prerequisite builds:

```bash
pnpm verify:select -- --files $(git diff --name-only) $(git diff --cached --name-only) $(git ls-files --others --exclude-standard)
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
```

Targeted regression coverage:

```bash
pnpm --filter @open-practice/api test -- calendar.test.ts inbound-email.test.ts tasks.test.ts operational-views.test.ts intake.test.ts signatures.test.ts
pnpm --filter @open-practice/database test -- repository.test.ts repository.inbound-email.test.ts schema.test.ts
```

Package tests and typechecks:

```bash
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
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Security, policy, docs, and formatting gates:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm security:scan
pnpm audit --prod
pnpm audit --dev
git diff --check
```

Docker evidence:

```bash
docker compose config
docker compose build --pull mailpit minio
docker scout quickview open-practice-mailpit:v1.30.1-go1.26.4
docker scout cves --only-severity critical,high open-practice-mailpit:v1.30.1-go1.26.4
docker scout recommendations open-practice-mailpit:v1.30.1-go1.26.4
docker scout quickview open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
docker scout cves --only-severity critical,high open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
docker scout recommendations open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
pnpm e2e:docker
```

Final local gate:

```bash
pnpm ci:local
```

Results:

- Domain tests passed: 24 files / 173 tests.
- Database tests passed: 18 files / 107 tests.
- API tests passed: 41 files / 495 tests.
- Worker tests passed: 3 files / 36 tests.
- Providers tests passed: 7 files / 18 tests.
- Web tests passed: 20 files / 140 tests.
- `pnpm --filter @open-practice/database db:check` passed with `Everything's fine`.
- `pnpm migrations:check` passed with 52 SQL files matching 52 journal entries.
- `pnpm security:scan` passed with no high-confidence tracked secrets.
- `pnpm audit --prod` and `pnpm audit --dev` passed with no known vulnerabilities.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm build`, and
  `git diff --check` passed.
- `pnpm e2e:docker` passed with 5 Docker Chromium Playwright checks and cleaned up the disposable
  `open-practice-e2e` Compose stack.
- `pnpm ci:local` passed after proof and validation-index reconciliation.

## Docker Residuals

- Mailpit Scout quickview: `0C/1H/1M/0L`.
- Mailpit critical/high CVE scan: one high residual in `github.com/gomarkdown/markdown`; Scout
  listed no fixed version and no same-contract recommendation that resolved it.
- MinIO Scout quickview: `11C/16H/19M/2L`.
- MinIO critical/high CVE scan: `11C/16H` across upstream MinIO and Go module residuals; Scout
  listed the Alpine base as current and no same-contract base recommendation that resolved the
  application/module residuals.
- Postgres remains documented in [GitHub Maintenance](../development/github-maintenance.md) with
  its local-only `curl/libcurl` residual.

No application-code Critical or High findings survived the final Codex Security scan, validation,
and attack-path review on this branch.
