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
- Statement import batch records persist source label, checksum, row count, duplicate count, status,
  optional matching profile ID, creator, and timestamp for operational tracking. They do not store
  statement rows, statement evidence, posting payloads, reconciliation records, approvals, or fund
  movement instructions.
- Statement match-rule profiles and accounting review profiles persist reviewer-owned posture only:
  reference and description strategies, date/amount tolerances, variance categories,
  operating-vs-trust/expense boundary posture, protected-funds cues, metadata-only bank-feed shell
  state, and vendor/expense/client-matter dimensions. They do not connect live feeds, run automatic
  matching, authorize disbursements, post trust entries, or certify accounting conclusions.
- Bank-feed reconciliation review summaries are derived from existing accounting profiles, import
  batch metadata, reconciliation records, and diagnostics. They count metadata-only/review-ready
  feeds, row/duplicate totals, pending accounts, protected-funds feeds, completed reconciliations,
  and exceptions only; they do not store statement rows, connect providers, auto-match
  transactions, post ledgers, reconcile accounts automatically, authorize disbursements, or certify
  accounting conclusions.
- Ledger balance snapshot comparisons are read-only reviewer cues derived from existing trust
  balances, latest posted transaction posture, statement import batch metadata, and reconciliation
  snapshots. They do not persist preview rows, create reconciliation records, post ledger entries,
  run matching, settle funds, connect feeds, or certify accounting conclusions.
- Reconciliation exception resolution records can store staff notes and variance decisions for
  unmatched statement-preview rows. They are review notes only: they do not mutate posted ledger
  entries, create reconciliation records, move funds, or certify accounting conclusions.
- The trust controls workbench is a read-only operator review surface for existing balances,
  approvals, reconciliations, statement-row counts, variance notes, recent postings,
  pending/posted/rejected posting-request cues, and diagnostics. It does not itself post, approve,
  reconcile, certify, or move funds.
- Jurisdictional trust reports are read-only aggregates over existing matter jurisdiction labels,
  balances, approvals, reconciliation summaries, variance totals, and diagnostics. They do not expose
  statement evidence or private matter detail, create export packages, or certify compliance in any
  jurisdiction.
- Billing, invoice, manual-payment, and trust-transfer-request workflows should be treated as
  operational controls around review, evidence, authorization, and reconciliation.
- No live payment processor is currently part of the product contract.
- Manual payment records are reviewed evidence, not proof of live settlement; pending manual
  payments must be reconciled before they affect invoice paid/balance status.
- Normalized payment settlement event records are reconciliation-review evidence only. They do not
  prove live settlement, apply invoice balances, reconcile deposits, handle refunds or chargebacks,
  authorize trust withdrawals, or move funds.
- Future payment processor imports, deposit-match proposals, refund cues, and chargeback cues remain
  review evidence until a separate approved workflow records reviewer evidence. They must not retain
  raw provider payloads, mutate invoice balances, create reconciliation records, call provider APIs,
  post operating or trust ledger entries, authorize withdrawals, or notify clients by themselves.
- AI draft-invoice cues are review artifacts only. Approving a proposal records reviewer status but
  does not create an invoice, change balances, schedule payment collection, reconcile payment
  evidence, or post trust/operating ledger entries.
- Trust-transfer-request approval must not automatically post trust ledger entries. Approval can
  record reviewer evidence after invoice-balance and matter trust-balance checks; linkage can only
  reference an existing matching ledger transaction that has not already been linked to another
  trust-transfer request.
- Trust posting requests are operational maker-checker support for selected postings only. Preparing
  a request stores the proposed balanced/idempotent transaction without posting; approval by a
  different checker posts it through the existing ledger transaction path with current no-overdraft
  checks; rejection never posts. This is separate from trust-transfer approval/linking, bank-feed
  matching, settlement, compliance certification, and jurisdiction-certified trust accounting.

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
status. Open Practice records new manual payments as pending evidence until reviewer reconciliation
creates the effective allocation. The
[payment import and deposit matching boundary packet](payment-import-deposit-matching-boundary-packet.md)
keeps processor imports, deposit proposals, refunds, and chargebacks in reviewer-owned evidence
posture until later approved controls define exact effects. A trust-transfer request may document
that funds are intended to move from trust after review and may later be linked to an existing
matching ledger transaction, but the actual trust ledger change must remain a separate, explicit,
balanced posting with its own audit trail.

## Before Compliance Claims

Before claiming trust-account compliance in any province, the project needs jurisdiction-specific
review of records, withdrawals, authorization, reconciliation, reporting, retention, mixed trust
account interest, billing and invoice treatment, payment handling, and licensee/notary/paralegal
rules.

Live trust/funds next steps are tracked in `docs/planning-and-progress.md`.
