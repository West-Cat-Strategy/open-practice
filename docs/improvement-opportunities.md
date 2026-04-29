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

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat j-lawyer.org, paperless-ngx, and Midaz as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific legal review is complete.
