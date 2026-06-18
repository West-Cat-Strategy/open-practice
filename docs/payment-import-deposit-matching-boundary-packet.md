# Payment Import And Deposit Matching Boundary Packet

Date: 2026-06-17 PDT

This packet defines the next safe boundary for future payment processor imports, deposit matching,
refunds, and chargebacks. It is docs-first policy groundwork only: it does not add live settlement,
payment processor webhooks, provider payload persistence, invoice mutation, trust posting, bank-feed
connections, worker replay, UI commands, migrations, dependencies, or runtime behavior.

## Source Posture

The boundary builds from the shipped payment and funds proofs:

- Manual payments start as `pending_reconciliation` evidence. They affect invoice paid/balance
  status only after explicit staff reviewer evidence creates the effective allocation.
- Hosted payment requests are shell records. Optional Stripe Checkout Sessions can record safe
  provider/session posture in non-production, but success redirects are not settlement evidence.
- Settlement event review stores normalized staff-side evidence on an existing hosted payment
  request. It does not ingest public webhooks, retain raw provider payloads, reconcile deposits,
  apply refunds or chargebacks, mutate invoice balances, or post trust ledger entries.
- Trust posting approval commands are separate maker-checker controls for selected ledger postings.
  They are not payment settlement, deposit clearing, trust-transfer automation, or certified trust
  accounting.

## Safe Import Boundary

Future processor imports may create reviewer-visible import evidence only when all of these limits
hold:

- The import is initiated by authenticated staff or a separately approved deployment profile; no
  public provider webhook, replay worker, or background settlement engine is part of this packet.
- Persisted data is limited to normalized review fields: provider label, event family/status,
  safe external identifiers, amount/currency, observed timestamp, related hosted payment-request or
  invoice candidates, reviewer state, duplicate/conflict flags, and evidence-present booleans.
- Raw provider request bodies, webhook headers, signing material, card details, customer/payment
  method records, checkout URLs, receipt files, dispute packets, refund artifacts, chargeback
  payloads, and provider-specific private metadata are not retained in database rows, job metadata,
  audit metadata, proof notes, or sample data.
- Import evidence cannot create manual payments, allocations, reconciliation records, trust
  transactions, trust-transfer links, refunds, chargebacks, write-offs, credits, or client
  notifications by itself.

Synthetic example shape:

```text
provider=stripe
eventFamily=payment_succeeded
externalEventId=evt_synthetic_review_001
amountCents=125000
currency=CAD
candidateInvoiceId=inv_synthetic_review_001
reviewState=needs_reviewer_evidence
rawPayloadRetained=false
```

The example is intentionally synthetic and illustrative. It is not an API contract, provider schema,
fixture requirement, or authorization to persist raw provider data.

## Deposit Matching Boundary

Deposit matching should remain reviewer-owned until a later implementation proves stronger controls.
The safe first slice may propose candidate matches between normalized processor evidence, hosted
payment requests, manual payment evidence, bank-feed review summaries, and existing reconciliation
records. It must not:

- create or complete ledger reconciliation records automatically;
- match or clear deposits without reviewer evidence;
- connect live bank feeds or store bank statement rows outside the existing approved boundaries;
- post operating or trust ledger transactions;
- approve or link trust transfers;
- treat payout or deposit timing as proof that an invoice was paid;
- clear protected-funds or trust questions without explicit funds review.

Deposit proposals should be reversible review cues. A reviewer must be able to reject a proposed
match without changing invoice balances, ledgers, trust-transfer state, or reconciliation records.

## Refund And Chargeback Boundary

Refunds and chargebacks are exception review cues, not financial commands. A future review surface
may show normalized status, amount, currency, timing, related import evidence, and candidate invoice
or payment references. It must not:

- call provider refund or dispute APIs;
- issue automatic invoice credits, write-offs, voids, reversals, or balance changes;
- reverse trust ledger entries or authorize trust withdrawals;
- post operating-account fees or chargeback losses;
- send client notifications or expose dispute evidence in the client portal;
- store raw dispute packets, receipt files, provider payloads, card/customer details, or private
  evidence bodies.

Any later refund or chargeback command needs its own reviewer workflow, audit metadata allowlist,
reversal semantics, accounting policy, trust/funds review posture, and selector-driven proof.

## Invoice And Trust Effects

Invoice balances can change only through explicit Open Practice workflows with reviewer evidence:

- Manual-payment evidence must still pass through `POST /api/payments/:paymentId/reconcile` before
  it creates an effective allocation and recalculates invoice paid/balance status.
- Hosted payment requests, processor imports, settlement-event review, deposit-match proposals,
  refunds, and chargeback cues must not independently mutate `paidCents`, `balanceDueCents`, invoice
  lifecycle status, source-entry billing state, or trust-transfer state.
- Trust ledger changes must remain explicit balanced ledger postings or approved selected posting
  requests. Payment evidence, import evidence, deposit proposals, refunds, and chargebacks must not
  auto-post trust entries.

Production Stripe enablement remains blocked until separate approved controls exist for webhook
verification, settlement imports, refund handling, chargeback handling, replay/deployment posture,
provider payload redaction, reviewer evidence, and trust/funds review.

## Implementation Gate

Before any runtime work starts, the implementation plan must name the exact first slice and prove:

- matter/firm authorization for every review record and candidate link;
- normalized import schema with no raw provider payload retention;
- duplicate and idempotency behavior for repeated provider evidence;
- reviewer evidence required before invoice, reconciliation, ledger, trust-transfer, refund,
  chargeback, credit, write-off, or notification side effects;
- synthetic fixtures only, with no client, matter, credential, payment, private deployment, raw
  provider, or private audit details;
- validation selected from the actual changed paths with `pnpm verify:select -- --files`.
