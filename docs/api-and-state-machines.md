# API and State Machines

This document records the current API and lifecycle contracts for OP-T6 and OP-T8. Keep it aligned
with `apps/api/src/server.ts`, `packages/domain/src/models.ts`,
`packages/domain/src/signatures.ts`, `packages/domain/src/ledger.ts`, and
`packages/domain/src/billing.ts`.

## API Surface

All `/api/*` routes require authentication except `POST /api/signature-requests/webhooks/docuseal`,
which uses the configured DocuSeal secret header. Development may use `x-open-practice-user-id` and
`x-open-practice-firm-id`; bearer JWTs require `AUTH_JWT_SECRET`. Production rejects
unauthenticated requests.

The billing lane exposes operational APIs for time, expenses, invoices, manual payments, and
trust-transfer-request records. It does not include live payment processing, jurisdiction-certified
accounting/tax advice, or automatic trust-ledger posting from billing actions.

| Route                                                        | Purpose                                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                | Liveness and repository mode (`memory` or `postgres`).                                                         |
| `GET /api/session`                                           | Current authenticated user.                                                                                    |
| `GET /api/capabilities`                                      | Permission-aware dashboard sections for the current user and first assigned matter.                            |
| `GET /api/overview`                                          | Firm overview metrics.                                                                                         |
| `GET /api/matters`                                           | Matters visible to the current user.                                                                           |
| `POST /api/conflicts/check`                                  | Conflict search with audit recording for prospective names, aliases, identifiers, and party role.              |
| `GET /api/ledger?matterId=`                                  | Trust ledger accounts, entries, posted transactions, and balances. Matter-scoped users must provide matter ID. |
| `POST /api/ledger/transactions`                              | Balanced, idempotent trust transaction posting.                                                                |
| `GET /api/audit`                                             | Firm audit events and hash-chain validity.                                                                     |
| `GET /api/documents/presign-upload`                          | S3 PUT upload intent, storage key, document intent record, and required scan marker.                           |
| `POST /api/documents/:id/upload-complete`                    | Checksum and scan-state completion for an upload intent.                                                       |
| `POST /api/documents/:id/scan-status`                        | Explicit malware/scan-state update for an existing document.                                                   |
| `GET /api/signature-requests?matterId=`                      | Signature requests visible firm-wide or across assigned matters.                                               |
| `POST /api/signature-requests`                               | Provider-neutral signature submission and initial provider event.                                              |
| `POST /api/signature-requests/provider-events`               | Provider status event plus webhook-attempt record.                                                             |
| `POST /api/signature-requests/webhooks/docuseal`             | DocuSeal webhook receiver with configured secret-header verification, replay checks, and event ordering.       |
| `GET /api/signature-requests/:id/events`                     | Provider event history for one signature request.                                                              |
| `GET /api/intake-sessions?matterId=`                         | Intake templates and sessions visible firm-wide or across assigned matters.                                    |
| `POST /api/intake-sessions`                                  | Manual or docassemble-backed intake session record, with Open Practice remaining system of record.             |
| `GET /api/intake-sessions/:id/answer-snapshots`              | Answer snapshots for one intake session.                                                                       |
| `POST /api/intake-sessions/:id/answer-snapshots`             | Captured intake answers for one intake session.                                                                |
| `POST /api/intake-sessions/:id/generated-documents`          | Generated document metadata tied to an intake session.                                                         |
| `POST /api/ledger/transactions/:id/approvals`                | Maker-checker approval decision for a trust transaction boundary.                                              |
| `POST /api/ledger/reconciliations`                           | Trust-account reconciliation record with matched/exception status.                                             |
| `GET /api/queues`                                            | Permission-aware operational queues for matters, documents, signatures, intake, ledger, and audit review.      |
| `GET /api/time-entries?matterId=&status=`                    | Time entries visible firm-wide or across assigned matters.                                                     |
| `POST /api/time-entries`                                     | Time-entry capture with performed date, immutable rate snapshot, and draft billing status.                     |
| `PATCH /api/time-entries/:id`                                | Draft/submitted time-entry edits before billing or write-off.                                                  |
| `POST /api/time-entries/:id/submit`                          | Move a draft time entry to submitted.                                                                          |
| `POST /api/time-entries/:id/approve`                         | Approve a submitted time entry for invoicing.                                                                  |
| `POST /api/time-entries/:id/write-off`                       | Mark an unbilled time entry as written off.                                                                    |
| `GET /api/expense-entries?matterId=&status=`                 | Expense entries visible firm-wide or across assigned matters.                                                  |
| `POST /api/expense-entries`                                  | Expense capture with incurred date, immutable amount snapshot, and draft billing status.                       |
| `PATCH /api/expense-entries/:id`                             | Draft/submitted expense-entry edits before billing or write-off.                                               |
| `POST /api/expense-entries/:id/submit`                       | Move a draft expense entry to submitted.                                                                       |
| `POST /api/expense-entries/:id/approve`                      | Approve a submitted expense entry for invoicing.                                                               |
| `POST /api/expense-entries/:id/write-off`                    | Mark an unbilled expense entry as written off.                                                                 |
| `GET /api/invoices?matterId=&status=`                        | Invoice summaries visible firm-wide or across assigned matters.                                                |
| `POST /api/invoices`                                         | Create a draft invoice from approved unbilled time/expense entries and optional adjustment lines.              |
| `GET /api/invoices/:id`                                      | Invoice detail with immutable line, tax, total, payment, and balance snapshots.                                |
| `POST /api/invoices/:id/approve`                             | Approve a draft invoice and mark source time/expense entries as billed.                                        |
| `POST /api/invoices/:id/issue`                               | Issue an approved invoice without changing stored line snapshots.                                              |
| `POST /api/invoices/:id/void`                                | Void an unpaid invoice while preserving source and audit evidence.                                             |
| `GET /api/payments?matterId=&invoiceId=`                     | Manual payments and allocations visible firm-wide or across assigned matters.                                  |
| `POST /api/payments`                                         | Record a manual payment allocation; over-allocation is rejected and invoice balance/status is recalculated.    |
| `GET /api/billing/trust-transfer-requests?matterId=&status=` | Trust-transfer-request records visible firm-wide or across assigned matters.                                   |
| `POST /api/billing/trust-transfer-requests`                  | Create a billing-side request to pay an invoice from trust; this does not post ledger transactions.            |
| `GET /api/billing/dashboard`                                 | Billing dashboard payload for approved unbilled work, draft invoices, issued balances, and payments.           |

