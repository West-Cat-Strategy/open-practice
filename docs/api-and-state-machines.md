# API and State Machines

This document records the current API and lifecycle contracts. Keep it aligned with
`apps/api/src/server.ts`, `apps/api/src/routes`, `packages/domain/src/models.ts`,
`packages/domain/src/operations.ts`, `packages/domain/src/signatures.ts`,
`packages/domain/src/ledger.ts`, and `packages/domain/src/billing.ts`.

## API Surface

All `/api/*` routes require authentication except first-run setup status/completion/setup passkey
options, embedded-auth login, password setup, recovery-code verification, public passkey login
options/verification, and token-scoped public portal routes such as `GET /api/portal/shares/:token`,
external-upload collection links, intake-form links, guest-session status links, and the
origin-restricted public consultation intake submission route. Production
accepts embedded session cookies or
`x-open-practice-session` tokens backed by PostgreSQL session records. Development may use
`x-open-practice-user-id`, `x-open-practice-firm-id`, and bearer JWT helpers. Production rejects
unauthenticated requests, development headers, and bearer JWTs.
Open Practice is a single-tenant application at the user-facing auth boundary: public embedded-auth
login, passkey login, recovery-code verification, and password setup accept user credentials only
and resolve the sole configured practice internally. `firmId` remains an internal authorization,
matter-scope, audit, and persistence partition key.

The billing lane exposes operational APIs for time, expenses, invoices, manual payments, and
trust-transfer-request records. It does not include live payment processing, jurisdiction-certified
accounting/tax advice, or automatic trust-ledger posting from billing actions.

## Authorization Relation Vocabulary

The first ReBAC planning slice is a domain-test vocabulary over existing authorization checks, not a
new policy engine. Matter, document, job, and portal-link list visibility remains delegated to
`canAccess` and job lifecycle helpers. The current relation vocabulary is deliberately small:
`same_firm`, `role_allows_read`, `firm_wide_role`, `assigned_matter`, `active_portal_grant`, and
`job_matter_metadata`.

The denial/list-visible matrix fixtures cover assigned matter visibility, owner/auditor firm-wide
visibility, active portal document grants, unassigned matter denial, expired portal grant denial, and
job lifecycle rows without matter metadata. They do not add external authorization services,
relationship persistence, assignment rewrites, or broader access rules.

