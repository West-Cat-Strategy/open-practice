# Development Backlog

This document captures the remaining opportunities for Open Practice, categorized by strategic phase. Use `docs/planning.md` for the durable roadmap and `docs/planning-and-progress.md` for live workboard tasks.

## Phase 2: Hardening & Integration (Current)

| Topic                   | Action-Oriented Goal                                                                                      |
| :---------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Worker Processors**   | Integrate Tesseract OCR and Whisper transcription into the `apps/worker` pipeline for verified documents. |
| **Email Delivery**      | Wire the Mailpit/Postal adapters for automated signature request notifications and firm alerts.           |
| **Advanced Auth**       | Complete the SimpleWebAuthn lifecycle, including MFA policy enforcement and credential recovery.          |
| **Drafting Foundation** | Implement the TipTap-backed drafting API with versioning, sanitization, and structured template support.  |
| **Inbound Triage**      | Automate parsing of inbound email into matter-scoped messages and document attachments.                   |
| **Trust Hardening**     | Transition from domain-only invariants to persistent DB-level concurrency and approval gates.             |

## Phase 3: Operational Scale (Upcoming)

| Topic                 | Action-Oriented Goal                                                                             |
| :-------------------- | :----------------------------------------------------------------------------------------------- |
| **Secure Shares**     | Implement time-bound, password-protected portal share links for documents and intake sessions.   |
| **External Uploads**  | Build the client-facing upload intent flow for secure document collection from external parties. |
| **Assistive AI**      | Integrate Ollama/LM Studio for local, private drafting assistance and matter summarization.      |
| **Guided Intake**     | Expand the intake engine to support branching logic and multi-document automation packages.      |
| **Specialized Flows** | Add support for nonprofit fiscal hosting and multi-jurisdiction trust ledger reporting.          |

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat j-lawyer.org, paperless-ngx, and Midaz as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific legal review is complete.
