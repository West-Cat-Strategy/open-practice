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

The April 2026 reference expansion added fresh local clones for document-management, CRM,
communications, scheduling, and workflow-orchestration projects. These candidates are concrete
backlog inputs, not active workboard commitments.

| Topic                                   | Candidate Goal                                                                                                                                                | Reference Inputs                                                |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| **Upload Review Lifecycle**             | Add original-preserving upload states, duplicate detection, retry/delete decisions, missing-metadata queues, and access-log proof for external uploads.       | Nextcloud, Papermerge, paperless-ngx, Mayan EDMS, OpenContracts |
| **Document Processing Workbench**       | Expose OCR/text-extraction queue state, review status, metadata search, annotation-ready records, and provider-disabled states without requiring OCR.         | Papermerge, paperless-ngx, Mayan EDMS, OpenContracts            |
| **Contact Dossier Surface**             | Add contact list/detail views with linked matters, roles, aliases, identifiers, portal status, adverse/confidential flags, and conflict history.              | EspoCRM, SuiteCRM, Twenty, OpenLawOffice                        |
| **Matter Activity Timeline**            | Create a matter-scoped activity stream that ties contacts, tasks, documents, billing, shares, uploads, messages, and calendar events together.                | EspoCRM, SuiteCRM, Twenty, j-lawyer.org, ArkCase, OpenLawOffice |
| **Participant Role Vocabulary**         | Standardize owner, assignee, reviewer, follower, external party, signer, uploader, meeting guest, and portal contact labels across UI and audit logs.         | j-lawyer.org, ArkCase, EspoCRM, SuiteCRM, Twenty                |
| **Task And Deadline Workbench**         | Promote task records into my/team overdue, today, upcoming, matter, and contact queues with assignment, completion audit, and dashboard counters.             | EspoCRM, SuiteCRM, j-lawyer.org, OpenLawOffice                  |
| **Saved Operational Views**             | Add saved filters for stale matters, uncontacted clients, awaiting signature, external uploads expiring, conflicts pending review, and overdue tasks.         | Twenty, EspoCRM, SuiteCRM                                       |
| **CRM Data Quality Review**             | Add duplicate candidates, merge-review decisions, protected adverse/confidential-party rules, and conflict-check revalidation after contact changes.          | EspoCRM, SuiteCRM, Twenty                                       |
| **Secure Conversation Threads**         | Model matter-scoped message topics/rooms with retention, export, access revocation, and notification boundaries before adding real-time chat.                 | Zulip, Matrix Synapse, Mattermost, Chatwoot                     |
| **Client Communications Inbox**         | Add a matter/contact-routed inbox with labels, assignment, private staff notes, consent/channel configuration, and disabled states for unconfigured channels. | Chatwoot, Zulip, Mattermost                                     |
| **Meeting Invitation Boundary**         | Keep meeting links disabled until configured, then add tokenized guest access, lobby/host controls, audit events, retention, and calendar invites.            | Jitsi Meet, Cal.diy, Matrix Synapse, Mattermost                 |
| **Connector Registry And Outbox**       | Define native connector records, secret references, durable outbox rows, retry leases, idempotency keys, and user-visible delivery attempts.                  | Activepieces, Apache Camel, Temporal, Blnk, Apache Fineract     |
| **Audit Event Taxonomy**                | Define canonical event names, actor/resource/matter fields, and required metadata before widening audit coverage across routes and worker actions.            | Apache Fineract, Activepieces                                   |
| **Email Delivery State Machine**        | Extend outbox/email events with attempts, next retry, terminal failure, preview/send provenance, manual retry, and visible delivery history.                  | Apache Camel, Blnk, Activepieces                                |
| **Worker Run Inspection**               | Add queue-agnostic run details with terminal status, failed-step snapshots, retry strategy, next-attempt time, and operator-visible error context.            | Activepieces, Temporal, Apache Camel                            |
| **Outbound Webhook Guardrails**         | Require HTTPS destinations, event allowlists, signed payloads, test delivery, no localhost/loopback, and explicit audit events before emitting integrations.  | Activepieces, Blnk, Apache Camel                                |
| **Idempotent Job Keys**                 | Add unique replay-safe keys per resource/action/provider attempt for outbox, ledger, upload, notification, and worker jobs.                                   | Apache Camel, Blnk, Temporal                                    |
| **Workflow History And Audit Envelope** | Give mutating API/workflow actions a consistent request id, actor, matter scope, before/after audit expectations, status, retry, and error record.            | Apache Fineract, Apache Camel, Temporal, Blnk                   |
| **Guided Intake Package Runtime**       | Add versioned intake packages with JSON-driven questions, branching predicates, answer snapshots, attachments, generated documents, and replay proof.         | docassemble, SurveyJS form library, Formbricks                  |
| **Trust Reconciliation Workbench**      | Add imported statement rows, match/unmatched counts, reviewer decisions, immutable balance snapshots, and variance explanations before compliance claims.     | Blnk, Apache Fineract, LedgerSMB, Midaz                         |

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat AGPL/GPL/LGPL/EPL/source-available, mixed-license, and unclear-license projects as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific legal review is complete.