| Route                                                                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                                                                         | Liveness and repository mode (`memory` or `postgres`).                                                                                                                                                                                                                                                                                                                   |
| `GET /api/setup/status`                                                               | First-run bootstrap status, including blocked partial-state and setup-key requirement flags.                                                                                                                                                                                                                                                                             |
| `POST /api/setup/webauthn-options`                                                    | Guarded first-run SimpleWebAuthn registration options for the optional owner-admin passkey; requires the setup key when configured.                                                                                                                                                                                                                                      |
| `POST /api/setup/complete`                                                            | Guarded first-run creation of firm settings, owner admin auth, optional passkey, audit event, and session from either a minimal workspace payload or the fuller legacy setup payload.                                                                                                                                                                                    |
| `POST /api/auth/login`                                                                | Single-tenant embedded session login with email and password; the API resolves the configured practice internally.                                                                                                                                                                                                                                                       |
| `POST /api/auth/login/options`                                                        | Public SimpleWebAuthn passkey login challenge generation with email only, without revealing whether the submitted email exists.                                                                                                                                                                                                                                          |
| `POST /api/auth/login/verify`                                                         | Public SimpleWebAuthn assertion verification with email, challenge, and response; creates an embedded session after matching an active same-practice credential.                                                                                                                                                                                                         |
| `POST /api/auth/logout`                                                               | Revokes the current embedded session and clears the session cookie.                                                                                                                                                                                                                                                                                                      |
| `GET /api/auth/session`                                                               | Current embedded-auth session user.                                                                                                                                                                                                                                                                                                                                      |
| `POST /api/client-portal/accounts`                                                    | Staff account setup for a visible matter contact: creates or reuses a `client_external` user and active portal grant, may return one password setup token, and records redacted account/grant audit metadata.                                                                                                                                                            |
| `GET /api/client-portal/workspace`                                                    | Logged-in `client_external` workspace summary over active contact-matched portal grants and existing portal-adjacent records. It returns action/status summaries only and excludes raw tokens, storage keys, message bodies, broad document browsing, chat, payments, and mobile-native behavior.                                                                        |
| `POST /api/auth/password-setup-tokens`                                                | Owner-admin password setup token creation for local invitation/setup flows.                                                                                                                                                                                                                                                                                              |
| `POST /api/auth/password-setup`                                                       | Consumes a setup token and stores a local password hash without requiring a firm ID in the public payload.                                                                                                                                                                                                                                                               |
| `POST /api/auth/recovery-codes/generate`                                              | Authenticated recovery-code issuance for the current embedded-auth user.                                                                                                                                                                                                                                                                                                 |
| `POST /api/auth/recovery-codes/verify`                                                | Public recovery-code verification with email and code only; consumes one unused code and creates an embedded session.                                                                                                                                                                                                                                                    |
| `POST /api/auth/register/options`                                                     | Authenticated SimpleWebAuthn registration challenge creation for the current embedded-auth user.                                                                                                                                                                                                                                                                         |
| `POST /api/auth/register/verify`                                                      | Authenticated passkey registration verification and credential persistence for the current user; the request uses the authenticated session context rather than public firm fields.                                                                                                                                                                                      |
| `GET /api/auth/credentials`                                                           | Authenticated listing of the current user's passkey credentials.                                                                                                                                                                                                                                                                                                         |
| `DELETE /api/auth/credentials/:id`                                                    | Authenticated same-firm passkey credential disable/delete action.                                                                                                                                                                                                                                                                                                        |
| `POST /api/auth/mfa/enable`                                                           | Enables MFA for the current user after confirming at least one active passkey exists.                                                                                                                                                                                                                                                                                    |
| `POST /api/auth/mfa/disable`                                                          | Disables MFA for the current user without deleting passkey credentials.                                                                                                                                                                                                                                                                                                  |
| `GET /api/session`                                                                    | Current authenticated user.                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/capabilities`                                                               | Permission-aware dashboard sections for the current user and first assigned matter.                                                                                                                                                                                                                                                                                      |
| `GET /api/overview`                                                                   | Firm overview metrics for owner/auditor readers; matter-scoped readers receive assigned-matter metrics and only their own user summary.                                                                                                                                                                                                                                  |
| `GET /api/matters`                                                                    | Matters visible to the current user, including redacted activity entries, document metadata used by the matter activity/file command center, and read-only `setupProfile` cues. Owner-admin and auditor readers receive firm matters even without assignment rows; matter-scoped users remain assignment-limited.                                                        |
| `POST /api/matters`                                                                   | Creates an internal first/starter matter for users with `matter:create`: server-generated matter/contact/party IDs, date-based matter number, intake status, prospective-client party, current-user assignment, and safe audit metadata only. Client details stay in contact/party records and out of audit metadata.                                                    |
| `GET /api/contacts/dossiers`                                                          | Read-only contact dossiers derived from visible matter-party links, active portal grants, aliases, identifiers, adverse/confidential cues, persistent contact relationship records, CRM taxonomy labels, quality-review signals, and redacted conflict-check history.                                                                                                    |
| `GET /api/contacts/review-queue`                                                      | Audit-safe contact review queue over visible dossiers, with duplicate, protected-party, and conflict-revalidation counts but no merge automation.                                                                                                                                                                                                                        |
| `GET /api/contacts/data-quality-resolutions?contactId=&matterId=`                     | Lists append-only reviewer decisions for visible contact data-quality signals to contact readers without returning signal matched values or broadening matter/contact scope.                                                                                                                                                                                             |
| `POST /api/contacts/data-quality-resolutions`                                         | Records a reviewer decision for one visible contact data-quality signal with safe audit metadata only; it does not merge contacts, rewrite records, or mutate conflict posture.                                                                                                                                                                                          |
| `GET /api/legal-clinic/programs`                                                      | Firm-scoped clinic programs with provider-neutral eligibility/referral defaults.                                                                                                                                                                                                                                                                                         |
| `POST /api/legal-clinic/programs`                                                     | Creates a firm-scoped clinic program and records redacted program audit metadata.                                                                                                                                                                                                                                                                                        |
| `GET /api/legal-clinic/fiscal-host-workflow?matterId=`                                | Matter-scoped fiscal-host workflow selector over existing clinic program/profile context, sanitized fiscal-host/restricted-fund metadata, restricted-fund review prompts, cautious reporting surfaces, and reuse points. It does not create accounting records, reports, or trust ledger postings.                                                                       |
| `GET /api/legal-clinic/profiles?matterId=`                                            | Lists the authorized matter's clinic profile as an empty or single-item profile array.                                                                                                                                                                                                                                                                                   |
| `PUT /api/legal-clinic/profiles/:matterId`                                            | Upserts the authorized matter's clinic profile and records redacted eligibility/referral audit metadata.                                                                                                                                                                                                                                                                 |
| `POST /api/conflicts/check`                                                           | Conflict search with audit recording for prospective names, aliases, identifiers, and party role.                                                                                                                                                                                                                                                                        |
| `GET /api/ledger?matterId=`                                                           | Trust ledger accounts, entries, posted transactions, and balances. Matter-scoped users must provide matter ID.                                                                                                                                                                                                                                                           |
| `GET /api/ledger/controls?matterId=`                                                  | Read-only trust controls workbench payload with ledger balances, approvals, reconciliations, diagnostics, and cautious trust-control policy. Matter-scoped users must provide matter ID.                                                                                                                                                                                 |
| `GET /api/ledger/reports/jurisdictional-trust?jurisdiction=`                          | Firm-wide, read-only aggregate trust report grouped by matter jurisdiction. It exposes counts and totals only; downloadable exports are requested through the reports job lifecycle and remain explicitly not jurisdiction-certified.                                                                                                                                    |
| `POST /api/ledger/reports/jurisdictional-trust/export-requests`                       | Creates a jurisdictional trust export request using the existing reports job lifecycle with redacted job/audit metadata and poll/download links.                                                                                                                                                                                                                         |
| `GET /api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId`           | Reads one jurisdictional trust export request status after trust-ledger export authorization.                                                                                                                                                                                                                                                                            |
| `GET /api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId/download`  | Downloads a completed jurisdictional trust export by regenerating the authorized aggregate report projection at request time instead of storing report bodies in job metadata.                                                                                                                                                                                           |
| `POST /api/ledger/transactions`                                                       | Balanced, idempotent trust transaction posting.                                                                                                                                                                                                                                                                                                                          |
| `GET /api/audit`                                                                      | Firm audit events, hash-chain validity, and additive taxonomy summary counts without metadata values.                                                                                                                                                                                                                                                                    |
| `POST /api/audit/export-requests`                                                     | Creates an audit export job request with redacted job metadata and poll/download links.                                                                                                                                                                                                                                                                                  |
| `GET /api/audit/export-requests/:exportJobId`                                         | Reads one audit export request status after audit-export authorization.                                                                                                                                                                                                                                                                                                  |
| `GET /api/audit/export-requests/:exportJobId/download`                                | Downloads a completed audit export with event metadata keys and taxonomy summaries, not raw metadata values.                                                                                                                                                                                                                                                             |
| `GET /api/documents/presign-upload`                                                   | S3 PUT upload intent, storage key, document intent record, and required scan marker.                                                                                                                                                                                                                                                                                     |
| `POST /api/documents/:id/upload-complete`                                             | Checksum and scan-state completion for an upload intent.                                                                                                                                                                                                                                                                                                                 |
| `POST /api/documents/:id/scan-status`                                                 | Explicit malware/scan-state update for an existing document.                                                                                                                                                                                                                                                                                                             |
| `GET /api/signature-requests?matterId=`                                               | Signature requests visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                                         |
| `POST /api/signature-requests`                                                        | Provider-neutral signature submission, initial provider event, and confirmation-gated SMTP signer email queueing.                                                                                                                                                                                                                                                        |
| `POST /api/signature-requests/provider-events`                                        | Authenticated legacy/provider-neutral status event for matching provider/external IDs.                                                                                                                                                                                                                                                                                   |
| `POST /api/signature-requests/:id/embedded-events`                                    | Embedded signature viewed/completed/declined event with consent/evidence capture.                                                                                                                                                                                                                                                                                        |
| `GET /api/signature-requests/:id/events`                                              | Provider event history for one signature request.                                                                                                                                                                                                                                                                                                                        |
| `GET /api/signature-requests/:id/evidence-packet`                                     | Staff-only redacted signature evidence packet with signer roles, linked document ID, status timeline, and allow-listed evidence reference keys without signer email, consent text, IP, or user agent.                                                                                                                                                                    |
| `GET /api/intake-sessions?matterId=`                                                  | Intake templates, including embedded definition metadata, and sessions visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                     |
| `POST /api/intake-sessions`                                                           | Embedded intake session record, with Open Practice remaining system of record and confirmation-gated SMTP staff notice.                                                                                                                                                                                                                                                  |
| `GET /api/intake-sessions/:id/answer-snapshots`                                       | Answer snapshots for one intake session.                                                                                                                                                                                                                                                                                                                                 |
| `POST /api/intake-sessions/:id/answer-snapshots`                                      | Captured intake answers plus computed embedded resolution for visible questions, matched branch rules, eligible packages, and package summaries.                                                                                                                                                                                                                         |
| `POST /api/intake-sessions/:id/generated-documents`                                   | Generated document metadata tied to an intake session, with confirmation-gated SMTP staff notice.                                                                                                                                                                                                                                                                        |
| `POST /api/intake-sessions/:id/generated-packages`                                    | Generated document records, package runtime replay proof, and confirmation-gated SMTP availability summary for an eligible embedded intake package.                                                                                                                                                                                                                      |
| `POST /api/intake-templates`                                                          | Creates an embedded V1/V2 intake template definition after validation and audit recording.                                                                                                                                                                                                                                                                               |
| `POST /api/intake-templates/preview`                                                  | Staff-only non-persistent QA preview for intake template definitions; validates and renders preview data without creating templates, sessions, snapshots, documents, jobs, or audit events.                                                                                                                                                                              |
| `PATCH /api/intake-templates/:id`                                                     | Updates an embedded intake template definition without accepting legacy external providers.                                                                                                                                                                                                                                                                              |
| `GET /api/intake-templates/:id/qa-preview`                                            | Staff-only intake-template QA report with branch preview paths, required item coverage, broken signature document reference cues, and no public token material.                                                                                                                                                                                                          |
| `GET /api/intake-form-links?matterId=&intakeSessionId=`                               | Lists token-hashed form links plus upload/signature item actions without returning token hashes.                                                                                                                                                                                                                                                                         |
| `POST /api/intake-form-links`                                                         | Creates an expiring token-hashed client form link, returns the raw token plus public portal URL once, and can queue one confirmed token email.                                                                                                                                                                                                                           |
| `POST /api/intake-form-links/:id/revoke`                                              | Revokes an active matter-scoped client form link.                                                                                                                                                                                                                                                                                                                        |
| `GET /api/intake-form-links/:id/review`                                               | Staff-only submitted intake review load for the linked answer snapshot, item actions, and review decision history.                                                                                                                                                                                                                                                       |
| `POST /api/intake-form-links/:id/review/accept`                                       | Records an accepted submitted-intake review decision and closes the review task without applying variable proposals.                                                                                                                                                                                                                                                     |
| `POST /api/intake-form-links/:id/review/reject`                                       | Records a rejected submitted-intake review decision with a required reason and closes the review task without applying variable proposals.                                                                                                                                                                                                                               |
| `POST /api/intake-form-links/:id/review/request-more-info`                            | Records a follow-up decision, creates a child token-hashed form link, and returns the raw follow-up token and URL once.                                                                                                                                                                                                                                                  |
| `GET /api/intake-variable-proposals?matterId=&status=`                                | Lists pending/approved/rejected staff-reviewed client/matter variable proposals created from public form answers.                                                                                                                                                                                                                                                        |
| `POST /api/intake-variable-proposals/:id/approve`                                     | Applies one pending proposal to the allowed client or matter field and records reviewer evidence.                                                                                                                                                                                                                                                                        |
| `POST /api/intake-variable-proposals/:id/reject`                                      | Rejects one pending proposal with a required reviewer reason.                                                                                                                                                                                                                                                                                                            |
| `GET /api/intake-pipeline`                                                            | Staff-only intake pipeline projection over public consultation and intake-session records with lead statuses, source attribution, conflict-review posture, safe request/appointment links, and conversion counts. Reporting omits requester email, request bodies, raw source/interview URLs, intake tokens, and appointment titles.                                     |
| `GET /api/public-consultation-intakes/settings`                                       | Staff read of the firm public-consultation notification/origin settings stored as provider-setting kind `public_intake`.                                                                                                                                                                                                                                                 |
| `PUT /api/public-consultation-intakes/settings`                                       | Staff update for public-consultation enabled state, allowed website origins, sender address, recipient emails, and optional review owner.                                                                                                                                                                                                                                |
| `GET /api/public-consultation-intakes?status=`                                        | Staff review queue for pending, converted, or dismissed public consultation submissions.                                                                                                                                                                                                                                                                                 |
| `POST /api/public/consultation-intakes`                                               | Unauthenticated, origin-restricted, rate-limited public consultation submission that requires disclosure acceptance, absorbs honeypot submissions, creates a pending public-intake record only, and may queue a redacted staff notification through the SMTP-gated outbox helper.                                                                                        |
| `POST /api/public-consultation-intakes/:id/dismiss`                                   | Staff dismissal for a pending public consultation intake with reviewer metadata and no matter creation.                                                                                                                                                                                                                                                                  |
| `POST /api/public-consultation-intakes/:id/convert`                                   | Staff conversion of a pending public consultation intake into an intake-status matter, prospective-client contact/party, opposing-party contacts/parties, and a link back to the source public intake submission.                                                                                                                                                        |
| `GET /api/portal/intake-forms/:token`                                                 | Public token-scoped form load with sanitized link metadata, template definition, item actions, and access logging.                                                                                                                                                                                                                                                       |
| `POST /api/portal/intake-forms/:token/submit`                                         | Public answer submission that gates required items, accepts an optional `clientSubmissionId` for idempotent browser retries, creates an answer snapshot, links it to the form link, creates a review task/queue signal, and creates pending proposals only.                                                                                                              |
| `POST /api/portal/intake-forms/:token/items/:itemId/uploads`                          | Public token-scoped S3 upload intent for an intake upload item, including accepted MIME-type validation.                                                                                                                                                                                                                                                                 |
| `POST /api/portal/intake-forms/:token/items/:itemId/documents/:id/complete`           | Public checksum completion for an intake upload item document.                                                                                                                                                                                                                                                                                                           |
| `POST /api/portal/intake-forms/:token/items/:itemId/signature`                        | Public embedded attestation fallback or document-backed signature request creation for an intake signature item.                                                                                                                                                                                                                                                         |
| `POST /api/ledger/transactions/:id/approvals`                                         | Maker-checker approval decision for a trust transaction boundary.                                                                                                                                                                                                                                                                                                        |
| `POST /api/ledger/reconciliations/preview`                                            | Firm-wide, review-only trust statement import preview that dedupes statement rows and proposes matches to existing ledger entries for a trust asset account. It does not post ledger entries, create reconciliation records, or emit audit events.                                                                                                                       |
| `GET /api/ledger/reconciliations/import-batches?accountId=`                           | Lists firm-wide persistent statement import batch metadata for one trust asset account, including source label, checksum, row counts, duplicate count, status, optional matching profile ID, creator, and timestamp. Statement rows and evidence bodies are not stored on this record.                                                                                   |
| `POST /api/ledger/reconciliations/import-batches`                                     | Records firm-wide statement import batch metadata for an existing trust asset account with safe audit metadata only. It does not post ledger entries, create reconciliation records, approve transactions, move funds, store statement rows, or store statement evidence.                                                                                                |
| `GET /api/ledger/reconciliation-exception-resolutions?accountId=`                     | Lists firm-wide staff resolution records for unmatched statement-preview rows on one trust asset account.                                                                                                                                                                                                                                                                |
| `POST /api/ledger/reconciliation-exception-resolutions`                               | Records a staff resolution note and variance decision for an unmatched statement-preview row with redacted audit metadata only. It does not post ledger entries, create reconciliation records, move funds, or certify accounting conclusions.                                                                                                                           |
| `POST /api/ledger/reconciliations`                                                    | Trust-account reconciliation record with imported statement rows, row-level matched/unmatched review decisions, immutable beginning/ending balance snapshots, and variance explanation.                                                                                                                                                                                  |
| `GET /api/queues`                                                                     | Permission-aware operational queues for matters, documents, signatures, intake, ledger, task deadlines, and audit review.                                                                                                                                                                                                                                                |
| `GET /api/tasks/workbench?matterId=`                                                  | Matter-scoped task/deadline projections, my/team counters, matter/contact queues, and focused overdue, today, upcoming, and unassigned task IDs.                                                                                                                                                                                                                         |
| `PATCH /api/tasks/:taskId/complete`                                                   | Completes one authorized matter task/deadline and records audit-safe completion metadata.                                                                                                                                                                                                                                                                                |
| `GET /api/operational-views`                                                          | Built-in matter-scoped operational view definitions and redacted results for stale matters, awaiting work, portal-token activity/anomalies, expiring public links, conflict cues, and overdue deadlines. Portal activity rows are review-only and expose normalized outcomes, reasons/statuses, counts, timestamps, matter IDs, and non-secret resource IDs only.        |
| `GET /api/operational-views/definitions?surface=`                                     | Owner-private saved operational view definitions for `queues` and `matters` dashboard surfaces, filtered by the current user's permission scopes.                                                                                                                                                                                                                        |
| `POST /api/operational-views/definitions`                                             | Create an owner-private saved operational view definition for a permitted dashboard surface; dashboard matter preset filters accept only follow-up, risk-review, and action-required preset families, and missing, empty, or unsupported matter preset families are rejected.                                                                                            |
| `PATCH /api/operational-views/definitions/:id`                                        | Update an owner-private saved operational view definition after rechecking permission scopes; patched dashboard matter preset filters use the same allowed-family guard as creation.                                                                                                                                                                                     |
| `POST /api/operational-views/definitions/:id/archive`                                 | Archive an owner-private saved operational view definition without showing it in active dashboard lists.                                                                                                                                                                                                                                                                 |
| `GET /api/time-entries?matterId=&status=`                                             | Time entries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                                               |
| `POST /api/time-entries`                                                              | Time-entry capture with performed date, immutable rate snapshot, draft billing status, billing-period lock checks, and rate-rule resolution when `rateCents` is omitted.                                                                                                                                                                                                 |
| `POST /api/time-entries/timer-drafts`                                                 | Local timer start/stop capture that resolves draft minutes and rate snapshots, always creates draft time entries, and rejects timer windows that overlap locked billing periods.                                                                                                                                                                                         |
| `PATCH /api/time-entries/:id`                                                         | Draft/submitted time-entry edits before billing or write-off, blocked when the existing or requested performed date is inside a locked billing period.                                                                                                                                                                                                                   |
| `POST /api/time-entries/:id/submit`                                                   | Move a draft time entry to submitted unless the performed date is inside a locked billing period.                                                                                                                                                                                                                                                                        |
| `POST /api/time-entries/:id/approve`                                                  | Approve a submitted time entry for invoicing unless the performed date is inside a locked billing period.                                                                                                                                                                                                                                                                |
| `POST /api/time-entries/:id/write-off`                                                | Mark an unbilled time entry as written off unless the performed date is inside a locked billing period.                                                                                                                                                                                                                                                                  |
| `GET /api/expense-entries?matterId=&status=`                                          | Expense entries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                                            |
| `POST /api/expense-entries`                                                           | Expense capture with incurred date, immutable amount snapshot, draft billing status, and billing-period lock checks.                                                                                                                                                                                                                                                     |
| `POST /api/expense-entries/review-drafts`                                             | Review-only expense category/profile capture that always creates draft expense entries and rejects incurred dates inside locked billing periods.                                                                                                                                                                                                                         |
| `PATCH /api/expense-entries/:id`                                                      | Draft/submitted expense-entry edits before billing or write-off, blocked when the existing or requested incurred date is inside a locked billing period.                                                                                                                                                                                                                 |
| `POST /api/expense-entries/:id/submit`                                                | Move a draft expense entry to submitted unless the incurred date is inside a locked billing period.                                                                                                                                                                                                                                                                      |
| `POST /api/expense-entries/:id/approve`                                               | Approve a submitted expense entry for invoicing unless the incurred date is inside a locked billing period.                                                                                                                                                                                                                                                              |
| `POST /api/expense-entries/:id/write-off`                                             | Mark an unbilled expense entry as written off unless the incurred date is inside a locked billing period.                                                                                                                                                                                                                                                                |
| `GET /api/invoices?matterId=&status=`                                                 | Invoice summaries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                                          |
| `POST /api/invoices`                                                                  | Create a draft invoice from approved unbilled time/expense entries and optional adjustment lines, rejecting source entries already linked to a non-void invoice.                                                                                                                                                                                                         |
| `GET /api/invoices/:id`                                                               | Invoice detail with immutable line, tax, total, payment, and balance snapshots.                                                                                                                                                                                                                                                                                          |
| `POST /api/invoices/:id/approve`                                                      | Approve a draft invoice and mark source time/expense entries as billed.                                                                                                                                                                                                                                                                                                  |
| `POST /api/invoices/:id/issue`                                                        | Issue an approved invoice without changing stored line snapshots.                                                                                                                                                                                                                                                                                                        |
| `POST /api/invoices/:id/void`                                                         | Void an unpaid invoice while preserving source and audit evidence.                                                                                                                                                                                                                                                                                                       |
| `GET /api/payments?matterId=&invoiceId=`                                              | Manual payments and allocations visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                            |
| `POST /api/payments`                                                                  | Record a manual payment allocation; over-allocation is rejected and invoice balance/status is recalculated.                                                                                                                                                                                                                                                              |
| `GET /api/billing/trust-transfer-requests?matterId=&status=`                          | Trust-transfer-request records visible firm-wide or across assigned matters.                                                                                                                                                                                                                                                                                             |
| `POST /api/billing/trust-transfer-requests`                                           | Create a billing-side request to pay an invoice from trust; this does not post ledger transactions.                                                                                                                                                                                                                                                                      |
| `POST /api/billing/trust-transfer-requests/:id/approve`                               | Approve a pending trust-transfer request after checking invoice balance, matter trust balance, and matter-scoped trust approval access. Approval records reviewer evidence but does not post trust ledger transactions.                                                                                                                                                  |
| `POST /api/billing/trust-transfer-requests/:id/reject`                                | Reject a pending trust-transfer request with reviewer evidence and safe audit metadata without posting or linking trust ledger transactions.                                                                                                                                                                                                                             |
| `POST /api/billing/trust-transfer-requests/:id/link`                                  | Link an approved trust-transfer request to an existing matching trust ledger transaction for the same matter/client context. Linkage is evidence/reference only and never creates ledger entries.                                                                                                                                                                        |
| `GET /api/billing/dashboard`                                                          | Billing dashboard payload for approved unbilled work, draft/submitted capture-review rows, review-only expense category profiles, draft invoices, issued balances, payments, period-lock summaries, and rate-rule summaries.                                                                                                                                             |
| `GET /api/billing/period-locks`                                                       | Lists firm-scoped billing period locks with start-inclusive/end-exclusive ranges.                                                                                                                                                                                                                                                                                        |
| `POST /api/billing/period-locks`                                                      | Creates one firm-scoped billing period lock and records safe audit metadata; existing invoice lifecycle actions over already selected entries may continue.                                                                                                                                                                                                              |
| `GET /api/billing/rate-rules`                                                         | Lists firm-scoped billing rate rules used for time-entry rate resolution.                                                                                                                                                                                                                                                                                                |
| `POST /api/billing/rate-rules`                                                        | Creates one non-overlapping active billing rate rule at a single specificity, from firm default through matter-plus-user.                                                                                                                                                                                                                                                |
| `POST /api/billing/export-requests`                                                   | Creates a billing export request using the existing reports job lifecycle with redacted job/audit metadata and poll/download links.                                                                                                                                                                                                                                      |
| `GET /api/billing/export-requests/:exportJobId`                                       | Reads one billing export request status after billing-export authorization.                                                                                                                                                                                                                                                                                              |
| `GET /api/billing/export-requests/:exportJobId/download`                              | Downloads a completed billing export by regenerating the authorized projection at request time instead of storing report bodies in job metadata.                                                                                                                                                                                                                         |
| `GET /api/reports/workspace`                                                          | Staff-only reporting workspace with saved report definitions, filter and grouping metadata, export profiles, recent export history, and first projections for invoice aging, reconciliation freshness, productivity, and operational follow-up.                                                                                                                          |
| `POST /api/reports/export-requests`                                                   | Creates one staff report export request through the existing reports job lifecycle with bounded report/profile/grouping metadata and no report body storage.                                                                                                                                                                                                             |
| `GET /api/reports/export-requests/:exportJobId`                                       | Reads one staff report export request status after report-export authorization.                                                                                                                                                                                                                                                                                          |
| `GET /api/reports/export-requests/:exportJobId/download`                              | Downloads a completed staff report export by regenerating the authorized projection at request time instead of storing rows or raw report output in job metadata.                                                                                                                                                                                                        |
| `GET /api/calendar/events?matterId=&startsAfter=&startsBefore=`                       | Matter-scoped calendar events, manual reminder-state records, read-only scheduling request summaries, CalDAV, iCalendar subscription URLs, and meeting-boundary status for the dashboard. Scheduling summaries expose safe linked task/event/reminder posture, source labels, owner/privacy cues, and bounded time-capture posture only.                                 |
| `POST /api/calendar/events`                                                           | Creates one authorized matter-scoped staff calendar event with provider-neutral event metadata and redacted audit evidence.                                                                                                                                                                                                                                              |
| `PATCH /api/calendar/events/:eventId`                                                 | Updates one authorized matter calendar event title, range, status, description, or location while preserving attendee, reminder, sync, and meeting-link children.                                                                                                                                                                                                        |
| `POST /api/calendar/events/:eventId/cancel`                                           | Cancels one authorized matter calendar event by setting `status=cancelled`, incrementing sequence, and recording redacted lifecycle audit metadata.                                                                                                                                                                                                                      |
| `POST /api/calendar/events/:eventId/reschedule`                                       | Reschedules one authorized matter calendar event, increments sequence, and reopens cancelled events to confirmed unless a status is explicitly supplied.                                                                                                                                                                                                                 |
| `POST /api/calendar/events/:eventId/reminders`                                        | Creates one manual dashboard reminder-state record for an authorized matter event and, when matching email `deliveryConfirmation` opts into delivery, queues a delayed reminder notification without touching attendee or invitation state.                                                                                                                              |
| `PATCH /api/calendar/events/:eventId/reminders/:reminderId`                           | Updates one manual reminder's due time, dashboard channel, status, or note and only reuses the reminder notification boundary when matching email `deliveryConfirmation` opts into delivery while the reminder transitions into a pending state.                                                                                                                         |
| `DELETE /api/calendar/events/:eventId/reminders/:reminderId?matterId=`                | Soft-deletes one manual reminder-state record for an authorized matter event.                                                                                                                                                                                                                                                                                            |
| `POST /api/calendar/events/:eventId/attendees`                                        | Adds a matter-scoped event attendee with role, response status, and not-yet-sent invitation state.                                                                                                                                                                                                                                                                       |
| `PATCH /api/calendar/events/:eventId/attendees/:attendeeId`                           | Updates an attendee name, email, role, or response status for one authorized matter event.                                                                                                                                                                                                                                                                               |
| `DELETE /api/calendar/events/:eventId/attendees/:attendeeId?matterId=`                | Soft-deletes an attendee from one authorized matter event.                                                                                                                                                                                                                                                                                                               |
| `PATCH /api/calendar/events/:eventId/meeting-link`                                    | Sets a matter-scoped calendar event meeting link to blank, HTTPS external URL, or configured hosted WebRTC room URL; native media/signaling remains deferred.                                                                                                                                                                                                            |
| `GET /api/calendar/events/:eventId/guest-sessions?matterId=`                          | Lists staff-only hosted guest-session summaries, guest-link counts, and redacted guest access states for one authorized hosted meeting event.                                                                                                                                                                                                                            |
| `POST /api/calendar/events/:eventId/guest-sessions`                                   | Creates or reuses a persistent hosted meeting-session record for one authorized hosted, non-cancelled calendar event when guest-token signing is configured.                                                                                                                                                                                                             |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/open`                   | Opens a hosted guest lobby and records redacted meeting-session audit metadata.                                                                                                                                                                                                                                                                                          |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/lock`                   | Locks a hosted guest lobby and records redacted meeting-session audit metadata.                                                                                                                                                                                                                                                                                          |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/end`                    | Ends a hosted guest lobby, revokes active guest access records, and records redacted session/link audit metadata.                                                                                                                                                                                                                                                        |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guest-links`            | Issues one tokenized guest access record, stores only the HMAC token hash, and returns the raw token/status URL once.                                                                                                                                                                                                                                                    |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/admit`  | Admits one waiting guest access record without exposing meeting URLs through the public status page.                                                                                                                                                                                                                                                                     |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/deny`   | Denies one guest access record and records redacted guest-link audit metadata.                                                                                                                                                                                                                                                                                           |
| `POST /api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/revoke` | Revokes one guest access record and records redacted guest-link audit metadata.                                                                                                                                                                                                                                                                                          |
| `POST /api/calendar/events/:eventId/invitations`                                      | Queues confirmed attendee invitation email through the SMTP outbox or marks invitations skipped/disabled when email is unavailable; stored meeting links can be included only when explicitly requested.                                                                                                                                                                 |
| `GET /api/portal/guest-sessions/:token`                                               | Public token-scoped status-only hosted guest-session page data with lobby/session/guest state and counts only; it does not expose matter, attendee, token-hash, or meeting URL details.                                                                                                                                                                                  |
| `POST /api/portal/guest-sessions/:token/check-in`                                     | Public token-scoped guest check-in that moves issued access to waiting only when the lobby is open and the token is unexpired.                                                                                                                                                                                                                                           |
| `GET /api/calendar/matters/:matterId.ics`                                             | Authenticated read-only iCalendar export for one authorized matter calendar.                                                                                                                                                                                                                                                                                             |
| `GET /api/calendar/credentials`                                                       | Current-user CalDAV app-password credentials without password hashes or one-time secrets.                                                                                                                                                                                                                                                                                |
| `POST /api/calendar/credentials`                                                      | Creates a current-user CalDAV app password and returns the generated password only once.                                                                                                                                                                                                                                                                                 |
| `POST /api/calendar/credentials/:id/revoke`                                           | Revokes a current-user CalDAV app password and records audit evidence.                                                                                                                                                                                                                                                                                                   |
| `GET /api/jobs?queueName=`                                                            | Firm-scoped PostgreSQL job lifecycle projection, optionally filtered by queue name including `connectors`, with redacted run summaries, queue status, and queue names; Redis internals are not exposed.                                                                                                                                                                  |
| `GET /api/jobs/health`                                                                | Compact read-only worker health summary over configured, reserved, and not-configured queues, last observed job activity, failed/stalled counts, and degraded/healthy/unknown state without job bodies or sensitive payloads.                                                                                                                                            |
| `GET /api/jobs/:jobId`                                                                | Firm-scoped redacted job-run detail with terminal/retryable state, retry timing, generic error summary, target resource IDs, and safe metadata only.                                                                                                                                                                                                                     |
| `GET /api/connectors?type=&status=`                                                   | Owner/auditor-visible connector registry records with type, key, status, masked secret-reference sentinel metadata, and operational config summaries only.                                                                                                                                                                                                               |
| `POST /api/connectors`                                                                | Creates a firm-scoped provider-neutral connector registry record without accepting raw credential fields.                                                                                                                                                                                                                                                                |
| `PATCH /api/connectors/:connectorId`                                                  | Updates firm-scoped connector display/status/config fields and preserves stored secret references when clients echo the masked unchanged-secret sentinel.                                                                                                                                                                                                                |
| `GET /api/connectors/developer/apps?connectorId=&status=`                             | Owner/auditor-visible integration developer app registrations linked to connector records, with OAuth-style client IDs, scoped endpoint/rate-limit posture, credential counts, subscription counts, and no client secrets.                                                                                                                                               |
| `POST /api/connectors/developer/apps`                                                 | Owner-only integration app registration for an existing connector, with HTTPS redirect/origin guardrails, constrained scopes, regional endpoint cues, documented-only rate-limit posture, and reserved custom-action placeholders.                                                                                                                                       |
| `POST /api/connectors/developer/apps/:appId/credentials`                              | Owner-only scoped API credential record creation for a registered integration app using a worker-resolved secret reference; responses mask the secret reference and do not expose a live API-auth flow.                                                                                                                                                                  |
| `POST /api/connectors/developer/credentials/:credentialId/revoke`                     | Owner-only revocation posture for a scoped integration API credential record, with redacted audit metadata.                                                                                                                                                                                                                                                              |
| `POST /api/connectors/developer/apps/:appId/webhook-subscriptions`                    | Owner-only provider-neutral webhook subscription posture with HTTPS destination validation, allowlisted connector events, destination-host-only response metadata, and masked signing secret references.                                                                                                                                                                 |
| `GET /api/connectors/developer/apps/:appId/delivery-history`                          | Redacted integration delivery history derived from the linked connector outbox and delivery attempts, without raw idempotency keys, destination URLs, signing material, payload bodies, or private attempt metadata.                                                                                                                                                     |
| `GET /api/connectors/outbox?connectorId=&status=`                                     | Firm-scoped connector outbox summaries with idempotency-key presence, retry counters, next-attempt timestamps, lease presence, redacted payload summaries, and redacted delivered/dead-letter outcomes.                                                                                                                                                                  |
| `POST /api/connectors/outbox`                                                         | Creates or returns an idempotent provider-neutral connector outbox row for a registered connector using bounded allowlisted payload summary fields.                                                                                                                                                                                                                      |
| `POST /api/connectors/outbox/:outboxId/retry`                                         | Owner-only confirmed manual retry for failed or dead-letter connector outbox rows, with current-status confirmation, redacted audit metadata, retry-attempt guardrails, and one redacted connector delivery job when configured.                                                                                                                                         |
| `POST /api/connectors/outbox/:outboxId/dead-letter`                                   | Owner-only confirmed manual dead-letter transition for pending, failed, or expired leased connector outbox rows, with current-status confirmation, active-lease guards, and fixed redacted operator metadata.                                                                                                                                                            |
| `GET /api/email/status`                                                               | SMTP provider status from firm provider settings.                                                                                                                                                                                                                                                                                                                        |
| `POST /api/email/previews`                                                            | Matter-scoped render-only email template preview that normalizes recipients and body previews without SMTP, outbox, job, or audit side effects.                                                                                                                                                                                                                          |
| `POST /api/mail/outbox`                                                               | Create or replay a confirmation-gated SMTP outbound email record, queued email event, durable job lifecycle record, audit event, and optional HMAC-hashed delivery receipt token.                                                                                                                                                                                        |
| `GET /api/mail/outbox?matterId=`                                                      | Matter-scoped outbound email delivery history without message bodies or raw receipt tokens.                                                                                                                                                                                                                                                                              |
| `POST /api/mail/outbox/:emailId/retry`                                                | Manually requeues a failed matter-scoped outbound email after confirmation with redacted job and audit metadata.                                                                                                                                                                                                                                                         |
| `GET /api/portal/email-receipts/:token`                                               | Public token-scoped, no-store delivery receipt confirmation page for opt-in outbound email receipt links. It does not record receipt state or expose sessions, recipient lists, message bodies, matter IDs, or email IDs.                                                                                                                                                |
| `POST /api/portal/email-receipts/:token`                                              | Public token-scoped idempotent delivery receipt recording for opt-in outbound email receipt links; returns status without exposing sessions, recipient lists, message bodies, matter IDs, or email IDs.                                                                                                                                                                  |
| `POST /api/outbound-webhooks/test-deliveries`                                         | Provider-neutral outbound-webhook guardrail preview and test-delivery simulation with HTTPS destination validation, event allowlist, signing metadata, and audit.                                                                                                                                                                                                        |
| `GET /api/inbound-email/status`                                                       | Inbound email provider status plus configured inbound addresses without provider secrets; matter-scoped readers see only assigned-matter addresses and no provider key.                                                                                                                                                                                                  |
| `GET /api/inbound-email/messages?matterId=`                                           | Matter-scoped parsed inbound email messages, or firm-wide owner/auditor review queue.                                                                                                                                                                                                                                                                                    |
| `GET /api/inbound-email/messages/:id`                                                 | Matter-scoped parsed inbound email detail with inbound-email attachment records and promoted `documentId` links when present.                                                                                                                                                                                                                                            |
| `GET /api/communications/inbox?matterId=`                                             | Matter-view redacted communications aggregate over inbound email summaries, outbound delivery history, conversation topics, contact cues, channel status, normalized channel history, phone/text note placeholders, and draft-only client-update requests.                                                                                                               |
| `PATCH /api/communications/inbox/inbound-email/:id`                                   | Triage-only update for one inbound email using existing status, labels, matter scope, and constrained `metadata.staffTriage` fields.                                                                                                                                                                                                                                     |
| `POST /api/inbound-email/messages/:id/attachments/:attachmentId/promote-document`     | Explicitly promotes one matter-scoped inbound attachment to a verified document record and optionally queues OCR.                                                                                                                                                                                                                                                        |
| `GET /api/conversation-threads?matterId=`                                             | Lists matter-scoped provider-neutral conversation topic records with retention/export/revocation boundary fields and no message bodies.                                                                                                                                                                                                                                  |
| `GET /api/conversation-threads/:id`                                                   | Reads one authorized conversation topic record after resolving its matter scope.                                                                                                                                                                                                                                                                                         |
| `GET /api/conversation-threads/:id/messages`                                          | Lists authorized matter-scoped message records for one conversation topic; this is persisted record access, not realtime chat or delivery.                                                                                                                                                                                                                               |
| `POST /api/conversation-threads`                                                      | Creates one authorized matter-scoped conversation topic record and records redacted boundary metadata; realtime chat, delivery, notification fan-out, and public notifications remain deferred at thread creation.                                                                                                                                                       |
| `POST /api/conversation-threads/:id/messages`                                         | Creates one authorized message record on an open matter-scoped conversation topic, records staff-only internal notification rows when the thread boundary is `internal_only`, and records redacted audit metadata without realtime chat, public delivery, portal composer behavior, or export creation.                                                                  |
| `PATCH /api/conversation-threads/:id/lifecycle`                                       | Applies a constrained matter-scoped thread lifecycle action for close, reopen, access revocation, or export request without accepting message bodies or producing export artifacts.                                                                                                                                                                                      |
| `POST /api/conversation-threads/:id/export-requests`                                  | Creates a staff-only redacted conversation export request through the existing reports job lifecycle after deriving the thread's matter scope and checking `conversation_thread:export`.                                                                                                                                                                                 |
| `GET /api/conversation-threads/:id/export-requests/:exportJobId`                      | Reads one staff-only conversation export request status for the same authorized thread/job pair.                                                                                                                                                                                                                                                                         |
| `GET /api/conversation-threads/:id/export-requests/:exportJobId/download`             | Downloads a completed staff-only redacted conversation export by regenerating thread/message projections at request time, with message bodies and metadata values redacted.                                                                                                                                                                                              |
| `GET /api/document-processing/status`                                                 | Operator-only OCR document-processing posture behind `provider_setting:read`, with provider/queue/job summaries plus reserved/deferred AI triage, transcription, and media metadata.                                                                                                                                                                                     |
| `PUT /api/document-processing/ocr-provider`                                           | Owner/admin OCR posture control behind `provider_setting:update`; accepts `{ enabled: boolean }` for the firm-scoped local Tesseract provider and returns sanitized document-processing status without provider config or secrets.                                                                                                                                       |
| `GET /api/document-processing/workbench?matterId=`                                    | Matter-scoped document processing workbench with sanitized document states, review-queue counts, queue eligibility, provider/worker status, redacted latest job/extraction summaries, reviewer-only non-mutating suggestion cues including retention-review hints, and review-only metadata search filters/tag cues/OCR posture over OP-authored fields.                 |
| `GET /api/document-assembly/workbench?matterId=`                                      | Read-only matter-scoped document assembly workbench with OP-authored document-set definitions, assembly package status, matter-data population posture, generated-document links, signature-envelope signer order, and field-placement validation summaries without raw populated values, storage keys, signer emails, consent text, signing URLs, or provider evidence. |
| `POST /api/document-processing/documents/:id/queue`                                   | Queues OCR for an authorized verified document only when the local OCR provider is enabled and the OCR worker queue is configured.                                                                                                                                                                                                                                       |
| `GET /api/auth/extensions`                                                            | Redacted embedded-auth status for local password, passkey, MFA, and recovery-code posture, with OIDC/SAML marked as deprecated legacy placeholders.                                                                                                                                                                                                                      |
| `GET /api/shares/status`                                                              | Share-link capability status and create enablement based on token-signing configuration.                                                                                                                                                                                                                                                                                 |
| `GET /api/shares?matterId=`                                                           | Persisted share-link listing with matter-scoped authorization and no token hashes in the response.                                                                                                                                                                                                                                                                       |
| `POST /api/shares`                                                                    | Creates an expiring token-hashed share link, returns the raw token once, and can queue one confirmed token email.                                                                                                                                                                                                                                                        |
| `POST /api/shares/:id/revoke`                                                         | Revokes an existing matter-scoped share link and records audit evidence.                                                                                                                                                                                                                                                                                                 |
| `GET /api/portal/shares/:token`                                                       | Public token-scoped read of eligible shared document metadata with access logging; verification-required links return an email-verification challenge.                                                                                                                                                                                                                   |
| `POST /api/portal/shares/:token/email-verification`                                   | Completes the first email-delivered share-link verification step, then returns eligible shared document metadata while preserving token-hash storage and access-log evidence.                                                                                                                                                                                            |
| `GET /api/external-uploads/status`                                                    | External upload capability status, token-signing signal, and S3 configuration signal.                                                                                                                                                                                                                                                                                    |
| `GET /api/external-uploads?matterId=`                                                 | Persisted external-upload link listing plus external-upload document review state with matter-scoped authorization and no token hashes.                                                                                                                                                                                                                                  |
| `POST /api/external-uploads`                                                          | Creates an expiring token-hashed upload link, returns the raw token once, and can queue one confirmed token email.                                                                                                                                                                                                                                                       |
| `POST /api/external-uploads/:id/revoke`                                               | Revokes an existing matter-scoped external-upload link and records audit evidence.                                                                                                                                                                                                                                                                                       |
| `PATCH /api/external-uploads/documents/:documentId/review`                            | Records an authenticated matter-scoped review decision for an external-upload document without deleting the original record.                                                                                                                                                                                                                                             |
| `GET /api/portal/external-uploads/:token`                                             | Public token-scoped read of safe external-upload link status, remaining upload count, expiry, accepted classification values, and uploaded-document review statuses without exposing matter, firm, staff, storage, review-note, or token-hash details.                                                                                                                   |
| `POST /api/portal/external-uploads/:token/intents`                                    | Public token-scoped S3 PUT upload intent for one external-upload link.                                                                                                                                                                                                                                                                                                   |
| `POST /api/portal/external-uploads/:token/documents/:id/complete`                     | Public token-scoped checksum and scan-state completion for a document upload intent.                                                                                                                                                                                                                                                                                     |
| `GET /api/drafts?matterId=&userId=`                                                   | Matter-scoped structured drafts with TipTap/ProseMirror JSON and sanitized rendered snapshots.                                                                                                                                                                                                                                                                           |
| `POST /api/drafts`                                                                    | Create a structured draft from either TipTap/ProseMirror JSON or an active draft template.                                                                                                                                                                                                                                                                               |
| `GET /api/drafts/:id`                                                                 | Fetch an authorized draft by ID.                                                                                                                                                                                                                                                                                                                                         |
| `PUT /api/drafts/:id`                                                                 | Save structured draft content or rendered snapshot updates and increment the draft version.                                                                                                                                                                                                                                                                              |
| `DELETE /api/drafts/:id`                                                              | Delete an authorized draft record.                                                                                                                                                                                                                                                                                                                                       |
| `POST /api/drafts/:id/exports`                                                        | Export a saved matter-scoped draft to PDF or DOCX through configured object storage, creating verified document metadata plus generated-document metadata.                                                                                                                                                                                                               |
| `GET /api/draft-assist/status`                                                        | Disabled-by-default drafting assist status from firm AI provider settings and injected provider availability.                                                                                                                                                                                                                                                            |
| `GET /api/draft-assist/records?matterId=&draftId=&documentId=`                        | Matter-scoped non-authoritative assist records filtered by matter, draft, or document.                                                                                                                                                                                                                                                                                   |
| `POST /api/drafts/:id/assist`                                                         | Synchronous review-first draft assist suggestion from structured draft text; does not mutate the draft.                                                                                                                                                                                                                                                                  |
| `POST /api/drafts/:id/assist/jobs`                                                    | Queues a review-first async draft assist job on `ai_triage` when AI provider settings, provider injection, and the async assist queue are configured; returns `202` with redacted job metadata only and does not mutate the draft.                                                                                                                                       |
| `POST /api/documents/:id/assist`                                                      | Synchronous document summary assist from completed text extraction; missing extraction returns `409`.                                                                                                                                                                                                                                                                    |
| `POST /api/documents/:id/assist/jobs`                                                 | Queues a review-first async document summary assist job from the latest completed text extraction; missing extraction returns `409`, generated suggestions become normal non-authoritative assist records, and source documents are not mutated.                                                                                                                         |
| `PATCH /api/draft-assist/records/:id/review`                                          | Mark an assist suggestion reviewed or rejected without changing source draft or document records.                                                                                                                                                                                                                                                                        |
| `GET /api/draft-templates?category=&activeOnly=`                                      | List active firm-scoped drafting templates, including seeded operational basics.                                                                                                                                                                                                                                                                                         |
| `POST /api/draft-templates`                                                           | Create a firm-scoped drafting template from structured TipTap/ProseMirror JSON.                                                                                                                                                                                                                                                                                          |

### Outbound Delivery Confirmation

Every API route that can queue recipient email requires an explicit confirmation payload before it
creates or requeues outbox delivery:
`deliveryConfirmation: { confirmed: true, channel: "email", recipientCount }`. Missing or false
confirmation returns `400 SEND_CONFIRMATION_REQUIRED`. A non-email channel or a recipient-count
mismatch returns `400 SEND_CONFIRMATION_MISMATCH`. Confirmation proves the operator or API caller
reviewed delivery intent, but confirmation text, recipient addresses, subjects, bodies, and message
content are not copied into job metadata, audit metadata, or idempotency fingerprints.

This confirmation is required for direct mail outbox create/retry, calendar invitations, signature
request creation, intake-session staff notices, generated-document staff notices, and token email
notification creates for share links, external-upload links, and intake-form links. The token-link
routes require confirmation only when `notificationEmail` is supplied; token-only creates remain
valid without `deliveryConfirmation`.

Open Practice does not currently implement an active SMS sender, SMS provider, or SMS queue. Future
SMS send seams must reuse the same review-before-send contract with an SMS channel and expected
recipient count before queueing provider delivery.

## Deferred Worker And Provider Surfaces

These surfaces remain limited until their persistence, authorization, and worker implementations
land behind the scaffolded provider settings and job lifecycle records. Inbound email parsing now
persists parsed messages and attachment records, inbound status filters recipient addresses by
authorization, staff can explicitly promote matter-scoped inbound attachments to documents, and
verified documents can be handed to the OCR queue only when both the local OCR provider and OCR
queue are configured. OCR is the only actionable document-processing queue in the current API;
document classification on AI triage, transcription, and media queues are reported as
reserved/deferred metadata rather than configurable work. A narrow async draft/document assist
slice may use `ai_triage` for `draft_assist_suggestion` only when an enabled AI provider
setting, an injected `DraftAssistProvider`, and the async assist queue are all configured. Webhook
ingestion, provider delivery setup, automatic document promotion, document classification,
transcription, media processing, and live Ollama/LM Studio adapter work remain deferred.
`GET /api/providers/status` is read-only configuration posture, not a live health probe: it reports
safe provider-setting keys, object-storage configured/not-configured state, BullMQ producer and
reserved worker queue posture, redacted job summaries, and current-user embedded-auth extension
posture without returning provider config, Redis URLs, storage endpoints, credentials, raw worker
errors, storage keys, message bodies, generated text, or auth secrets.

| Surface                              | Purpose                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/providers/status`          | Operator-visible configuration posture for Redis/BullMQ producers, object storage, provider settings, reserved workers, redacted jobs, and auth extensions.   |
| Media transcription jobs             | Deferred route candidate for FFmpeg normalization and Whisper transcription after media authorization and worker governance land.                             |
| Async assistive-drafting worker jobs | Queue-first `draft_assist_suggestion` jobs create existing review-first assist records when locally configured; live Ollama/LM Studio adapters stay deferred. |

