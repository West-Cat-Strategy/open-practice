# Development Backlog

This document captures candidate opportunities for Open Practice. Use `docs/planning.md` for the
durable roadmap and `docs/planning-and-progress.md` for live workboard tasks. Items here are not
active commitments until promoted to the live workboard.

## Phase 2: Hardening & Integration (Completed)

| Topic                   | Action-Oriented Goal                                                                                |
| :---------------------- | :-------------------------------------------------------------------------------------------------- |
| **Worker Processors**   | Integrated Tesseract OCR/text extraction into the `apps/worker` pipeline for verified documents.    |
| **Email Delivery**      | Wired Mailpit/Postal adapters for automated signature request notifications and firm alerts.        |
| **Advanced Auth**       | Completed the SimpleWebAuthn lifecycle, including MFA policy enforcement and credential recovery.   |
| **Drafting Foundation** | Implemented the TipTap-backed drafting API with versioning, sanitization, and structured templates. |
| **Inbound Triage**      | Automated parsing of inbound email into matter-scoped messages and attachments.                     |
| **Trust Hardening**     | Added persistent DB-level client-balance concurrency guards and approval/reconciliation gates.      |

## Phase 3: Operational Scale Candidates

| Topic                        | Candidate Goal                                                                                                                           |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit Coverage**           | Extend append-only audit events across signature, intake, drafting, document, billing, ledger, email, share, and upload state changes.   |
| **Email Workflow Closure**   | Connect SMTP/outbox worker capability to API preview/send flows for signature, intake, share, upload, and meeting notices.               |
| **Guided Intake**            | Add branching logic, reusable intake packages, and multi-document automation while keeping generated records inside Open Practice.       |
| **Local AI Drafting Assist** | Integrate disabled-by-default Ollama/LM Studio workflows for reviewed draft assistance and matter/document summarization.                |
| **Calendaring/Meetings**     | Add matter-scoped event CRUD, outbound iCalendar/webcal sync, invitation email, and optional configured WebRTC meeting links.            |
| **Specialized Workflows**    | Support legal clinics, nonprofit fiscal hosts, complex trust accounting, and multi-jurisdiction reporting with cautious compliance text. |

## Phase 3: Completed Slices

| Topic                | Completed Goal                                                                                                                          |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **Secure Shares**    | Added token-hashed, expiring, revocable v1 portal share links for document metadata with matter-scoped auth, audit events, and logs.    |
| **External Uploads** | Added client-facing upload links with token-scoped S3 intent/complete flows, S3-disabled fallback behavior, revocation, and audit logs. |

## Reference-Driven Follow-Ups

The April 2026 reference expansion added local reference inputs for document-management, CRM,
communications, scheduling, and workflow-orchestration projects. The central reference index at
`../reference-repos/docs/index.json` is the current source of truth for new clean-room research; rows
that cite older project-local lock entries should be refreshed into the central index before becoming
implementation evidence. These candidates are concrete backlog inputs, not active workboard
commitments.

