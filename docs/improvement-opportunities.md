# Development Backlog

This document captures candidate opportunities for Open Practice. Use `docs/planning.md` for the
durable roadmap, `docs/planning-and-progress.md` for live workboard tasks, and `docs/archive/` for
completed proof. Items here are not active commitments until promoted to the live workboard.

Keep this file candidate-only: if a slice is already shipped, the archive owns the evidence and the
row should not stay here as future work.

## Candidate Backlog

These candidates name the next smallest useful unimplemented slice. Each row also states the shipped
surface it must not duplicate.

- **Native WebRTC Guest Session Controls**: Add Open Practice-hosted meeting-session records,
  tokenized guest access, lobby/host controls, room-state audit metadata, and retention boundaries.
  Do not duplicate the shipped ability to store blank, external, or configured hosted meeting links
  on calendar events.
- **Async Local AI Assist Jobs**: Move selected matter/document summary and drafting-assist requests
  behind disabled-by-default queue jobs with reviewed outputs and job status. Do not duplicate the
  shipped synchronous draft/document assist routes or make generated text authoritative.
- **Connector/Webhook Delivery Worker V1**: Lease existing connector outbox rows, sign allowlisted
  HTTPS payloads, attempt delivery, and record redacted delivery/dead-letter outcomes. Do not
  duplicate shipped connector registry/outbox records, preview-only outbound webhook guardrails, or
  the live OP-T88 read-only delivery-attempt visibility row.
- **Conversation Message Records V1**: Add matter-scoped message records under existing
  conversation topics, with author metadata, retention/export boundaries, and safe read APIs. Do not
  duplicate shipped topic create/list/read or lifecycle state changes, and leave realtime delivery
  and notifications out of scope.
- **Communications Triage Ownership And Private Notes**: Add assignment/ownership, private staff
  notes, and consent/channel follow-up state to the communications inbox. Do not duplicate the
  shipped redacted inbox aggregate or constrained inbound-email status/label triage.
- **Contact Data-Quality Resolution Decisions**: Add reviewer decision records for duplicate
  candidates, protected-party handling, and conflict-check revalidation prompts. Keep the first slice
  non-destructive: no automatic merge, contact rewrite, or conflict-disposition mutation. Do not
  duplicate shipped contact dossier signals or the read-only review queue.
- **Audit Projection Dashboard Summaries**: Add read-only operator summaries over the existing
  hash-chained audit taxonomy, including unknown actions, matter-scope gaps, and resource-type
  mismatches. Do not change stored audit events.
- **Async Report Export Requests**: Move large audit, billing, or trust exports behind capped direct
  responses and async job status when report size exceeds safe synchronous limits. Keep export bodies
  out of job metadata.
- **Trust Statement Import Preview**: Add a non-posting bank-statement import preview that dedupes
  rows, proposes matches to existing trust ledger entries, and requires staff review before creating
  reconciliation records. Do not auto-post ledger entries or certify accounting conclusions.
- **Trust Transfer Review And Link Flow**: Add explicit approve, reject, and link actions for
  billing trust-transfer requests with invoice-balance, trust-balance, and ledger-evidence checks.
  Do not automatically post trust ledger transactions from approval.
- **Billing Period Locks And Rate Rules**: Add matter/user rate presets and billing-period locks
  that preserve rate snapshots and prevent edits to submitted or approved ranges. Do not rewrite
  existing invoice lifecycle or trust-transfer behavior.
- **Reconciliation Exception Resolution Records**: Add staff resolution notes and variance
  decisions for unmatched statement rows without mutating posted ledger entries or creating
  accounting-certification language.
- **Delivery Receipt Tokens**: Add purpose-scoped public delivery receipt links for selected
  outbound emails without exposing sessions, recipient lists, or message bodies.
- **Saved Operational View Surface Expansion**: Expand user-owned saved view definitions beyond the
  current queue-dashboard surface into additional matter dashboard presets, such as overdue filings,
  uncontacted intake clients, and expiring upload links. Do not duplicate the shipped built-in
  operational views or queue-surface CRUD.

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes
  `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat AGPL/GPL/LGPL/EPL/source-available, mixed-license, and
  unclear-license projects as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented
  APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific
  legal review is complete.
