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
- No live Clio-informed parity rows remain in `docs/planning-and-progress.md`.
- Future parity work requires a fresh clean-room gap audit against the shipped proof set before new
  candidate rows are created.

## Shipped Parity Areas

- Matter setup, stage/setup projections, and single-tenant auth entry flows.
- Client portal account workspace, intake/source reporting, contact relationship graph, calendar
  scheduling requests, communications history, document assembly/signature envelope model, time and
  expense capture, billing/payment shell, reporting workspace, integration developer boundary,
  mobile/UX readiness, and admin/data-portability readiness.
- Trust foundations: ledger posting guards, transfer review/link flow, statement preview,
  statement import batch metadata, reconciliation exception review notes, jurisdictional aggregate
  reporting, and OP-T136 accounting review profiles.
- AI and legal-work foundations: review-first draft/document assist, async assist jobs, OP-T138
  operational proposal records for deadlines, tasks, document organization, draft invoice cues, and
  client-update drafts, plus OP-T139 staff-only legal research workspace artifacts for cited-source
  notes, matter-context attachments, document-analysis status, strategy/timeline notes, and review
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
- OP-T139 is a staff-only legal research workspace shell. It stores bounded staff-authored notes
  only on authorized review artifacts and keeps audit metadata limited to IDs, kind/status values,
  counts, title/note lengths, source types, creator/reviewer IDs, and review-only posture; it does
  not add live research providers, queues, scraped authority storage, citation-verification claims,
  public/client research surfaces, legal-advice automation, or downstream source-record mutation.

## Remaining Gaps

- No remaining live OP-T127 through OP-T142 Clio-informed parity rows.
- Future post-parity candidates should be created only after comparing against existing proof so
  shipped shell boundaries are not reimplemented under new names.

## Post-Parity Guidance

Run a fresh clean-room gap audit before creating new parity candidates. New rows must preserve the
same boundaries used here: synthetic data only, no copied Clio structure or assets, no live provider
claims without provider proof, no prompts/source text/generated legal content in job or audit
metadata, and no automatic legal, billing, trust, or communications mutations without a separately
approved review gate.

## Validation

Validation is recorded in the OP-T136, OP-T138, and OP-T139 row-local proof notes for their
implementation branches and stacked closeout reruns.