The authenticated and public SimpleWebAuthn routes are live embedded-auth routes in the main API
surface above. They remain deployment-gated by the configured RP ID/origin and setup/session secrets;
they are no longer tracked as planned worker/provider routes. Public passkey login resolves the sole
configured practice internally; authenticated passkey registration uses the current session context.

## State Machines

## First-Run Setup And Practice Presets

First-run setup is a minimal workspace bootstrap in the web UI. It asks only for the workspace name,
initial owner name/email, backup password, setup key when required, optional recommended passkey
registration, and the trust/funds operational acknowledgement. `POST /api/setup/complete` also keeps
the fuller setup payload backward-compatible: callers may still provide `businessAddress`, `office`,
`settings`, `selectedPresetIds`, owner `practitionerProfile`, and an optional `firstMatter`.

When those fuller fields are omitted, the API creates editable operational defaults: BC as the
default province, a blank Canadian business address, owner email as the office email, a blank office
phone, `General practice`, a firm-name-derived invoice prefix, 30-day payment terms, and `Trust
account`. Detailed practice settings are post-setup configuration rather than first-run blockers.

If `selectedPresetIds` are supplied, Open Practice seeds the basic drafting templates plus the
selected preset draft and embedded intake templates. Preset-backed templates store metadata such as
`source=open-practice-preset`, `presetId`, `presetVersion`, supported jurisdictions, practice areas,
and `editable=true`. Intake templates also expose `category`, optional `description`, timestamps, and
metadata so the dashboard can explain and filter operational starter material without relying on
external forms.

