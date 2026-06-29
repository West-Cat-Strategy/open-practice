# Validation Proof Index

Use this index for current handoff proof, row-local validation notes, proof-file navigation, and
skipped-check context. The live workboard remains
[Planning and Progress](../planning-and-progress.md); completed workboard summaries live in
[Archive](../archive/README.md).

## Start Here

1. Open [Planning and Progress](../planning-and-progress.md) first for current ownership, status,
   and the next move.
2. Use [Testing](../testing/TESTING.md) and `pnpm verify:select -- --files <changed paths...>` to
   choose validation before running checks.
3. Record skipped checks with the reason, especially when a browser, Docker, database, or provider
   dependency is unavailable.
4. Keep row ownership and live status out of this index. Archive completed workboard summaries in
   [Archive](../archive/README.md), while this page may keep links to dated proof files.

## Current Handoff Notes

The 2026-06-28 Trust Controls maker-checker readiness proof is recorded in
[OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md](OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md).
It covers the read-only readiness block on `GET /api/ledger/controls`, the Trust Controls dashboard
section, matter-scoped filtering of readiness matter rows, and the preserved no-policy-enabled,
direct-posting-unchanged, no-approval-mutation, no-auto-posting, no-settlement, no-bank-feed, and
no jurisdiction-certified accounting boundaries.

The 2026-06-26 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md).
It covers the all-active-lane closeout through `merge/open-practice-mainline-20260626`, including
features/capabilities audit and remediation, appointment booking tentative holds, structured task
management V3, the calendar tickler review bridge, external S3 env bootstrap, Docker storage
preflight, and Gitleaks history fixture tuning. It records selector-driven validation, migration
renumbering from appointment booking `0071` to structured tasks `0072`, release-proof retry after
starting local replay Postgres, final `main` publication, clean merged worktree/branch pruning, and
unchanged stash count `42`.

The 2026-06-26 OP-T161 calendar tickler review bridge proof is recorded in
[OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md](OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md).
It covers the review-only tickler bridge over existing `calendar_scheduling_requests`, including
duplicate-open-request rejection, typed web payload defaults, Tasks and Calendar dashboard request
actions, task-workbench refresh, and preserved no-new-table/no-migration/no-dependency/
no-provider-sync/no-public-booking/no-court-rule-automation/no-automatic-mutation boundaries.

The 2026-06-26 Docker storage preflight proof is recorded in
[OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md](OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md).
It covers the branch-first local tooling guard that makes `pnpm docker:app-smoke`,
`pnpm e2e:docker`, `pnpm selfhost:restore-drill`, and private-pilot release proof fail early on
avoidable Docker free-space exhaustion while preserving runtime behavior and using synthetic-only
proof. Selector-chosen validation passed; the integrated private-pilot release proof passed after
starting local replay Postgres for `pnpm migrations:replay`.

The 2026-06-26 Gitleaks history false-positive tuning proof is recorded in
[OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md](OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md).
It covers the branch-first local security follow-up that adds exact Gitleaks fingerprints for
reviewed synthetic test/proof fixtures, routes `.gitleaksignore` through the security-review
selector lane, documents the no-broad-allowlist boundary, and preserves tracked-secret scanning
strength plus clean-room posture.

The 2026-06-26 features and capabilities parity remediation proof is recorded in
[OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md](OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md).
It covers the metadata-only document conversion review state/readiness packet, including additive
`conversionReview.reviewReadiness` API/workbench responses, reviewed/rejected conversion-review
posture, bounded worker artifact metadata, and Documents dashboard copy while preserving
provider-disabled/review-only boundaries, no raw OCR/provider evidence, no downstream mutation, no
schema/migration/dependency change, and synthetic-only proof.

The 2026-06-26 appointment booking tentative-holds proof is recorded in
[OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md](OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md).
It covers the branch-first booking profile, website API, direct-link, tentative calendar hold,
staff confirm/dismiss review, public runner, intake status reporting, route authorization, audit
taxonomy, migration, and docs slice while preserving no provider sync, public room URLs, native
media, signaling, chat, recordings, automatic final confirmation, hold auto-expiry, automatic
matter creation, new dependency, raw token, meeting URL, provider payload, or private-data
boundaries.

The 2026-06-26 structured task management V3 proof is recorded in
[OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md](OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md).
It covers additive checklist items, staff-only comments, dependency blockers, reusable templates,
structured task detail reads, route authorization manifest coverage, audit-safe metadata, Tasks
dashboard structured-detail controls, migration/repository/domain validation, and preserved
existing task CRUD, source-pair, archive, workbench, permission, client visibility, provider,
recurrence, dependency, and email boundaries.

The 2026-06-26 features and capabilities parity audit is recorded in
[OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md](OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md).
It maps current Open Practice capabilities across matters, CRM, intake, calendar/tasks, documents,
communications, billing/payments, trust/accounting, reports, AI/legal work, integrations, workers,
admin/security, self-hosting, and validation/release posture. The audit is documentation-only and
records no new candidate backlog rows because the remaining competitive differences are already
shipped first slices, review-only/provider-disabled boundaries, or explicit watch items.

The 2026-06-25 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md).
It covers the all-active-lane closeout through `merge/open-practice-mainline-20260625`, including
Canadian starter template/sample enhancements, reliable local PDF/image OCR, deep security
remediation, external HTTPS S3 restore-drill evidence, and bundled-MinIO hardening proof. It records
selector-driven validation, conflict reconciliation, and final push/prune evidence for the
integrated path.

The 2026-06-24 Canadian template and sample enhancement proof is recorded in
[OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md](OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md).
It covers the branch-first update of first-run starter draft templates, practice-preset embedded
intake definitions, and seeded BC residential-tenancy sample document/intake/assembly metadata with
original synthetic Canadian operational wording. It preserves preset IDs, setup payload
compatibility, sample record IDs/counts, provider assumptions, authorization assumptions, and the
no-email-template-draft/no-delivery/no-dependency/no-migration/no-API-route/no-legal-advice
boundary.

The 2026-06-24 reliable local PDF/image OCR proof is recorded in
[OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md](OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md).
It covers the `codex/reliable-local-pdf-ocr-20260624` branch, including the local OCRmyPDF/Tesseract
provider, byte-sniffed PDF/JPEG/PNG/TIFF eligibility, unsupported-file queue reason, normalized
legacy Tesseract.js confidence, internal-only extracted text retention, metadata redaction, optional
wrapped-runtime reuse record, dedicated `worker-ocr` self-host profile, and Docker worker image
toolchain validation. The proof was refreshed with 2026-06-26 selector-driven package, docs,
self-host, Docker, API contract, workspace build, and proof-reconciliation evidence.

The 2026-06-24 deep security remediation proof is recorded in
[OP_DEEP_SECURITY_REMEDIATION_PROOF_2026-06-24.md](OP_DEEP_SECURITY_REMEDIATION_PROOF_2026-06-24.md).
It covers the `security/deep-scan-main-20260624` branch remediation for all 11 main-branch
deep-scan findings: signature terminal-state authority, signature audit chronology, granular portal
workspace permissions, external-upload reservation, Mailgun raw MIME idempotency ordering, receipt
token form posting, public guest-session count redaction, SMTP/IMAP egress guardrails, trusted
calendar feed origins, and production CSP script policy. `pnpm ci:local` passed; `pnpm
security:review` is accepted with the existing MinIO readiness-blocked result because the only
failed required command was the already-documented Docker residual-watch MinIO private-pilot
blocker.

The 2026-06-24 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md).
It covers the three-lane closeout through `merge/open-practice-mainline-20260624`, including the
private-pilot readiness remediation branch, the private-pilot MinIO readiness blocker branch, and
the video meetings control-plane branch. It records validation, the direct `main` publication,
conservative worktree/branch prune evidence, unchanged stash count `42`, and the final docs-only
proof closeout. That historical closeout recorded the bundled MinIO readiness blocker as still
held at merge time; the later private-pilot MinIO hardening proof supersedes it with proof-gated
residual acceptance.

The 2026-06-23 private-pilot readiness remediation proof is recorded in
[OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md](OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md).
It covers the `private-pilot/readiness-remediation-20260623` branch, including the self-host restore
drill, private-pilot release proof option, malware-scan/share gating regressions, provider
readiness/admin posture, security review evidence normalization and selector options, review-only
workflow preview packets, client-portal activity/read-state posture, comms/scheduling failure
handoff, billing/trust reconciliation packet summaries, and document-processing provider readiness
surfaces. The follow-up fix pass tightens portal notification counts after revoked-thread filtering,
adds matter-scoped backend regressions, exposes explicit web projection types, surfaces retry
handoff and empty-evidence copy, bounds workflow packet summaries, and adds restore-drill selector
coverage plus a webpack-backed E2E dev-runner fix for Docker dashboard sweeps. The optional scanner
closure installs Semgrep, OSV Scanner, ScanCode, Hadolint, Checkov, Trivy, and Docker Scout locally,
fixes the OSV `tar` advisory and Docker scan wrapper compatibility, records non-skipped scanner
evidence, and leaves the bundled MinIO image high/critical Trivy findings as an explicit
owner-visible watch item because the pinned upstream source tag is still current. Final closeout
also records the Docker E2E rerun after clearing local Docker build cache: the first upload receipt
attempt hit Docker internal storage exhaustion, and the rerun passed once the Docker overlay had
room. The proof keeps live payments, bank feeds, automatic trust posting, provider-backed
OCR/AI/transcription activation, public booking/media, production email delivery, provider payload
retention, and raw private text retention as intentional boundaries.

The 2026-06-24 private-pilot MinIO readiness blocker proof is recorded in
[OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md).
It covers the branch-first residual-watch and Admin Readiness follow-up that promotes bundled MinIO
archived-source or Critical/High CVE posture from an owner-visible watch item into a private-pilot
readiness blocker. The branch preserves local-only self-hosting boundaries, checked-in Docker and
MinIO pins, Compose contracts, runtime APIs, schemas, dependency manifests, synthetic proof, and
clean-room upstream posture.

The 2026-06-24 private-pilot external S3 restore-drill proof is recorded in
[OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md).
It covers the branch-first restore-drill follow-up that keeps bundled MinIO behavior unchanged while
allowing an ignored operator env with external HTTPS S3-compatible object storage to produce
synthetic marker backup, deliberate-overwrite, restore, and checksum evidence. The code path and
checked-in bundled MinIO restore-drill proof are locally validated, and the 2026-06-26 follow-up
adds an ignored `.env.selfhost.local` bootstrap plus preflight path so operators can create the
local template, replace placeholders, verify external HTTPS S3 readiness without Docker/S3 actions,
and then run real external proof only after preflight passes. The branch preserves local-only
self-hosting boundaries, runtime APIs, schemas, Compose contracts, dependency manifests, default
private-pilot release-proof behavior, residual-watch semantics, and synthetic-only proof.

The 2026-06-24 private-pilot MinIO hardening proof is recorded in
[OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md).
It covers the separate bundled-MinIO hardening proof path that adds read-only root filesystems and
`/tmp` tmpfs mounts to the local and self-host MinIO services, extends self-host render validation,
teaches Docker residual-watch to record `minioHardening` plus `acceptedResiduals`, and keeps
bundled-MinIO-only Trivy scan findings proof-gated by that same residual-watch evidence. The final
private-pilot release proof passed with self-host restore drill and residual-watch evidence. The
branch preserves MinIO pins, S3 contracts, runtime APIs, schemas, dependencies, private-pilot
release-proof command shape, synthetic proof, and clean-room upstream posture.

The 2026-06-23 video meetings control-plane proof is recorded in
[OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md](OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md).
It covers the branch-first Calendar workspace scheduling-review controls, per-event readiness
labels, public guest-session manual refresh and waiting-only polling without page reload,
header/path token mismatch handling, terminal guest-session `409` transitions, CalDAV/iCalendar
meeting-link preservation and non-disclosure, safe audit metadata, and API/state-machine
documentation updates while preserving the no-native-media/no-signaling/no-chat/no-recording/
no-upload/no-public-booking/no-provider-sync/no-dependency/no-migration boundary. The proof is
reconciled to the current 23-path branch set and records green package, build, host E2E,
first-run, matterless, client-portal, and a11y validation. Docker E2E is recorded as skipped with
reason because no Docker/container/provider-runtime path changed.

The 2026-06-23 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-23.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-23.md).
It covers the six-lane active dirty-worktree consolidation through
`merge/open-practice-mainline-20260623`, including AI proposal authorization proof refinement, API
route inventory reconciliation, lifecycle close proof updates, document retention/hold action
descriptors, lifecycle archive behavior, and the conservative dependency refresh. It records
selector-driven local validation, green `pnpm ci:local`, dependency/license/supply-chain checks,
migration replay, Docker app smoke, Docker Chromium E2E, and the publication/prune evidence while
preserving stash count `42`.

The 2026-06-23 dependency refresh proof is recorded in
[OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md). It covers
the conservative patch/minor JavaScript refresh on `chore/dependency-refresh-20260621`, including
Tiptap, AWS SDK S3, BullMQ, Lucide React, imapflow, mailparser, Stripe, Knip, and
`typescript-eslint` patch/minor updates while holding `@types/node 26.0.0` as a separate major
compatibility review. The proof records clean audit/license/supply-chain evidence, optional
OSV/ScanCode local skips, package-focused validation, green `pnpm build`, and green `pnpm ci:local`.

The 2026-06-21 document retention/hold action descriptor proof is recorded in
[OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md](OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md).
It covers the behavior-preserving extension of domain-owned operational action descriptors to the
Documents dashboard retention/hold review control, including stable action keys, busy/disabled
labels, accessible disabled reasons, focused domain/web validation, and preserved route/API,
authorization, review-only metadata, legal-hold blocking, portal access, audit, database, retention,
migration, dependency, and route catalog boundaries.

The 2026-06-20 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-20.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-20.md).
It covers the 11-lane active dirty-worktree consolidation through
`merge/open-practice-mainline-20260620`, including deposit-match review records, retention/hold
review cues, inbound-email replay recovery, lifecycle close behavior, lifecycle action
descriptors, AI proposal authorization fixtures, provider document conversion metadata, dead-code
export/artifact pruning, API docs route inventory reconciliation, incomplete-implementation audit
evidence, and self-hosting readiness evidence. It records selector-driven local validation, green
`pnpm ci:local`, migration replay, dependency/license/supply-chain checks, Docker app smoke,
Docker Chromium E2E, completed main push/prune evidence, and preserved stash count `42`.

The 2026-06-20 OP-T160 deposit-match review records proof is recorded in
[OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md](OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md).
It covers the branch-first follow-up that adds existing manual-payment candidate cues to normalized
payment import review records, staff-only matter/candidate validation, Billing dashboard
deposit-match counts and candidate copy, duplicate/conflict posture, selector-driven validation,
and preserved no-live-settlement/no-provider-command/no-raw-payload/no-invoice-balance-mutation/
no-reconciliation-mutation/no-refund-or-chargeback/no-trust-posting boundaries.

The 2026-06-20 staff document retention/hold review surface proof is recorded in
[OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md](OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md).
It covers the branch-first runtime slice for a staff-only, matter-scoped retention/hold decision
record; bounded review metadata, workbench/UI posture, safe audit metadata, and authorization
coverage; plus the preserved no-object-deletion/no-retention-deadline/no-legal-hold-override/
no-retained-export-body/no-raw-payload/no-compliance-claim boundary.

The 2026-06-20 lifecycle review action descriptor proof is recorded in
[OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md](OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md).
It covers the single-surface extension of domain-owned operational action descriptors to the Matter
overview Lifecycle readiness review form and `Record review` action, including stable action keys,
busy/disabled labels, accessible status semantics, selector-driven validation, and preserved
route/API, authorization, command, provider, settlement, trust, retention, and review-only evidence
boundaries.

