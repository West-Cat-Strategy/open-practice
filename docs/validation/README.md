# Validation Proof Index

Use this index for active validation notes, row-local proof, and skipped-check context. The live
workboard remains [Planning and Progress](../planning-and-progress.md); completed historical proof
lives in [Archive](../archive/README.md).

## Start Here

1. Open [Planning and Progress](../planning-and-progress.md) first for current ownership, status,
   and the next move.
2. Use [Testing](../testing/TESTING.md) and `pnpm verify:select -- --files <changed paths...>` to
   choose validation before running checks.
3. Record skipped checks with the reason, especially when a browser, Docker, database, or provider
   dependency is unavailable.
4. Move closed historical proof to [Archive](../archive/README.md) instead of keeping this index as
   a second workboard.

## Active Proof Notes

| Artifact                                                                                                                             | Type                 | Use                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md](OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md)       | Row-local proof note | Done proof for the zero-matter dashboard shell, guided first-matter creation API/UI, firm-wide owner/auditor matter listing, and matter-section disabling.                              |
| [OP-T115_DOCUMENT_INGEST_METADATA_SEARCH_PROOF_2026-05-22.md](OP-T115_DOCUMENT_INGEST_METADATA_SEARCH_PROOF_2026-05-22.md)           | Row-local proof note | Done proof for review-only document metadata filters, computed tag cues, OCR search posture, and redacted matter-scoped result summaries.                                               |
| [OP-T114_OCR_ROLLOUT_PERMISSION_AVAILABILITY_PROOF_2026-05-22.md](OP-T114_OCR_ROLLOUT_PERMISSION_AVAILABILITY_PROOF_2026-05-22.md)   | Row-local proof note | Done proof for permission-aware dashboard availability copy, owner/admin local OCR provider posture, OCR queue/promotion gating, and synthetic API/browser smoke.                       |
| [OP-T113_GUEST_SESSION_ADMITTED_HANDOFF_PROOF_2026-05-22.md](OP-T113_GUEST_SESSION_ADMITTED_HANDOFF_PROOF_2026-05-22.md)             | Row-local proof note | Done proof for the status-only admitted guest-session handoff marker that keeps public pages out of meeting URL, media, signaling, chat, recording, and upload delivery.                |
| [OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md](OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md)                       | Row-local proof note | Done proof for contact data-quality decisions, async billing/trust exports, billing locks/rate rules, delivery receipt tokens, and saved matter view presets.                           |
| [OP-T107_RECONCILIATION_EXCEPTION_RESOLUTIONS_PROOF_2026-05-19.md](OP-T107_RECONCILIATION_EXCEPTION_RESOLUTIONS_PROOF_2026-05-19.md) | Row-local proof note | Done proof for review-only reconciliation exception resolution records with staff notes, variance decisions, safe audit metadata, and no ledger posting or reconciliation creation.     |
| [DEPENDENCY_REFRESH_PROOF_2026-05-19.md](DEPENDENCY_REFRESH_PROOF_2026-05-19.md)                                                     | Maintenance proof    | Proof for the pnpm 11/package refresh, Docker base-image review, sibling-worktree reference-governance fix, local CI, and skipped Docker Engine runtime checks.                         |
| [OP-T106_TRUST_TRANSFER_REVIEW_LINK_PROOF_2026-05-19.md](OP-T106_TRUST_TRANSFER_REVIEW_LINK_PROOF_2026-05-19.md)                     | Row-local proof note | Done proof for explicit trust-transfer approve/reject/link routes, balance checks, existing-ledger linkage, safe audit metadata, and no automatic trust ledger posting.                 |
| [OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md](OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md)               | Row-local proof note | Review proof for persistent hosted meeting-session records, token-hashed guest access, staff lobby controls, and public status-only guest check-in.                                     |
| [OP_BRANCH_CONSOLIDATION_PROOF_2026-05-18.md](OP_BRANCH_CONSOLIDATION_PROOF_2026-05-18.md)                                           | Merge proof note     | Local proof for consolidating OP-T98 through OP-T105 hardening worktrees, dependency checks, full `ci:local`, and branch-prune readiness.                                               |
| [OP-T105_ASYNC_AI_ASSIST_JOBS_PROOF_2026-05-18.md](OP-T105_ASYNC_AI_ASSIST_JOBS_PROOF_2026-05-18.md)                                 | Row-local proof note | Done proof for disabled-by-default async draft/document assist jobs, redacted `ai_triage` lifecycle metadata, worker-created suggested assist records, and local CI.                    |
| [OP-T104_TRUST_STATEMENT_IMPORT_PREVIEW_PROOF_2026-05-18.md](OP-T104_TRUST_STATEMENT_IMPORT_PREVIEW_PROOF_2026-05-18.md)             | Row-local proof note | Done proof for the review-only trust statement import preview with statement-row dedupe, proposed existing-ledger matches, no ledger posting, and no reconciliation creation.           |
| [OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md](OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md)   | Row-local proof note | Done proof for communications triage private-note counters, consent/channel follow-up state, matter-scoped validation, and audit redaction.                                             |
| [OP-T98_TO_T101_HARDENING_WAVE_PROOF_2026-05-18.md](OP-T98_TO_T101_HARDENING_WAVE_PROOF_2026-05-18.md)                               | Row-local proof note | Done proof for migration integrity, connector scheduling, route authorization manifest, and reference governance hardening, including successful disposable migration replay.           |
| [OP-T97_CLOSEOUT_SMOKE_2026-05-18.md](OP-T97_CLOSEOUT_SMOKE_2026-05-18.md)                                                           | Row-local proof note | Closeout smoke for the merged OP-T97 audit projection, conversation message record, and matters saved operational view preset rows.                                                     |
| [OP-T97_AUDIT_PROJECTION_DASHBOARD_SUMMARIES_PROOF_2026-05-17.md](OP-T97_AUDIT_PROJECTION_DASHBOARD_SUMMARIES_PROOF_2026-05-17.md)   | Row-local proof note | Review-ready proof for read-only audit taxonomy dashboard summaries covering unknown actions, matter-scope gaps, and resource-type mismatches.                                          |
| [OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md](OP-T97_CONVERSATION_MESSAGE_RECORDS_V1_PROOF_2026-05-17.md)             | Row-local proof note | Review-ready proof for matter-scoped conversation message records, safe thread message APIs, redacted audit metadata, and communications inbox message summaries.                       |
| [OP-T97_MATTERS_OPERATIONAL_VIEW_PRESETS_PROOF_2026-05-17.md](OP-T97_MATTERS_OPERATIONAL_VIEW_PRESETS_PROOF_2026-05-17.md)           | Row-local proof note | Review-ready proof for owner-private `matters` saved operational view definitions and the matter follow-up dashboard preset family.                                                     |
| [OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md](OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md)             | Row-local proof note | Done proof for audit metadata redaction, overview scoping, inbound status filtering, job visibility pagination, connector payload minimization, and public-token network recovery copy. |
| [OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md](OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md)                                       | Row-local proof note | Done proof for the local release artifact, command status capture, license evidence, CycloneDX SBOM handoff, and partial-proof failure behavior.                                        |
| [OP-T94_ROUTE_BOUNDARY_RATCHETS_PROOF_2026-05-16.md](OP-T94_ROUTE_BOUNDARY_RATCHETS_PROOF_2026-05-16.md)                             | Row-local proof note | Done proof for route registrar ownership checks and route-family test coverage ratchets.                                                                                                |
| [OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md](OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md)                       | Row-local proof note | Done proof for connector masked-secret reads, unchanged-secret writes, and repository-level retry/export metadata redaction.                                                            |
| [OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md](OP-T92_INTAKE_AUTHORING_DIAGNOSTICS_PROOF_2026-05-16.md)                   | Row-local proof note | Done proof for non-persistent structured intake builder diagnostics and missing-question render hardening.                                                                              |
| [OP-T91_DASHBOARD_FRESHNESS_PROOF_2026-05-16.md](OP-T91_DASHBOARD_FRESHNESS_PROOF_2026-05-16.md)                                     | Row-local proof note | Done proof for dashboard lane freshness, stale, refresh, and error-state controls.                                                                                                      |
| [OP-T90_ASYNC_AUDIT_EXPORT_REQUESTS_PROOF_2026-05-15.md](OP-T90_ASYNC_AUDIT_EXPORT_REQUESTS_PROOF_2026-05-15.md)                     | Row-local proof note | Done proof for queued audit export requests, reports queue wiring, redacted download semantics, bounded job pagination, and selector/allowlist ratchets.                                |
| [OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md](OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md)     | Row-local proof note | Review-ready proof for the validation index, candidate-row harvest, token `Needs attention` summary, unsupported intake schema lockout, and selector runtime-config coverage.           |

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
