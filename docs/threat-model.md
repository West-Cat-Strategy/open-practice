# Threat Model

## Assets

- Client and matter information.
- Privileged and work-product documents.
- Derived document text, conversion summaries, annotation posture, and extraction metadata.
- Portal messages and document exchanges.
- Signature evidence and signed records.
- Intake answers, generated-document metadata, and automation-session evidence.
- Trust/funds ledger entries and reconciliation records.
- Audit logs and permission changes.

## Primary Risks

- Cross-matter or cross-firm data leakage.
- Overbroad portal grants exposing privileged documents.
- Tampered audit logs or trust ledger records.
- Uploaded malware or unsafe document previews.
- Derived-document leakage through raw client text, raw OCR text, converted Markdown, annotation
  bodies/spans, sensitive chunks, embeddings, semantic-review outputs, provider payloads, prompts,
  object-storage keys, object bodies, free-form generated summaries, or private excerpts in job
  metadata, audit metadata, API posture, artifacts, or validation proof.
- Forged upload-completion claims, checksum mismatches, or scan-state bypasses.
- Spoofed, duplicated, or out-of-order embedded signature/provider events.
- Overexposed intake answers or generated documents.
- Unauthorized trust withdrawals or duplicate payment events.
- Misleading e-sign evidence or missing consent records.

## Controls

- Matter-scoped RBAC checked server-side.
- Explicit portal grants with expiry and revocation.
- Signed URLs with short expiry and scan-gated sharing.
- Upload-complete records that preserve checksum and scan status before share decisions.
- Local-only document-processing boundaries that retain only OP-authored redacted summaries,
  counts, length bands, statuses, policy flags, provider kind/status, idempotency-key presence,
  reviewer state, and posture metadata until a separately reviewed provider-backed conversion,
  annotation, chunking, embedding, or semantic-review slice proves the same no-raw-text/
  no-provider-payload posture.
- Hash-chained domain audit events.
- Balanced double-entry ledger posting and idempotency keys.
- Provider-agnostic e-sign evidence stored in core records.
- Provider events and webhook attempts stored in core records for reconciliation and review.