Contact dossiers are a read-only `/?section=contacts` dashboard surface backed by
`GET /api/contacts/dossiers`. Dossiers reuse existing contacts, visible matter-party links, active
portal grants, aliases, identifiers, adverse/confidential party cues, additive `qualityReview`
signals, CRM taxonomy labels, and display-safe contact relationship summaries. Relationship graph
summaries expose direction, kind, status, source, conflict-safe label, related contact kind/display
name, and visible matter IDs only; they do not expose `relatedContact.id`, hidden contacts, raw
matched values, contact editing, duplicate merges, automatic conflict changes, external CRM sync, or
cross-scope matter disclosure.

Legal clinic workflow data is modeled as firm-scoped clinic programs plus at most one clinic matter
profile per matter. Program records carry operational status, service area, eligibility summary,
and default referral source/status metadata. Matter profiles carry program linkage,
eligibility/referral statuses, referral source/date, next review date, clinic relationship role,
notes, and redaction-safe metadata. The dashboard treats those records as read-only context: the
Matters section may show a `Clinic workflow` summary and the Intake section may show
`Eligibility and referral` when a profile is returned for the active matter. Mutation UI,
navigation, provider claims, and automatic intake/referral actions remain out of scope for this
foundation slice.

The first fiscal-host workflow slice reuses that legal-clinic context through
`GET /api/legal-clinic/fiscal-host-workflow?matterId=`. The selector is intentionally narrow: it
returns the authorized matter's program relationship posture, a whitelisted fiscal-host summary from
program metadata (`hostName`, `programCode`, `reportingCadence`), a whitelisted restricted-fund
summary from matter-profile metadata (`fundCode`, `purpose`, `reviewStatus`, `nextReviewDate`),
restricted-fund prompts for staff review, cautious operational reporting surfaces, and reuse points
across intake, documents, email, calendar, billing, and trust controls. Malformed or extra metadata
is dropped instead of echoed. It does not persist fiscal-host records, certify restricted fund use,
produce accounting/tax advice, publish client-facing reports, or automatically post trust ledger
entries. Future slices should add persistence, database/API/web tests, and report exports only after
the specific fiscal-host workflow and review boundary are selected.