## State Machines

Document upload state starts at `intent_created` with `checksumStatus=pending` and
`scanStatus=pending`. Upload completion moves to `verified` only when the supplied checksum matches
the upload intent. Checksum mismatch moves upload to `rejected`, checksum to `mismatch`, and scan to
`failed`. Matching checksums set checksum to `verified` or `duplicate`; scan becomes the supplied
`pending`, `queued`, `passed`, `failed`, or `not_required` value. Portal sharing remains blocked
unless upload is verified, checksum is verified, scan has passed or is not required, and legal hold is
clear.

Signature requests use provider statuses `draft`, `pending_provider_submission`, `sent`, `viewed`,
`completed`, `declined`, and `provider_error`. Creating a request records the provider submission,
signers, and an initial provider event. Provider events update the request status, set completion or
decline timestamps for terminal statuses, and persist webhook-attempt evidence. DocuSeal webhooks are
accepted only when the configured secret header matches. Replayed events are recorded as failed
attempts, and terminal request statuses are not overwritten by out-of-order non-terminal events.

Intake sessions use `created`, `in_progress`, `ready_to_generate`, `completed`, and
`provider_error`. The API creates manual sessions by default and calls the docassemble adapter only
for templates whose provider is `docassemble` and only when docassemble env configuration is present.
Answer snapshots and generated-document metadata are stored locally; docassemble must not become the
system of record for sessions, answers, generated document metadata, or final document records.

Ledger posting has no mutable status field. A transaction is accepted only when entries are balanced,
non-zero, one-sided debit/credit rows; all accounts, matters, and clients are valid; the idempotency
key is new or repeats the same request fingerprint; and client-liability balances are not overdrawn.
Reversal transactions must reference an existing transaction and exactly mirror the original entries.
Approval and reconciliation records are first-class controls around posting and review, but they are
not jurisdiction-certified compliance claims.

Billing work treats time and expense capture as pre-invoice operational records. The billing status
is `draft`, `submitted`, `approved`, `billed`, or `written_off`. Draft entries can be edited,
submitted entries can be approved, approved entries can be invoiced, and billed or written-off
records cannot be edited through ordinary patch routes. Rates and expense amounts are stored as
snapshots; approval is not tax advice and does not certify rates, tax treatment, disbursement
handling, or jurisdiction rules.

Invoice records should move through `draft`, `approved`, `issued`, `partially_paid`, `paid`,
and `void`. Invoice creation can reference only approved unbilled source entries and can include
manual adjustment lines. Invoice lines store immutable subtotal, tax name, tax rate in basis points,
tax cents, and total snapshots. Approving an invoice marks source entries `billed`. Payment status is
derived from manual payment allocations against stored invoice totals, not from client-entered text.
Voids and corrections should keep the original invoice visible in the audit trail.

Manual payment records use `received` or `void` status. A manual payment is operator-entered
evidence of funds received or observed; it is not live settlement from a payment processor.
Allocations are stored separately, over-allocation is rejected, and invoice `paidCents`,
`balanceDueCents`, and lifecycle status are recalculated after every allocation. Applying a manual
payment must not automatically post to the trust ledger.

Trust-transfer requests move through `pending_approval`, `approved`, `rejected`, `linked`, and
`cancelled`. These records represent a controlled request to pay an invoice from trust after review.
Approval should not create trust ledger entries by itself. Any trust ledger posting must remain an
explicit balanced ledger transaction with its own idempotency key, actor, evidence,
approval/reconciliation records where required, and reversal path. Optional linkage to a ledger
transaction is evidence/reference only.

Audit events are append-only records with hash-chain validation. Conflict checks and other repository
operations that create audit events should preserve firm scoping, actor identity, canonical payloads,
and chain validity.

Provider/bootstrap selection is environment driven. `DATABASE_URL` selects PostgreSQL unless
`OPEN_PRACTICE_USE_MEMORY_REPO=true` or the database URL is absent. `OPEN_PRACTICE_DEV_SEED=true`
loads seed data. DocuSeal is selected only when both `DOCUSEAL_BASE_URL` and `DOCUSEAL_API_KEY` are
present; otherwise the manual signature provider is used. S3 upload signing is enabled only when
endpoint and credentials are configured. `DOCUSEAL_WEBHOOK_SECRET_HEADER` and
`DOCUSEAL_WEBHOOK_SECRET_VALUE` enable DocuSeal webhook acceptance. `DOCASSEMBLE_BASE_URL`,
`DOCASSEMBLE_API_KEY`, and `DOCASSEMBLE_RETURN_URL` enable optional docassemble sessions.
There is no live payment processor configuration. Future processor keys, webhooks, and settlement
imports should be introduced behind explicit deployment profiles and reconciliation controls.
