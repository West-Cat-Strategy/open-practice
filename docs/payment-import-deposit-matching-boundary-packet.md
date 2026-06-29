# Payment Import And Deposit Matching Boundary Packet

Date: 2026-06-17 PDT

This packet defines the next safe boundary for future payment processor imports, deposit matching,
refunds, and chargebacks. It began as docs-first policy groundwork and now has three narrow runtime
slices: staff-only normalized payment import review records for processor evidence cues,
staff-only deposit-match reviewer decisions over those normalized records, and provider-neutral
refund/chargeback review cues derived from existing payment import records. The packet still does
not authorize live settlement, payment processor webhooks, provider payload persistence, invoice
mutation, trust posting, bank-feed connections, worker replay, provider commands, refund or
chargeback commands, or deposit matching automation.

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
- OP-T160 adds provider-neutral payment import review records and Billing dashboard cues. They are
  normalized reviewer evidence only and do not apply payments, mutate invoice balances, reconcile
  deposits, handle refunds or chargebacks, or post trust entries.
- OP-T162 adds provider-neutral deposit-match reviewer decisions over OP-T160 records. They are
  append-only reviewer evidence only and do not apply or reconcile manual payments, mutate invoice
  balances, clear deposits, call providers, notify clients, handle refunds or chargebacks, or post
  trust entries.
- The 2026-06-28 refund/chargeback cue surface derives provider-neutral reviewer cues from existing
  payment import review records with `eventFamily="payment"` and `eventStatus="refund_observed"`
  or `eventStatus="chargeback_observed"`. It adds dashboard counts, optional row cue metadata, and
  safe audit metadata only; it does not create workflows, provider commands, dispute packets,
  invoice mutations, ledger reversals, client notifications, trust transfers, or trust postings.

## First Runtime Slice

OP-T160 implements the first runtime slice under this packet:

- `POST /api/billing/payment-import-review-records` and
  `GET /api/billing/payment-import-review-records` create and list staff-only normalized review
  records for authenticated billing staff.
- Stored fields are provider-neutral: safe provider label, event family/status, safe external IDs,
  amount/currency, observed/imported timestamps, candidate invoice, hosted payment-request, or
  manual-payment IDs, duplicate/conflict cues, review state, and explicit no-side-effect boundary
  flags.
- Idempotency is keyed by `(firm, provider label, external event ID)`: identical normalized
  evidence returns the existing review record, while changed evidence for the same event is rejected
  for staff review.
- Billing dashboard cues show per-matter import counts, event rows, candidate IDs, duplicate and
  conflict indicators, and explicit copy that the records are normalized evidence only.
- Deposit matching remains candidate metadata only. The runtime slice creates no matching,
  reconciliation, ledger, payment, refund, chargeback, notification, provider command, trust
  transfer, or trust posting action. The 2026-06-20 follow-up lets staff attach an existing
  manual-payment candidate ID to normalized deposit evidence for review, but it still does not
  reconcile, allocate, clear, or post that payment.

## Second Runtime Slice

OP-T162 implements the second runtime slice under this packet:

- `POST /api/billing/payment-import-review-records/:recordId/deposit-match-reviews` and
  `GET /api/billing/payment-import-review-records/:recordId/deposit-match-reviews` record and list
  staff-only reviewer decisions for one normalized deposit import record.
- Stored fields are provider-neutral and audit-safe: payment import review record ID, candidate
  manual-payment and optional invoice IDs, enum decision and reason, import/manual-payment amount
  snapshots, candidate manual-payment status, reviewer/evidence posture, idempotency key and
  fingerprint, reviewed timestamp/user, and explicit no-side-effect boundary flags.
- Idempotency is keyed by `(firm, payment import review record, idempotency key)`: identical
  reviewer evidence returns the existing decision, while changed evidence for the same key is
  rejected for staff review.
- `candidate_supported` is allowed only when the normalized record has deposit evidence and a
  candidate manual payment, the candidate remains `pending_reconciliation`, amounts/currency match,
  and duplicate/conflict cues are inactive. Rejections and needs-more-evidence decisions remain
  reviewer evidence only.
- Billing dashboard cues show per-matter decision counts and latest decision posture. The slice
  creates no matching, reconciliation, ledger, payment, refund, chargeback, notification, provider
  command, trust transfer, or trust posting action.
- The 2026-06-29 readiness follow-up adds Billing dashboard cues for latest `candidate_supported`
  decisions that still appear eligible for the existing manual-payment reconcile review workflow.
  Eligibility is read from current manual-payment and invoice state, remains advisory, and does not
  invoke `POST /api/payments/:paymentId/reconcile`, allocate funds, clear deposits, mutate invoices,
  or post trust entries.

## Refund And Chargeback Cue Surface

The 2026-06-28 cue surface derives reviewer-visible exception cues from existing normalized payment
import review records only:

- Recognized inputs are limited to `eventFamily="payment"` with `eventStatus="refund_observed"` or
  `eventStatus="chargeback_observed"`.
- The derived cue is metadata only: `category`, `status="needs_review"`, and
  `reviewAction="staff_refund_chargeback_review_required"`, plus explicit no-side-effect flags.
- Billing dashboard responses expose refund, chargeback, and combined cue counts, with optional
  per-record cue metadata for reviewer context.
- Audit metadata for payment-import creation may include cue category/status/action and boundary
  flags such as `refundHandling`, `chargebackHandling`, `providerCommand`, and
  `clientNotification`.
- The slice adds no table, migration, provider adapter, worker, route, ledger command, invoice
  mutation, dispute packet retention, trust posting, or client notification.

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
providerLabel=synthetic_processor
eventFamily=deposit
eventStatus=deposit_observed
externalEventId=evt_synthetic_review_001
externalDepositId=dep_synthetic_review_001
amountCents=125000
currency=CAD
candidateInvoiceId=inv_synthetic_review_001
candidateManualPaymentId=pay_synthetic_review_001
reviewState=needs_review
rawPayloadRetained=false
invoiceBalanceMutation=none
settlementAutomation=false
trustPosting=none
```

The example is intentionally synthetic and illustrative. It is not an API contract, provider schema,
fixture requirement, authorization to persist raw provider data, or authorization to allocate the
candidate manual payment.

## Deposit Matching Boundary

Deposit matching should remain reviewer-owned until a later implementation proves stronger controls.
The current safe slices may propose candidate matches and record reviewer support/rejection/needs
more evidence decisions between normalized processor evidence, hosted payment requests, manual
payment evidence, bank-feed review summaries, and existing reconciliation records. Candidate manual
payments are references to existing evidence only. They must not:

- create or complete ledger reconciliation records automatically;
- match or clear deposits without reviewer evidence;
- connect live bank feeds or store bank statement rows outside the existing approved boundaries;
- post operating or trust ledger transactions;
- approve or link trust transfers;
- treat payout or deposit timing as proof that an invoice was paid;
- clear protected-funds or trust questions without explicit funds review.

Deposit proposals and reviewer decisions should be reversible review cues. A reviewer must be able
to reject a proposed match without changing invoice balances, ledgers, trust-transfer state, or
reconciliation records.

## Refund And Chargeback Boundary

Refunds and chargebacks are exception review cues, not financial commands. The cue surface may show
normalized status, amount, currency, timing, related import evidence, candidate invoice or payment
references, cue counts, and safe cue metadata. It must not:

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
- Deposit-match readiness cues may identify supported candidates for that existing manual-payment
  review workflow, but the cue itself is read-only and performs no reconciliation, allocation,
  deposit clearing, invoice mutation, provider command, or trust posting.
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