| Topic                                   | Candidate Goal                                                                                                                                                                                                                      | Reference Inputs                                                                                 |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Upload Review Lifecycle**             | Add original-preserving upload states, duplicate detection, retry/delete decisions, missing-metadata queues, and access-log proof for external uploads.                                                                             | Central: paperless-ngx. Legacy/local lock only: Nextcloud, Papermerge, Mayan EDMS, OpenContracts |
| **Document Processing Workbench**       | Expose OCR/text-extraction queue state, review status, metadata search, annotation-ready records, and provider-disabled states without requiring OCR.                                                                               | Central: paperless-ngx. Legacy/local lock only: Papermerge, Mayan EDMS, OpenContracts            |
| **Contact Dossier Surface**             | Add contact list/detail views with linked matters, roles, aliases, identifiers, portal status, adverse/confidential flags, and conflict history.                                                                                    | EspoCRM, SuiteCRM, Twenty, OpenLawOffice                                                         |
| **Matter Activity Timeline**            | Create a matter-scoped activity stream that ties contacts, tasks, documents, billing, shares, uploads, messages, and calendar events together.                                                                                      | EspoCRM, SuiteCRM, Twenty, j-lawyer.org, ArkCase, OpenLawOffice                                  |
| **Participant Role Vocabulary**         | Standardize owner, assignee, reviewer, follower, external party, signer, uploader, meeting guest, and portal contact labels across UI and audit logs.                                                                               | j-lawyer.org, ArkCase, EspoCRM, SuiteCRM, Twenty                                                 |
| **Task And Deadline Workbench**         | Promote task records into my/team overdue, today, upcoming, matter, and contact queues with assignment, completion audit, and dashboard counters.                                                                                   | EspoCRM, SuiteCRM, j-lawyer.org, OpenLawOffice                                                   |
| **Saved Operational Views**             | Add saved filters for stale matters, uncontacted clients, awaiting signature, external uploads expiring, conflicts pending review, and overdue tasks.                                                                               | Twenty, EspoCRM, SuiteCRM                                                                        |
| **CRM Data Quality Review**             | Add duplicate candidates, merge-review decisions, protected adverse/confidential-party rules, and conflict-check revalidation after contact changes.                                                                                | EspoCRM, SuiteCRM, Twenty                                                                        |
| **Secure Conversation Threads**         | Model matter-scoped message topics/rooms with retention, export, access revocation, and notification boundaries before adding real-time chat.                                                                                       | Legacy/local lock only: Zulip, Matrix Synapse, Mattermost, Chatwoot                              |
| **Client Communications Inbox**         | Add a matter/contact-routed inbox with labels, assignment, private staff notes, consent/channel configuration, and disabled states for unconfigured channels.                                                                       | Legacy/local lock only: Chatwoot, Zulip, Mattermost                                              |
| **Meeting Invitation Boundary**         | Keep meeting links disabled until configured, then add tokenized guest access, lobby/host controls, audit events, retention, and calendar invites.                                                                                  | Legacy/local lock only: Jitsi Meet, Cal.diy, Matrix Synapse, Mattermost                          |
| **Connector Registry And Outbox**       | Define native connector records, secret references, durable outbox rows, retry leases, idempotency keys, and user-visible delivery attempts.                                                                                        | Central: Blnk, Apache Fineract. Legacy/local lock only: Activepieces, Apache Camel, Temporal     |
| **Audit Event Taxonomy**                | Define canonical event names, actor/resource/matter fields, and required metadata before widening audit coverage across routes and worker actions.                                                                                  | Central: Apache Fineract. Legacy/local lock only: Activepieces                                   |
| **Email Delivery State Machine**        | Extend outbox/email events with attempts, next retry, terminal failure, preview/send provenance, manual retry, and visible delivery history.                                                                                        | Central: Blnk. Legacy/local lock only: Apache Camel, Activepieces                                |
| **Worker Run Inspection**               | Add queue-agnostic run details with terminal status, failed-step snapshots, retry strategy, next-attempt time, and operator-visible error context.                                                                                  | Legacy/local lock only: Activepieces, Temporal, Apache Camel                                     |
| **Outbound Webhook Guardrails**         | Require HTTPS destinations, event allowlists, signed payloads, test delivery, no localhost/loopback, and explicit audit events before emitting integrations.                                                                        | Central: Blnk. Legacy/local lock only: Activepieces, Apache Camel                                |
| **Idempotent Job Keys**                 | Add unique replay-safe keys per resource/action/provider attempt for outbox, ledger, upload, notification, and worker jobs.                                                                                                         | Central: Blnk. Legacy/local lock only: Apache Camel, Temporal                                    |
| **Workflow History And Audit Envelope** | Give mutating API/workflow actions a consistent request id, actor, matter scope, before/after audit expectations, status, retry, and error record.                                                                                  | Central: Apache Fineract, Blnk. Legacy/local lock only: Apache Camel, Temporal                   |
| **Guided Intake Package Runtime**       | Add versioned intake packages with JSON-driven questions, branching predicates, answer snapshots, attachments, generated documents, and replay proof.                                                                               | Central: docassemble, SurveyJS Creator, rjsf, Form.io. Legacy/local lock only: Formbricks        |
| **Trust Reconciliation Workbench**      | Add imported statement rows, match/unmatched counts, reviewer decisions, immutable balance snapshots, and variance explanations before compliance claims.                                                                           | Central: Blnk, Apache Fineract, LedgerSMB, Midaz                                                 |
| **Intake Builder QA/Preview**           | Add staff-only preview and coverage checks for embedded intake definitions, including branch reachability, required-item coverage, package eligibility, broken document references, unmapped questions, and synthetic preview runs. | Central: docassemble, SurveyJS Creator, rjsf, Form.io                                            |
| **Document Suggestions Review Queue**   | Add reviewer-only OCR/extraction suggestions for classification, duplicate or supersession cues, matter/contact hints, and missing metadata without automatic merge or classification.                                              | Central: paperless-ngx                                                                           |
| **Signature Evidence Packet View**      | Add a matter-scoped evidence view for embedded signature requests with signer role, delivery state, completion/decline timeline, linked document ID, and redacted audit references.                                                 | Central: DocuSeal, docassemble                                                                   |

## Nonprofit-Manager Behavioral Pattern Candidates

The May 2026 local `nonprofit-manager` review produced clean-room behavioral candidates only. Do not
copy nonprofit-manager implementation structure, portal/case-form terminology, generic approval
models, provider assumptions, or deployment workflows into Open Practice.

| Topic                              | Candidate Goal                                                                                                                                    | Reference Posture                    |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------- |
| **Saved Operational Views**        | Add user-owned matter dashboard presets for overdue filings, uncontacted intake clients, and expiring upload links after built-in views grow.     | Behavioral reference; no code reuse. |
| **Audit Projection Summaries**     | Add read-only operator summaries over the existing hash-chained audit taxonomy without changing stored audit events.                              | Behavioral reference; no code reuse. |
| **Async Report Export Requests**   | Move large audit, billing, or trust exports behind capped direct responses and async job status when report size exceeds safe synchronous limits. | Behavioral reference; no code reuse. |
| **Delivery Receipt Tokens**        | Add purpose-scoped public delivery receipt links for selected outbound emails without exposing sessions or message bodies.                        | Behavioral reference; no code reuse. |
| **Fiscal-Host Workflow Design**    | Model fiscal-host program relationships and restricted-fund reporting cues as legal-operational metadata before adding accounting dimensions.     | Behavioral reference; no code reuse. |
| **Jurisdictional Trust Reporting** | Add cautious trust report/export shapes over current balances, approvals, reconciliations, variance explanations, and matter jurisdiction labels. | Behavioral reference; no code reuse. |

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat AGPL/GPL/LGPL/EPL/source-available, mixed-license, and unclear-license projects as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific legal review is complete.