The 2026-06-20 AI proposal authorization matrix proof is recorded in
[OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md](OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md).
It covers behavior-preserving authorization fixture coverage for
`GET /api/ai-operational-proposals`, including firm-wide, assigned-matter, unassigned-matter, and
client-external staff-route denial/list-visible expectations, without changing RBAC, matter-scope
checks, public-token policies, portal grants, route authorization manifest ownership, schema,
migrations, dependencies, route behavior, or API response shapes.

The 2026-06-19 dead-code and bloat prune proof is recorded in
[OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md](OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md).
It covers the branch-first `prune/dead-code-bloat` cleanup for low-risk API/web/worker export
contraction, generated Playwright artifact removal, stale release-age excludes, provider/domain/
database package-surface narrowing, selector-driven validation, and preserved public route,
authorization, redaction, payment/trust, provider, migration, ProseMirror, public-token, and
synthetic-data boundaries. It also records the exact-path selector rerun, explicit
`pnpm deadcode:check`, package/API/web/worker gates, repo policy/build checks, and `pnpm ci:local`
closeout. Larger contacts/dashboard/E2E structural splits remain later prune slices.

The 2026-06-20 API docs route inventory reconciliation proof is recorded in
[OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md](OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md).
It closes the docs-only route inventory gap by aligning `docs/api-and-state-machines.md` with the
route authorization/API inventory through compact-notation rules plus explicit WebAuthn step-up,
CalDAV, current public mail receipt, and local/e2e-support-only route rows. Its 2026-06-20 follow-up
revalidated the generated local route inventory and made the compact CalDAV, e2e-support, WebAuthn
step-up, receipt, and public-token/path-token coverage anchors explicit while preserving runtime
source, route registration, route authorization, public-token, CalDAV, e2e helper, provider,
payment, and trust behavior.

The 2026-06-20 exhaustive incomplete-implementation inventory is recorded in
[OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md).
It covers the branch-based docs-backed audit for stubs, placeholders, TODO markers, worker skipped
paths, dead-code/tooling evidence, route/API drift, web route catalog coverage, and intentional
review-only boundaries. No P0/P1 runtime blocker or confirmed production stub was found; the only
new follow-up was the API documentation inventory completeness gap closed by the API docs route
inventory reconciliation proof above.

The 2026-06-19 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-19.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-19.md).
It covers the active dirty-lane consolidation through
`merge/open-practice-active-lanes-2026-06-19` into `main`, migration numbering reconciliation,
proof/index/workboard reconciliation, selector-driven validation, completed main parity/push, and
branch/worktree prune status while preserving stash count `42`.

The 2026-06-19 local security tooling proof is recorded in
[OP_LOCAL_SECURITY_TOOLING_PROOF_2026-06-19.md](OP_LOCAL_SECURITY_TOOLING_PROOF_2026-06-19.md).
It covers the local-only `pnpm security:review` packet writer, tracked-secret-scan JSON evidence
without matched secret serialization, optional Gitleaks/Semgrep/OSV/ScanCode/Hadolint/Checkov/
Trivy/Cosign local wrappers, selector updates for security review tooling, and docs for local
security review packets while preserving the no-external-SaaS/no-GitHub-Actions/no-Dependabot/
no-CodeQL-default/no-remote-required-checks posture and avoiding runtime product/API/schema
changes.

The 2026-06-19 local tooling ratchets proof is recorded in
[OP_LOCAL_TOOLING_RATCHETS_PROOF_2026-06-19.md](OP_LOCAL_TOOLING_RATCHETS_PROOF_2026-06-19.md).
It covers local-only selector, toolchain, environment-surface, dependency-review, license, and
rendered accessibility QA additions plus `verify:run`, lockfile supply-chain policy, architecture
import checks, API contract inventory, migration lint, Docker lint/scan wrappers, OSV scanning,
source-license scanning, and release attestation while preserving the no-GitHub-Actions/
no-Dependabot/no-CodeQL-default/no-remote-required-checks posture and avoiding runtime
product/API/schema changes.

The 2026-06-19 self-hosting optimization proof is recorded in
[OP_SELF_HOSTING_OPTIMIZATION_PROOF_2026-06-19.md](OP_SELF_HOSTING_OPTIMIZATION_PROOF_2026-06-19.md).
It covers same-origin browser API mode, the focused `docker-compose.selfhost.yml` profile,
`pnpm selfhost:check`, worker production-readiness ratchets, and the self-hosting runbook while
preserving the local development Compose profile, public API route shapes, production setup gate,
payment/trust boundaries, and synthetic-only proof posture. The proof records selected package,
dependency, docs, policy, Docker app-smoke, Docker E2E, `pnpm ci:local`, and `git diff --check`
validation as passing.
The 2026-06-20 release-readiness drill is recorded in
[OP_SELF_HOSTING_RELEASE_READINESS_DRILL_PROOF_2026-06-20.md](OP_SELF_HOSTING_RELEASE_READINESS_DRILL_PROOF_2026-06-20.md).
It revalidated current `main` from a clean sibling worktree. `pnpm selfhost:check` and
`pnpm docker:app-smoke` passed without runtime changes; `pnpm docker:residual-watch` was interrupted
after a local no-output hang, optional Docker lint/scan wrappers skipped with local artifacts, and
Docker E2E failed the dashboard sweep on a 240s Playwright timeout after 2 of 3 tests passed.

The 2026-06-19 security scan remediation proof is recorded in
[OP_SECURITY_SCAN_REMEDIATION_PROOF_2026-06-19.md](OP_SECURITY_SCAN_REMEDIATION_PROOF_2026-06-19.md).
It covers all ten findings from
`/tmp/codex-security-scans/open-practice/e680c230_20260619T050725Z/report.md`, including
inbound-email unscoped assignment authorization, external-upload capacity accounting, portal
workspace principal filtering, outbound webhook IPv6/NAT64 SSRF guards, trust-transfer ledger-link
single-use enforcement, Nodemailer `9.0.1`, and removal of legacy public path-token web pages while
preserving hash-token entry pages and review-only billing/trust/provider boundaries.

The 2026-06-19 filtered audit repository reads proof is recorded in
[OP_FILTERED_AUDIT_REPOSITORY_READS_PROOF_2026-06-19.md](OP_FILTERED_AUDIT_REPOSITORY_READS_PROOF_2026-06-19.md).
It covers the behavior-preserving `listFilteredAuditEvents` repository capability, action/resource
sequence indexes, matter-scoped `/api/audit` bounded reads, and Trust Controls
`financialCommandJournal` filtered action reads while preserving full-chain verification for
`chainValid`, firm-wide audit/export full-log behavior, authorization, redaction, posting,
settlement, and public-route boundaries.

The 2026-06-19 OP-T160 matter lifecycle commands proof is recorded in
[OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md](OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md).
It covers the first review-gated `POST /api/matters/:matterId/lifecycle-commands` runtime slice for
`pause` and `reopen` only, latest-ready readiness gating, status-only matter mutation, safe audit
metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/assignment/billing/
trust/retention/cleanup side effects.

The 2026-06-20 OP-T160 matter lifecycle close-command proof is recorded in
[OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md](OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md).
It covers the status-only `close` runtime slice for `POST
/api/matters/:matterId/lifecycle-commands`: `open -> closed`, latest-ready readiness gating, safe
audit metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/assignment/
billing/trust/retention/cleanup side effects.

The 2026-06-21 OP-T160 matter lifecycle archive-command proof is recorded in
[OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md](OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md).
It covers the status-only `archive` runtime slice for `POST
/api/matters/:matterId/lifecycle-commands`: `closed -> archived`, latest-ready readiness gating,
safe audit metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/
assignment/billing/trust/retention/cleanup side effects.

The 2026-06-19 operational efficiency remediation proof is recorded in
[OP_OPERATIONAL_EFFICIENCY_REMEDIATION_PROOF_2026-06-19.md](OP_OPERATIONAL_EFFICIENCY_REMEDIATION_PROOF_2026-06-19.md).
It covers the clean sibling-worktree remediation for Docker-local same-origin API routing proof,
filtered audit reads, client portal workspace batching, communications child-row bulk reads, and
dashboard/operations SSR parallelization while preserving public response shapes, authorization,
audit/redaction posture, provider behavior, trust/payment behavior, and Docker local-dev-only
boundaries.

The 2026-06-19 review remediation proof is recorded in
[OP_REVIEW_REMEDIATION_PROOF_2026-06-19.md](OP_REVIEW_REMEDIATION_PROOF_2026-06-19.md).
It covers the focused implementation follow-through from the efficiency/code-quality review:
contact dossier/preload reuse, indexed contact dossier inputs, batched assigned-matter billing
list reads, route authorization manifest extraction, external-upload dashboard request-helper
extraction, and selector/domain-build alignment while preserving HTTP response shapes,
authorization, redaction, payment settlement behavior, trust posting behavior, provider behavior,
and public/private data boundaries.

The 2026-06-19 staff UI/UX page overhaul proof is recorded in
[OP_STAFF_UI_UX_PAGE_OVERHAUL_PROOF_2026-06-19.md](OP_STAFF_UI_UX_PAGE_OVERHAUL_PROOF_2026-06-19.md).
It covers the branch-first split from the single-dashboard staff experience into canonical
workspace, finance, operations, and review pages; route-catalog canonical paths with legacy
`?section=` aliases; the Communications staff page; the light legal-ops visual refresh; local
screenshots for desktop/mobile and zero-matter states; selector-driven host, Docker, first-run,
matterless, client-portal, web test, typecheck, and build validation; and preserved API, permission,
public token, client portal, settlement, trust-posting, provider, worker, and synthetic-data
boundaries.

The 2026-06-19 UI overlap resilience proof is recorded in
[OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md](OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md).
It covers the first-matter zero-matter workspace layout hardening, first-matter/zero-matter E2E
collision-selector coverage, matterless breakpoint browser proof, and the current host/Docker
environment blockers while preserving API payloads, authorization, matter creation semantics,
setup behavior, provider behavior, payment settlement, trust posting, and public data boundaries.

The 2026-06-18 database access hot-path efficiency proof is recorded in
[OP_DATABASE_ACCESS_HOT_PATH_EFFICIENCY_PROOF_2026-06-18.md](OP_DATABASE_ACCESS_HOT_PATH_EFFICIENCY_PROOF_2026-06-18.md).
It covers the focused internal refactor for hot-path schema indexes, batched Drizzle repository
queries, selected-parent invoice/payment child-row loading, simple SQL filter pushdowns, and
matter-workspace per-matter grouping while preserving HTTP response shapes, permissions, payment
settlement behavior, trust posting behavior, provider behavior, and public data boundaries.

The 2026-06-18 contact list database efficiency proof is recorded in
[OP_CONTACT_LIST_DATABASE_EFFICIENCY_PROOF_2026-06-18.md](OP_CONTACT_LIST_DATABASE_EFFICIENCY_PROOF_2026-06-18.md).
It covers the Drizzle-only contact-list refactor that keeps `/api/contacts` behavior unchanged
while avoiding full dossier hydration for lightweight list reads, preserving matter-scoped
visibility, standalone creator visibility, search/sort/pagination compatibility, and the existing
dossier/detail/history/export boundaries.

The 2026-06-18 email outbox child-row bulk-read proof is recorded in
[OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md](OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md).
It covers the narrow database-access efficiency branch that batches outbound email events and
receipt-token child rows for `/api/mail/outbox` and the outbound portion of
`/api/communications/inbox` while preserving response shapes, authorization, redaction, provider
behavior, public-token behavior, and trust/payment boundaries.

The 2026-06-17 all-active-lanes integration proof, with the 2026-06-18 Docker gate closeout, is
recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md).
It covers the merge of the 13 committed dirty lanes plus the clean retirement branch into
`merge/open-practice-active-lanes-2026-06-17`, the final 101-path integrated path set against
`origin/main`, selector output from `pnpm verify:select -- --base origin/main`, the Postgres/Mailpit
same-contract Docker pin refresh, green Docker app smoke, residual watch, Docker E2E, package, build,
policy/docs, and `pnpm ci:local` validation, final `main` publication, clean merged-branch/worktree
prune, and unchanged stash count of `42`.

The 2026-06-17 OP-T159 aged receivables report proof is recorded in
[OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md](OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md).
It covers the additive staff-only `aged_receivables` report definition, visible-client/matter/
invoice/aging-bucket grouping, report export profile reuse, dashboard rendering, and the preserved
no-live-settlement/no-automatic-allocation/no-invoice-mutation/no-trust-posting boundary.

The 2026-06-17 document retention and hold workflow design proof is recorded in
[OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md](OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md).
It covers the docs-first retention timeline model, hold-blocking rules, deletion-review gates, and
records-disposition wording for future reviewed implementation planning while preserving the
current no-runtime-change/no-deletion-automation/no-retention-deadline/no-legal-hold-override/no
jurisdiction-certified-compliance posture.

The 2026-06-17 firm-managed expense category registry proof is recorded in
[OP_EXPENSE_CATEGORY_REGISTRY_PROOF_2026-06-17.md](OP_EXPENSE_CATEGORY_REGISTRY_PROOF_2026-06-17.md).
It covers the persisted category registry, nullable `expense_entries.category_code`, active
matter/practice/jurisdiction/reimbursable validation for new expense entries, Billing controls UI/API
management, dashboard compatibility projection, legacy free-text row readability, and the preserved
no-invoice-recalculation/no-live-settlement/no-trust-posting boundaries.

The 2026-06-17 financial export field profiles proof is recorded in
[OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md](OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md).
It covers reusable OP-authored field-profile metadata for generated local billing and
jurisdictional trust downloads, profile-ID-only queue/job/audit metadata, preserved regenerated
download serialization, and the no-retained-body/no-settlement/no-automatic-trust-posting boundary.

The 2026-06-17 inbound email recovery metadata addendum is recorded in
[OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md](OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md).
It covers metadata-only owner-reviewed recovery posture for Mailgun and IMAP inbound parser/poll
lifecycle failures, bounded provider-failure stages, IMAP parser enqueue failure marking, and the
preserved no-raw-MIME/no-object-key/no-provider-payload/no-automatic-document-or-matter-promotion
boundary. The addendum records the final changed-path selector and selected package/doc/policy gates.

The 2026-06-17 ledger balance snapshot comparison proof is recorded in
[OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md](OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md).
It covers reviewer-only current trust balance, latest posted transaction, latest statement import
batch, and latest reconciliation snapshot cues while preserving no preview-row storage, posting,
matching, settlement, bank-feed automation, or certified-accounting posture.

The 2026-06-17 provider-backed document conversion boundary proof is recorded in
[OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md](OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md).
It covers the docs-only reviewed design guardrails for future provider-backed conversion,
annotation, chunking, embedding, and semantic-review runtime slices; preserves the shipped
metadata-only `document_conversion_review` posture; and keeps raw client text, converted Markdown,
annotation bodies/spans, prompts, chunks, embeddings/vectors, storage keys, object bodies, provider
payloads, private excerpts, and free-form generated summaries out of job/audit/API/artifact/proof
metadata.

The 2026-06-20 provider-backed document conversion metadata follow-up proof is recorded in
[OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md](OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md).
It covers the local/mock document-conversion metadata provider adapter, provider/status posture in
the existing `document_conversion_review` worker/API path, focused domain/provider/worker/API tests,
and the preserved no raw client text, converted Markdown, annotation bodies/spans, prompts, chunks,
embeddings/vectors, storage keys, object bodies, provider payloads, private excerpts, or generated
summaries boundary.

The 2026-06-16 Clio parity gap closure proof is recorded in
[OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md](OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md).
It covers the final workflow-depth closure for metadata-only document conversion review,
staff-reviewed scheduling requests, legal-clinic cadence signals, CRM retention-hold cues and
matter-scoped exports, ledger reconciliation freshness, trust/reporting dimensions, and the
preserved no-live-settlement/no-automatic-trust-posting/no-raw-private-metadata boundaries.