Dashboard queues are a first-class `/?section=queues` surface. The web shell also exposes active
section state, live workflow status text, skip/focus handling, disabled-section reasons, and a matter
action strip for existing matter-scoped features. These are UI affordances only; API authorization
remains authoritative. Presets and queue labels must remain operational and must not claim
jurisdiction-certified compliance, accounting, tax, trust-account, retention, e-signature, or
legal-records status.

Matter summaries expose a read-only activity timeline through `GET /api/matters`. Activity entries
fold existing matter-scoped audit events, parties/contacts, documents, shares/uploads/access logs,
signatures, intake, generated documents, calendar, tasks, billing, trust requests, ledger postings,
outbound email outbox history, and explicit external-upload document review decisions into one
read surface. Timeline email entries expose only safe delivery summary fields such as template key,
status, counts, related resource IDs, timestamps, and sanitized failure summary; they do not expose
subjects, bodies, recipient addresses, provider message IDs, idempotency keys, or outbox metadata.
External-upload review entries expose only review status/decision/reason, reviewer ID, document ID,
upload link ID, and duplicate/supersession references; they do not expose storage keys, checksums,
review metadata, token hashes, evidence, or uploaded content.

Document upload state starts at `intent_created` with `checksumStatus=pending` and
`scanStatus=pending`. Upload completion moves to `verified` only when the supplied checksum matches
the upload intent. Checksum mismatch moves upload to `rejected`, checksum to `mismatch`, and scan to
`failed`. Matching checksums set checksum to `verified` or `duplicate`; scan becomes the supplied
`pending`, `queued`, `passed`, `failed`, or `not_required` value. Portal sharing remains blocked
unless upload is verified, checksum is verified, scan has passed or is not required, and legal hold is
clear.

Secure share links store only HMAC token hashes. Authenticated v1 creation accepts document-view
shares only, requires matter-scoped `share_link:create` access, a future expiry, and at least one
shareable document. The create response returns the raw token once; when `notificationEmail` is
provided and SMTP is configured, the create flow queues one outbox email while the raw token is
still available. List and revoke responses never expose token hashes. Public share reads resolve the
supplied token to its hash, reject missing, revoked, expired, or email-verification-required links,
filter documents through the same upload/checksum/scan/legal-hold/supersession gates as portal
grants, and record access-log outcomes for granted and denied reads. Upload, message, signature,
and email-verification share flows remain future scoped until those public flows are implemented.

