# Threat Model

## Assets

- Client and matter information.
- Privileged and work-product documents.
- Portal messages and document exchanges.
- Signature evidence and signed records.
- Trust/funds ledger entries and reconciliation records.
- Audit logs and permission changes.

## Primary Risks

- Cross-matter or cross-firm data leakage.
- Overbroad portal grants exposing privileged documents.
- Tampered audit logs or trust ledger records.
- Uploaded malware or unsafe document previews.
- Unauthorized trust withdrawals or duplicate payment events.
- Misleading e-sign evidence or missing consent records.

## Controls

- Matter-scoped RBAC checked server-side.
- Explicit portal grants with expiry and revocation.
- Signed URLs with short expiry and scan-gated sharing.
- Hash-chained domain audit events.
- Balanced double-entry ledger posting and idempotency keys.
- Provider-agnostic e-sign evidence stored in core records.