The 2026-06-16 CRM contact timeline activity-filter follow-up is recorded in
[OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md](OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md).
It covers the optional `activity` filter for the existing contact timeline projection, Contacts
dashboard filtering for safe CRM activity and review-only task/follow-up cues, and the preserved
no-sync/no-automatic-task/no-raw-private-history boundary.

The 2026-06-16 Docker app-image footprint and Compose hardening proof is recorded in
[OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md](OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md).
It records the API/Web/Worker before/after image sizes, the reduced Docker build context, local-only
Compose self-initialization for migrations and MinIO bucket setup, loopback-only port rendering,
Docker smoke/E2E proof, and the historical residual-watch Postgres manifest-drift review candidate.
The 2026-06-17 local rerun addenda record the Docker daemon/socket blockers and held Postgres pin;
the 2026-06-18 all-active-lanes closeout supersedes those blockers by refreshing the Postgres digest
and Mailpit `v1.30.2` source pin, then rerunning Docker app smoke, residual watch, and Docker E2E.

The 2026-06-16 OP-T158 email template drafts proof is recorded in
[OP-T158_EMAIL_TEMPLATE_DRAFTS_PROOF_2026-06-16.md](OP-T158_EMAIL_TEMPLATE_DRAFTS_PROOF_2026-06-16.md).
It covers provider-neutral firm-scoped saved email template drafts, matter-scoped persisted preview
snapshots, safe preview/audit metadata, related-resource matter matching, focused
domain/database/API/web tests, and the preserved no-campaign/no-bulk-send/no-provider-side-effect
boundary.

The 2026-06-16 financial command approval journal proof is recorded in
[OP_FINANCIAL_COMMAND_APPROVAL_JOURNAL_PROOF_2026-06-16.md](OP_FINANCIAL_COMMAND_APPROVAL_JOURNAL_PROOF_2026-06-16.md).
It covers the read-only trust controls `financialCommandJournal` projection over existing audit
metadata for trust-transfer, ledger transaction approval, invoice approval, and reconciliation
decisions, matter-scoped filtering, dashboard rendering, safe allowlisted cues, and the preserved
no-schema/no-posting/no-settlement/no-public-route/no-read-audit-event boundary.

The 2026-06-17 payment import and deposit matching boundary packet proof is recorded in
[OP_PAYMENT_IMPORT_DEPOSIT_MATCHING_BOUNDARY_PACKET_PROOF_2026-06-17.md](OP_PAYMENT_IMPORT_DEPOSIT_MATCHING_BOUNDARY_PACKET_PROOF_2026-06-17.md).
It covers the docs-first boundary for future processor imports, deposit matching, refunds, and
chargebacks; reviewer-owned normalized evidence; production Stripe gating; and the preserved no-live
settlement/no-trust-posting/no-provider-payload-retention/no-invoice-balance-mutation-without
reviewer-evidence boundary.

The 2026-06-19 OP-T160 payment import review records proof is recorded in
[OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md](OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md).
It covers the first staff-only runtime slice under that packet: provider-neutral normalized review
records, idempotent repository behavior, safe API/audit metadata, Billing dashboard cues, and the
preserved no-raw-payload/no-invoice-mutation/no-settlement/no-reconciliation/no-refund/no-chargeback/
no-trust-posting boundary.

The 2026-06-16 private document conversion and annotation boundary proof is recorded in
[OP_PRIVATE_DOCUMENT_CONVERSION_ANNOTATION_BOUNDARY_PROOF_2026-06-16.md](OP_PRIVATE_DOCUMENT_CONVERSION_ANNOTATION_BOUNDARY_PROOF_2026-06-16.md).
It remains the docs-first local-only boundary record for future conversion, annotation, chunking,
Markdown extraction, semantic review, and provider-backed extraction prototypes; the preserved
clean-room reference constraints; and the no-raw-client-text/no-raw-Markdown/no-annotation/
no-provider-payload/no-sensitive-chunk metadata boundary.

The 2026-06-16 document conversion review runtime prototype proof is recorded in
[OP_DOCUMENT_CONVERSION_REVIEW_RUNTIME_PROTOTYPE_PROOF_2026-06-16.md](OP_DOCUMENT_CONVERSION_REVIEW_RUNTIME_PROTOTYPE_PROOF_2026-06-16.md).
It covers the local-only `document_conversion_review` runtime path, matter-scoped
`document_processing:create` authorization, existing OCR queue reuse, `document_analysis_status`
artifact posture, OP-authored `summaryPosture`, redacted count/status metadata, and the preserved
no-provider/no-Markdown/no-annotation/no-prompt/no-embedding/no-storage-key boundary.

The 2026-06-16 trust posting approval commands proof is recorded in
[OP_TRUST_POSTING_APPROVAL_COMMANDS_PROOF_2026-06-16.md](OP_TRUST_POSTING_APPROVAL_COMMANDS_PROOF_2026-06-16.md).
It covers the opt-in pre-post `trust_posting_requests` command path, existing trust-ledger
authorization, matter-scoped list/decision restrictions, balanced/idempotent/no-overdraft posting at
approval time, Funds workbench cues, safe audit metadata, and explicit no-settlement/no-bank-feed/no
trust-transfer auto-posting/no jurisdiction-certified trust-accounting boundary.

The 2026-06-17 trust posting action descriptors proof is recorded in
[OP_TRUST_POSTING_ACTION_DESCRIPTORS_PROOF_2026-06-17.md](OP_TRUST_POSTING_ACTION_DESCRIPTORS_PROOF_2026-06-17.md).
It covers the read-only descriptor follow-up for Trust Controls posting-request approve/reject
buttons, including domain-owned labels, busy/disabled reasons, accessible button labels, stable
action keys, and unchanged approve/reject command semantics.

The 2026-06-16 inbound email matter draft proof is recorded in
[OP_INBOUND_EMAIL_MATTER_DRAFT_PROOF_2026-06-16.md](OP_INBOUND_EMAIL_MATTER_DRAFT_PROOF_2026-06-16.md).
It covers the review-only `POST /api/inbound-email/messages/:id/matter-draft` endpoint, sanitized
metadata serialization, reviewer-facing duplicate/existing-matter/checklist cues from authorized
projections, unscoped dashboard review/prefill behavior, safe audit metadata, focused API/domain/web
tests, and the preserved no-provider-ingestion/no-automatic-matter-creation/no-raw body or
object-key exposure boundary.

The 2026-06-16 16-lane mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md).
It covers the dirty-lane commits, shared proof/workboard/API doc reconciliation, dependency
compatibility merge choices, migration renumbering from `0056` through `0059`, selector-driven
validation plan, and final push/prune handoff. The same proof file now also records the three-lane
follow-up merge for matter lifecycle transition journals, CRM contact-history export runtime, and
inbound email matter drafts, including lane-local validation, conflict reconciliation, integrated
validation, push parity, and prune disposition; it also records the eight-lane follow-up merge for
staff intake QA scenarios, queued contact-history export links, contact timeline filters, OP-T158
email template drafts, financial command journal, inbound-email review cues, private document
conversion boundary docs, and trust posting approval commands, including integrated validation,
push parity, and prune disposition. The 2026-06-17 addenda record local-only retirement of two
absorbed parked worktrees for meeting availability requests and matter-scoped contact-history export
scope without landing stale standalone proof/diff residue, the later retirement of three safe merged
sibling worktrees after preserving unique promotional README residue as ignored local evidence, and
the later 2026-06-17 unpublished-delta revalidation with exact 18-path selector proof, blocked
Docker daemon/socket evidence, green non-Docker selected checks, and no push or release handoff.

The 2026-06-16 matter lifecycle transition journal proof is recorded in
[OP_MATTER_LIFECYCLE_TRANSITION_JOURNAL_PROOF_2026-06-16.md](OP_MATTER_LIFECYCLE_TRANSITION_JOURNAL_PROOF_2026-06-16.md).
It covers append-only, review-only pause/close/archive/reopen readiness records; current/target
status snapshots; concise reason/blocker evidence; matter-scoped API and dashboard authorization;
safe audit metadata; and the no-automation/no-destructive-closure boundary.

The 2026-06-17 matter lifecycle command policy/API plan proof is recorded in
[OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md](OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md).
It covers the docs-only planned `POST /api/matters/:matterId/lifecycle-commands` contract,
pause/close/archive/reopen command consequences, stale/blocked readiness gating, portal visibility,
billing/task/assignment/audit/cleanup boundaries, and the explicit unshipped-command posture.

The 2026-06-16 queued CRM contact-history export links proof is recorded in
[OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md](OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md).
It covers the additive request/poll/download route family under existing `contact:export`,
metadata-only `reports` queue job lifecycle records, 24-hour authenticated link expiry,
download-time regeneration from current visibility, dashboard queued status/download behavior, and
the no-retained-body/no-object-storage/no-retention-deadline/no-legal-hold-override boundary.

The 2026-06-16 CRM contact-history export runtime proof is recorded in
[OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md](OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md).
It covers the selected single-contact synchronous `staff_review` runtime, existing
`contact:export` authorization, redacted/transient JSON response, posture-only audit metadata,
dashboard client-side download action, and explicit no-schema/no-provider/no-retained-body/
no-retention-claim boundary for that synchronous route.

The 2026-06-15 contact-history export, retention, and privacy decision packet is recorded in
[OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md](OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md).
It covers the docs-only pre-implementation decisions needed before contact-history export runtime
work, including request purpose, authorization/redaction posture, matter boundaries,
retention/hold questions, privacy-policy choices, and non-goals.

The 2026-06-15 OP-T157 staff submissions operations proof is recorded in
[OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md](OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md).
It covers the additive `GET /api/intake-pipeline` `submissionsOperations` projection, derived
assignment posture, export-safe dashboard rows, redaction boundaries, focused package tests, and
selector-driven validation.

The 2026-06-16 ReBAC fixture catalogue proof is recorded in
[OP_REBAC_FIXTURE_CATALOGUE_PROOF_2026-06-16.md](OP_REBAC_FIXTURE_CATALOGUE_PROOF_2026-06-16.md).
It covers the OP-authored relation vocabulary plus denial/list-visible fixtures for matters,
documents, jobs, and portal links; focused domain/API route tests; and selector-chosen
domain/API/provider/worker/docs/policy validation without adding a ReBAC policy engine,
canonical-only authorization rewrite, schema change, dependency, or route behavior change. The
2026-06-17 addendum expands the fixture matrix to contact dossier/list visibility for firm-wide
reviewers, assigned staff, unassigned staff, standalone contact creators, and client-external route
denial, and the 2026-06-20 AI proposal matrix adds non-contact list-query coverage while preserving
the same no-runtime-rewrite boundary.

The 2026-06-16 workflow-step history projection branch is recorded in
[OP_WORKFLOW_STEP_HISTORY_PROJECTION_PROOF_2026-06-16.md](OP_WORKFLOW_STEP_HISTORY_PROJECTION_PROOF_2026-06-16.md).
It covers the read-only projection over existing job lifecycle records and workflow-shaped audit
events, `GET /api/jobs/workflows`, Operations/Queues dashboard rendering, route-authorization
manifest coverage, redaction-by-construction boundaries, and the explicit no-Temporal/no-new-engine/
no-sensitive-payload-storage scope.

The 2026-06-16 Signature Request Envelope Metadata proof is recorded in
[OP_SIGNATURE_REQUEST_ENVELOPE_METADATA_PROOF_2026-06-16.md](OP_SIGNATURE_REQUEST_ENVELOPE_METADATA_PROOF_2026-06-16.md).
It covers OP-authored signer-order and field-placement metadata on existing signature requests,
provider-neutral validation, no-side-effect rejection before provider/email/audit work, redacted
evidence-packet summaries, dashboard posture, and selector-driven validation.

The 2026-06-16 immutable intake template versions proof is recorded in
[OP_INTAKE_TEMPLATE_VERSIONS_PROOF_2026-06-16.md](OP_INTAKE_TEMPLATE_VERSIONS_PROOF_2026-06-16.md).
It covers mutable staff intake-template drafts, immutable published versions, session-pinned public
link behavior, redacted publish audit metadata, migration backfill, and selector-driven validation
for the schema/API/domain/docs/policy change set.

The 2026-06-16 staff intake QA scenario matrix proof is recorded in
[OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md](OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md).
It covers staff-only saved QA scenarios inside embedded V2 intake template definitions, multi-path
branch/package preview summaries, private staff QA response shaping, public scenario omission, and
the no-approval-automation/no-public-runner-change boundary.

The 2026-06-15 legal-clinic metadata DTO remediation follow-up is recorded in the
[2026-06-11 whole-application review proof](OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md).
It closes the raw arbitrary metadata exposure finding for legal-clinic program/profile responses by
keeping compatible `metadata` DTOs but returning only allowlisted fiscal-host and restricted-fund
summary fields, with focused API tests and selector-driven validation.

The 2026-06-14 six-lane mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-14.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-14.md).
It covers the dependency-refresh, dead-code, duplicate-id parity, dashboard deeplink, OP-T155, and
OP-T156 lane commits; deliberate overlap reconciliation; the dashboard unavailable-route E2E
assertion reconciliation; broad local CI; dependency audit/license checks; host/Docker/first-run/
matterless/client-portal E2E; and the final push/prune gate.

The 2026-06-13 OP-T156 client portal permissioned workspace V2 proof is recorded in
[OP-T156_CLIENT_PORTAL_PERMISSIONED_WORKSPACE_V2_PROOF_2026-06-13.md](OP-T156_CLIENT_PORTAL_PERMISSIONED_WORKSPACE_V2_PROOF_2026-06-13.md).
It covers account-bound portal grants, confidential-client file grant gating, shared file metadata,
embedded viewed/signed/declined signature actions, staff document grant/revoke controls,
desktop/mobile client portal screenshot QA, redaction boundaries, and final selector-driven
validation for merge handoff.

The 2026-06-13 dead-code prune and scanner gate proof is recorded in
[OP_DEAD_CODE_PRUNE_PROOF_2026-06-13.md](OP_DEAD_CODE_PRUNE_PROOF_2026-06-13.md).
It covers the isolated sibling worktree cleanup, the Knip file/dependency gate added to
`policy:check`, high-confidence unused export/helper/CSS pruning, direct dependency pruning for
transitive ProseMirror helper packages, and held medium-risk public-domain helper candidates.

OP-T155 intake widget registry and validator adapter proof is recorded in
[OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md](OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md).
It covers the clean-room domain/web registry adapters for the existing intake item kinds, public
renderer delegation, staff builder default-item registry coverage, final selector-driven validation,
and the preserved no-dependency, no-new-kind, no-public-runner-behavior-change boundary.

The 2026-06-12 mainline merge/push/prune proof is recorded in
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-12.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-12.md).
It covers the branch-first integration lane, dirty sibling worktree commits, OP-T153 task-system
merge, SMTP/IMAP provider-settings merge, conflict-resolution choices, selected broad validation,
Docker app-smoke retry evidence, the OP-SEC production setup gate hardening plus OP-T155 focused
E2E validation-lane closeout, the esbuild audit remediation, and final push/prune handoff.
The 2026-06-12 OSS policy parity follow-up keeps the older whole-app and test-pruning drift notes
historical while confirming the current reference lock matches the central index and both
`policy:check` and `ci:local` are unblocked.

The 2026-06-13 conservative dependency refresh proof is recorded in
[OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md).
It covers the safe patch/minor refresh for TipTap, AWS SDK S3 packages, Turbo, ESLint, and Lucide
React, keeps `@fastify/rate-limit` and `pdfkit` held as major-compatibility reviews, records the
late Stripe patch as a separate provider/payment review candidate, records dependency audit/license
evidence, and captures Docker image inventory plus the Docker residual-watch blocker caused by
Docker Engine being unavailable. A 2026-06-15 PDT rerun on
`proof/docker-gaps-2026-06-16` cleared that residual-watch blocker with a passing clean local
artifact.