External upload links store only HMAC token hashes. Authenticated creation requires matter-scoped
`external_upload:create` access, configured token signing, configured S3 upload signing, a future
expiry, and a positive upload limit. The create response returns the raw token once; when
`notificationEmail` is provided and SMTP is configured, the create flow queues one outbox email
while the raw token is still available. List and revoke responses never expose token hashes. Public
upload-intent requests resolve the supplied token to its hash, reject missing, revoked, expired, or
fully used links, atomically claim one upload use, create a document upload intent, and return only
the signed PUT URL plus minimal document status fields. Public completion reuses the existing
checksum and scan-state completion rules after verifying the token and document scope. Granted and
denied public reads/writes are recorded in access logs when the link can be resolved.

External-upload documents keep original document rows and storage keys intact through review.
Ordinary internal upload intents have `reviewStatus=not_required`; public external-upload intents
start with `reviewStatus=pending_review`; checksum duplicates keep `pending_review` with a
duplicate pointer; and checksum mismatches move to `retry_requested`. Authenticated reviewers with
matter access can record `accept`, `needs_metadata`, `request_retry`, or `discard` decisions. Those
decisions update only review status, decision/reason fields, reviewer IDs, timestamps, and sanitized
operational metadata; `discard` is a preserved state rather than a destructive delete. Review
transitions append audit events and access-log entries with IDs, status, decision, reason, and
duplicate pointers only.

Idempotent workflow actions use firm-scoped replay keys. Client-provided keys are accepted where a
route exposes `idempotencyKey`; otherwise internal job/outbox helpers derive stable keys from firm,
matter, resource, action, and provider/template scope. Replaying the same key with the same safe
fingerprint returns the existing durable record and does not enqueue another BullMQ job or append a
duplicate audit event. Reusing a key with a different safe fingerprint returns
`409 IDEMPOTENCY_KEY_CONFLICT`. Generated idempotency keys are stored for replay, but route
responses expose only `idempotencyKeyPresent` unless the route already returns a caller-provided
business key such as trust ledger `idempotencyKey`.

Signature requests use provider statuses `draft`, `pending_provider_submission`, `sent`, `viewed`,
`completed`, `declined`, and `provider_error`. Creating a request records the provider submission,
signers, and an initial provider event; when SMTP is configured, the route also queues a
`signature.requested` outbox email to the signer addresses. Provider events update the request
status, set completion or decline timestamps for terminal statuses, and preserve terminal statuses
against out-of-order non-terminal events. Embedded signature events capture signer consent text,
actor ID, IP, user-agent, timestamps, and caller-provided evidence. Legacy `docuseal` requests
remain historical records and are rejected by embedded event routes.

Conversation threads are non-real-time matter-scoped topic records. The topic slice stores topic,
status, retention boundary, export state, access-revocation timestamp, notification boundary,
creator/updater IDs, timestamps, and server-owned operational metadata behind `conversation_thread`
authorization. Message records are additive child records under an authorized open thread with kind,
body text, author/user IDs, authored/created timestamps, and server-owned metadata. Message list and
create routes do not queue delivery, realtime events, webhook payloads, public tokens, or public
exports. When a thread's notification boundary is `internal_only`, new message creation also
records staff-only notification rows for users who can read the matter, and those rows track
per-user read/mute posture without public delivery. Message reads are blocked after access
revocation, and new message creation is blocked after the thread retention boundary has expired.
Lifecycle updates are limited
to close, reopen, access revocation, and export-request state. The staff-only export artifact slice
uses the reports job lifecycle for `conversation_thread_export` requests, stores only routing IDs,
counts, queue state, and provenance in job metadata, and regenerates the redacted artifact at
download time. The downloaded artifact includes thread boundary fields and message IDs/kinds,
timestamps, author/user routing fields, body lengths, body-redaction markers, and metadata keys
only; it does not include message bodies, metadata values, public tokens, delivery state, provider
payloads, PDF/DOCX packaging, realtime chat, or external integrations. Audit events include only
thread/message IDs, matter ID, status/boundary state, message kind, body length, author-presence
booleans, notification boundary/counts, job IDs, counts, and enqueue posture; message bodies are
not copied into audit metadata.

Email preview is render-only. `POST /api/email/previews` requires matter-scoped email create access
and returns normalized template key, recipients, subject, sanitized/truncated body preview,
warnings, optional related-resource summary, and explicit `persisted: false` / `queued: false`
delivery flags. It accepts legacy `template` as an alias for `templateKey`, but does not require
SMTP configuration, create outbox records, enqueue BullMQ jobs, store message bodies, or append
audit metadata.

Outbound email queueing is SMTP-provider gated and confirmation-gated. `POST /api/mail/outbox`
requires matter-scoped email create access, an enabled SMTP provider setting, configured
Redis/BullMQ queue access, matching `deliveryConfirmation`, and at least one non-empty text or HTML
body. The route creates the outbox record, queued email event, durable email job lifecycle record,
and BullMQ email job together before returning `queued`. The job payload carries only the outbox ID,
firm ID, optional matter ID, provider, and recipient references only; email bodies stay in the
outbox record rather than job or audit metadata. The worker reads message bodies from the outbox
record, marks delivery `sent` or `failed`, appends provider metadata, and closes the associated job
lifecycle record with success, retry failure, dead letter, or skipped status.

When `POST /api/mail/outbox` includes `receipt: { requested: true, expiresAt?, includeInBody? }`,
Open Practice creates a purpose-scoped public receipt token, stores its HMAC hash, expiry, and
recorded timestamp only in `email_receipt_tokens`, and defaults `includeInBody` to true. Outbox,
job, and audit metadata keep only safe receipt-request posture. The public receipt `GET` endpoint is
a no-store confirmation page and does not record receipt state; `POST` records receipt status
idempotently from the token hash and returns only status fields. Staff history exposes receipt
posture without raw tokens, token hashes, recipient lists, or message bodies.

Delivery history is exposed through the matter-scoped outbox history route without returning HTML or
plain-text bodies. Worker attempt, next-retry, terminal-failure, and provider provenance are recorded
in email event metadata and mirrored into outbox delivery-state fields. Manual retry is allowed only
for failed outbox records; it appends a queued event with retry provenance, creates a fresh email job
lifecycle row, and records an audit event containing only IDs, counts, status, provider, and job
references.

Outbound webhook delivery is preview-only in the first guardrails slice. `POST
/api/outbound-webhooks/test-deliveries` requires firm-level outbound-webhook create access, accepts
only allowlisted event keys, validates an HTTPS destination, rejects localhost and loopback hosts,
and returns a simulated delivery shape with HMAC-SHA256 header metadata. It does not persist a
connector, store a secret value, enqueue a worker job, or make a network request. The audit event
records only the simulated delivery ID, destination scheme/host/port, allowlisted event keys, event
count, signing algorithm/header, and `simulationOnly=true`; raw destination paths, credentials,
payload bodies, and secret values stay out of audit metadata.

V2 intake form `signature` items remain attestation-only when no `documentId` is configured. When
staff configure a `documentId`, the public token-scoped signature item creates an embedded
signature request for that existing matter document, derives the signer from the intake session's
client contact email, records the initial and terminal signature events, and links the
`intake_form_item_actions` row to the resulting signature request. Missing or cross-matter
documents, missing client contacts, and contacts without an email reject before any signature
request or item action is created.

Intake sessions use `created`, `in_progress`, `ready_to_generate`, `completed`, and
`provider_error`. The API creates embedded sessions from embedded templates. Embedded template
records store `definitionVersion` plus provider-neutral JSON definitions with questions, branch
rules, reusable packages, and package document metadata. `GET /api/intake-sessions` returns those
definitions with the template list so clients can render the current embedded intake shape.

Answer snapshots keep the existing request shape, but the response and persisted record include a
computed `resolution` with the template ID/version, visible question IDs, eligible and selected
package IDs, matched branch rule IDs, package summaries, and resolved package document references.
Branch-only questions are visible only after their branch rule matches.
Public form submission links the created answer snapshot back to the submitted form link and creates
a deterministic `intake-review:<formLinkId>` task plus an intake queue item using only link/session
IDs, review status, and generic titles. Public submit accepts an optional `clientSubmissionId`;
exact retries with the same ID and equivalent answers return the original submitted response, while
conflicting retries return `409 INTAKE_FORM_SUBMISSION_CONFLICT` before creating another snapshot,
review task, or proposal set. Staff review decisions are persisted separately from intake variable
proposals: accept/reject/request-more-info records do not apply proposed client or matter field
changes. Request-more-info creates a child form link with only the token hash stored; the raw token
and URL are returned once in that create-time response. Task, queue, and audit metadata must not
include raw answers, raw tokens, token hashes, or client-facing follow-up reason text.
`POST /api/intake-sessions/:id/generated-packages` accepts a package ID and renders package document
records from the latest stored resolution snapshot, so later template edits do not change the
documents selected by a captured answer set. The response includes a `packageRuntime` replay proof
with template/version, answer snapshot ID, matched branch rules, visible question IDs, selected
package IDs, required incomplete item IDs, and generated document IDs/titles only. The response also
includes a `queuedEmail` summary: disabled when no SMTP provider is enabled, or not queued when SMTP
is available but no recipient-specific email action has been requested. When SMTP is configured,
intake session creation and generated-document creation queue staff-facing outbox notices to the
authenticated user. Legacy `docassemble` templates/sessions are rejected for new generation paths.

Intake audit events record only IDs, counts, status, provider, package/document references, and
signature request references. Raw answers, signer details, evidence bodies, storage keys,
checksums, and generated content stay out of audit metadata.

Public consultation intake submissions are a separate pending-review queue, not automatic matter
creation. `POST /api/public/consultation-intakes` is allowlisted as unauthenticated but must pass
the configured website origin policy, the in-memory route rate limit, a blank honeypot field, and a
checked disclosure-acceptance field. Accepted submissions store only the configured firm ID, client
name, email, optional telephone, opposing-party names, brief matter description, source URL,
timestamps, and `pending` status in `public_consultation_intakes`; honeypot submissions return a
generic received response without persistence.

Public consultation settings live in provider-setting kind `public_intake`, key `consultation`.
The setting controls whether the public route is enabled, which website origins may submit, which
sender address and recipient emails are used for staff notifications, and an optional review-owner
user ID. Missing or unreadable settings resolve to disabled, empty defaults: no sender, no
recipients, and no allowed origins. Public intake can be enabled only after the firm-owned setting
explicitly provides a sender address, at least one recipient email, and at least one allowed website
origin. Requests without an `Origin` header or with an unconfigured origin are rejected before
persistence. SMTP credentials still come from the normal deployment provider setup.
Deployments may bootstrap that same firm-owned setting from
`PUBLIC_CONSULTATION_INTAKE_ENABLED`, `PUBLIC_CONSULTATION_INTAKE_SENDER_ADDRESS`,
`PUBLIC_CONSULTATION_INTAKE_RECIPIENT_EMAILS`,
`PUBLIC_CONSULTATION_INTAKE_ALLOWED_ORIGINS`, and
`PUBLIC_CONSULTATION_INTAKE_REVIEW_OWNER_USER_ID`. Supplying only allowed origins opens the CORS
allowlist for the public route but does not overwrite stored notification settings.

When enabled and SMTP/outbox infrastructure is available, public consultation submission queues a
matter-less staff notification through the same outbound email helper used elsewhere. The email
body may contain the submitted details for staff review, but outbox job and audit metadata must
stay redacted to IDs, recipient count, template key, source flags, and provider/job references. Raw
matter descriptions, submitted contact details, opposing-party names, email bodies, and website-origin
headers are not copied into job metadata or audit metadata.

Staff review actions keep the pending queue review-first. Dismissal moves a pending submission to
`dismissed` with reviewer metadata only. Conversion requires staff review and creates an
intake-status matter, prospective-client contact/party, opposing-party contacts/parties, current
user assignment, and a `converted` link back to the source public consultation submission. The
dashboard conflict-check action is a prefilled staff tool; it does not by itself convert,
dismiss, or mutate the submission.

