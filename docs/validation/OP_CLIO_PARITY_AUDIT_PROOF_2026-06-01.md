# Clio Parity Audit Proof

Date: 2026-06-01 PDT

## Scope

This compact audit reconciles the current Open Practice parity board against the clean-room Clio
review. Official Clio public pages checked for planning anchors:
[features](https://www.clio.com/features/),
[matters](https://help.clio.com/hc/en-150/articles/9285920226075-Clio-Manage-Matters-Overview),
[billing](https://www.clio.com/features/legal-billing/),
[trust accounting](https://www.clio.com/features/legal-trust-accounting/),
[client portal](https://www.clio.com/features/client-portal/), and
[Manage AI](https://www.clio.com/features/legal-ai-software/).

The references were used only for feature-category planning. No Clio prose, schemas, examples,
screenshots, UI structure, assets, private tenant data, or code were copied into Open Practice.

## Current Parity State

- OP-T127 through OP-T137 and OP-T140 through OP-T142 are Done.
- OP-T138 is in Review with the first review-only AI operational proposal slice.
- OP-T139 remains Candidate.

## Shipped Parity Areas

- Matter setup, stage/setup projections, and single-tenant auth entry flows.
- Client portal account workspace, intake/source reporting, contact relationship graph, calendar
  scheduling requests, communications history, document assembly/signature envelope model, time and
  expense capture, billing/payment shell, reporting workspace, integration developer boundary,
  mobile/UX readiness, and admin/data-portability readiness.
- Trust foundations: ledger posting guards, transfer review/link flow, statement preview,
  statement import batch metadata, reconciliation exception review notes, jurisdictional aggregate
  reporting, and OP-T136 accounting review profiles.
- AI assist foundations: review-first draft/document assist, async assist jobs, and OP-T138
  operational proposal records for deadlines, tasks, document organization, draft invoice cues, and
  client-update drafts.

## Deliberate Shell Boundaries

- OP-T135 is a billing/payment shell. It does not claim full payment processing, card vaulting,
  tap-to-pay, settlement, refunds, chargebacks, public payment-page UX, payment-plan enforcement,
  automatic reconciliation, or trust posting.
- OP-T136 is review-only accounting depth. It persists statement match-rule profiles and accounting
  review profiles, but it does not connect live bank feeds, auto-match transactions, automate
  disbursement, post trust entries, or certify accounting/compliance conclusions.
- OP-T138 is a review-only AI proposal shell. It stores generated proposal content only as the
  authorized review artifact and keeps jobs/audit metadata limited to IDs, counts, kinds, provider
  provenance, and lengths; approval records status only and does not create downstream records.
- OP-T139 remains a human-reviewed planning candidate, not autonomous legal advice or
  privileged-content automation.

## Remaining Gaps

- OP-T139: legal research workspace shell for cited-source notes, matter-context attachment,
  analysis artifact status, strategy/timeline notes, and review checkpoints.
- Future post-parity candidates should be created only after comparing against existing proof so
  shipped shell boundaries are not reimplemented under new names.

## Next-Row Ranking

1. OP-T138 Review: confirm proposal persistence, matter-scoped route authorization, dashboard
   posture, redacted job/audit metadata, provider-disabled behavior, and migration proof.
2. OP-T139 Candidate: next legal-work shell after OP-T138, with strict no-provider/no-advice
   boundaries.

## Validation

Validation is recorded in the OP-T136 and OP-T138 row-local proof notes for their implementation
branches.
