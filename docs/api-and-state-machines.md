# API and State Machines

This document records the current API and lifecycle contracts. Keep it aligned with
`apps/api/src/server.ts`, `apps/api/src/routes`, `packages/domain/src/models.ts`,
`packages/domain/src/operations.ts`, `packages/domain/src/signatures.ts`,
`packages/domain/src/ledger.ts`, and `packages/domain/src/billing.ts`.

## API Surface

All `/api/*` routes require authentication except first-run setup status/completion,
`POST /api/auth/login`, `POST /api/auth/password-setup`, and token-scoped public portal routes such
as `GET /api/portal/shares/:token`. Production accepts embedded session cookies or
`x-open-practice-session` tokens backed by PostgreSQL session records. Development may use
`x-open-practice-user-id`, `x-open-practice-firm-id`, and bearer JWT helpers. Production rejects
unauthenticated requests, development headers, and bearer JWTs.

The billing lane exposes operational APIs for time, expenses, invoices, manual payments, and
trust-transfer-request records. It does not include live payment processing, jurisdiction-certified
accounting/tax advice, or automatic trust-ledger posting from billing actions.

| Route                                                        | Purpose                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                | Liveness and repository mode (`memory` or `postgres`).                                                          |
| `GET /api/setup/status`                                      | First-run bootstrap status, including blocked partial-state and setup-key requirement flags.                    |
| `POST /api/setup/complete`                                   | Guarded first-run creation of firm settings, owner admin auth, optional first matter, audit event, and session. |
| `POST /api/auth/login`                                       | Embedded session login with firm ID, email, and password.                                                       |
| `POST /api/auth/logout`                                      | Revokes the current embedded session and clears the session cookie.                                             |
| `GET /api/auth/session`                                      | Current embedded-auth session user.                                                                             |
| `POST /api/auth/password-setup-tokens`                       | Owner-admin password setup token creation for local invitation/setup flows.                                     |
| `POST /api/auth/password-setup`                              | Consumes a setup token and stores a local password hash.                                                        |
| `GET /api/session`                                           | Current authenticated user.                                                                                     |
| `GET /api/capabilities`                                      | Permission-aware dashboard sections for the current user and first assigned matter.                             |
| `GET /api/overview`                                          | Firm overview metrics.                                                                                          |
| `GET /api/matters`                                           | Matters visible to the current user.                                                                            |
| `POST /api/conflicts/check`                                  | Conflict search with audit recording for prospective names, aliases, identifiers, and party role.               |
| `GET /api/ledger?matterId=`                                  | Trust ledger accounts, entries, posted transactions, and balances. Matter-scoped users must provide matter ID.  |
| `POST /api/ledger/transactions`                              | Balanced, idempotent trust transaction posting.                                                                 |
| `GET /api/audit`                                             | Firm audit events and hash-chain validity.                                                                      |
| `GET /api/documents/presign-upload`                          | S3 PUT upload intent, storage key, document intent record, and required scan marker.                            |
| `POST /api/documents/:id/upload-complete`                    | Checksum and scan-state completion for an upload intent.                                                        |
| `POST /api/documents/:id/scan-status`                        | Explicit malware/scan-state update for an existing document.                                                    |
| `GET /api/signature-requests?matterId=`                      | Signature requests visible firm-wide or across assigned matters.                                                |
| `POST /api/signature-requests`                               | Provider-neutral signature submission and initial provider event.                                               |
| `POST /api/signature-requests/provider-events`               | Authenticated legacy/provider-neutral status event for matching provider/external IDs.                          |
| `POST /api/signature-requests/:id/embedded-events`           | Embedded signature viewed/completed/declined event with consent/evidence capture.                               |
| `GET /api/signature-requests/:id/events`                     | Provider event history for one signature request.                                                               |
| `GET /api/intake-sessions?matterId=`                         | Intake templates and sessions visible firm-wide or across assigned matters.                                     |
| `POST /api/intake-sessions`                                  | Embedded intake session record, with Open Practice remaining system of record.                                  |
| `GET /api/intake-sessions/:id/answer-snapshots`              | Answer snapshots for one intake session.                                                                        |
| `POST /api/intake-sessions/:id/answer-snapshots`             | Captured intake answers for one intake session.                                                                 |
| `POST /api/intake-sessions/:id/generated-documents`          | Generated document metadata tied to an intake session.                                                          |
| `POST /api/ledger/transactions/:id/approvals`                | Maker-checker approval decision for a trust transaction boundary.                                               |
| `POST /api/ledger/reconciliations`                           | Trust-account reconciliation record with matched/exception status.                                              |
| `GET /api/queues`                                            | Permission-aware operational queues for matters, documents, signatures, intake, ledger, and audit review.       |
| `GET /api/time-entries?matterId=&status=`                    | Time entries visible firm-wide or across assigned matters.                                                      |
| `POST /api/time-entries`                                     | Time-entry capture with performed date, immutable rate snapshot, and draft billing status.                      |
| `PATCH /api/time-entries/:id`                                | Draft/submitted time-entry edits before billing or write-off.                                                   |
| `POST /api/time-entries/:id/submit`                          | Move a draft time entry to submitted.                                                                           |
| `POST /api/time-entries/:id/approve`                         | Approve a submitted time entry for invoicing.                                                                   |
| `POST /api/time-entries/:id/write-off`                       | Mark an unbilled time entry as written off.                                                                     |
| `GET /api/expense-entries?matterId=&status=`                 | Expense entries visible firm-wide or across assigned matters.                                                   |
| `POST /api/expense-entries`                                  | Expense capture with incurred date, immutable amount snapshot, and draft billing status.                        |
| `PATCH /api/expense-entries/:id`                             | Draft/submitted expense-entry edits before billing or write-off.                                                |
| `POST /api/expense-entries/:id/submit`                       | Move a draft expense entry to submitted.                                                                        |
| `POST /api/expense-entries/:id/approve`                      | Approve a submitted expense entry for invoicing.                                                                |
| `POST /api/expense-entries/:id/write-off`                    | Mark an unbilled expense entry as written off.                                                                  |
| `GET /api/invoices?matterId=&status=`                        | Invoice summaries visible firm-wide or across assigned matters.                                                 |
| `POST /api/invoices`                                         | Create a draft invoice from approved unbilled time/expense entries and optional adjustment lines.               |
| `GET /api/invoices/:id`                                      | Invoice detail with immutable line, tax, total, payment, and balance snapshots.                                 |
| `POST /api/invoices/:id/approve`                             | Approve a draft invoice and mark source time/expense entries as billed.                                         |
| `POST /api/invoices/:id/issue`                               | Issue an approved invoice without changing stored line snapshots.                                               |
| `POST /api/invoices/:id/void`                                | Void an unpaid invoice while preserving source and audit evidence.                                              |
| `GET /api/payments?matterId=&invoiceId=`                     | Manual payments and allocations visible firm-wide or across assigned matters.                                   |
| `POST /api/payments`                                         | Record a manual payment allocation; over-allocation is rejected and invoice balance/status is recalculated.     |
| `GET /api/billing/trust-transfer-requests?matterId=&status=` | Trust-transfer-request records visible firm-wide or across assigned matters.                                    |
| `POST /api/billing/trust-transfer-requests`                  | Create a billing-side request to pay an invoice from trust; this does not post ledger transactions.             |
| `GET /api/billing/dashboard`                                 | Billing dashboard payload for approved unbilled work, draft invoices, issued balances, and payments.            |
| `GET /api/jobs`                                              | Firm-scoped PostgreSQL job lifecycle projection and queue names; Redis internals are not exposed.               |
| `GET /api/email/status`                                      | SMTP provider status from firm provider settings.                                                               |
| `POST /api/email/previews`                                   | Auth-gated disabled scaffold for future template previews and queued mail creation.                             |
| `GET /api/inbound-email/status`                              | Inbound email provider status from firm provider settings.                                                      |
| `GET /api/inbound-email/messages?matterId=`                  | Matter-scoped parsed inbound email messages, or firm-wide owner/auditor review queue.                           |
| `GET /api/document-processing/status`                        | OCR, transcription, media, and AI provider status from firm provider settings.                                  |
| `POST /api/document-processing/documents/:id/queue`          | Auth-gated disabled scaffold for future document processing jobs.                                               |
| `GET /api/auth/extensions`                                   | Embedded-auth extension status for local password, OIDC/SAML placeholders, and MFA policy scaffolding.          |
| `GET /api/shares/status`                                     | Share-link capability status and create enablement based on token-signing configuration.                        |
| `GET /api/shares?matterId=`                                  | Persisted share-link listing with matter-scoped authorization and no token hashes in the response.              |
| `POST /api/shares`                                           | Creates an expiring token-hashed share link and returns the raw token only once.                                |
| `POST /api/shares/:id/revoke`                                | Revokes an existing matter-scoped share link and records audit evidence.                                        |
| `GET /api/portal/shares/:token`                              | Public token-scoped read of eligible shared document metadata with access logging.                              |
| `GET /api/external-uploads/status`                           | External upload capability status and S3 configuration signal.                                                  |
| `POST /api/external-uploads/intents`                         | Auth-gated disabled scaffold for future secure external upload intents.                                         |
| `GET /api/drafts?matterId=&userId=`                          | Matter-scoped structured drafts with TipTap/ProseMirror JSON and sanitized rendered snapshots.                  |
| `POST /api/drafts`                                           | Create a structured draft from either TipTap/ProseMirror JSON or an active draft template.                      |
| `GET /api/drafts/:id`                                        | Fetch an authorized draft by ID.                                                                                |
| `PUT /api/drafts/:id`                                        | Save structured draft content or rendered snapshot updates and increment the draft version.                     |
| `DELETE /api/drafts/:id`                                     | Delete an authorized draft record.                                                                              |
| `GET /api/draft-templates?category=&activeOnly=`             | List active firm-scoped drafting templates, including seeded operational basics.                                |
| `POST /api/draft-templates`                                  | Create a firm-scoped drafting template from structured TipTap/ProseMirror JSON.                                 |