The intake pipeline projection is staff-only and read-only in this slice. `GET /api/intake-pipeline`
combines public consultation submissions, intake sessions, intake form links/reviews, and
matter-scoped calendar event IDs into lead-style records. Lead status is derived from staff-owned
review states: pending website submissions with opposing-party names are marked for conflict review,
dismissed submissions are closed, converted submissions and accepted submitted intake forms count as
conversions, and submitted-but-unreviewed intake forms remain qualified/reviewing. Source
attribution uses safe labels, channels, and URL presence flags; aggregate reporting does not include
requester email addresses, request bodies, raw source/interview URLs, intake token hashes, portal
URLs, raw answers, appointment titles, or appointment locations. The route does not create matters,
send SMS, ingest ad spend, run campaign delivery, or perform marketing automation.

Draft records store structured TipTap/ProseMirror JSON and an optional sanitized rendered HTML
snapshot. New drafts start at version `1`; each save through `PUT /api/drafts/:id` increments the
version and records the updating user. `POST /api/drafts` accepts exactly one seed source:
`editorJson` for direct structured content or `templateId` for an active firm-scoped template. Basic
draft templates are firm-scoped seed records and can be filtered by category while remaining editable
through future template-management workflows.

Draft exports are the first office-suite word-processing slice. `POST /api/drafts/:id/exports`
accepts `format: "pdf" | "docx"` and an optional title, reads only the saved draft version, resolves
the safe server-owned merge fields for firm, matter, and primary client/contact data, and rejects
unknown placeholders before rendering or creating records. Exports require configured S3-compatible
storage. A successful export stores rendered bytes in object storage, creates a verified
matter-scoped document row, creates generated-document metadata with optional `intakeSessionId`, and
records a redacted audit event with IDs, format, checksum, byte length, and draft version only.
Spreadsheet, presentation, external legal-template, intake-answer, and collaboration surfaces remain
deferred.

Document assembly is a read-only first slice over OP-authored metadata. Definitions describe
reusable document sets with source references and required merge-field keys; matter packages track
assembly status, population posture, linked document/generated-document/signature IDs, and envelope
metadata; signature envelopes track signer roles/order plus field-placement validation. The
workbench response returns titles, IDs, roles, counts, statuses, and validation issues only. It does
not return populated matter values, raw generated content, storage keys, signer emails, consent
text, signing URLs, provider evidence, IP addresses, or user-agent values. Third-party template
import, automatic legal drafting, public signing UX rewrites, and copied external forms remain out
of scope.

Ledger posting has no mutable status field. A transaction is accepted only when entries are balanced,
non-zero, one-sided debit/credit rows; all accounts, matters, and clients are valid; the idempotency
key is new or repeats the same request fingerprint; and client-liability balances are not overdrawn.
PostgreSQL persistence also maintains a matter/client trust-balance guard that is updated atomically
with posted client-liability entries so concurrent withdrawals cannot push a persisted balance below
zero. Reversal transactions must reference an existing transaction and exactly mirror the original
entries. Approval and reconciliation records are first-class controls around posting and review, but
they are not jurisdiction-certified compliance claims. Approval records must reference an existing
transaction and one reviewer cannot record duplicate decisions for the same transaction.

Reconciliation records store imported statement rows with row-level matched/unmatched review
decisions, immutable beginning/ending statement-balance snapshots, expected-versus-actual variance,
and a required explanation whenever balances or rows do not match. Matched statement rows must point
at existing ledger entries for the reconciled account; unmatched rows carry no ledger-entry links.

The statement import preview is a non-persistent review aid before reconciliation creation. It
dedupes repeated statement rows by normalized date, amount, description, and reference, proposes
candidate matches against existing entries for the selected trust asset account, and returns a
`review_only_no_automatic_ledger_posting` policy marker. It does not create ledger entries,
reconciliation records, approvals, or audit events.

Reconciliation exception resolution records are immutable staff review notes for unmatched
statement-preview rows. They store a statement-row snapshot with a server-computed duplicate key,
one variance decision, reviewer metadata, and a staff note. Recording a resolution
does not mutate posted ledger entries, create reconciliation records, move funds, or certify
accounting conclusions. Route audit metadata records only account id, statement-row id, variance
decision, and note-presence flags.

The read-only trust controls workbench surfaces existing balances, approval decisions,
reconciliation exceptions, unreconciled accounts, statement-row counts, variance explanations, recent
postings, and invariant diagnostics for operator review. It does not post ledger entries, approve
transactions, create reconciliations, place holds, add accounting dimensions, or claim
compliance-pack coverage.

The jurisdictional trust report is a firm-wide, read-only aggregate over the same trust controls
data. It groups accessible matter balances, approval counts, reconciliation exception counts,
statement-row counts, variance totals, unreconciled-account counts, and overdrawn diagnostics by
matter jurisdiction. The response intentionally omits statement evidence, row descriptions, and
private matter details; its posture is `operational_controls_only_not_jurisdiction_certified`.
Jurisdictional-trust export requests reuse the reports queue lifecycle, store only metadata needed
for status/download authorization, and regenerate the aggregate projection at download time instead
of putting report bodies in job metadata.

The staff reporting workspace is a read-only firm reporting surface backed by OP-authored saved
report definitions. The first definitions cover invoice aging, reconciliation freshness,
productivity, and operational follow-up using structured filter/grouping metadata and two manual
export profiles: summary JSON and review CSV. Export requests reuse the reports queue lifecycle,
store only the definition/profile/grouping IDs, requester/provenance, queue state, and bounded row
counts in job metadata, and regenerate projections for downloads. This slice does not accept custom
SQL, embed BI tools, schedule email delivery, persist raw report bodies, expose payment processor
data, or certify accounting/compliance conclusions.

Billing work treats time and expense capture as pre-invoice operational records. The billing status
is `draft`, `submitted`, `approved`, `billed`, or `written_off`. Draft entries can be edited,
submitted entries can be approved, approved entries can be invoiced, and billed or written-off
records cannot be edited through ordinary patch routes. Rates and expense amounts are stored as
snapshots; approval is not tax advice and does not certify rates, tax treatment, disbursement
handling, or jurisdiction rules.

Invoice records should move through `draft`, `approved`, `issued`, `partially_paid`, `paid`,
and `void`. Invoice creation can reference only approved unbilled source entries that are not
already attached to a non-void invoice and can include manual adjustment lines. Invoice lines store
immutable subtotal, tax name, tax rate in basis points, tax cents, and total snapshots. Approving an
invoice marks source entries `billed`. Payment status is derived from manual payment allocations
against stored invoice totals, not from client-entered text. Voids and corrections should keep the
original invoice visible in the audit trail.

Manual payment records use `received` or `void` status. A manual payment is operator-entered
evidence of funds received or observed; it is not live settlement from a payment processor.
Allocations are stored separately, over-allocation is rejected, and invoice `paidCents`,
`balanceDueCents`, and lifecycle status are recalculated after every allocation. Applying a manual
payment must not automatically post to the trust ledger.

Trust-transfer requests move through `pending_approval`, `approved`, `rejected`, `linked`, and
`cancelled`. These records represent a controlled request to pay an invoice from trust after review.
Approval requires the request to be pending, the invoice to belong to the same matter, the request
amount to fit within the invoice balance due, and the matter trust balance to be sufficient. Approval
does not create trust ledger entries. Rejection closes a pending request without posting or linking.
Linkage requires an approved request and an existing ledger transaction that matches the request's
matter, amount, and client context when present. A ledger transaction can be linked to only one
trust-transfer request. Any trust ledger posting must remain an explicit balanced ledger transaction
with its own idempotency key, actor, evidence, approval/reconciliation records where required, and
reversal path. Optional linkage to a ledger transaction is evidence/reference only.

Audit events are append-only records with hash-chain validation. Conflict checks and other repository
operations that create audit events should preserve firm scoping, actor identity, canonical payloads,
and chain validity. `GET /api/audit` includes a derived taxonomy summary for existing events with
category, resource, matter-scope, actor-hint, and unknown-event counts; the summary is additive and
must not expose raw metadata values.

Workflow audit events use the exported `@open-practice/domain` workflow metadata builder for
high-value mutating flows. The envelope is limited to request ID, actor type/ID, matter scope,
workflow status, before/expected/after status, retry attempt fields, idempotency-key presence, and
safe error summaries. Ledger posting, external-upload review, failed-email retry, and document OCR
queue events use this builder while route-specific repository/auth wiring stays in API code.

Task/deadline records are matter-scoped operational records for assignment, due-date, completion,
and contact/matter queue review. The workbench API returns projected task state, bucketed counters,
and queue groupings only for authorized matters. Completing a task records actor ID, completion
timestamp, and an audit event without changing calendar deadlines, billing entries, or trust state.

Operational views are built-in computed views, not user-persisted saved filters yet. Results must be
derived from matter-scoped data already visible to the authenticated user, and they should expose
redacted IDs/counts/status labels rather than raw tokens, message bodies, contact names, private
notes, or privileged document content.

The communications inbox is a matter-view aggregate, not a new navigation route. It combines
matter-scoped inbound email summaries, redacted outbound delivery history, conversation topic
summaries with message counts/latest-message timestamps and current-user notification posture
summaries, contact dossier cues without notes, derived staff-triage note counts/latest-note
timestamps, consent/channel follow-up state, channel state, a normalized redacted channel-history
timeline, phone/text note placeholders, and draft-only client-update requests derived from explicitly
marked existing conversation message records. It does not expose email bodies, parsed text, raw storage keys,
checksums, provider IDs/tokens, contact notes, private staff-note text, conversation message bodies,
public portal composition, realtime chat, live SMS/text delivery, automatic client-update sends,
retry controls, or new provider setup.
Triage updates stay on existing inbound email rows and accept only status, labels, matter scope,
one internal staff note per update, consent/channel follow-up fields, and constrained
`metadata.staffTriage` fields for staff routing.

`@open-practice/domain` exports the audit event taxonomy used to classify known action names,
expected resource types, matter-scope hints, actor-source hints, and safe metadata keys for operator
summaries. Unknown actions remain valid hash-chain records, but any new audit-producing route or
worker transition should add taxonomy coverage and focused tests before relying on the action in
review queues, summaries, or future enforcement.

Worker jobs use `queued`, `active`, `completed`, `failed`, `dead_letter`, and `skipped`.
PostgreSQL stores the durable job lifecycle record, queue name, BullMQ job ID, target resource,
firm-scoped idempotency key, retry counts, error summary, timestamps, and routing metadata.
Redis/BullMQ delivers work and retry attempts, but the API exposes only the PostgreSQL projection.
`GET /api/jobs` adds queue summaries, `GET /api/jobs/health` returns compact operational health
counts and healthy/degraded/unknown state, and `GET /api/jobs/:jobId` returns redacted run details
for terminal state, failed-step/error context, retry/next-attempt hints, idempotency-key presence,
and metadata keys that are safe for operators.
Error summaries are generic; privileged worker/provider diagnostics stay in server-side logs.
`GET /api/document-processing/status` is firm-wide operator posture guarded by
`provider_setting:read`; `GET /api/document-processing/workbench?matterId=` remains
matter-scoped for document-processing readers. Both reuse the same redacted summaries for
OCR/document-processing state, including provider-disabled, queue-unconfigured, and
reserved/deferred cases. `PUT /api/document-processing/ocr-provider` is owner/admin posture control
for the firm-scoped local Tesseract provider and returns the same sanitized status response without
provider config or secrets. OCR queueing and inbound-email attachment promotion reject before
creating jobs or promoted documents unless the OCR provider is enabled and the OCR queue is
configured. The document-processing projection keeps the broad `supportedTasks` list for
compatibility, adds `actionableTasks: ["ocr"]`, and reports AI triage, transcription, and media
through reserved/deferred queue and task metadata until their provider governance and enqueue
surfaces are implemented. Async assist status and job endpoints are separate from
document-processing classification: `ai_triage` can report configured for
`draft_assist_suggestion` when the async assist queue is injected, while classification remains
reserved/deferred. Job metadata must not carry email bodies, portal tokens, generated content,
storage keys, raw evidence, source text, or private secrets.
The workbench also returns reviewer-only `reviewSuggestions` per visible document. These suggestions
are non-mutating cues for classification review, duplicate/supersession checks, matter/contact
context, missing metadata, and retention review based on legal hold, supersession, upload,
checksum, scan state, and external-upload review state. They are derived from authorized same-matter document
state and whitelisted extraction metadata only; raw extracted text, storage keys, checksums,
provider payloads, tokens, arbitrary metadata values, deletion automation, retention deadlines,
retention-policy eligibility, and jurisdictional compliance claims are never returned. Applying
suggestions, merging documents, changing classification, writing metadata, or deleting documents
remains outside this surface.
Failed or skipped OCR, transcription, email, connector, AI-assist, or media jobs must not change
portal-share, billing, signature, trust, or audit state without an explicit reviewed transition.

