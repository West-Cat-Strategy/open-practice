# API and State Machines

This document records the current API and lifecycle contracts. Keep it aligned with
`apps/api/src/server.ts`, `apps/api/src/routes`, `packages/domain/src/models.ts`,
`packages/domain/src/operations.ts`, `packages/domain/src/signatures.ts`,
`packages/domain/src/ledger.ts`, and `packages/domain/src/billing.ts`.

## API Surface

All `/api/*` routes require authentication except first-run setup status/completion/setup passkey
options, embedded-auth login, password setup, recovery-code verification, public passkey login
options/verification, and token-scoped public portal routes such as `GET /api/portal/shares/:token`
plus external-upload collection links. Production accepts embedded session cookies or
`x-open-practice-session` tokens backed by PostgreSQL session records. Development may use
`x-open-practice-user-id`, `x-open-practice-firm-id`, and bearer JWT helpers. Production rejects
unauthenticated requests, development headers, and bearer JWTs.

The billing lane exposes operational APIs for time, expenses, invoices, manual payments, and
trust-transfer-request records. It does not include live payment processing, jurisdiction-certified
accounting/tax advice, or automatic trust-ledger posting from billing actions.

| Route                                                                             | Purpose                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                                     | Liveness and repository mode (`memory` or `postgres`).                                                                                                                                                                                                                                             |
| `GET /api/setup/status`                                                           | First-run bootstrap status, including blocked partial-state and setup-key requirement flags.                                                                                                                                                                                                       |
| `POST /api/setup/webauthn-options`                                                | Guarded first-run SimpleWebAuthn registration options for the optional owner-admin passkey; requires the setup key when configured.                                                                                                                                                                |
| `POST /api/setup/complete`                                                        | Guarded first-run creation of firm settings, owner admin auth, optional passkey, audit event, and session from either a minimal workspace payload or the fuller legacy setup payload.                                                                                                              |
| `POST /api/auth/login`                                                            | Embedded session login with firm ID, email, and password.                                                                                                                                                                                                                                          |
| `POST /api/auth/login/options`                                                    | Public SimpleWebAuthn passkey login challenge generation without revealing whether the submitted email exists.                                                                                                                                                                                     |
| `POST /api/auth/login/verify`                                                     | Public SimpleWebAuthn assertion verification that creates an embedded session after matching an active same-firm credential.                                                                                                                                                                       |
| `POST /api/auth/logout`                                                           | Revokes the current embedded session and clears the session cookie.                                                                                                                                                                                                                                |
| `GET /api/auth/session`                                                           | Current embedded-auth session user.                                                                                                                                                                                                                                                                |
| `POST /api/auth/password-setup-tokens`                                            | Owner-admin password setup token creation for local invitation/setup flows.                                                                                                                                                                                                                        |
| `POST /api/auth/password-setup`                                                   | Consumes a setup token and stores a local password hash.                                                                                                                                                                                                                                           |
| `POST /api/auth/recovery-codes/generate`                                          | Authenticated recovery-code issuance for the current embedded-auth user.                                                                                                                                                                                                                           |
| `POST /api/auth/recovery-codes/verify`                                            | Public recovery-code verification that consumes one unused code and creates an embedded session.                                                                                                                                                                                                   |
| `POST /api/auth/register/options`                                                 | Authenticated SimpleWebAuthn registration challenge creation for the current embedded-auth user.                                                                                                                                                                                                   |
| `POST /api/auth/register/verify`                                                  | Authenticated passkey registration verification and credential persistence for the current user.                                                                                                                                                                                                   |
| `GET /api/auth/credentials`                                                       | Authenticated listing of the current user's passkey credentials.                                                                                                                                                                                                                                   |
| `DELETE /api/auth/credentials/:id`                                                | Authenticated same-firm passkey credential disable/delete action.                                                                                                                                                                                                                                  |
| `POST /api/auth/mfa/enable`                                                       | Enables MFA for the current user after confirming at least one active passkey exists.                                                                                                                                                                                                              |
| `POST /api/auth/mfa/disable`                                                      | Disables MFA for the current user without deleting passkey credentials.                                                                                                                                                                                                                            |
| `GET /api/session`                                                                | Current authenticated user.                                                                                                                                                                                                                                                                        |
| `GET /api/capabilities`                                                           | Permission-aware dashboard sections for the current user and first assigned matter.                                                                                                                                                                                                                |
| `GET /api/overview`                                                               | Firm overview metrics.                                                                                                                                                                                                                                                                             |
| `GET /api/matters`                                                                | Matters visible to the current user, including redacted activity entries and document metadata used by the matter activity/file command center.                                                                                                                                                    |
| `GET /api/contacts/dossiers`                                                      | Read-only contact dossiers derived from visible matter-party links, active portal grants, aliases, identifiers, adverse/confidential cues, quality-review signals, and redacted conflict-check history.                                                                                            |
| `GET /api/contacts/review-queue`                                                  | Audit-safe contact review queue over visible dossiers, with duplicate, protected-party, and conflict-revalidation counts but no merge automation.                                                                                                                                                  |
| `GET /api/legal-clinic/programs`                                                  | Firm-scoped clinic programs with provider-neutral eligibility/referral defaults.                                                                                                                                                                                                                   |
| `POST /api/legal-clinic/programs`                                                 | Creates a firm-scoped clinic program and records redacted program audit metadata.                                                                                                                                                                                                                  |
| `GET /api/legal-clinic/fiscal-host-workflow?matterId=`                            | Matter-scoped fiscal-host workflow selector over existing clinic program/profile context, sanitized fiscal-host/restricted-fund metadata, restricted-fund review prompts, cautious reporting surfaces, and reuse points. It does not create accounting records, reports, or trust ledger postings. |
| `GET /api/legal-clinic/profiles?matterId=`                                        | Lists the authorized matter's clinic profile as an empty or single-item profile array.                                                                                                                                                                                                             |
| `PUT /api/legal-clinic/profiles/:matterId`                                        | Upserts the authorized matter's clinic profile and records redacted eligibility/referral audit metadata.                                                                                                                                                                                           |
| `POST /api/conflicts/check`                                                       | Conflict search with audit recording for prospective names, aliases, identifiers, and party role.                                                                                                                                                                                                  |
| `GET /api/ledger?matterId=`                                                       | Trust ledger accounts, entries, posted transactions, and balances. Matter-scoped users must provide matter ID.                                                                                                                                                                                     |
| `GET /api/ledger/controls?matterId=`                                              | Read-only trust controls workbench payload with ledger balances, approvals, reconciliations, diagnostics, and cautious trust-control policy. Matter-scoped users must provide matter ID.                                                                                                           |
| `GET /api/ledger/reports/jurisdictional-trust?jurisdiction=`                      | Firm-wide, read-only aggregate trust report grouped by matter jurisdiction. It exposes counts and totals only, has no export package, and is explicitly not jurisdiction-certified.                                                                                                                |
| `POST /api/ledger/transactions`                                                   | Balanced, idempotent trust transaction posting.                                                                                                                                                                                                                                                    |
| `GET /api/audit`                                                                  | Firm audit events, hash-chain validity, and additive taxonomy summary counts without metadata values.                                                                                                                                                                                              |
| `GET /api/documents/presign-upload`                                               | S3 PUT upload intent, storage key, document intent record, and required scan marker.                                                                                                                                                                                                               |
| `POST /api/documents/:id/upload-complete`                                         | Checksum and scan-state completion for an upload intent.                                                                                                                                                                                                                                           |
| `POST /api/documents/:id/scan-status`                                             | Explicit malware/scan-state update for an existing document.                                                                                                                                                                                                                                       |
| `GET /api/signature-requests?matterId=`                                           | Signature requests visible firm-wide or across assigned matters.                                                                                                                                                                                                                                   |
| `POST /api/signature-requests`                                                    | Provider-neutral signature submission, initial provider event, and confirmation-gated SMTP signer email queueing.                                                                                                                                                                                  |
| `POST /api/signature-requests/provider-events`                                    | Authenticated legacy/provider-neutral status event for matching provider/external IDs.                                                                                                                                                                                                             |
| `POST /api/signature-requests/:id/embedded-events`                                | Embedded signature viewed/completed/declined event with consent/evidence capture.                                                                                                                                                                                                                  |
| `GET /api/signature-requests/:id/events`                                          | Provider event history for one signature request.                                                                                                                                                                                                                                                  |
| `GET /api/signature-requests/:id/evidence-packet`                                 | Staff-only redacted signature evidence packet with signer roles, linked document ID, status timeline, and allow-listed evidence reference keys without signer email, consent text, IP, or user agent.                                                                                              |
| `GET /api/intake-sessions?matterId=`                                              | Intake templates, including embedded definition metadata, and sessions visible firm-wide or across assigned matters.                                                                                                                                                                               |
| `POST /api/intake-sessions`                                                       | Embedded intake session record, with Open Practice remaining system of record and confirmation-gated SMTP staff notice.                                                                                                                                                                            |
| `GET /api/intake-sessions/:id/answer-snapshots`                                   | Answer snapshots for one intake session.                                                                                                                                                                                                                                                           |
| `POST /api/intake-sessions/:id/answer-snapshots`                                  | Captured intake answers plus computed embedded resolution for visible questions, matched branch rules, eligible packages, and package summaries.                                                                                                                                                   |
| `POST /api/intake-sessions/:id/generated-documents`                               | Generated document metadata tied to an intake session, with confirmation-gated SMTP staff notice.                                                                                                                                                                                                  |
| `POST /api/intake-sessions/:id/generated-packages`                                | Generated document records, package runtime replay proof, and confirmation-gated SMTP availability summary for an eligible embedded intake package.                                                                                                                                                |
| `POST /api/intake-templates`                                                      | Creates an embedded V1/V2 intake template definition after validation and audit recording.                                                                                                                                                                                                         |
| `POST /api/intake-templates/preview`                                              | Staff-only non-persistent QA preview for intake template definitions; validates and renders preview data without creating templates, sessions, snapshots, documents, jobs, or audit events.                                                                                                        |
| `PATCH /api/intake-templates/:id`                                                 | Updates an embedded intake template definition without accepting legacy external providers.                                                                                                                                                                                                        |
| `GET /api/intake-templates/:id/qa-preview`                                        | Staff-only intake-template QA report with branch preview paths, required item coverage, broken signature document reference cues, and no public token material.                                                                                                                                    |
| `GET /api/intake-form-links?matterId=&intakeSessionId=`                           | Lists token-hashed form links plus upload/signature item actions without returning token hashes.                                                                                                                                                                                                   |
| `POST /api/intake-form-links`                                                     | Creates an expiring token-hashed client form link, returns the raw token plus public portal URL once, and can queue one confirmed token email.                                                                                                                                                     |
| `POST /api/intake-form-links/:id/revoke`                                          | Revokes an active matter-scoped client form link.                                                                                                                                                                                                                                                  |
| `GET /api/intake-form-links/:id/review`                                           | Staff-only submitted intake review load for the linked answer snapshot, item actions, and review decision history.                                                                                                                                                                                 |
| `POST /api/intake-form-links/:id/review/accept`                                   | Records an accepted submitted-intake review decision and closes the review task without applying variable proposals.                                                                                                                                                                               |
| `POST /api/intake-form-links/:id/review/reject`                                   | Records a rejected submitted-intake review decision with a required reason and closes the review task without applying variable proposals.                                                                                                                                                         |
| `POST /api/intake-form-links/:id/review/request-more-info`                        | Records a follow-up decision, creates a child token-hashed form link, and returns the raw follow-up token and URL once.                                                                                                                                                                            |
| `GET /api/intake-variable-proposals?matterId=&status=`                            | Lists pending/approved/rejected staff-reviewed client/matter variable proposals created from public form answers.                                                                                                                                                                                  |
| `POST /api/intake-variable-proposals/:id/approve`                                 | Applies one pending proposal to the allowed client or matter field and records reviewer evidence.                                                                                                                                                                                                  |
| `POST /api/intake-variable-proposals/:id/reject`                                  | Rejects one pending proposal with a required reviewer reason.                                                                                                                                                                                                                                      |
| `GET /api/portal/intake-forms/:token`                                             | Public token-scoped form load with sanitized link metadata, template definition, item actions, and access logging.                                                                                                                                                                                 |
| `POST /api/portal/intake-forms/:token/submit`                                     | Public answer submission that gates required items, accepts an optional `clientSubmissionId` for idempotent browser retries, creates an answer snapshot, links it to the form link, creates a review task/queue signal, and creates pending proposals only.                                        |
| `POST /api/portal/intake-forms/:token/items/:itemId/uploads`                      | Public token-scoped S3 upload intent for an intake upload item, including accepted MIME-type validation.                                                                                                                                                                                           |
| `POST /api/portal/intake-forms/:token/items/:itemId/documents/:id/complete`       | Public checksum completion for an intake upload item document.                                                                                                                                                                                                                                     |
| `POST /api/portal/intake-forms/:token/items/:itemId/signature`                    | Public embedded attestation fallback or document-backed signature request creation for an intake signature item.                                                                                                                                                                                   |
| `POST /api/ledger/transactions/:id/approvals`                                     | Maker-checker approval decision for a trust transaction boundary.                                                                                                                                                                                                                                  |
| `POST /api/ledger/reconciliations`                                                | Trust-account reconciliation record with imported statement rows, row-level matched/unmatched review decisions, immutable beginning/ending balance snapshots, and variance explanation.                                                                                                            |
| `GET /api/queues`                                                                 | Permission-aware operational queues for matters, documents, signatures, intake, ledger, task deadlines, and audit review.                                                                                                                                                                          |
| `GET /api/tasks/workbench?matterId=`                                              | Matter-scoped task/deadline projections, my/team counters, matter/contact queues, and focused overdue, today, upcoming, and unassigned task IDs.                                                                                                                                                   |
| `PATCH /api/tasks/:taskId/complete`                                               | Completes one authorized matter task/deadline and records audit-safe completion metadata.                                                                                                                                                                                                          |
| `GET /api/operational-views`                                                      | Built-in matter-scoped operational view definitions and redacted results for stale matters, awaiting work, expiring links, conflict cues, and overdue deadlines.                                                                                                                                   |
| `GET /api/time-entries?matterId=&status=`                                         | Time entries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                         |
| `POST /api/time-entries`                                                          | Time-entry capture with performed date, immutable rate snapshot, and draft billing status.                                                                                                                                                                                                         |
| `PATCH /api/time-entries/:id`                                                     | Draft/submitted time-entry edits before billing or write-off.                                                                                                                                                                                                                                      |
| `POST /api/time-entries/:id/submit`                                               | Move a draft time entry to submitted.                                                                                                                                                                                                                                                              |
| `POST /api/time-entries/:id/approve`                                              | Approve a submitted time entry for invoicing.                                                                                                                                                                                                                                                      |
| `POST /api/time-entries/:id/write-off`                                            | Mark an unbilled time entry as written off.                                                                                                                                                                                                                                                        |
| `GET /api/expense-entries?matterId=&status=`                                      | Expense entries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                      |
| `POST /api/expense-entries`                                                       | Expense capture with incurred date, immutable amount snapshot, and draft billing status.                                                                                                                                                                                                           |
| `PATCH /api/expense-entries/:id`                                                  | Draft/submitted expense-entry edits before billing or write-off.                                                                                                                                                                                                                                   |
| `POST /api/expense-entries/:id/submit`                                            | Move a draft expense entry to submitted.                                                                                                                                                                                                                                                           |
| `POST /api/expense-entries/:id/approve`                                           | Approve a submitted expense entry for invoicing.                                                                                                                                                                                                                                                   |
| `POST /api/expense-entries/:id/write-off`                                         | Mark an unbilled expense entry as written off.                                                                                                                                                                                                                                                     |
| `GET /api/invoices?matterId=&status=`                                             | Invoice summaries visible firm-wide or across assigned matters.                                                                                                                                                                                                                                    |
| `POST /api/invoices`                                                              | Create a draft invoice from approved unbilled time/expense entries and optional adjustment lines, rejecting source entries already linked to a non-void invoice.                                                                                                                                   |
| `GET /api/invoices/:id`                                                           | Invoice detail with immutable line, tax, total, payment, and balance snapshots.                                                                                                                                                                                                                    |
| `POST /api/invoices/:id/approve`                                                  | Approve a draft invoice and mark source time/expense entries as billed.                                                                                                                                                                                                                            |
| `POST /api/invoices/:id/issue`                                                    | Issue an approved invoice without changing stored line snapshots.                                                                                                                                                                                                                                  |
| `POST /api/invoices/:id/void`                                                     | Void an unpaid invoice while preserving source and audit evidence.                                                                                                                                                                                                                                 |
| `GET /api/payments?matterId=&invoiceId=`                                          | Manual payments and allocations visible firm-wide or across assigned matters.                                                                                                                                                                                                                      |
| `POST /api/payments`                                                              | Record a manual payment allocation; over-allocation is rejected and invoice balance/status is recalculated.                                                                                                                                                                                        |
| `GET /api/billing/trust-transfer-requests?matterId=&status=`                      | Trust-transfer-request records visible firm-wide or across assigned matters.                                                                                                                                                                                                                       |
| `POST /api/billing/trust-transfer-requests`                                       | Create a billing-side request to pay an invoice from trust; this does not post ledger transactions.                                                                                                                                                                                                |
| `GET /api/billing/dashboard`                                                      | Billing dashboard payload for approved unbilled work, draft invoices, issued balances, and payments.                                                                                                                                                                                               |
| `GET /api/calendar/events?matterId=&startsAfter=&startsBefore=`                   | Matter-scoped operator-entered calendar events, manual reminder-state records, CalDAV, iCalendar subscription URLs, and meeting-boundary status for the matter dashboard.                                                                                                                          |
| `POST /api/calendar/events`                                                       | Creates one authorized matter-scoped staff calendar event with provider-neutral event metadata and redacted audit evidence.                                                                                                                                                                        |
| `PATCH /api/calendar/events/:eventId`                                             | Updates one authorized matter calendar event title, range, status, description, or location while preserving attendee, reminder, sync, and meeting-link children.                                                                                                                                  |
| `POST /api/calendar/events/:eventId/cancel`                                       | Cancels one authorized matter calendar event by setting `status=cancelled`, incrementing sequence, and recording redacted lifecycle audit metadata.                                                                                                                                                |
| `POST /api/calendar/events/:eventId/reschedule`                                   | Reschedules one authorized matter calendar event, increments sequence, and reopens cancelled events to confirmed unless a status is explicitly supplied.                                                                                                                                           |
| `POST /api/calendar/events/:eventId/reminders`                                    | Creates one manual dashboard reminder-state record for an authorized matter event; it does not queue notifications.                                                                                                                                                                                |
| `PATCH /api/calendar/events/:eventId/reminders/:reminderId`                       | Updates one manual reminder's due time, dashboard channel, status, or note without queuing notifications.                                                                                                                                                                                          |
| `DELETE /api/calendar/events/:eventId/reminders/:reminderId?matterId=`            | Soft-deletes one manual reminder-state record for an authorized matter event.                                                                                                                                                                                                                      |
| `POST /api/calendar/events/:eventId/attendees`                                    | Adds a matter-scoped event attendee with role, response status, and not-yet-sent invitation state.                                                                                                                                                                                                 |
| `PATCH /api/calendar/events/:eventId/attendees/:attendeeId`                       | Updates an attendee name, email, role, or response status for one authorized matter event.                                                                                                                                                                                                         |
| `DELETE /api/calendar/events/:eventId/attendees/:attendeeId?matterId=`            | Soft-deletes an attendee from one authorized matter event.                                                                                                                                                                                                                                         |
| `PATCH /api/calendar/events/:eventId/meeting-link`                                | Sets a matter-scoped calendar event meeting link to blank, HTTPS external URL, or configured hosted WebRTC room URL; native media/signaling remains deferred.                                                                                                                                      |
| `POST /api/calendar/events/:eventId/invitations`                                  | Queues confirmed attendee invitation email through the SMTP outbox or marks invitations skipped/disabled when email is unavailable; stored meeting links can be included only when explicitly requested.                                                                                           |
| `GET /api/calendar/matters/:matterId.ics`                                         | Authenticated read-only iCalendar export for one authorized matter calendar.                                                                                                                                                                                                                       |
| `GET /api/calendar/credentials`                                                   | Current-user CalDAV app-password credentials without password hashes or one-time secrets.                                                                                                                                                                                                          |
| `POST /api/calendar/credentials`                                                  | Creates a current-user CalDAV app password and returns the generated password only once.                                                                                                                                                                                                           |
| `POST /api/calendar/credentials/:id/revoke`                                       | Revokes a current-user CalDAV app password and records audit evidence.                                                                                                                                                                                                                             |
| `GET /api/jobs?queueName=`                                                        | Firm-scoped PostgreSQL job lifecycle projection, optionally filtered by queue name including `connectors`, with redacted run summaries, queue status, and queue names; Redis internals are not exposed.                                                                                            |
| `GET /api/jobs/health`                                                            | Compact read-only worker health summary over configured, reserved, and not-configured queues, last observed job activity, failed/stalled counts, and degraded/healthy/unknown state without job bodies or sensitive payloads.                                                                      |
| `GET /api/jobs/:jobId`                                                            | Firm-scoped redacted job-run detail with terminal/retryable state, retry timing, generic error summary, target resource IDs, and safe metadata only.                                                                                                                                               |
| `GET /api/connectors?type=&status=`                                               | Owner/auditor-visible connector registry records with type, key, status, masked secret-reference sentinel metadata, and operational config summaries only.                                                                                                                                         |
| `POST /api/connectors`                                                            | Creates a firm-scoped provider-neutral connector registry record without accepting raw credential fields.                                                                                                                                                                                          |
| `PATCH /api/connectors/:connectorId`                                              | Updates firm-scoped connector display/status/config fields and preserves stored secret references when clients echo the masked unchanged-secret sentinel.                                                                                                                                          |
| `GET /api/connectors/outbox?connectorId=&status=`                                 | Firm-scoped connector outbox summaries with idempotency-key presence, retry counters, next-attempt timestamps, lease presence, redacted payload summaries, and redacted delivered/dead-letter outcomes.                                                                                            |
| `POST /api/connectors/outbox`                                                     | Creates or returns an idempotent provider-neutral connector outbox row for a registered connector without emitting provider-specific webhooks.                                                                                                                                                     |
| `GET /api/email/status`                                                           | SMTP provider status from firm provider settings.                                                                                                                                                                                                                                                  |
| `POST /api/email/previews`                                                        | Matter-scoped render-only email template preview that normalizes recipients and body previews without SMTP, outbox, job, or audit side effects.                                                                                                                                                    |
| `POST /api/mail/outbox`                                                           | Create or replay a confirmation-gated SMTP outbound email record, queued email event, durable job lifecycle record, and audit event.                                                                                                                                                               |
| `GET /api/mail/outbox?matterId=`                                                  | Matter-scoped outbound email delivery history without message bodies.                                                                                                                                                                                                                              |
| `POST /api/mail/outbox/:emailId/retry`                                            | Manually requeues a failed matter-scoped outbound email after confirmation with redacted job and audit metadata.                                                                                                                                                                                   |
| `POST /api/outbound-webhooks/test-deliveries`                                     | Provider-neutral outbound-webhook guardrail preview and test-delivery simulation with HTTPS destination validation, event allowlist, signing metadata, and audit.                                                                                                                                  |
| `GET /api/inbound-email/status`                                                   | Inbound email provider status plus configured firm inbound addresses.                                                                                                                                                                                                                              |
| `GET /api/inbound-email/messages?matterId=`                                       | Matter-scoped parsed inbound email messages, or firm-wide owner/auditor review queue.                                                                                                                                                                                                              |
| `GET /api/inbound-email/messages/:id`                                             | Matter-scoped parsed inbound email detail with inbound-email attachment records and promoted `documentId` links when present.                                                                                                                                                                      |
| `GET /api/communications/inbox?matterId=`                                         | Matter-view redacted communications aggregate over inbound email summaries, outbound delivery history, conversation topics, contact cues, and channel status.                                                                                                                                      |
| `PATCH /api/communications/inbox/inbound-email/:id`                               | Triage-only update for one inbound email using existing status, labels, matter scope, and constrained `metadata.staffTriage` fields.                                                                                                                                                               |
| `POST /api/inbound-email/messages/:id/attachments/:attachmentId/promote-document` | Explicitly promotes one matter-scoped inbound attachment to a verified document record and optionally queues OCR.                                                                                                                                                                                  |
| `GET /api/conversation-threads?matterId=`                                         | Lists matter-scoped provider-neutral conversation topic records with retention/export/revocation boundary fields and no message bodies.                                                                                                                                                            |
| `GET /api/conversation-threads/:id`                                               | Reads one authorized conversation topic record after resolving its matter scope.                                                                                                                                                                                                                   |
| `POST /api/conversation-threads`                                                  | Creates one authorized matter-scoped conversation topic record and records redacted boundary metadata; realtime chat, messages, and notifications remain deferred.                                                                                                                                 |
| `PATCH /api/conversation-threads/:id/lifecycle`                                   | Applies a constrained matter-scoped thread lifecycle action for close, reopen, access revocation, or export request without accepting message bodies or producing export artifacts.                                                                                                                |
| `GET /api/document-processing/status`                                             | OCR-only actionable document-processing status with reserved/deferred AI triage, transcription, and media queue metadata plus redacted job summaries.                                                                                                                                              |
| `GET /api/document-processing/workbench?matterId=`                                | Matter-scoped document processing workbench with sanitized document states, review-queue counts, queue eligibility, provider/worker status, redacted latest job/extraction summaries, and reviewer-only non-mutating suggestion cues.                                                              |
| `POST /api/document-processing/documents/:id/queue`                               | Queues OCR for an authorized verified document when the OCR worker queue is configured.                                                                                                                                                                                                            |
| `GET /api/auth/extensions`                                                        | Redacted embedded-auth status for local password, passkey, MFA, and recovery-code posture, with OIDC/SAML marked as deprecated legacy placeholders.                                                                                                                                                |
| `GET /api/shares/status`                                                          | Share-link capability status and create enablement based on token-signing configuration.                                                                                                                                                                                                           |
| `GET /api/shares?matterId=`                                                       | Persisted share-link listing with matter-scoped authorization and no token hashes in the response.                                                                                                                                                                                                 |
| `POST /api/shares`                                                                | Creates an expiring token-hashed share link, returns the raw token once, and can queue one confirmed token email.                                                                                                                                                                                  |
| `POST /api/shares/:id/revoke`                                                     | Revokes an existing matter-scoped share link and records audit evidence.                                                                                                                                                                                                                           |
| `GET /api/portal/shares/:token`                                                   | Public token-scoped read of eligible shared document metadata with access logging; verification-required links return an email-verification challenge.                                                                                                                                             |
| `POST /api/portal/shares/:token/email-verification`                               | Completes the first email-delivered share-link verification step, then returns eligible shared document metadata while preserving token-hash storage and access-log evidence.                                                                                                                      |
| `GET /api/external-uploads/status`                                                | External upload capability status, token-signing signal, and S3 configuration signal.                                                                                                                                                                                                              |
| `GET /api/external-uploads?matterId=`                                             | Persisted external-upload link listing plus external-upload document review state with matter-scoped authorization and no token hashes.                                                                                                                                                            |
| `POST /api/external-uploads`                                                      | Creates an expiring token-hashed upload link, returns the raw token once, and can queue one confirmed token email.                                                                                                                                                                                 |
| `POST /api/external-uploads/:id/revoke`                                           | Revokes an existing matter-scoped external-upload link and records audit evidence.                                                                                                                                                                                                                 |
| `PATCH /api/external-uploads/documents/:documentId/review`                        | Records an authenticated matter-scoped review decision for an external-upload document without deleting the original record.                                                                                                                                                                       |
| `GET /api/portal/external-uploads/:token`                                         | Public token-scoped read of safe external-upload link status, remaining upload count, expiry, accepted classification values, and uploaded-document review statuses without exposing matter, firm, staff, storage, review-note, or token-hash details.                                             |
| `POST /api/portal/external-uploads/:token/intents`                                | Public token-scoped S3 PUT upload intent for one external-upload link.                                                                                                                                                                                                                             |
| `POST /api/portal/external-uploads/:token/documents/:id/complete`                 | Public token-scoped checksum and scan-state completion for a document upload intent.                                                                                                                                                                                                               |
| `GET /api/drafts?matterId=&userId=`                                               | Matter-scoped structured drafts with TipTap/ProseMirror JSON and sanitized rendered snapshots.                                                                                                                                                                                                     |
| `POST /api/drafts`                                                                | Create a structured draft from either TipTap/ProseMirror JSON or an active draft template.                                                                                                                                                                                                         |
| `GET /api/drafts/:id`                                                             | Fetch an authorized draft by ID.                                                                                                                                                                                                                                                                   |
| `PUT /api/drafts/:id`                                                             | Save structured draft content or rendered snapshot updates and increment the draft version.                                                                                                                                                                                                        |
| `DELETE /api/drafts/:id`                                                          | Delete an authorized draft record.                                                                                                                                                                                                                                                                 |
| `POST /api/drafts/:id/exports`                                                    | Export a saved matter-scoped draft to PDF or DOCX through configured object storage, creating verified document metadata plus generated-document metadata.                                                                                                                                         |
| `GET /api/draft-assist/status`                                                    | Disabled-by-default drafting assist status from firm AI provider settings and injected provider availability.                                                                                                                                                                                      |
| `GET /api/draft-assist/records?matterId=&draftId=&documentId=`                    | Matter-scoped non-authoritative assist records filtered by matter, draft, or document.                                                                                                                                                                                                             |
| `POST /api/drafts/:id/assist`                                                     | Synchronous review-first draft assist suggestion from structured draft text; does not mutate the draft.                                                                                                                                                                                            |
| `POST /api/documents/:id/assist`                                                  | Synchronous document summary assist from completed text extraction; missing extraction returns `409`.                                                                                                                                                                                              |
| `PATCH /api/draft-assist/records/:id/review`                                      | Mark an assist suggestion reviewed or rejected without changing source draft or document records.                                                                                                                                                                                                  |
| `GET /api/draft-templates?category=&activeOnly=`                                  | List active firm-scoped drafting templates, including seeded operational basics.                                                                                                                                                                                                                   |
| `POST /api/draft-templates`                                                       | Create a firm-scoped drafting template from structured TipTap/ProseMirror JSON.                                                                                                                                                                                                                    |

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