The 2026-06-19 security plus patch/minor dependency refresh proof is recorded in
[OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md).
It covers the Nodemailer advisory remediation through a direct `nodemailer@9.0.1` pin plus a
workspace override for transitive IMAP/mailparser paths, current patch/minor updates for AWS S3,
BullMQ, TipTap, ProseMirror model, Lucide, Playwright, Knip, TypeScript ESLint, and Vitest, and the
mainline-closeout upgrade to `@cyclonedx/cyclonedx-npm@5.0.0` after dependency audit flagged the
older release-tooling version.

The 2026-06-16 Fastify rate-limit compatibility proof is recorded in
[OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md).
It covers the isolated `@fastify/rate-limit@11.0.0` API-lane review, unchanged public rate-limit
behavior, focused API typecheck/test evidence, and final dependency closeout gates.

The 2026-06-16 PDFKit compatibility proof is recorded in
[OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md).
It covers the isolated `pdfkit@0.19.1` provider-lane review, unchanged draft export behavior,
focused provider/API validation, and final dependency closeout gates.

The 2026-06-16 Stripe compatibility proof is recorded in
[OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md).
It covers the isolated `stripe@22.2.1` provider/payment patch review, unchanged Checkout Session
behavior, focused provider/API validation, and final dependency closeout gates.

The 2026-06-11 conservative dependency refresh proof is recorded in
[OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md).
It covers the safe patch/minor npm/pnpm dependency refresh, `pnpm@11.5.3`, release-age exclusion
alignment, central reference-lock commit alignment needed for local policy validation, held major
candidates for `@fastify/rate-limit` and `pdfkit`, dependency audit/license evidence, Docker image
inventory, and Docker residual-watch posture without Docker image pin changes. The follow-up review
kept the API rate-limit and provider PDF-rendering majors as held compatibility-review candidates,
with exact risks and validation gates recorded while dependency versions remain unchanged in this
lane.

The 2026-06-11 whole-application review branch is recorded in
[OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md](OP_WHOLE_APP_REVIEW_PROOF_2026-06-11.md).
It covers the repository-wide Codex Security scan artifact at
`/tmp/codex-security-scans/open-practice/30a26a17_20260611T230554Z/`, code-review findings,
UI/UX review findings, validation pass/fail evidence, and the then-open OSS reference-lock drift and
host Playwright readiness blockers. The 2026-06-13 follow-ups in the same proof close the
memory-backed matter-workspace duplicate-id parity candidate with focused database coverage and
record the UIUX-01 unavailable-section state for unknown or disabled dashboard deep links, focused
route-selection tests, and completed host/Docker browser follow-through for the isolated sibling
worktree. The 2026-06-15 follow-ups in the same proof close the report and conversation export
idempotency code-review item with stable `409 IDEMPOTENCY_KEY_CONFLICT` responses, replay-safe
queue/audit behavior, and staff report default-key grouping scope; close the submitted public
intake token expiry finding with route-layer enforcement; and close the dashboard conflict-check
plus intake-link create/revoke status-announcement gaps with polite atomic live regions.

The test-suite pruning branch is recorded in
[OP_TEST_SUITE_PRUNING_PROOF_2026-06-11.md](OP_TEST_SUITE_PRUNING_PROOF_2026-06-11.md).
It covers aggressive removal of redundant API/domain/database/provider/web/E2E tests, rehomes
signature, billing, ledger, permissions, conflicts, audit sequence, and matter setup projection
guardrails into focused suites, keeps public-token, trust/funds, auth/setup, redaction, queue, and
Docker-backed storage behavior covered, and adds focused client-portal browser proof for redacted
workspace data.

OP-T153 task system V2 is recorded in
[OP-T153_TASK_SYSTEM_V2_PROOF_2026-06-10.md](OP-T153_TASK_SYSTEM_V2_PROOF_2026-06-10.md)
and covers staff-only matter-scoped task persistence, lifecycle APIs, audit taxonomy, dashboard
Tasks workspace behavior, review-first suggested follow-ups, operational-view task rows, migration
checks, selector-selected package checks, broad closeout gates, and the 2026-06-11 replay on top of
the matterless contacts/calendar mainline with the task-system migration renumbered to
`0053_task_system_v2`.

The matterless workflow branch is recorded in
[OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md](OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md).
It covers standalone contact creation and visibility, contact-first matter creation,
firm/client-scoped calendar events and dashboard reminders, zero-matter dashboard navigation,
desktop/mobile browser proof, host/Docker E2E proof, scope-aware matterless permissions, and the
retained matter-only boundaries for attendees, invitations, guest sessions, meeting links, calendar
feeds, public links, and email reminder delivery. The 2026-06-11 final review follow-up
reconfirmed changed-path and screenshot proof consistency, fixed public-token browser navigation
to use canonical hash URLs, and reran the selected host and Docker E2E gates green for merge
handoff.

Email settings SMTP/IMAP proof is recorded in
[OP_EMAIL_SETTINGS_SMTP_IMAP_PROOF_2026-06-10.md](OP_EMAIL_SETTINGS_SMTP_IMAP_PROOF_2026-06-10.md)
and covers optional first-run SMTP/IMAP setup, owner-admin redacted Admin settings, DB-backed SMTP
delivery resolution, IMAP raw-MIME polling/parser enqueueing, and the new ImapFlow dependency.
The reconciled proof is matched to the current 52-path source/docs/config diff; selector-driven
local validation, Docker residual watch, Docker app smoke, and Docker E2E pass.

First-run setup no longer accepts or requires a setup key. The current proof is recorded in
[OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md](OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md)
and covers empty-state production setup without a key, partial-state blocking, loopback/Docker
bridge non-production gating, selected OP-authored starter presets, optional first-matter
hydration, owner session/audit creation, host and Docker E2E, and Docker smoke/residual checks.

