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

- OP-T127 through OP-T142 are Done.
- OP-T136 is closed as the first trust/accounting reconciliation-depth slice.
- OP-T138 is closed as the first review-only AI operational proposal slice.
- OP-T139 is closed as the first staff-only legal research workspace shell.

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
- Legal-work review shell: OP-T139 legal research artifact records for cited-source notes,
  matter-context attachment, document-analysis artifact status, strategy/timeline notes, and review
  checkpoints.

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
- OP-T139 is a staff-authored, review-only research workspace shell. It does not connect live
  research providers, store scraped authority text, verify citations, automate legal advice, expose
  client-facing research surfaces, or mutate downstream task/document/draft/message/calendar records.

## Remaining Gaps

- No live Clio-informed candidate row remains open after OP-T136, OP-T138, and OP-T139 closeout.
- Future post-parity candidates should come from a fresh clean-room gap audit and should compare
  against existing proof so shipped shell boundaries are not reimplemented under new names.

## Next-Row Ranking

1. Fresh candidate audit: compare the current shipped OP-T127 through OP-T142 proof set against
   remaining clean-room legal-practice workflow gaps.
2. Candidate promotion: open only one narrow row with explicit shell boundaries, validation scope,
   and no copied proprietary material.
3. Review discipline: keep OP-T135/OP-T136/OP-T138/OP-T139 shell limits intact unless a future row
   explicitly designs and validates deeper provider, automation, or compliance behavior.

## Validation

Validation is recorded in the OP-T136, OP-T138, and OP-T139 row-local proof notes. Status-only
closeout and local main merge readiness are recorded in
[OP Clio parity review closeout proof](OP_CLIO_PARITY_REVIEW_CLOSEOUT_PROOF_2026-06-01.md).