These routes remain limited until their persistence, authorization, and worker implementations land
behind the scaffolded provider settings and job lifecycle records. Inbound email parsing now
persists parsed messages and attachment records, inbound status exposes configured firm recipient
addresses, staff can explicitly promote matter-scoped inbound attachments to documents, and verified
documents can be handed to the OCR queue. OCR is the only actionable document-processing queue in
the current API; AI triage, transcription, and media queues are reported as reserved/deferred
metadata rather than configurable work. Webhook ingestion, provider delivery setup, automatic
document promotion, transcription, media processing, and async AI drafting remain deferred.
`GET /api/providers/status` is read-only configuration posture, not a live health probe: it reports
safe provider-setting keys, object-storage configured/not-configured state, BullMQ producer and
reserved worker queue posture, redacted job summaries, and current-user embedded-auth extension
posture without returning provider config, Redis URLs, storage endpoints, credentials, raw worker
errors, storage keys, message bodies, generated text, or auth secrets.

| Route                                             | Purpose                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/providers/status`                       | Operator-visible configuration posture for Redis/BullMQ producers, object storage, provider settings, reserved workers, redacted jobs, and auth extensions. |
| `POST /api/media/:id/transcription-jobs`          | Enqueue FFmpeg normalization and Whisper transcription for authorized media.                                                                                |
| `POST /api/documents/:id/assistive-drafting-jobs` | Future async Ollama/LM Studio drafting worker job after provider and queue governance land.                                                                 |

The authenticated and public SimpleWebAuthn routes are live embedded-auth routes in the main API
surface above. They remain deployment-gated by the configured RP ID/origin and setup/session secrets;
they are no longer tracked as planned worker/provider routes.

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
portal grants, aliases, identifiers, adverse/confidential party cues, and additive
`qualityReview` signals. Quality review can flag likely duplicate candidates, protected-party
handling, portal-sensitive contacts, and manual conflict-check revalidation prompts; it does not add
contact editing, duplicate merges, automatic conflict changes, or cross-scope matter disclosure.

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

Conversation threads are non-real-time matter-scoped topic records. The current slice stores topic,
status, retention boundary, export state, access-revocation timestamp, notification boundary,
creator/updater IDs, timestamps, and server-owned operational metadata behind `conversation_thread`
authorization. Create/list/read/lifecycle routes never accept or return message bodies, connector
delivery attempts, webhook payloads, raw notification content, or public tokens. Lifecycle updates
are limited to close, reopen, access revocation, and export-request state; export request marks the
thread as requested only and does not create an export artifact. Audit events include only thread
ID, matter ID, status, retention/export/notification boundary state, and access-revoked state.

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

The read-only trust controls workbench surfaces existing balances, approval decisions,
reconciliation exceptions, unreconciled accounts, statement-row counts, variance explanations, recent
postings, and invariant diagnostics for operator review. It does not post ledger entries, approve
transactions, create reconciliations, place holds, add accounting dimensions, or claim
compliance-pack coverage.

The jurisdictional trust report is a firm-wide, read-only aggregate over the same trust controls
data. It groups accessible matter balances, approval counts, reconciliation exception counts,
statement-row counts, variance totals, unreconciled-account counts, and overdrawn diagnostics by
matter jurisdiction. The response intentionally omits statement evidence, row descriptions, private
matter details, and export files; its posture is
`operational_controls_only_not_jurisdiction_certified`.

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
Approval should not create trust ledger entries by itself. Any trust ledger posting must remain an
explicit balanced ledger transaction with its own idempotency key, actor, evidence,
approval/reconciliation records where required, and reversal path. Optional linkage to a ledger
transaction is evidence/reference only.

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
summaries, contact dossier cues without notes, and channel state. It does not expose email bodies,
parsed text, raw storage keys, checksums, provider IDs/tokens, contact notes, conversation messages,
composers, realtime chat, retry controls, or new provider setup. Triage updates stay on existing
inbound email rows and accept only status, labels, matter scope, and constrained
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
`GET /api/document-processing/status` and `GET /api/document-processing/workbench?matterId=` reuse
the same redacted summaries for OCR/document-processing workbench state, including provider-disabled,
queue-unconfigured, and reserved/deferred cases. The document-processing projection keeps the broad
`supportedTasks` list for compatibility, adds `actionableTasks: ["ocr"]`, and reports AI triage,
transcription, and media through reserved/deferred queue and task metadata until their provider
governance and enqueue surfaces are implemented. Job metadata must not carry email bodies, portal
tokens, generated content, storage keys, raw evidence, or private secrets.
The workbench also returns reviewer-only `reviewSuggestions` per visible document. These suggestions
are non-mutating cues for classification review, duplicate/supersession checks, matter/contact
context, and missing metadata. They are derived from authorized same-matter document state and
whitelisted extraction metadata only; raw extracted text, storage keys, checksums, provider payloads,
tokens, and arbitrary metadata values are never returned. Applying suggestions, merging documents,
changing classification, or writing metadata remains outside this surface.
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
The dashboard operations panel may present connector/outbox posture as read-only redacted status:
connector type/key/status/display name, idempotency-key presence, attempt counts, next-attempt time,
lease presence, delivery/dead-letter timestamps, last error summary, and safe payload-summary shape.
It does not expose raw idempotency keys, lease IDs, secret references, webhook signing material, or
payload bodies. This slice does not emit outbound webhooks, validate destination URLs, sign
payloads, retry or lease outbox rows, or implement provider-specific worker delivery controls.
Connector delivery worker V1 uses the `connectors` worker queue to lease due outbox rows for
enabled connectors, validate allowlisted event keys and HTTPS destinations from redacted connector
configuration, resolve signing material from worker-only secret configuration by secret-reference
ID, send signed JSON summary envelopes built from safe outbox fields and `payloadSummary`, and
record delivered, retryable failed, or dead-letter outcomes through connector outbox and delivery
attempt rows. Retry error summaries and delivery attempt metadata are sanitized at the repository
boundary so API reads, backup-style repository exports, and later operational exports do not carry
raw tokens, signatures, secret references, private storage paths, or email addresses. It does not
persist raw webhook bodies, expose raw idempotency keys, return signing material, log secrets in job
metadata, add manual retry controls, or implement provider-specific webhook integrations.

Email outbox records and retry jobs store firm-scoped idempotency keys. Replaying a matching
outbox or retry request returns the existing email/job projection without requeueing; changed safe
payload fields such as recipients, subject, template, related resource, provider, or retry target
conflict. Message bodies are not copied into idempotency metadata.
Signature, intake, share-link, external-upload, and calendar-invitation flows reuse the same outbox
helper only after their route-specific delivery confirmation is accepted; share, external-upload,
and intake-form notification emails are create-time only because raw tokens are not recoverable
after the response. Calendar attendees are stored as matter-scoped event children with
required/optional role, response status, and invitation state. Invitation attempts are optional:
when SMTP or queue delivery is unavailable, the API records a skipped attendee invitation state
without failing attendee management. `PATCH /api/calendar/events/:eventId/meeting-link` stores
blank, HTTPS external, or configured hosted WebRTC room URLs on the authorized event. Hosted links
require `WEBRTC_MEETING_PROVIDER_KEY` and `WEBRTC_MEETING_BASE_URL`; guest-access capability is
reported as configured only when hosted meeting configuration and token signing are both available.
Invitation requests that include a meeting link require an existing stored link and are rejected
before email delivery state changes when the link is unavailable. The dashboard lets staff save or
clear stored event meeting links and send link invitations only after a link is present. Native
Open Practice media rooms, signaling, chat, recordings, temporary room uploads, and public meeting
preview/session pages remain deferred.
Calendar event lifecycle writes are staff-controlled matter-scoped records. Create/update/cancel
and reschedule increment the event sequence whenever an existing event changes, preserve attendees,
reminders, iCalendar/CalDAV export behavior, and stored meeting-link fields, and record audit
metadata with identifiers, status, sequence, counts, and change flags only. Manual reminder records
are dashboard state records with `pending`, `acknowledged`, `dismissed`, or `cancelled` status and
the dashboard channel; they do not create outbox email, notification jobs, public tokens, worker
metadata, or delivery attempts. Calendar audit metadata records event, reminder, attendee, email,
job, meeting-boundary status, and count identifiers only; invitation message bodies remain in the
outbox record and reminder notes are not copied into audit metadata.

Draft assist is a disabled-by-default synchronous scaffold for non-authoritative suggestions.
`GET /api/draft-assist/status` reports disabled when no enabled `ai` provider setting exists or no
provider is injected. Configured draft/document assist creates `draft_assist_records` with provider
and model provenance, suggested plain text, optional summary, review state, source references, and
redacted metadata. Draft assist reads structured TipTap text and never saves draft changes; the
dashboard can insert a suggestion into local editor state, and the existing draft save route remains
the only persistence path. Document assist is limited to `summarize` and requires completed text
extraction. Audit events record only IDs, task/status, provider/model, length/count metadata, and
review decisions; raw draft text, document text, prompts, instructions, generated text, storage keys,
checksums, and evidence bodies stay out of audit metadata.

Provider/bootstrap selection is local-first. `DATABASE_URL` selects PostgreSQL unless
`OPEN_PRACTICE_USE_MEMORY_REPO=true` or the database URL is absent. `OPEN_PRACTICE_DEV_SEED=true`
loads seed data. Empty firm/user state exposes first-run setup; partial firm/user state is blocked
until an operator repairs it. Production first-run status is blocked until `OPEN_PRACTICE_SETUP_KEY`
is configured, and completion requires the matching `x-open-practice-setup-key` header.
Non-production setup without a configured key is limited to local/private network access.
Signature and intake providers default to embedded
implementations. S3 upload signing is enabled only when endpoint and credentials are configured.
Redis/BullMQ queues, firm provider settings, job lifecycle records, and disabled-by-default API
scaffolds are implemented for email, AI triage, OCR, transcription, media, draft assist, and auth
extensions. Email, inbound email, and OCR are actionable queue families when configured; AI triage,
transcription, and media remain reserved/deferred queue names until explicit provider governance and
enqueue surfaces are added. Provider-status posture is an operator read surface over configuration
and redacted job lifecycle records; it must not be treated as provider connectivity, credential, or
worker liveness proof.
Secure share-link create/list/revoke plus token-scoped public document metadata reads are
implemented with token hashing, matter-scoped authorization, audit events, and access logs. External
upload link create/list/revoke plus token-scoped S3 intent and completion flows are implemented with
token hashing, matter-scoped authorization, S3-disabled fallbacks, audit events, and access logs.
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
