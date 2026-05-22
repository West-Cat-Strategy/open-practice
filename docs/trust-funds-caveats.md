# Canadian Trust and Funds Caveats

Open Practice starts with careful funds-tracking infrastructure. It is not yet jurisdiction-certified
trust accounting software, accounting software, or tax-advice tooling.

## V1 Defaults

- Separate trust and operating account concepts.
- Matter-level client balances.
- Balanced double-entry transactions.
- No overdrawing a client matter balance.
- PostgreSQL-backed client trust balances are updated atomically with posted client-liability entries.
- Idempotency keys for external bank/payment events.
- Append-only posted entries; corrections require reversing transactions.
- Reconciliation records can store imported statement rows, matched/unmatched review decisions,
  immutable beginning/ending balance snapshots, and variance explanations. These records,
  maker-checker approvals, and persistent concurrency guarantees are operational controls; they are
  not jurisdiction-certified controls.
- Statement import previews are non-persistent review aids only. They can dedupe imported rows and
  propose matches against existing trust-ledger entries, but they do not post ledger entries, create
  reconciliation records, approve transactions, or move funds.
- Reconciliation exception resolution records can store staff notes and variance decisions for
  unmatched statement-preview rows. They are review notes only: they do not mutate posted ledger
  entries, create reconciliation records, move funds, or certify accounting conclusions.
- The trust controls workbench is a read-only operator review surface for existing balances,
  approvals, reconciliations, statement-row counts, variance notes, recent postings, and diagnostics.
  It does not post, approve, reconcile, certify, or move funds.
- Jurisdictional trust reports are read-only aggregates over existing matter jurisdiction labels,
  balances, approvals, reconciliation summaries, variance totals, and diagnostics. They do not expose
  statement evidence or private matter detail, create export packages, or certify compliance in any
  jurisdiction.
- Billing, invoice, manual-payment, and trust-transfer-request workflows should be treated as
  operational controls around review, evidence, authorization, and reconciliation.
- No live payment processor is currently part of the product contract.
- Manual payment records are reviewed evidence, not proof of live settlement.
- Trust-transfer-request approval must not automatically post trust ledger entries. Approval can
  record reviewer evidence after invoice-balance and matter trust-balance checks; linkage can only
  reference an existing matching ledger transaction that has not already been linked to another
  trust-transfer request.

## Reference Guidance

- Use **Blnk** as the primary permissive reference for ledger APIs, balances, idempotent transaction posting, and reconciliation boundaries.
- Use **Apache Fineract** selectively for maker-checker approvals, tenant isolation, configurable accounting controls, and reporting patterns.
- Use **LedgerSMB** only as a GPL reference for mature general-ledger and reconciliation reports; do not reuse implementation code.
- Treat **Midaz** as source-available/reference-only because the pinned clone uses Elastic License 2.0 unless legal review confirms otherwise.

## Canadian Context

The product should support configurable workflows for BC, Ontario, and broader Canadian practices, including lawyers, Ontario paralegals, BC notaries, and staff. Regulatory language differs by role and province, so the product must present checklists and prompts as configurable practice-management support, not legal advice.

Billing and invoice wording must remain similarly cautious. The product can help record time,
expenses, invoice lines, payment applications, write-offs, and transfer requests, but it must not
present tax treatment, trust withdrawal eligibility, invoice wording, or fee/disbursement handling as
certified for a jurisdiction without specific review.

Manual payments and future payment-processor imports should be reconciled before affecting invoice
status. A trust-transfer request may document that funds are intended to move from trust after review
and may later be linked to an existing matching ledger transaction, but the actual trust ledger
change must remain a separate, explicit, balanced posting with its own audit trail.

## Before Compliance Claims

Before claiming trust-account compliance in any province, the project needs jurisdiction-specific
review of records, withdrawals, authorization, reconciliation, reporting, retention, mixed trust
account interest, billing and invoice treatment, payment handling, and licensee/notary/paralegal
rules.

Live trust/funds next steps are tracked in `docs/planning-and-progress.md`.