## Deferred Worker And Provider Surfaces

These routes remain deferred until their persistence, authorization, and worker implementations land
behind the scaffolded provider settings and job lifecycle records. Inbound email parsing now
persists parsed messages and attachment records, but webhook ingestion, provider delivery setup, and
automatic document promotion remain deferred.

| Route                                             | Purpose                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/providers/status`                       | Operator-visible status for Redis/BullMQ, object storage, mail, OCR, transcription, and Ollama.  |
| `POST /api/documents/:id/ocr-jobs`                | Enqueue Tesseract OCR for a verified document version.                                           |
| `POST /api/media/:id/transcription-jobs`          | Enqueue FFmpeg normalization and Whisper transcription for authorized media.                     |
| `POST /api/documents/:id/assistive-drafting-jobs` | Enqueue an Ollama-backed drafting/summarization aid with required review state.                  |
| `POST /api/mail/outbox`                           | Create an audited outbound email record for a mail worker to deliver through the active profile. |
| `POST /api/auth/passkeys/registration-options`    | Create a SimpleWebAuthn registration challenge for the current user.                             |
| `POST /api/auth/passkeys/registration`            | Verify and store a passkey credential for embedded auth.                                         |
| `POST /api/auth/passkeys/authentication-options`  | Create a passkey login challenge for configured RP ID/origin.                                    |
| `POST /api/auth/passkeys/authentication`          | Verify passkey assertion and create an embedded session.                                         |

## State Machines

Document upload state starts at `intent_created` with `checksumStatus=pending` and
`scanStatus=pending`. Upload completion moves to `verified` only when the supplied checksum matches
the upload intent. Checksum mismatch moves upload to `rejected`, checksum to `mismatch`, and scan to
`failed`. Matching checksums set checksum to `verified` or `duplicate`; scan becomes the supplied
`pending`, `queued`, `passed`, `failed`, or `not_required` value. Portal sharing remains blocked
unless upload is verified, checksum is verified, scan has passed or is not required, and legal hold is
clear.

Secure share links store only HMAC token hashes. Authenticated v1 creation accepts document-view
shares only, requires matter-scoped `share_link:create` access, a future expiry, and at least one
shareable document. The create response returns the raw token once; list and revoke responses never
expose token hashes. Public share reads resolve the supplied token to its hash, reject missing,
revoked, expired, or email-verification-required links, filter documents through the same
upload/checksum/scan/legal-hold/supersession gates as portal grants, and record access-log outcomes
for granted and denied reads. Upload, message, signature, and email-verification share flows remain
future scoped until those public flows are implemented.

Signature requests use provider statuses `draft`, `pending_provider_submission`, `sent`, `viewed`,
`completed`, `declined`, and `provider_error`. Creating a request records the provider submission,
signers, and an initial provider event. Provider events update the request status, set completion or
decline timestamps for terminal statuses, and preserve terminal statuses against out-of-order
non-terminal events. Embedded signature events capture signer consent text, actor ID, IP,
user-agent, timestamps, and caller-provided evidence. Legacy `docuseal` requests remain historical
records and are rejected by embedded event routes.

Intake sessions use `created`, `in_progress`, `ready_to_generate`, `completed`, and
`provider_error`. The API creates embedded sessions from embedded templates. Answer snapshots and
generated-document metadata are stored locally. Legacy `docassemble` templates/sessions are rejected
for new generation paths.

Draft records store structured TipTap/ProseMirror JSON and an optional sanitized rendered HTML
snapshot. New drafts start at version `1`; each save through `PUT /api/drafts/:id` increments the
version and records the updating user. `POST /api/drafts` accepts exactly one seed source:
`editorJson` for direct structured content or `templateId` for an active firm-scoped template. Basic
draft templates are firm-scoped seed records and can be filtered by category while remaining editable
through future template-management workflows.

Ledger posting has no mutable status field. A transaction is accepted only when entries are balanced,
non-zero, one-sided debit/credit rows; all accounts, matters, and clients are valid; the idempotency
key is new or repeats the same request fingerprint; and client-liability balances are not overdrawn.
PostgreSQL persistence also maintains a matter/client trust-balance guard that is updated atomically
with posted client-liability entries so concurrent withdrawals cannot push a persisted balance below
zero. Reversal transactions must reference an existing transaction and exactly mirror the original
entries. Approval and reconciliation records are first-class controls around posting and review, but
they are not jurisdiction-certified compliance claims. Approval records must reference an existing
transaction and one reviewer cannot record duplicate decisions for the same transaction.

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

Worker jobs use `queued`, `active`, `completed`, `failed`, `dead_letter`, and `skipped`.
PostgreSQL stores the durable job lifecycle record, queue name, BullMQ job ID, target resource,
retry counts, error summary, timestamps, and metadata. Redis/BullMQ delivers work and retry attempts,
but the API exposes only the PostgreSQL projection. Failed or skipped OCR, transcription, email,
AI-assist, or media jobs must not change portal-share, billing, signature, trust, or audit state
without an explicit reviewed transition.

Provider/bootstrap selection is local-first. `DATABASE_URL` selects PostgreSQL unless
`OPEN_PRACTICE_USE_MEMORY_REPO=true` or the database URL is absent. `OPEN_PRACTICE_DEV_SEED=true`
loads seed data. Empty firm/user state exposes first-run setup; partial firm/user state is blocked
until an operator repairs it. Production first-run completion requires `OPEN_PRACTICE_SETUP_KEY`
and the matching `x-open-practice-setup-key` header. Non-production setup without a configured key
is limited to local/private network access. Signature and intake providers default to embedded
implementations. S3 upload signing is enabled only when endpoint and credentials are configured.
Redis/BullMQ queues, firm provider settings, job lifecycle records, and disabled-by-default API
scaffolds are implemented for email, AI triage, OCR, transcription, media, auth extensions, and
external uploads. Secure share-link create/list/revoke plus token-scoped public document metadata
reads are implemented with token hashing, matter-scoped authorization, audit events, and access
logs. Inbound email parsing is implemented for raw messages already stored in object storage;
provider webhooks and automatic document promotion remain deferred. Concrete
Postal, Tesseract, Whisper/FFmpeg, Ollama, LM Studio, SimpleWebAuthn, and TipTap behavior still
requires explicit setup, provider adapters, review states, and deployment profiles. `DOCUSEAL_*`,
`DOCASSEMBLE_*`, and `OIDC_*` variables are deprecated and rejected in production. There is no live
payment processor configuration. Future processor keys, webhooks, and settlement imports should be
introduced behind explicit deployment profiles and reconciliation controls.
