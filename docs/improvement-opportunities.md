# Development Backlog

This document captures candidate opportunities for Open Practice. Use `docs/planning.md` for the
durable roadmap, `docs/planning-and-progress.md` for live workboard tasks, and `docs/archive/` for
completed proof. Items here are not active commitments until promoted to the live workboard.

Keep this file candidate-only: if a slice is already shipped, the archive owns the evidence and the
row should not stay here as future work.

## Candidate Backlog

These candidates name the next smallest useful unimplemented slice. Each row also states the shipped
surface it must not duplicate.

- **Async Billing And Trust Export Requests**: Move large billing or trust exports behind capped
  direct responses and async job status when report size exceeds safe synchronous limits. Do not
  duplicate shipped audit export requests, and keep export bodies out of job metadata.
- **Billing Period Locks And Rate Rules**: Add matter/user rate presets and billing-period locks
  that preserve rate snapshots and prevent edits to submitted or approved ranges. Do not rewrite
  existing invoice lifecycle or trust-transfer behavior.
- **Delivery Receipt Tokens**: Add purpose-scoped public delivery receipt links for selected
  outbound emails without exposing sessions, recipient lists, or message bodies.
- **Saved Operational View Additional Presets**: Add more user-owned saved-view preset families
  beyond the shipped queue-dashboard and first `matters` family, such as overdue filings,
  uncontacted intake clients, and expiring upload links. Do not duplicate the shipped built-in
  operational views, queue-surface CRUD, or `matters` stale/open-client follow-up presets.

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes
  `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat AGPL/GPL/LGPL/EPL/source-available, mixed-license, and
  unclear-license projects as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented
  APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific
  legal review is complete.