Connectors are firm-scoped, provider-neutral registry records. The registry stores connector type,
key, display name, status, optional worker-resolved secret-reference metadata, and redacted
operational config summaries; route reads never return the stored secret-reference ID. They return
only `__open_practice_connector_secret_unchanged__` as the masked sentinel plus non-secret labels,
versions, and rotation timestamps so update clients can preserve existing stored values without
learning them. Connector outbox rows are durable records with
an idempotency key, payload summary, status, max attempts, attempt count, next-attempt timestamp,
and optional lease/error summary fields, but route responses expose idempotency-key and lease
presence rather than raw values. Creating an outbox row is idempotent by firm and idempotency key.
Matching replays return the existing outbox row; conflicting replays return
`IDEMPOTENCY_KEY_CONFLICT`.
The integration developer boundary is an owner-managed layer over those connector records. It
creates OAuth-style app registrations with generated client IDs, HTTPS redirect/origin guardrails,
constrained scopes (`matter.read`, `document.read`, `signature_request.read`,
`intake_session.read`, `invoice.read`, `email_outbox.read`, and `webhook.deliver`), regional
endpoint cues marked `cue_only`, documented rate-limit posture with enforcement reserved, and
reserved custom-action placeholders only. Scoped API credential records store worker-resolved
secret references and return only masked secret metadata. Webhook subscription posture validates
allowlisted connector events and HTTPS destinations, then returns destination hosts rather than full
destination URLs. The developer delivery-history route reads the linked connector outbox and
delivery attempts while withholding raw idempotency keys, signing material, destination URLs,
payload bodies, private attempt metadata, public marketplace behavior, third-party app review, broad
model coverage, live payment-link API exposure, and provider-specific recovery tooling.
The dashboard operations panel may present connector/outbox posture as redacted status: connector
type/key/status/display name, idempotency-key presence, attempt counts, next-attempt time, lease
presence, delivery/dead-letter timestamps, last error summary, and safe payload-summary shape.
Owner-admin users may also request confirmed manual recovery for eligible outbox rows. Retry
requests require `connector:update`, the target outbox ID, `action: "retry"`, `confirmed: true`,
and an expected current status of `failed` or `dead_letter`; accepted rows are reset to `pending`,
their lease/dead-letter/error fields are cleared, `nextAttemptAt` is set to now, exhausted
`maxAttempts` values are bumped only enough to allow one reviewed attempt, and one
`deliver_connectors` job is scheduled with manual-retry idempotency metadata. Manual dead-letter
requests require `connector:update`, the target outbox ID, `action: "dead_letter"`,
`confirmed: true`, and an expected current status of `pending`, `failed`, or `leased`; only pending,
failed, and expired-lease rows are accepted, active leases are rejected, lease and retry timing are
cleared, and the operator summary is a fixed redacted string.
The routes do not expose raw idempotency keys, lease IDs, secret references, webhook signing
material, payload bodies, or free-form private operator details. They reject delivered, cancelled,
ineligible current-status, missing/wrong-firm, disabled/paused connector, and unconfigured connector
queue cases according to the action guard.
Connector delivery worker V1 uses the `connectors` worker queue to lease due outbox rows for
enabled connectors, validate allowlisted event keys and HTTPS destinations from redacted connector
configuration, resolve signing material from worker-only secret configuration by secret-reference
ID, send signed JSON summary envelopes built from safe outbox fields and `payloadSummary`, and
record delivered, retryable failed, or dead-letter outcomes through connector outbox and delivery
attempt rows. Retry error summaries and delivery attempt metadata are sanitized at the repository
boundary so API reads, backup-style repository exports, and later operational exports do not carry
raw tokens, signatures, secret references, private storage paths, or email addresses. It does not
persist raw webhook bodies, expose raw idempotency keys, return signing material, log secrets in job
metadata, replay raw webhook payloads, implement inbound webhook recovery, or implement
provider-specific recovery tooling.

Email outbox records and retry jobs store firm-scoped idempotency keys. Replaying a matching
outbox or retry request returns the existing email/job projection without requeueing; changed safe
payload fields such as recipients, subject, template, related resource, provider, or retry target
conflict. Message bodies are not copied into idempotency metadata.
Signature, intake, public consultation intake, share-link, external-upload, and calendar-invitation
flows reuse the same outbox helper at their route-specific review/confirmation boundary; share,
external-upload, and intake-form notification emails are create-time only because raw tokens are
not recoverable after the response. Public consultation intake staff notices are matter-less and
must keep job/audit metadata redacted to routing IDs and counts. Calendar attendees are stored as
matter-scoped event children with
required/optional role, response status, and invitation state. Invitation attempts are optional:
when SMTP or queue delivery is unavailable, the API records a skipped attendee invitation state
without failing attendee management. `PATCH /api/calendar/events/:eventId/meeting-link` stores
blank, HTTPS external, or configured hosted WebRTC room URLs on the authorized event. Hosted links
require `WEBRTC_MEETING_PROVIDER_KEY` and `WEBRTC_MEETING_BASE_URL`; guest-access capability is
reported as configured only when hosted meeting configuration and token signing are both available.
Invitation requests that include a meeting link require an existing stored link and are rejected
before email delivery state changes when the link is unavailable. The dashboard lets staff save or
clear stored event meeting links and send link invitations only after a link is present. Hosted
guest sessions are persistent records under existing matter-scoped `calendar_event` authorization:
staff can create/reuse one lobby, open, lock, end, issue guest status tokens, and admit, deny, or
revoke guest access. Guest links store HMAC token hashes only; the raw token/status URL is returned
once. Public guest-session pages are status-only and may show lobby state, time bounds, counts, and
the guest access state; they do not expose matter/client details, attendee email, token hashes,
stored meeting URLs, or room identifiers. Actual meeting-link delivery remains the existing calendar
invitation/meeting-link path. Public guest-session responses include only a status-only
meeting-access handoff marker that points admitted guests back to staff-controlled calendar
invitation or handoff workflows and always reports that no meeting URL is available on the public
status page. Native Open Practice media rooms, WebRTC signaling, chat, recordings, temporary room
uploads, and public media previews remain deferred.
Calendar event lifecycle writes are staff-controlled matter-scoped records. Create/update/cancel
and reschedule increment the event sequence whenever an existing event changes, preserve attendees,
reminders, iCalendar/CalDAV export behavior, and stored meeting-link fields, and record audit
metadata with identifiers, status, sequence, counts, and change flags only. Manual reminder records
remain dashboard-state records with `pending`, `acknowledged`, `dismissed`, or `cancelled` status
and the dashboard channel. Pending reminders do not send by default; create/update requests must
include matching email `deliveryConfirmation` to opt into a delayed reminder notification through
the existing email outbox boundary, without adding attendee or invitation state. Calendar audit
metadata records event, reminder, attendee, email, job, meeting-boundary status, and count
identifiers only; invitation message bodies remain in the outbox record and reminder notes are not
copied into audit metadata. Dashboard reminder records remain the source of truth.

Calendar scheduling request records are persistent review records, not automation. The Calendar
matter load returns them only after matter-scoped calendar read access, and linked task/event/reminder
summaries are included only when they stay in the same firm and matter. The summary exposes safe IDs,
dates, source labels, owner assignment, reminder posture, privacy level, and bounded time-capture
counts/minute suggestions when the caller can read time entries. It does not expose reminder notes,
attendee emails, meeting URLs, time narratives, raw source payloads, provider metadata, public room
URLs, media, or private audit metadata. Reviewing those records is metadata-only in this first slice
and does not create tasks, reschedule calendar events, cancel reminders, queue delivery, or create
time entries.

Draft assist is a disabled-by-default scaffold for non-authoritative suggestions.
`GET /api/draft-assist/status` reports disabled when no enabled `ai` provider setting exists or no
provider is injected. Async jobs additionally require the `ai_triage` async assist queue. Configured
draft/document assist creates `draft_assist_records` with provider and model provenance, suggested
plain text, optional summary, review state, source references, and redacted metadata. Draft assist
reads structured TipTap text and never saves draft changes; the dashboard can insert a suggestion
into local editor state, and the existing draft save route remains the only persistence path.
Document assist is limited to `summarize` and requires completed text extraction. Async draft and
document job create routes accept the existing assist body shape plus optional `clientRequestId`, but
this queue-first slice stores only IDs, provider/task provenance, and length/key-count metadata in
PostgreSQL and BullMQ. Workers reload draft text or the latest completed extraction by ID before
calling the injected `DraftAssistProvider`; raw source text, prompt/evidence values, generated text,
storage keys, checksums, and private payloads stay out of job metadata and audit metadata. Generated
text is stored only on the resulting suggested assist record for the existing review flow.

Provider/bootstrap selection is local-first. `DATABASE_URL` selects PostgreSQL unless
`OPEN_PRACTICE_USE_MEMORY_REPO=true` or the database URL is absent. `OPEN_PRACTICE_DEV_SEED=true`
loads seed data. Empty firm/user state exposes first-run setup; partial firm/user state is blocked
until an operator repairs it. Production first-run status is blocked until `OPEN_PRACTICE_SETUP_KEY`
is configured, and completion requires the matching `x-open-practice-setup-key` header.
Non-production setup without a configured key is limited to local/private network access. After
setup, embedded auth blocks sign-in if no practice exists or if more than one practice record is
present, because user-facing auth is intentionally single-tenant.
Signature and intake providers default to embedded
implementations. Public consultation intake notification/origin settings use provider-setting kind
`public_intake` and the existing SMTP provider/outbox path for notification delivery. S3 upload
signing is enabled only when endpoint and credentials are configured.
Redis/BullMQ queues, firm provider settings, job lifecycle records, and disabled-by-default API
scaffolds are implemented for email, AI triage, OCR, transcription, media, draft assist, and auth
extensions. Email, inbound email, OCR, and queue-first async draft assist are actionable queue
families when their providers and queues are configured. AI triage document classification,
transcription, and media remain reserved/deferred queue names until explicit provider governance and
enqueue surfaces are added. Provider-status posture is an operator read surface over configuration
and redacted job lifecycle records; it must not be treated as provider connectivity, credential, or
worker liveness proof.
Secure share-link create/list/revoke plus token-scoped public document metadata reads are
implemented with token hashing, matter-scoped authorization, audit events, and access logs. External
upload link create/list/revoke plus token-scoped S3 intent and completion flows are implemented with
token hashing, matter-scoped authorization, S3-disabled fallbacks, audit events, and access logs.
Client portal account setup is an authenticated staff operation over existing matter contacts and
portal grants. The logged-in client workspace is read-only and summarizes the client's granted
matter actions across existing portal-adjacent records without replacing token-scoped public routes,
exposing raw tokens or storage keys, or adding chat, payments, or native mobile behavior.
Inbound email parsing is implemented for raw messages already stored in object storage, with
matter-scoped message detail and attachment-record reads; provider webhooks and automatic document
promotion remain deferred. Concrete Postal, Tesseract, Whisper/FFmpeg, and live Ollama/LM Studio
adapters still require explicit setup, provider adapters, review states, and deployment profiles.
SimpleWebAuthn passkey routes and TipTap-backed drafting/template routes are embedded app surfaces;
production still must configure RP ID/origin, session secrets, setup keys, authorization, and
retention controls before exposing them. `DOCUSEAL_*`, `DOCASSEMBLE_*`, and `OIDC_*` variables are
deprecated and rejected in production. There is no live payment processor configuration. Future
processor keys, webhooks, and settlement imports should be introduced behind explicit deployment
profiles and reconciliation controls.