Completed OP-MOD, mainline consolidation, and Docker-maintenance proof has been summarized in
[Archive](../archive/README.md#completed-proof-ledgers). Keep this active index focused on current
proof and skipped-check context.

Direct proof-index links retained for archived ledgers:
[OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md](OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md),
[OP-MOD-002_DASHBOARD_SHELL_NAVIGATION_MODEL_PROOF_2026-06-08.md](OP-MOD-002_DASHBOARD_SHELL_NAVIGATION_MODEL_PROOF_2026-06-08.md),
[OP_DOCKER_SECURITY_EFFICIENCY_REFACTOR_PROOF_2026-06-07.md](OP_DOCKER_SECURITY_EFFICIENCY_REFACTOR_PROOF_2026-06-07.md),
[DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md](DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md),
[OP_SECURITY_DOCKER_RESIDUAL_WATCH_PROOF_2026-06-05.md](OP_SECURITY_DOCKER_RESIDUAL_WATCH_PROOF_2026-06-05.md),
[OP_MAINLINE_CONSOLIDATION_WESTCAT_DEPLOY_PROOF_2026-06-09.md](OP_MAINLINE_CONSOLIDATION_WESTCAT_DEPLOY_PROOF_2026-06-09.md),
[OP_MAINLINE_SECURITY_MERGE_PRUNE_PROOF_2026-06-05.md](OP_MAINLINE_SECURITY_MERGE_PRUNE_PROOF_2026-06-05.md),
[OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-04.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-04.md),
[OP_MAINLINE_CONSOLIDATION_PROOF_2026-06-03.md](OP_MAINLINE_CONSOLIDATION_PROOF_2026-06-03.md), and
[OP_MAINLINE_PUSH_PRUNE_FOLLOWUP_PROOF_2026-06-03.md](OP_MAINLINE_PUSH_PRUNE_FOLLOWUP_PROOF_2026-06-03.md).

The 2026-06-09 setup hydration CSP hotfix proof is recorded in
[OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md](OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md).
It restores production Next.js hydration by allowing inline bootstrap scripts without
`unsafe-eval`, while keeping production API connections scoped to `self`.

The 2026-06-09 first-run setup hydration proof is recorded in
[OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md](OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md).
It removes the setup-key contract, preserves empty-state/partial-state setup safety, hydrates
selected starter presets and an optional first matter, and records full host, Docker, and
first-run E2E validation.

The 2026-06-15 Full CRM Contacts proof is recorded in
[OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md](OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md). It covers
the contact/organization CRM model, relationship maintenance, matter-contact associations,
conflict-check expansion, portal grant lifecycle, authorization/redaction posture, clean-room
reference use, and mainline validation evidence.

The 2026-06-16 contact duplicate review assistance proof is recorded in
[OP_CONTACT_DUPLICATE_REVIEW_ASSISTANCE_PROOF_2026-06-16.md](OP_CONTACT_DUPLICATE_REVIEW_ASSISTANCE_PROOF_2026-06-16.md).
It covers review-only derived duplicate cues, safe duplicate candidate metadata, API redaction,
dashboard review context, and the no-merge/no-contact-mutation boundary.

## Proof Inventory

This table is a proof-file index, not a live workboard. Use it to find dated validation evidence;
use [Planning and Progress](../planning-and-progress.md) for current row status.

| Artifact                                                                                                                                                           | Type                 | Use                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-26.md)                                                               | Mainline proof       | Proof for the 2026-06-26 all-active-lane closeout, covering features/capabilities audit and remediation, appointment booking tentative holds, structured task management V3, calendar tickler review bridge, external S3 env bootstrap, Docker storage preflight, Gitleaks history fixture tuning, selector-driven validation, `0071`/`0072` migration reconciliation, private-pilot release proof, final `main` publication, clean merged worktree/branch pruning, and unchanged stash count `42`.                                                                             |
| [OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md](OP-T161_CALENDAR_TICKLER_REVIEW_BRIDGE_PROOF_2026-06-26.md)                                           | Row-local proof note | Proof for the OP-T161 calendar tickler review bridge, covering review-only reuse of `calendar_scheduling_requests`, duplicate-open-request rejection, typed web payload defaults, Tasks and Calendar dashboard request actions, task-workbench refresh, selector-driven validation, and preserved no-new-table, no-migration, no-dependency, no-provider-sync, no-public-booking, no-court-rule-automation, and no-automatic-mutation boundaries.                                                                                                                               |
| [OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md](OP_DOCKER_STORAGE_PREFLIGHT_PROOF_2026-06-26.md)                                                                 | Maintenance proof    | Proof for the Docker storage preflight guard, covering early local Docker free-space checks for Docker-heavy validation and private-pilot release proof, Docker `system df` context capture, pull-free local-image probing, selector coverage, and preserved runtime APIs, schemas, Compose contracts, Docker pins, dependencies, automatic Docker pruning, synthetic-only proof, and clean-room posture.                                                                                                                                                                       |
| [OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md](OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md)                                     | Maintenance proof    | Proof for Gitleaks history false-positive tuning, covering exact reviewed fingerprints for synthetic test/proof fixtures, `.gitleaksignore` selector and security-review routing, no broad allowlist boundary, tracked-secret scan strength, local evidence posture, selector-driven validation, and clean-room posture.                                                                                                                                                                                                                                                        |
| [OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md](OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md)                                 | Row-local proof note | Proof for the metadata-only document conversion review state/readiness packet, covering additive `conversionReview.reviewReadiness` API/workbench responses, reviewed/rejected conversion-review posture, bounded worker artifact metadata, Documents dashboard copy, selector-driven validation, and preserved provider-disabled/review-only behavior, raw OCR/provider evidence, downstream mutation, schema, migration, dependency, route/auth, and synthetic-only boundaries.                                                                                               |
| [OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md](OP_APPOINTMENT_BOOKING_TENTATIVE_HOLDS_PROOF_2026-06-26.md)                                           | Row-local proof note | Proof for the appointment booking tentative-holds slice, covering staff-managed profiles, website booking APIs, token-hashed direct links, tentative calendar events, staff confirm/dismiss review, public `/appointment-booking#token` runner, intake appointment status counts, route authorization/redaction, audit taxonomy coverage, selector-driven validation, and preserved no-provider-sync, no-public-room, no-native-media, no-chat, no-recording, no-auto-confirm, no-auto-expiry, no-automatic-matter-creation, no-new-dependency, and no-private-data boundaries. |
| [OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md](OP_STRUCTURED_TASK_MANAGEMENT_V3_PROOF_2026-06-26.md)                                                       | Row-local proof note | Proof for structured task management V3, covering additive checklist items, staff-only comments, dependency blockers, reusable templates, structured task detail reads, route authorization manifest coverage, audit-safe metadata, Tasks dashboard structured-detail controls, migration/repository/domain validation, and preserved existing task CRUD, source-pair, archive, workbench, permission, client visibility, provider, recurrence, dependency, and email boundaries.                                                                                               |
| [OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md](OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md)                                                         | Audit proof note     | Documentation-only competitive parity audit covering current Open Practice capability maturity, clean-room Clio/reference-source posture, proof coverage, intentionally deferred watch items, and no new candidate backlog rows because no high-confidence gap was found beyond shipped, review-only, provider-disabled, or explicitly deferred boundaries.                                                                                                                                                                                                                     |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-25.md)                                                               | Mainline proof       | Proof for the 2026-06-25 all-active-lane closeout, covering Canadian template/sample enhancements, reliable local PDF/image OCR, deep security remediation, external HTTPS S3 restore-drill evidence, bundled-MinIO hardening proof, selector-driven validation, direct `main` publication, clean merged-branch/worktree prune, and unchanged stash count.                                                                                                                                                                                                                      |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-24.md)                                                               | Mainline proof       | Proof for the 2026-06-24 three-lane mainline closeout, covering lane commits, integration-branch merge order, additive readiness/MinIO/video conflict reconciliation, selector-driven validation, direct `main` publication, clean merged-branch/worktree prune, and unchanged stash count.                                                                                                                                                                                                                                                                                     |
| [OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md](OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md)                                       | Maintenance proof    | Proof for Canadian first-run starter template and seeded sample enhancements, covering pan-Canadian and BC-specific synthetic drafting/intake/document/assembly wording, deterministic embedded intake definitions, selector-driven domain/API/provider/worker validation, and preserved preset IDs, setup payload compatibility, sample IDs/counts, provider assumptions, authorization assumptions, no email drafts/delivery, no dependencies, no migrations, no API routes, and no legal-advice/certification claims.                                                        |
| [OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md](OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md)                                           | Maintenance proof    | Proof for the private-pilot remediation branch, covering the self-host restore drill, private-pilot release proof option, malware-scan/share gating, provider readiness/admin posture, local security review evidence normalization and selectors, review-only workflow/client-portal/comms/scheduling/billing/trust/document-processing depth, selector-driven validation, and preserved synthetic-data, privacy, no-live-settlement, no-automatic-trust-posting, no-provider-side-effect, and no-raw-text-retention boundaries.                                               |
| [OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_MINIO_READINESS_BLOCKER_PROOF_2026-06-24.md)                                       | Maintenance proof    | Proof for the private-pilot MinIO readiness blocker lane, covering residual-watch `readinessBlockers`, private-pilot release-proof gating, read-only Admin Readiness blocker copy, selector-driven validation, and preserved local-only self-hosting, synthetic-proof, no-MinIO-pin-change, no-Compose-contract-change, no-runtime-API/schema/dependency-change, and clean-room boundaries.                                                                                                                                                                                     |
| [OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md)                                   | Maintenance proof    | Proof for the external HTTPS S3 restore-drill lane, covering bundled MinIO behavior preservation, external S3 synthetic marker backup/overwrite/restore support, ignored `.env.selfhost.local` bootstrap and preflight, no list/delete permission requirement, Admin Readiness/self-host docs updates, selector-driven validation, and preserved local-only self-hosting, synthetic-proof, no-runtime-API/schema/Compose/dependency-change, default release-proof, and residual-watch boundaries.                                                                               |
| [OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md](OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md)                                                       | Maintenance proof    | Proof for the separate bundled-MinIO hardening path, covering read-only root filesystem and `/tmp` tmpfs hardening in local and self-host Compose, self-host render validation, residual-watch `minioHardening` and `acceptedResiduals`, proof-gated bundled-MinIO Trivy scan residuals, final private-pilot release proof, selector-driven validation, and preserved MinIO pins, S3 contracts, runtime APIs, schemas, dependencies, private-pilot release-proof command shape, synthetic-proof, and clean-room boundaries.                                                     |
| [OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md](OP_VIDEO_MEETINGS_CONTROL_PLANE_PROOF_2026-06-23.md)                                                         | Row-local proof note | Proof for the Calendar video meetings control-plane slice, covering staff scheduling-review controls, per-event readiness labels, public guest-session refresh/polling without reload, token-transport mismatch behavior, terminal guest-session conflict handling, CalDAV/iCalendar meeting-link preservation/non-disclosure, safe audit metadata, green package/build/browser validation, and preserved no-native-media, signaling, chat, recording, upload, public-booking, provider-sync, dependency, and migration boundaries.                                             |
| [OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md](OP_DOCUMENT_RETENTION_HOLD_ACTION_DESCRIPTOR_PROOF_2026-06-21.md)                               | Row-local proof note | Proof for the Documents retention/hold action descriptor slice, covering domain-owned labels, busy/disabled reasons, stable action keys, accessible status semantics, focused domain/web validation, and preserved route/API, authorization, review-only metadata, legal-hold blocking, portal access, audit, database, retention, migration, dependency, and route catalog boundaries.                                                                                                                                                                                         |
| [OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md](OP-T160_DEPOSIT_MATCH_REVIEW_RECORDS_PROOF_2026-06-20.md)                                               | Row-local proof note | Proof for the deposit-match review-record follow-up, covering existing manual-payment candidate cues on normalized deposit evidence, staff-only matter/candidate validation, Billing dashboard counts/copy, selector-driven validation, and preserved no-live-settlement, no-provider-command, no-raw-payload, no-invoice-balance-mutation, no-reconciliation-mutation, no-refund-or-chargeback, and no-trust-posting boundaries.                                                                                                                                               |
| [OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md](OP_LIFECYCLE_REVIEW_ACTION_DESCRIPTOR_PROOF_2026-06-20.md)                                             | Row-local proof note | Proof for the Lifecycle readiness review action descriptor slice, covering domain-owned labels, busy/disabled reasons, stable action keys, accessible status semantics, focused domain/web validation, and preserved route/API, authorization, lifecycle command, provider, settlement, trust, retention, and review-only evidence boundaries.                                                                                                                                                                                                                                  |
| [OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md](OP_DOCUMENT_RETENTION_HOLD_REVIEW_SURFACE_PROOF_2026-06-20.md)                                     | Row-local proof note | Proof for the staff-only document retention/hold review surface, covering bounded latest-decision metadata, workbench and Documents UI posture, safe audit metadata, matter-scoped authorization, ready-packet blocker rejection, selector-driven validation, and preserved no-object-deletion/no-retention-deadline/no-legal-hold-override/no-retained-export-body/no-raw-payload/no-compliance-claim boundaries.                                                                                                                                                              |
| [OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md](OP_AI_PROPOSAL_AUTHORIZATION_MATRIX_PROOF_2026-06-20.md)                                                 | Maintenance proof    | Proof for behavior-preserving AI operational proposal authorization fixture coverage, including firm-wide, assigned-matter, unassigned-matter, and client-external list-query expectations, focused domain/API tests, selector-driven validation, and preserved RBAC, matter-scope, public-token, portal grant, route manifest, schema, dependency, route behavior, and response-shape boundaries.                                                                                                                                                                              |
| [OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md](OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md)                                                                       | Maintenance proof    | Proof for the scoped dead-code and bloat prune, covering low-risk API/web/worker export contraction, generated Playwright artifact removal, stale release-age excludes, provider/domain/database package-surface narrowing, selector-driven validation, package/API/web/worker gates, policy/build checks, and preserved public routes, authorization, redaction, payment/trust, provider, migration, ProseMirror, public-token, and synthetic-data boundaries.                                                                                                                 |
| [OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md](OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md)                                   | Maintenance proof    | Proof for the docs-only API route inventory reconciliation and follow-up, covering compact route notation rules plus explicit WebAuthn step-up, CalDAV, public receipt, public-token/path-token, and local/e2e-support-only route anchors while preserving route registration, route authorization, public-token semantics, CalDAV behavior, e2e helper availability, schemas, providers, payment, trust, and runtime source.                                                                                                                                                   |
| [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md)                                                   | Maintenance proof    | Exhaustive branch-based inventory for stubs, placeholders, TODO markers, worker skipped paths, dead-code/tooling evidence, route/API drift, web route catalog coverage, and intentional review-only boundaries, with no P0/P1 runtime blocker or confirmed production stub found; its only new follow-up is closed by the API docs route inventory reconciliation proof.                                                                                                                                                                                                        |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-19.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-19.md)                                                               | Maintenance proof    | Proof for the 2026-06-19 active-lane mainline closeout, covering lane commits, integration-branch merge order, migration numbering reconciliation, selector-driven validation, main/origin parity, push, prune, and unchanged stash count.                                                                                                                                                                                                                                                                                                                                      |
| [OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md](OP-T160_MATTER_LIFECYCLE_COMMANDS_PROOF_2026-06-19.md)                                                     | Row-local proof note | Proof for the first review-gated matter lifecycle command runtime slice, covering `pause` `open -> paused`, `reopen` `paused -> open`, latest-ready journal gating, status-only matter mutation, safe audit metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/assignment/billing/trust/retention/cleanup side effects.                                                                                                                                                                                                                              |
| [OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md](OP-T160_MATTER_LIFECYCLE_CLOSE_COMMAND_PROOF_2026-06-20.md)                                           | Row-local proof note | Proof for the status-only matter lifecycle close-command slice, covering `close` `open -> closed`, latest-ready journal gating, status-only matter mutation, safe audit metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/assignment/billing/trust/retention/cleanup side effects.                                                                                                                                                                                                                                                                  |
| [OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md](OP-T160_MATTER_LIFECYCLE_ARCHIVE_COMMAND_PROOF_2026-06-21.md)                                       | Row-local proof note | Proof for the status-only matter lifecycle archive-command slice, covering `archive` `closed -> archived`, latest-ready journal gating, status-only matter mutation, safe audit metadata, selector-driven validation, and preserved no-`closedOn`/portal/task/assignment/billing/trust/retention/cleanup side effects.                                                                                                                                                                                                                                                          |
| [OP_OPERATIONAL_EFFICIENCY_REMEDIATION_PROOF_2026-06-19.md](OP_OPERATIONAL_EFFICIENCY_REMEDIATION_PROOF_2026-06-19.md)                                             | Maintenance proof    | Proof for the operational efficiency remediation branch, covering Docker-local same-origin API routing validation, filtered audit read indexes without filtered chain-validity claims, client portal workspace batching and focused signature lookup, communications child-row bulk reads, dashboard/operations SSR parallelization, selector-driven validation, and preserved response-shape, authorization, redaction, provider, trust/payment, and Docker local-dev-only boundaries.                                                                                         |
| [OP_REVIEW_REMEDIATION_PROOF_2026-06-19.md](OP_REVIEW_REMEDIATION_PROOF_2026-06-19.md)                                                                             | Maintenance proof    | Proof for the focused review remediation branch, covering contact dossier/preload reuse, indexed contact dossier inputs, assigned-matter billing list batching, route authorization manifest extraction, external-upload dashboard helper extraction, selector/domain-build alignment, and preserved response-shape, authorization, redaction, provider, payment, trust, and public/private data boundaries.                                                                                                                                                                    |
| [OP_STAFF_UI_UX_PAGE_OVERHAUL_PROOF_2026-06-19.md](OP_STAFF_UI_UX_PAGE_OVERHAUL_PROOF_2026-06-19.md)                                                               | Row-local proof note | Proof for the staff UI/UX page overhaul, covering canonical workspace/finance/operations/review pages, legacy `?section=` aliases, Communications routing, shell navigation, light legal-ops visual refresh, screenshot evidence, selector-selected host/Docker/first-run/matterless/client-portal/web validation, and preserved API, permission, public-token, client-portal, settlement, trust-posting, provider, worker, and synthetic-data boundaries.                                                                                                                      |
| [OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md](OP_UI_OVERLAP_RESILIENCE_PROOF_2026-06-19.md)                                                                       | Row-local proof note | Proof for first-matter zero-matter workspace layout hardening, first-matter/zero-matter collision-selector coverage, matterless breakpoint browser proof, and preserved API payload, authorization, matter-creation, setup, provider, payment, trust-posting, and public-data boundaries.                                                                                                                                                                                                                                                                                       |
| [OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md](OP_EMAIL_OUTBOX_CHILD_BULK_READS_PROOF_2026-06-18.md)                                                       | Row-local proof note | Proof for the email outbox child-row bulk-read efficiency branch, covering optional `emailIds` repository filters, memory/Drizzle parity, page-scoped event/token batching for outbox and communications history, selector-driven validation, and preserved route shape, authorization, redaction, provider, receipt, and trust/payment boundaries.                                                                                                                                                                                                                             |
| [OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md](OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md)                                                         | Row-local proof note | Done proof for the additive read-only aged receivables report, covering visible-client/matter/invoice/aging-bucket grouping, current/30/60/90 buckets, manual report export profiles, dashboard rendering, and no live settlement, automatic allocation, invoice mutation, trust posting, raw report body storage, or accounting certification.                                                                                                                                                                                                                                 |
| [OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md](OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md)                                   | Row-local proof note | Docs-first proof for the document retention and hold workflow design, covering configured review schedules, hold-blocking rules, deletion-review gates, records-disposition wording, and no runtime change, deletion automation, retention-deadline enforcement, legal-hold override, object deletion, or compliance certification.                                                                                                                                                                                                                                             |
| [OP_EXPENSE_CATEGORY_REGISTRY_PROOF_2026-06-17.md](OP_EXPENSE_CATEGORY_REGISTRY_PROOF_2026-06-17.md)                                                               | Row-local proof note | Proof for the firm-managed expense category registry, covering persisted codes, active/applicability validation for new expense entries, Billing controls management, dashboard compatibility projection, legacy free-text row readability, and preserved invoice/payment/trust boundaries.                                                                                                                                                                                                                                                                                     |
| [OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md](OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md)                                                   | Row-local proof note | Proof for the financial export field-profile slice, covering reusable billing/trust field-profile metadata, profile-ID-only queue/job/audit metadata, regenerated downloads with original serialization, selector-driven validation, and preserved no-retained-body/no-settlement/no-automatic-trust-posting boundaries.                                                                                                                                                                                                                                                        |
| [OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md](OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md)                                             | Row-local proof note | Proof for the reviewer-only ledger balance snapshot comparison, covering current trust balance totals, latest posted transaction posture, latest statement import batch metadata as preview posture, latest reconciliation snapshot cues, Funds dashboard rendering, and preserved no-preview-row-storage/no-posting/no-matching/no-settlement/no-bank-feed/no-certified-accounting boundaries.                                                                                                                                                                                 |
| [OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md](OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md)                                                                   | Maintenance proof    | Proof for the final Clio parity workflow-depth closure, covering metadata-only document conversion review, staff-reviewed scheduling requests, legal-clinic cadence signals, CRM retention-hold cues and matter-scoped exports, reconciliation freshness, trust/reporting dimensions, exact path-set ownership, and preserved clean-room/no-raw-text/no-live-settlement/no-automatic-trust-posting boundaries.                                                                                                                                                                  |
| [OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md](OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md)                         | Maintenance proof    | Proof for the Docker app-image footprint and Compose hardening lane, covering pruned API/Web/Worker images, Next standalone Web runtime, reduced Docker build context, local-only Compose migration and MinIO bucket self-initialization, loopback-only port rendering, historical Docker smoke/E2E validation, residual-watch candidates, the 2026-06-17 blocked Docker rerun, and the same-day Postgres pin hold.                                                                                                                                                             |
| [OP_DOCUMENT_CONVERSION_REVIEW_RUNTIME_PROTOTYPE_PROOF_2026-06-16.md](OP_DOCUMENT_CONVERSION_REVIEW_RUNTIME_PROTOTYPE_PROOF_2026-06-16.md)                         | Row-local proof note | Proof for the local-only document conversion review runtime prototype, covering `document_processing:create` authorization, OCR queue reuse, metadata-only `document_conversion_review` jobs, `document_analysis_status` artifact posture, OP-authored summary posture, redacted counts/statuses, and preserved no-raw-text/no-Markdown/no-annotation/no-provider-payload/no-prompt/no-embedding/no-storage-key boundaries.                                                                                                                                                     |
| [OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md](OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md)                                         | Row-local proof note | Proof for the docs-only planned matter lifecycle command policy/API contract, covering future pause/close/archive/reopen command semantics, readiness gating, portal/billing/task/assignment/audit/cleanup consequences, no runtime/schema/UI changes, and the preserved evidence-only transition journal.                                                                                                                                                                                                                                                                      |
| [OP_PAYMENT_IMPORT_DEPOSIT_MATCHING_BOUNDARY_PACKET_PROOF_2026-06-17.md](OP_PAYMENT_IMPORT_DEPOSIT_MATCHING_BOUNDARY_PACKET_PROOF_2026-06-17.md)                   | Row-local proof note | Proof for the docs-only payment import and deposit matching boundary packet, covering future processor imports, deposit proposals, refunds, and chargebacks as reviewer-owned normalized evidence only, while excluding runtime APIs, provider payload retention, invoice-balance mutation without reviewer evidence, live settlement, trust posting, provider commands, and client notifications.                                                                                                                                                                              |
| [OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md](OP-T160_PAYMENT_IMPORT_REVIEW_RECORDS_PROOF_2026-06-19.md)                                             | Row-local proof note | Proof for the first runtime slice under the payment import and deposit matching boundary packet, covering staff-only provider-neutral review records, normalized processor evidence cues, idempotency/conflict handling, safe audit metadata, Billing dashboard rendering, and preserved no raw payload, invoice mutation, settlement, reconciliation, refund, chargeback, provider-command, notification, or trust-posting behavior.                                                                                                                                           |
| [OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md](OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md)                                       | Row-local proof note | Proof for the docs-only reviewed provider-backed document conversion boundary, covering future conversion, annotation, chunking, embedding, and semantic-review guardrails; preserved metadata-only `document_conversion_review` runtime posture; clean-room/license constraints; and no raw client text, converted Markdown, annotation bodies/spans, prompts, chunks, embeddings/vectors, storage keys, object bodies, provider payloads, private excerpts, or generated summaries in durable metadata.                                                                       |
| [OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md](OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md)                     | Row-local proof note | Proof for the smallest local provider-backed metadata follow-up to document conversion review, covering the dependency-free provider adapter, provider/status posture in existing worker/API summaries, redaction allowlist coverage, focused provider/worker/API/domain tests, and preserved no raw text, Markdown, annotations, chunks, embeddings, prompts, storage keys, object bodies, provider payloads, private excerpts, or generated summaries.                                                                                                                        |
| [OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md](OP_TRUST_CONTROLS_MAKER_CHECKER_READINESS_PROOF_2026-06-28.md)                                     | Row-local proof note | Proof for read-only Trust Controls maker-checker readiness indicators, covering category and safe matter-ID projection cues from existing controls data, matter-scoped filtering, dashboard boundary copy, and preserved no-policy-enabled/no direct-posting-change/no approval mutation/no auto-posting/no settlement/no bank-feed matching/no jurisdiction-certified accounting boundaries.                                                                                                                                                                                   |
| [OP_TRUST_POSTING_ACTION_DESCRIPTORS_PROOF_2026-06-17.md](OP_TRUST_POSTING_ACTION_DESCRIPTORS_PROOF_2026-06-17.md)                                                 | Row-local proof note | Proof for the read-only Trust Controls posting-request approve/reject descriptor slice, covering domain-owned action labels, busy/disabled reasons, accessible labels, stable action keys, dashboard guardrails, unchanged API/database/audit semantics, and the no-settlement/no-bank-feed/no automatic-trust-posting boundary.                                                                                                                                                                                                                                                |
| [OP_TRUST_POSTING_APPROVAL_COMMANDS_PROOF_2026-06-16.md](OP_TRUST_POSTING_APPROVAL_COMMANDS_PROOF_2026-06-16.md)                                                   | Row-local proof note | Proof for the opt-in pre-post trust posting approval commands, covering prepare/list/approve/reject semantics, trust-ledger authorization, maker-checker restrictions, idempotent balanced posting at approval time, no-overdraft recheck behavior, Funds controls cues, safe audit metadata, and the no-settlement/no-bank-feed/no trust-transfer auto-post/no certified-accounting boundary.                                                                                                                                                                                  |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md)                                                               | Mainline proof       | Proof for the 2026-06-16 16-lane branch-first mainline merge plus later three-lane/eight-lane follow-up merges, 2026-06-17 local worktree retirements, unpublished-delta Docker blockers, and the 2026-06-18 all-active-lanes Docker gate closeout, `main` publication, parity verification, and merged branch/worktree prune.                                                                                                                                                                                                                                                  |
| [OP-T133_WORKER_OWNED_PACKAGE_ASSEMBLY_PROOF_2026-06-16.md](OP-T133_WORKER_OWNED_PACKAGE_ASSEMBLY_PROOF_2026-06-16.md)                                             | Row-local proof note | Done proof for moving embedded intake generated-package assembly to the worker-owned `document_assembly` queue with snapshot reload, redacted lifecycle metadata, compact poll responses, and no docassemble runtime dependency.                                                                                                                                                                                                                                                                                                                                                |
| [OP_MANUAL_PAYMENT_RECONCILIATION_GATE_PROOF_2026-06-16.md](OP_MANUAL_PAYMENT_RECONCILIATION_GATE_PROOF_2026-06-16.md)                                             | Row-local proof note | Done proof for the manual-payment reconciliation gate, covering pending manual-payment evidence, reviewer reconciliation before effective allocations, Billing dashboard cues, audit metadata, and no live settlement, automatic deposit reconciliation, or trust posting.                                                                                                                                                                                                                                                                                                      |
| [OP_INTAKE_TEMPLATE_VERSIONS_PROOF_2026-06-16.md](OP_INTAKE_TEMPLATE_VERSIONS_PROOF_2026-06-16.md)                                                                 | Row-local proof note | Proof for mutable staff intake-template drafts, immutable published versions, session-pinned public link behavior, redacted publish audit metadata, migration backfill, and selector-driven validation for the schema/API/domain/docs/policy change set.                                                                                                                                                                                                                                                                                                                        |
| [OP_SIGNATURE_REQUEST_ENVELOPE_METADATA_PROOF_2026-06-16.md](OP_SIGNATURE_REQUEST_ENVELOPE_METADATA_PROOF_2026-06-16.md)                                           | Row-local proof note | Proof for OP-authored signer-order and field-placement metadata on existing signature requests, covering provider-neutral validation, persistence defaults, no-side-effect rejection, redacted evidence-packet summaries, dashboard posture, and selector-driven validation.                                                                                                                                                                                                                                                                                                    |
| [OP_WORKFLOW_STEP_HISTORY_PROJECTION_PROOF_2026-06-16.md](OP_WORKFLOW_STEP_HISTORY_PROJECTION_PROOF_2026-06-16.md)                                                 | Row-local proof note | Proof for the workflow-step history projection branch, covering domain grouping/redaction, `GET /api/jobs/workflows`, matter-scoped authorization, dashboard Operations/Queues rendering, route manifest coverage, docs reconciliation, and selector-driven validation.                                                                                                                                                                                                                                                                                                         |
| [OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md](OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md)                                             | Row-local proof note | Proof for the queued single-contact CRM contact-history export link follow-up, covering request/poll/download routes under existing `contact:export`, metadata-only reports queue lifecycle records, authenticated 24-hour link expiry, regenerated downloads, dashboard queued status/download behavior, redaction allowlists, and no retained export body or broad retention/legal-hold claim.                                                                                                                                                                                |
| [OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md](OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md)                                                     | Row-local proof note | Proof for the single-contact CRM contact-history export runtime, covering existing `contact:export` authorization, transient `staff_review` JSON generation from authorized projections, redaction/audit metadata boundaries, dashboard JSON download behavior, docs reconciliation, and selector-driven validation.                                                                                                                                                                                                                                                            |
| [OP-T121_REMINDER_JOB_RECONCILIATION_PROOF_2026-06-16.md](OP-T121_REMINDER_JOB_RECONCILIATION_PROOF_2026-06-16.md)                                                 | Row-local proof note | Done proof for durable reconciliation of queued opt-in calendar reminder email jobs when staff cancel, delete, reschedule, or refresh pending dashboard reminder records.                                                                                                                                                                                                                                                                                                                                                                                                       |
| [OP_CONTACT_DUPLICATE_REVIEW_ASSISTANCE_PROOF_2026-06-16.md](OP_CONTACT_DUPLICATE_REVIEW_ASSISTANCE_PROOF_2026-06-16.md)                                           | Row-local proof note | Proof for review-only contact duplicate assistance, covering derived safe duplicate candidate metadata in dossiers/review queues, API matched-value redaction, Contacts dashboard review context, append-only reviewer decisions, and no merge, migration, contact rewrite, conflict mutation, or matter-scope widening.                                                                                                                                                                                                                                                        |
| [OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md](OP_INTAKE_QA_SCENARIO_MATRIX_PROOF_2026-06-16.md)                                                               | Row-local proof note | Proof for staff-only saved intake QA scenarios, covering named branch-path/package-combination scenario persistence, staff QA preview summaries without answer bodies, public payload omission, dashboard builder controls, clean-room posture, and selector-driven validation.                                                                                                                                                                                                                                                                                                 |
| [OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md](OP-T157_STAFF_SUBMISSIONS_OPERATIONS_PROOF_2026-06-15.md)                                               | Row-local proof note | Done proof for the redacted staff submissions operations surface, covering the derived intake-pipeline operations projection, assignment posture, export-safe dashboard summaries, privacy boundaries, focused package tests, and selector-selected validation.                                                                                                                                                                                                                                                                                                                 |
| [OP-T157_STAFF_VISUAL_BRANCH_RULE_AUTHORING_PROOF_2026-06-15.md](OP-T157_STAFF_VISUAL_BRANCH_RULE_AUTHORING_PROOF_2026-06-15.md)                                   | Row-local proof note | Proof for staff visual branch-rule authoring, covering structured rule editing, typed trigger values, shown-question/package targets, local preview path summaries, public runner regression coverage, clean-room posture, and unchanged public form semantics/API/persistence.                                                                                                                                                                                                                                                                                                 |
| [OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md)                                                                 | Maintenance proof    | Proof for the isolated `stripe@22.2.1` compatibility review, preserving Checkout Session-only provider/payment behavior while recording focused provider/API validation and dependency closeout gates.                                                                                                                                                                                                                                                                                                                                                                          |
| [OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md)                                                                 | Maintenance proof    | Proof for the isolated `pdfkit@0.19.1` compatibility review, preserving provider draft PDF rendering and API export behavior while recording focused provider/API validation and dependency closeout gates.                                                                                                                                                                                                                                                                                                                                                                     |
| [OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md](OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md)                                         | Maintenance proof    | Proof for the isolated `@fastify/rate-limit@11.0.0` compatibility review, preserving API rate-limit behavior while recording focused typecheck/test evidence and dependency closeout gates.                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md)                                                                             | Maintenance proof    | Proof for the 2026-06-19 security plus patch/minor dependency refresh, covering the Nodemailer advisory remediation, current npm patch/minor updates, dependency audit/license evidence, focused provider compatibility, and the held CycloneDX major candidate.                                                                                                                                                                                                                                                                                                                |
| [OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md](OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md) | Row-local proof note | Proof for the docs-only contact-history export, retention, and privacy decision packet, covering the pre-implementation policy choices needed before future CRM export runtime work and explicitly excluding API, database, UI, worker, provider, migration, dependency, and export behavior changes.                                                                                                                                                                                                                                                                           |
| [OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md](OP_FULL_CRM_CONTACTS_PROOF_2026-06-15.md)                                                                               | Row-local proof note | Proof for the Full CRM Contacts branch, covering contact/organization records, structured names/methods/identifiers, relationship editing, matter-contact associations, portal grant state and permissions, conflict-check categories, redaction boundaries, clean-room reference posture, and branch validation.                                                                                                                                                                                                                                                               |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-14.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-14.md)                                                               | Mainline proof       | Proof for the 2026-06-14 six-lane branch-first mainline merge, overlap reconciliation, stale unavailable-route E2E assertion update, broad local CI, dependency audit/license checks, host/Docker/first-run/matterless/client-portal E2E, and final push/prune gate.                                                                                                                                                                                                                                                                                                            |
| [OP-T156_CLIENT_PORTAL_PERMISSIONED_WORKSPACE_V2_PROOF_2026-06-13.md](OP-T156_CLIENT_PORTAL_PERMISSIONED_WORKSPACE_V2_PROOF_2026-06-13.md)                         | Row-local proof note | Done proof for the permissioned logged-in client portal workspace V2, covering account-bound grants, confidential-client file visibility, signature actions, staff document grant/revoke controls, client portal screenshot QA, redaction boundaries, and selector-driven merge handoff validation.                                                                                                                                                                                                                                                                             |
| [OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md](OP-T155_INTAKE_WIDGET_REGISTRY_PROOF_2026-06-13.md)                                                           | Row-local proof note | Done proof for the clean-room intake widget registry and validator adapter slice, covering domain validation/preview/QA adapters, public renderer delegation, staff builder default-item registry coverage, and no new item kinds, dependencies, API/database/provider changes, or public runner behavior changes.                                                                                                                                                                                                                                                              |
| [OP_DEAD_CODE_PRUNE_PROOF_2026-06-13.md](OP_DEAD_CODE_PRUNE_PROOF_2026-06-13.md)                                                                                   | Maintenance proof    | Proof for the isolated dead-code cleanup and scanner gate, covering Knip configuration, package-policy integration, high-confidence API/database/web export cleanup, CSS selector pruning, direct dependency pruning, and held public-surface candidates.                                                                                                                                                                                                                                                                                                                       |
| [OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-12.md](OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-12.md)                                                               | Mainline proof       | Proof for the 2026-06-12 branch-first mainline merge, dirty sibling worktree commits, OP-T153 and SMTP/IMAP merge reconciliation, OP-SEC production setup gate hardening, OP-T155 focused E2E validation lanes, selected broad validation, Docker app-smoke retry evidence, esbuild audit remediation, and final push/prune handoff.                                                                                                                                                                                                                                            |
| [OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md)                                                                             | Maintenance proof    | Proof for the conservative 2026-06-13 dependency refresh covering safe patch/minor npm updates, held major candidates, the late Stripe provider/payment patch review candidate, dependency audit/license evidence, Docker image inventory, and the 2026-06-15 PDT Docker residual-watch rerun that cleared the earlier Docker Engine blocker.                                                                                                                                                                                                                                   |
| [OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md](OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md)                                                                             | Maintenance proof    | Proof for the conservative 2026-06-11 dependency refresh covering safe patch/minor npm/pnpm updates, `pnpm@11.5.3`, reference-lock alignment, held major candidates, dependency audit/license evidence, Docker image inventory, and Docker residual-watch posture.                                                                                                                                                                                                                                                                                                              |
| [OP-T153_TASK_SYSTEM_V2_PROOF_2026-06-10.md](OP-T153_TASK_SYSTEM_V2_PROOF_2026-06-10.md)                                                                           | Row-local proof note | Proof for the staff-only matter-scoped task system V2 lifecycle API, repository persistence, audit actions, operational-view task rows, dashboard Tasks workspace, migration sequencing, and selected host/Docker validation.                                                                                                                                                                                                                                                                                                                                                   |
| [OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md](OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md)                                                                           | Row-local proof note | Proof for matterless contacts/calendar workflows, zero-matter dashboard navigation, public-token browser-navigation follow-up, and selected host/Docker E2E merge handoff evidence.                                                                                                                                                                                                                                                                                                                                                                                             |
| [OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md](OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md)                                                               | Setup proof note     | Proof for removing the setup-key contract from first-run setup while preserving empty-state-only setup, partial-state blocking, loopback/Docker bridge non-production gating, starter preset hydration, optional first-matter creation, owner session/audit creation, and full host/Docker/first-run E2E validation.                                                                                                                                                                                                                                                            |
| [OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md](OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md)                                                             | Security hotfix      | Proof for the setup-wizard hydration CSP hotfix allowing production Next.js inline bootstrap scripts without `unsafe-eval`, preserving `connect-src 'self'`, local Docker relaxed-CSP gating, and first-run setup API behavior.                                                                                                                                                                                                                                                                                                                                                 |
| [OP_CODE_REVIEW_REMEDIATION_PROOF_2026-06-06.md](OP_CODE_REVIEW_REMEDIATION_PROOF_2026-06-06.md)                                                                   | Security remediation | Proof for the merged code review remediation mainline covering Docker-ignore/release scanning policy, public-token header transport and URL redaction, permission-aware share/upload capabilities, email receipt compare-and-set correctness, strict public parsing/upload schemas, metadata redaction, web network-failure resilience, selector/proof policy gates, host/Docker E2E, and final validation evidence.                                                                                                                                                            |
| [OP_SECURITY_FULL_SCAN_REMEDIATION_PROOF_2026-06-05.md](OP_SECURITY_FULL_SCAN_REMEDIATION_PROOF_2026-06-05.md)                                                     | Security remediation | Proof for the 2026-06-05 full-scan remediation lane covering client-external aggregate denial, production CORS scoping, same-matter duplicate IDs, inbound-email redaction, audit sequencing, OCR scan gating, provider status RBAC, redacted stale guest-token access logging, closed Docker follow-up evidence, and the formal `/tmp` Codex Security report bundle.                                                                                                                                                                                                           |
| [OP_SECURITY_HOT_PATH_RESCAN_PROOF_2026-06-05.md](OP_SECURITY_HOT_PATH_RESCAN_PROOF_2026-06-05.md)                                                                 | Security maintenance | Proof for the local hot-path rescan helper that reruns scoped evidence for inbound email redaction/promotion, public guest-token logging, Drizzle audit append semantics, and checksum duplicate-lock code after future edits.                                                                                                                                                                                                                                                                                                                                                  |
| [OP_AUDIT_EVENT_SEQUENCE_HARDENING_PROOF_2026-06-05.md](OP_AUDIT_EVENT_SEQUENCE_HARDENING_PROOF_2026-06-05.md)                                                     | Security remediation | Standalone proof for the audit-event sequencing hardening slice, covering per-firm audit sequences, hash-chain backfill, advisory append locking, legacy record recomputation, and domain/database/API/worker validation.                                                                                                                                                                                                                                                                                                                                                       |
| [OP_SECURITY_OCR_SCAN_GATING_PROOF_2026-06-05.md](OP_SECURITY_OCR_SCAN_GATING_PROOF_2026-06-05.md)                                                                 | Security remediation | Standalone proof for the OCR scan-gating slice, covering scan-safe OCR queue preconditions, worker scan rechecks, inbound-email promotion without automatic OCR, and storage-key redaction.                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP_SECURITY_STAFF_AGGREGATE_CORS_PROOF_2026-06-05.md](OP_SECURITY_STAFF_AGGREGATE_CORS_PROOF_2026-06-05.md)                                                       | Security remediation | Standalone proof for the staff aggregate authorization and authenticated production CORS slice, covering `client_external` denials, configured-origin CORS, and billing-denied web fallback behavior.                                                                                                                                                                                                                                                                                                                                                                           |
| [OP_SECURITY_REMEDIATION_2026-06-03.md](OP_SECURITY_REMEDIATION_2026-06-03.md)                                                                                     | Security remediation | Proof for resolving the reportable 2026-06-03 security findings across auth freshness, signatures/evidence, public tokens, uploads, OCR, reports, billing, and docs.                                                                                                                                                                                                                                                                                                                                                                                                            |
| [OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md](OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md)                                                                         | Audit proof note     | Clean-room core-suite Clio parity gap audit that refreshed the active goal backlog after OP-T127 through OP-T143; OP-T144 through OP-T152 now have row-local proof and no active core-suite parity candidate remains.                                                                                                                                                                                                                                                                                                                                                           |
| [OP-T152_SCOPED_DEVELOPER_API_WEBHOOK_REPLAY_PROOF_2026-06-04.md](OP-T152_SCOPED_DEVELOPER_API_WEBHOOK_REPLAY_PROOF_2026-06-04.md)                                 | Row-local proof note | Done proof for the scoped developer API enforcement and webhook replay boundary slice, covering explicit app enforcement posture, `webhook.deliver` scope checks, app-scoped confirmed replay, redacted delivery jobs, and redacted audit metadata.                                                                                                                                                                                                                                                                                                                             |
| [OP-T151_LEGAL_RESEARCH_PROVIDER_JOB_BOUNDARY_PROOF_2026-06-04.md](OP-T151_LEGAL_RESEARCH_PROVIDER_JOB_BOUNDARY_PROOF_2026-06-04.md)                               | Row-local proof note | Done proof for the first legal-research provider job boundary slice, covering reserved citation-review job lifecycle metadata, strict no-prompt/no-source body API input, worker skip posture, Research dashboard rendering, and no legal-advice automation or source-record mutation.                                                                                                                                                                                                                                                                                          |
| [OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md](OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md)                                         | Row-local proof note | Done proof for the first metadata-only bank-feed reconciliation review slice, covering import-batch metadata in trust controls, derived bank-feed review posture, Funds dashboard rendering, and no live feeds, automatic matching, ledger posting, disbursement automation, or accounting claims.                                                                                                                                                                                                                                                                              |
| [OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md](OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md)                       | Row-local proof note | Done proof for the first payment settlement/reconciliation review slice, covering normalized settlement-event posture, Billing dashboard review copy, audit redaction, and no payment application, invoice mutation, trust posting, refund/chargeback handling, or production webhook claims.                                                                                                                                                                                                                                                                                   |
| [OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md](OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md)                                 | Row-local proof note | Done proof for the first scheduled-reporting/report-builder posture slice, covering manual schedule-readiness metadata, builder posture, export-job posture, dashboard rendering, and no scheduler, custom SQL, BI embeds, scheduled delivery, or raw report-body storage.                                                                                                                                                                                                                                                                                                      |
| [OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md](OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md)                                   | Row-local proof note | Done proof for the first review-first intake follow-up/source-attribution slice, covering derived safe follow-up cues, source-label provenance, dashboard rendering, and no matter creation, campaigns, SMS, bulk delivery, ad-spend ingestion, or client contact automation.                                                                                                                                                                                                                                                                                                   |
| [OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md](OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md)                                               | Row-local proof note | Done proof for the first staff-only task/deadline review surface, covering authorized task review projections, scheduling-review cues, Queues rendering, and no automation or client-visible deadline views.                                                                                                                                                                                                                                                                                                                                                                    |
| [OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md](OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md)                                                       | Row-local proof note | Done proof for the first logged-in client-visible billing workspace slice, covering safe invoice/payment-request summaries, web rendering, and no checkout, settlement, payment evidence, trust posting, or invoice-balance mutation.                                                                                                                                                                                                                                                                                                                                           |
| [OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md](OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md)                                           | Row-local proof note | Done proof for the first logged-in client portal action workspace slice, covering grouped matter action cues, redacted conversation/calendar/document/payment summaries, web rendering, and no broad document browsing, checkout, settlement, chat, or SMS.                                                                                                                                                                                                                                                                                                                     |
| [OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md](OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md)                                                       | Row-local proof note | Done proof for the signed Mailgun raw-MIME inbound webhook slice covering HMAC validation, raw MIME storage, inbound parser enqueue, provider-setting bootstrap, route-public manifest coverage, and redacted operational status.                                                                                                                                                                                                                                                                                                                                               |
| [OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md](OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md)                                                       | Follow-up proof note | Done proof for owner-only inbound parser job retry/dead-letter recovery controls, corrected parser raw-object namespace, confirmation guards, stalled-job dead-letter checks, redacted job summaries, safe audit metadata, the 2026-06-17 metadata-only recovery posture addendum, and the 2026-06-20 metadata-only replay-request action.                                                                                                                                                                                                                                      |
| [OP_SECURITY_REVIEW_PROOF_2026-06-02.md](OP_SECURITY_REVIEW_PROOF_2026-06-02.md)                                                                                   | Security proof note  | Full security review remediation proof for password setup ownership, passkey deletion scope, share email-verifier codes, public intake redaction, public-origin CORS scoping, connector URL credentials, upload byte-size verification, and CSP hardening.                                                                                                                                                                                                                                                                                                                      |
| [OP_INBOUND_EMAIL_ROLE_POSTURE_FOLLOWUP_PROOF_2026-06-03.md](OP_INBOUND_EMAIL_ROLE_POSTURE_FOLLOWUP_PROOF_2026-06-03.md)                                           | Security proof note  | Follow-up proof for direct inbound-email API role posture, matter-address filtering, worker raw-object namespace enforcement, and redacted inbound-email job metadata.                                                                                                                                                                                                                                                                                                                                                                                                          |
| [OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md](OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md)                                                   | Row-local proof note | Done proof for authenticated provider-setting config encryption, PostgreSQL-backed API/worker key enforcement, legacy plaintext read compatibility, repository plaintext-return behavior, and docs/runtime hardening notes.                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T143_OBJECT_STORAGE_ENCRYPTION_FOLLOWUP_PROOF_2026-06-02.md](OP-T143_OBJECT_STORAGE_ENCRYPTION_FOLLOWUP_PROOF_2026-06-02.md)                                   | Follow-up proof note | Done proof for configurable SSE-S3 `AES256` requests on draft-export, inbound-email, staff document-upload, public external-upload, and public intake-form upload flows while preserving response shapes and repository contracts.                                                                                                                                                                                                                                                                                                                                              |
| [OP-T143_INBOUND_RAW_MIME_SSE_FOLLOWUP_PROOF_2026-06-03.md](OP-T143_INBOUND_RAW_MIME_SSE_FOLLOWUP_PROOF_2026-06-03.md)                                             | Follow-up proof note | Done proof for requesting configured SSE-S3 `AES256` on the Mailgun raw-MIME webhook's initial raw object write while preserving response shapes and repository contracts.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T139_LEGAL_RESEARCH_WORKSPACE_PROOF_2026-06-01.md](OP-T139_LEGAL_RESEARCH_WORKSPACE_PROOF_2026-06-01.md)                                                       | Row-local proof note | Done proof for the staff-only legal research workspace shell covering matter-scoped artifacts, bounded notes, disabled provider posture, redacted audit metadata, API authorization, Research dashboard rendering, and stacked integration validation.                                                                                                                                                                                                                                                                                                                          |
| [OP-T138_AI_OPERATIONAL_PROPOSALS_PROOF_2026-06-01.md](OP-T138_AI_OPERATIONAL_PROPOSALS_PROOF_2026-06-01.md)                                                       | Row-local proof note | Done proof for disabled-by-default, review-only AI operational proposals across deadline extraction, task creation, document organization, draft invoice cues, client-update drafts, matter-scoped API/worker persistence, dashboard controls, and closeout.                                                                                                                                                                                                                                                                                                                    |
| [OP-T136_TRUST_ACCOUNTING_RECONCILIATION_DEPTH_PROOF_2026-06-01.md](OP-T136_TRUST_ACCOUNTING_RECONCILIATION_DEPTH_PROOF_2026-06-01.md)                             | Row-local proof note | Done proof for review-only statement match-rule profiles, accounting review profiles, protected-funds cues, metadata-only bank-feed shell posture, accounting dimension posture, dashboard/API/audit coverage, and closeout date-drift hardening.                                                                                                                                                                                                                                                                                                                               |
| [OP_CLIO_PARITY_AUDIT_PROOF_2026-06-01.md](OP_CLIO_PARITY_AUDIT_PROOF_2026-06-01.md)                                                                               | Audit proof note     | Compact clean-room Clio parity audit recording shipped parity areas, shell boundaries, and no remaining live Clio-informed parity rows after OP-T138 and OP-T139 closeout.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP_CLIO_PARITY_REVIEW_CLOSEOUT_PROOF_2026-06-01.md](OP_CLIO_PARITY_REVIEW_CLOSEOUT_PROOF_2026-06-01.md)                                                           | Maintenance proof    | Status-only closeout proof for OP-T136, OP-T138, and OP-T139 review-to-done reconciliation with clean-room boundary notes and no behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [OP_CLIO_BILLING_SALVAGE_PROOF_2026-06-01.md](OP_CLIO_BILLING_SALVAGE_PROOF_2026-06-01.md)                                                                         | Maintenance proof    | Proof for the narrow Clio billing residue salvage covering non-billable capture-review visibility, draft-only timer policy metadata, billing flag preservation, and future-relative client-portal fixtures.                                                                                                                                                                                                                                                                                                                                                                     |
| [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md)                                                   | Maintenance proof    | Exhaustive branch-based inventory for stubs, placeholders, TODO markers, worker skipped paths, dead-code/tooling evidence, route/API drift, web route catalog coverage, and intentional review-only boundaries, with no P0/P1 runtime blocker or confirmed production stub found.                                                                                                                                                                                                                                                                                               |
| [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-05-31.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-05-31.md)                                                   | Maintenance proof    | Fresh-branch proof for the incomplete-implementation audit covering worker startup safety, OCR storage readiness, upload capacity atomicity, route manifest drift, public UX copy, and docs.                                                                                                                                                                                                                                                                                                                                                                                    |
| [OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md](OP-T135_BILLING_PAYMENT_SHELL_PROOF_2026-05-31.md)                                                             | Row-local proof note | Done proof for hosted payment-request/link shell records, bill delivery/reminder state, payment-plan placeholders, credit/write-off posture, Stripe Checkout Session posture, manual payment evidence flags, and no automatic settlement or trust posting.                                                                                                                                                                                                                                                                                                                      |
| [OP_SECURITY_REMEDIATION_PROOF_2026-05-31.md](OP_SECURITY_REMEDIATION_PROOF_2026-05-31.md)                                                                         | Security proof note  | Done proof for upload verification, scoped audit/conflict exposure, passkey non-enumeration, connector SSRF guardrails, Docker loopback binding, and web security headers.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T132_COMMUNICATIONS_CHANNEL_HISTORY_CLIENT_UPDATES_PROOF_2026-05-30.md](OP-T132_COMMUNICATIONS_CHANNEL_HISTORY_CLIENT_UPDATES_PROOF_2026-05-30.md)             | Row-local proof note | Done proof for redacted communications channel history, phone/text placeholders, draft-only client-update requests, portal `client_update` rows, and out-of-scope send/composer boundaries.                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T134_TIME_EXPENSE_CAPTURE_PROOF_2026-05-31.md](OP-T134_TIME_EXPENSE_CAPTURE_PROOF_2026-05-31.md)                                                               | Row-local proof note | Done proof for the local timer-to-draft time-entry flow, review-only expense profile drafts, billing dashboard capture-review rows, lock checks, route manifest coverage, and stash scope.                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T130_CONTACT_RELATIONSHIP_GRAPH_CRM_TAXONOMY_PROOF_2026-05-29.md](OP-T130_CONTACT_RELATIONSHIP_GRAPH_CRM_TAXONOMY_PROOF_2026-05-29.md)                         | Row-local proof note | Done proof for the contact relationship graph and CRM taxonomy slice across domain, database, `GET /api/contacts/dossiers`, and the Contacts dashboard, with display-safe relationship output.                                                                                                                                                                                                                                                                                                                                                                                  |
| [OP-T141_UI_UX_SCREENSHOT_QA_PROOF_2026-05-30.md](OP-T141_UI_UX_SCREENSHOT_QA_PROOF_2026-05-30.md)                                                                 | Row-local proof note | Done proof for UI/UX screenshot QA, layout-health assertions, zero-matter mobile polish, public-token proof, and host/Docker browser validation.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [OP-T142_ADMIN_MIGRATION_PORTABILITY_PROOF_2026-05-30.md](OP-T142_ADMIN_MIGRATION_PORTABILITY_PROOF_2026-05-30.md)                                                 | Row-local proof note | Done proof for the read-only Admin Readiness dashboard surface covering support-access posture, migration/data-portability checklists, regional/privacy notes, and backup/restore evidence.                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T131_CALENDAR_SCHEDULING_REQUESTS_PROOF_2026-05-29.md](OP-T131_CALENDAR_SCHEDULING_REQUESTS_PROOF_2026-05-29.md)                                               | Row-local proof note | Done proof for persistent read-only calendar scheduling request records, safe Calendar matter-load summaries, dashboard presentation, matter-scoped redaction, and review-only boundaries.                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T133_DOCUMENT_ASSEMBLY_SIGNATURE_ENVELOPES_PROOF_2026-05-29.md](OP-T133_DOCUMENT_ASSEMBLY_SIGNATURE_ENVELOPES_PROOF_2026-05-29.md)                             | Row-local proof note | Done proof for the read-only document assembly and signature-envelope slice with OP-authored set/package metadata, field validation, safe workbench aggregation, and dashboard presentation.                                                                                                                                                                                                                                                                                                                                                                                    |
| [OP_BRANCH_CONSOLIDATION_PROOF_2026-05-29.md](OP_BRANCH_CONSOLIDATION_PROOF_2026-05-29.md)                                                                         | Merge proof note     | Local proof for merging OP-T128, OP-T129, OP-T137, and OP-T140 local branches into `main`, recording the superseded OP-T128 account branch, full local CI, and branch-prune readiness.                                                                                                                                                                                                                                                                                                                                                                                          |
| [DEPENDENCY_REFRESH_PROOF_2026-05-28.md](DEPENDENCY_REFRESH_PROOF_2026-05-28.md)                                                                                   | Maintenance proof    | Proof for the pnpm/package refresh, Docker base and service-image review, `docx` compatibility recovery, Mailpit refresh, full local CI, and local image build/Scout evidence.                                                                                                                                                                                                                                                                                                                                                                                                  |
| [OP-T128_CLIENT_PORTAL_WORKSPACE_PROOF_2026-05-28.md](OP-T128_CLIENT_PORTAL_WORKSPACE_PROOF_2026-05-28.md)                                                         | Row-local proof note | Done proof for the logged-in client portal account workspace, staff-controlled setup, redacted account posture, and client-visible action summaries over existing portal-adjacent records.                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T129_INTAKE_PIPELINE_SOURCE_REPORTING_PROOF_2026-05-28.md](OP-T129_INTAKE_PIPELINE_SOURCE_REPORTING_PROOF_2026-05-28.md)                                       | Row-local proof note | Done proof for the first staff-owned intake pipeline/source reporting slice across public consultation and intake-session records, with redacted source/request/appointment reporting.                                                                                                                                                                                                                                                                                                                                                                                          |
| [OP-T137_STAFF_REPORTING_WORKSPACE_PROOF_2026-05-28.md](OP-T137_STAFF_REPORTING_WORKSPACE_PROOF_2026-05-28.md)                                                     | Row-local proof note | Done proof for the staff reporting workspace, saved report definitions, manual export profiles, report-job reuse, bounded metadata, and first operational report projections.                                                                                                                                                                                                                                                                                                                                                                                                   |
| [OP_BRANCH_CONSOLIDATION_PROOF_2026-05-28.md](OP_BRANCH_CONSOLIDATION_PROOF_2026-05-28.md)                                                                         | Merge proof note     | Local proof for consolidating the dashboard usability, matter setup projection, and single-tenant auth lanes before fast-forwarding `main` and pruning redundant branches.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T140_INTEGRATION_DEVELOPER_BOUNDARY_PROOF_2026-05-28.md](OP-T140_INTEGRATION_DEVELOPER_BOUNDARY_PROOF_2026-05-28.md)                                           | Row-local proof note | Done proof for the integration developer boundary over connector registry/outbox records, scoped API credentials, webhook posture, regional/rate-limit cues, and redacted delivery history.                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T127_MATTER_SETUP_PROJECTION_PROOF_2026-05-27.md](OP-T127_MATTER_SETUP_PROJECTION_PROOF_2026-05-27.md)                                                         | Row-local proof note | Done proof for the read-only matter setup profile projection across domain, repository summaries, `GET /api/matters`, and the matter overview, with desktop/mobile browser proof.                                                                                                                                                                                                                                                                                                                                                                                               |
| [OP_SINGLE_TENANT_AUTH_PROOF_2026-05-27.md](OP_SINGLE_TENANT_AUTH_PROOF_2026-05-27.md)                                                                             | Merge proof note     | Focused proof for removing user-facing firm ID entry from login, passkey login/registration, recovery-code verification, and password setup while preserving internal firm partitioning.                                                                                                                                                                                                                                                                                                                                                                                        |
| [OP-T126_SUBMITTED_INTAKE_ACTION_DESCRIPTORS_PROOF_2026-05-27.md](OP-T126_SUBMITTED_INTAKE_ACTION_DESCRIPTORS_PROOF_2026-05-27.md)                                 | Row-local proof note | Done proof for extending shared operational action descriptors to submitted intake review controls without changing API, database, permission, route, dependency, or CSS boundaries.                                                                                                                                                                                                                                                                                                                                                                                            |
| [OP-T125_REVIEW_RAIL_ARIA_STABILITY_PROOF_2026-05-27.md](OP-T125_REVIEW_RAIL_ARIA_STABILITY_PROOF_2026-05-27.md)                                                   | Row-local proof note | Done proof for keeping review-rail controls pointed at a mounted accessibility target across collapsed and expanded dashboard states.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [OP-T124_PUBLIC_CONSULTATION_ACTION_DESCRIPTORS_PROOF_2026-05-27.md](OP-T124_PUBLIC_CONSULTATION_ACTION_DESCRIPTORS_PROOF_2026-05-27.md)                           | Row-local proof note | Done proof for extending shared operational action descriptors to public consultation Intake review controls without adding backend routes or exposing request details outside Intake.                                                                                                                                                                                                                                                                                                                                                                                          |
| [OP_DASHBOARD_REVIEW_RAIL_PROOF_2026-05-26.md](OP_DASHBOARD_REVIEW_RAIL_PROOF_2026-05-26.md)                                                                       | Follow-up proof note | Proof for branch-local dashboard review rail persistence, actionable operations focus cards, zero-matter/matter layout behavior, and accessible sidebar groups.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [OP_PUBLIC_CONSULTATION_TENANT_SAFE_DEFAULTS_PROOF_2026-05-27.md](OP_PUBLIC_CONSULTATION_TENANT_SAFE_DEFAULTS_PROOF_2026-05-27.md)                                 | Follow-up proof note | Proof for replacing tenant-specific public consultation sender, recipient, and origin defaults with disabled empty configuration and explicit firm-owned settings before enablement.                                                                                                                                                                                                                                                                                                                                                                                            |
| [OP_BRANCH_CONSOLIDATION_PROOF_2026-05-26.md](OP_BRANCH_CONSOLIDATION_PROOF_2026-05-26.md)                                                                         | Merge proof note     | Local proof for consolidating the OP-T119 through OP-T123 operational lanes and public consultation intake lane, including the follow-up OSS lock/index reconciliation.                                                                                                                                                                                                                                                                                                                                                                                                         |
| [OP-T123_OPERATIONAL_ACTION_STATE_DESCRIPTORS_PROOF_2026-05-26.md](OP-T123_OPERATIONAL_ACTION_STATE_DESCRIPTORS_PROOF_2026-05-26.md)                               | Row-local proof note | Done proof for the first shared operational action availability descriptor across connector recovery and document OCR queue actions, including the web-safe domain subpath.                                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T121_CALENDAR_REMINDER_DELIVERY_JOBS_PROOF_2026-05-26.md](OP-T121_CALENDAR_REMINDER_DELIVERY_JOBS_PROOF_2026-05-26.md)                                         | Row-local proof note | Done proof for the first opt-in calendar reminder delivery slice through the email outbox boundary, including delayed reminder jobs, confirmation gating, and dashboard-record preservation.                                                                                                                                                                                                                                                                                                                                                                                    |
| [OP-T122_CONVERSATION_INTERNAL_NOTIFICATIONS_PROOF_2026-05-26.md](OP-T122_CONVERSATION_INTERNAL_NOTIFICATIONS_PROOF_2026-05-26.md)                                 | Row-local proof note | Done proof for staff-only conversation message notifications, read/mute posture updates, inbox posture summaries, and notification-boundary audit metadata.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T119_PUBLIC_CONSULTATION_INTAKE_PROOF_2026-05-26.md](OP-T119_PUBLIC_CONSULTATION_INTAKE_PROOF_2026-05-26.md)                                                   | Row-local proof note | Done proof for the review-first public consultation intake route, settings, pending queue, dismissal/conversion actions, email notification redaction, and dashboard review controls.                                                                                                                                                                                                                                                                                                                                                                                           |
| [OP-T119_CONNECTOR_RECOVERY_CONTROLS_PROOF_2026-05-26.md](OP-T119_CONNECTOR_RECOVERY_CONTROLS_PROOF_2026-05-26.md)                                                 | Row-local proof note | Done proof for owner-only confirmed connector outbox retry and manual dead-letter controls, retry guards, dashboard actions, and redacted audit metadata.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [OP-T119_CONVERSATION_EXPORT_ARTIFACT_PROOF_2026-05-26.md](OP-T119_CONVERSATION_EXPORT_ARTIFACT_PROOF_2026-05-26.md)                                               | Row-local proof note | Done proof for the staff-only redacted conversation export artifact, reports job lifecycle, same-thread gates, revoked-access blocking, and body/metadata-value redaction.                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T120_DOCUMENT_RETENTION_REVIEW_HINTS_PROOF_2026-05-25.md](OP-T120_DOCUMENT_RETENTION_REVIEW_HINTS_PROOF_2026-05-25.md)                                         | Row-local proof note | Done proof for read-only document retention-review hints based on legal hold, supersession, upload/checksum/scan state, and external-upload review state.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [OP-T118_TRUST_STATEMENT_IMPORT_BATCHES_PROOF_2026-05-22.md](OP-T118_TRUST_STATEMENT_IMPORT_BATCHES_PROOF_2026-05-22.md)                                           | Row-local proof note | Done proof for metadata-only persistent trust statement import batches with safe audit metadata and no ledger posting, reconciliation creation, statement rows, or evidence storage.                                                                                                                                                                                                                                                                                                                                                                                            |
| [OP-T117_PORTAL_ACCESS_ACTIVITY_ANOMALY_PANEL_PROOF_2026-05-22.md](OP-T117_PORTAL_ACCESS_ACTIVITY_ANOMALY_PANEL_PROOF_2026-05-22.md)                               | Row-local proof note | Done proof for the read-only Operations focus portal access activity/anomaly panel across secure shares, external uploads, intake links, and guest sessions.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md](OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md)                                     | Row-local proof note | Done proof for the zero-matter dashboard shell, guided first-matter creation API/UI, firm-wide owner/auditor matter listing, and matter-section disabling.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T115_DOCUMENT_INGEST_METADATA_SEARCH_PROOF_2026-05-22.md](OP-T115_DOCUMENT_INGEST_METADATA_SEARCH_PROOF_2026-05-22.md)                                         | Row-local proof note | Done proof for review-only document metadata filters, computed tag cues, OCR search posture, and redacted matter-scoped result summaries.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [OP-T114_OCR_ROLLOUT_PERMISSION_AVAILABILITY_PROOF_2026-05-22.md](OP-T114_OCR_ROLLOUT_PERMISSION_AVAILABILITY_PROOF_2026-05-22.md)                                 | Row-local proof note | Done proof for permission-aware dashboard availability copy, owner/admin local OCR provider posture, OCR queue/promotion gating, and synthetic API/browser smoke.                                                                                                                                                                                                                                                                                                                                                                                                               |
| [OP-T113_GUEST_SESSION_ADMITTED_HANDOFF_PROOF_2026-05-22.md](OP-T113_GUEST_SESSION_ADMITTED_HANDOFF_PROOF_2026-05-22.md)                                           | Row-local proof note | Done proof for the status-only admitted guest-session handoff marker that keeps public pages out of meeting URL, media, signaling, chat, recording, and upload delivery.                                                                                                                                                                                                                                                                                                                                                                                                        |
| [OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md](OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md)                                                     | Row-local proof note | Done proof for contact data-quality decisions, async billing/trust exports, billing locks/rate rules, delivery receipt tokens, and saved matter view presets.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [OP-T107_RECONCILIATION_EXCEPTION_RESOLUTIONS_PROOF_2026-05-19.md](OP-T107_RECONCILIATION_EXCEPTION_RESOLUTIONS_PROOF_2026-05-19.md)                               | Row-local proof note | Done proof for review-only reconciliation exception resolution records with staff notes, variance decisions, safe audit metadata, and no ledger posting or reconciliation creation.                                                                                                                                                                                                                                                                                                                                                                                             |
| [DEPENDENCY_REFRESH_PROOF_2026-05-19.md](DEPENDENCY_REFRESH_PROOF_2026-05-19.md)                                                                                   | Maintenance proof    | Proof for the pnpm 11/package refresh, Docker base-image review, sibling-worktree reference-governance fix, local CI, and skipped Docker Engine runtime checks.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [OP-T106_TRUST_TRANSFER_REVIEW_LINK_PROOF_2026-05-19.md](OP-T106_TRUST_TRANSFER_REVIEW_LINK_PROOF_2026-05-19.md)                                                   | Row-local proof note | Done proof for explicit trust-transfer approve/reject/link routes, balance checks, existing-ledger linkage, safe audit metadata, and no automatic trust ledger posting.                                                                                                                                                                                                                                                                                                                                                                                                         |
| [OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md](OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md)                                             | Row-local proof note | Done proof for persistent hosted meeting-session records, token-hashed guest access, staff lobby controls, and public status-only guest check-in.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [OP_BRANCH_CONSOLIDATION_PROOF_2026-05-18.md](OP_BRANCH_CONSOLIDATION_PROOF_2026-05-18.md)                                                                         | Merge proof note     | Local proof for consolidating OP-T98 through OP-T105 hardening worktrees, dependency checks, full `ci:local`, and branch-prune readiness.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [OP-T105_ASYNC_AI_ASSIST_JOBS_PROOF_2026-05-18.md](OP-T105_ASYNC_AI_ASSIST_JOBS_PROOF_2026-05-18.md)                                                               | Row-local proof note | Done proof for disabled-by-default async draft/document assist jobs, redacted `ai_triage` lifecycle metadata, worker-created suggested assist records, and local CI.                                                                                                                                                                                                                                                                                                                                                                                                            |
| [OP-T104_TRUST_STATEMENT_IMPORT_PREVIEW_PROOF_2026-05-18.md](OP-T104_TRUST_STATEMENT_IMPORT_PREVIEW_PROOF_2026-05-18.md)                                           | Row-local proof note | Done proof for the review-only trust statement import preview with statement-row dedupe, proposed existing-ledger matches, no ledger posting, and no reconciliation creation.                                                                                                                                                                                                                                                                                                                                                                                                   |
| [OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md](OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md)                                 | Row-local proof note | Done proof for communications triage private-note counters, consent/channel follow-up state, matter-scoped validation, and audit redaction.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [OP-T98_TO_T101_HARDENING_WAVE_PROOF_2026-05-18.md](OP-T98_TO_T101_HARDENING_WAVE_PROOF_2026-05-18.md)                                                             | Row-local proof note | Done proof for migration integrity, connector scheduling, route authorization manifest, and reference governance hardening, including successful disposable migration replay.                                                                                                                                                                                                                                                                                                                                                                                                   |
| [OP-T97_CLOSEOUT_SMOKE_2026-05-18.md](OP-T97_CLOSEOUT_SMOKE_2026-05-18.md)                                                                                         | Row-local proof note | Closeout smoke for the merged OP-T97 audit projection, conversation message record, and matters saved operational view preset rows.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [OP-T97_AUDIT_PROJECTION_DASHBOARD_SUMMARIES_PROOF_2026-05-17.md](OP-T97_AUDIT_PROJECTION_DASHBOARD_SUMMARIES_PROOF_2026-05-17.md)                                 | Row-local proof note | Review-ready proof for read-only audit taxonomy dashboard summaries covering unknown actions, matter-scope gaps, and resource-type mismatches.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md](OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md)                                           | Row-local proof note | Review-ready proof for matter-scoped conversation message records, safe thread message APIs, redacted audit metadata, and communications inbox message summaries.                                                                                                                                                                                                                                                                                                                                                                                                               |
| [OP-T97_MATTERS_OPERATIONAL_VIEW_PRESETS_PROOF_2026-05-17.md](OP-T97_MATTERS_OPERATIONAL_VIEW_PRESETS_PROOF_2026-05-17.md)                                         | Row-local proof note | Review-ready proof for owner-private `matters` saved operational view definitions and the matter follow-up dashboard preset family.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md](OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md)                                           | Row-local proof note | Done proof for audit metadata redaction, overview scoping, inbound status filtering, job visibility pagination, connector payload minimization, and public-token network recovery copy.                                                                                                                                                                                                                                                                                                                                                                                         |
| [OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md](OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md)                                                                     | Row-local proof note | Done proof for the local release artifact, command status capture, license evidence, CycloneDX SBOM handoff, and partial-proof failure behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [OP-T94_ROUTE_BOUNDARY_RATCHETS_PROOF_2026-05-16.md](OP-T94_ROUTE_BOUNDARY_RATCHETS_PROOF_2026-05-16.md)                                                           | Row-local proof note | Done proof for route registrar ownership checks and route-family test coverage ratchets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md](OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md)                                                     | Row-local proof note | Done proof for connector masked-secret reads, unchanged-secret writes, and repository-level retry/export metadata redaction.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md](OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md)                                                 | Row-local proof note | Done proof for non-persistent structured intake builder diagnostics and missing-question render hardening.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [OP-T91_DASHBOARD_FRESHNESS_PROOF_2026-05-16.md](OP-T91_DASHBOARD_FRESHNESS_PROOF_2026-05-16.md)                                                                   | Row-local proof note | Done proof for dashboard lane freshness, stale, refresh, and error-state controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [OP-T90_ASYNC_AUDIT_EXPORT_REQUESTS_PROOF_2026-05-15.md](OP-T90_ASYNC_AUDIT_EXPORT_REQUESTS_PROOF_2026-05-15.md)                                                   | Row-local proof note | Done proof for queued audit export requests, reports queue wiring, redacted download semantics, bounded job pagination, and selector/allowlist ratchets.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md](OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md)                                   | Row-local proof note | Review-ready proof for the validation index, candidate-row harvest, token `Needs attention` summary, unsupported intake schema lockout, and selector runtime-config coverage.                                                                                                                                                                                                                                                                                                                                                                                                   |

## Proof Discipline

- Keep validation notes synthetic and operational; do not include client, matter, credential,
  payment, private deployment, or privileged document details.
- Prefer row-local notes for multi-command proof, browser evidence, skipped checks, or environmental
  blockers.
- Keep the workboard concise: summarize the latest proof there and link to the row-local note when
  details matter.
- Treat nonprofit-manager as an internal pattern reference only. Do not copy source, proof text, or
  runtime scripts into Open Practice without the reuse review required by
  [License Policy](../license-policy.md).

## Related Docs

- [Testing](../testing/TESTING.md)
- [Planning and Progress](../planning-and-progress.md)
- [Documentation Archive](../archive/README.md)
- [License Policy](../license-policy.md)
