# Open Practice Planning

This is the durable roadmap for Open Practice. Use `docs/planning-and-progress.md` for live task status and immediate next moves.

## Current Baseline

Open Practice is an Apache-2.0 TypeScript monorepo that has stabilized **Phase 1:
Foundation** and **Phase 2: Hardening & Integration**. Key accomplishments include:

- **Core Architecture**: Provider-neutral `packages/domain`, Drizzle-backed `packages/database`, and Fastify `apps/api`.
- **Operational Dashboard**: API-backed `apps/web` with permission-aware navigation and route catalogs.
- **Worker Foundation**: Redis/BullMQ `apps/worker` scaffold with job lifecycle persistence.
- **Provider Adapters**: Embedded signature and document-automation adapters in `packages/providers`.
- **Hardened Features**: WebAuthn first-run setup, matter-scoped RBAC, audit hash chains, persistent trust ledger balance guards, and billing/reporting foundations.
- **Module extraction**: Extraction of Auth, Session, Matters, Ledger, Documents, Signatures, and Intake into owned API registrars.

## Strategic Phases

### Phase 2: Hardening & Integration (Complete)

Strengthened the system of record and automated high-frequency workflows.

1.  **Worker Processors**: Implemented concrete Tesseract OCR and text-extraction processors for verified documents.
2.  **Notification Delivery**: Implemented outbound email delivery (Postal/Mailpit) for signature requests and alerts.
3.  **Advanced Auth**: Completed SimpleWebAuthn MFA, passkey authentication, and recovery paths.
4.  **Drafting & Templates**: Implemented the TipTap/ProseMirror foundation for structured drafting and template management.
5.  **Inbound Triage**: Implemented mail parsing and matter-scoped inbound correspondence storage.
6.  **Trust Hardening**: Added persistent client trust-balance guards, atomic ledger posting updates, and tighter approval/reconciliation persistence rules.

### Phase 3: Operational Scale (Current Focus)

Expand the ecosystem for secure collaboration, controlled automation, and operational workflows that
stay local-first, matter-scoped, and auditable.

1.  **Secure Shares**: Replace disabled share-creation scaffolding with token-hashed,
    time-bound, revocable portal share links for documents and intake sessions.
2.  **External Uploads**: Turn the guarded upload-intent scaffold into expiring,
    revocable document collection links for external parties, with S3 completion checks and audit
    records.
3.  **Audit Coverage**: Broaden append-only audit events across signature, intake, drafting,
    document, billing, ledger, email, share, and external-upload state changes.
4.  **Email Workflow Closure**: Connect the local SMTP/outbox worker foundation to API preview/send
    flows for signature, intake, share, upload, and future meeting notices.
5.  **Guided Intake**: Expand the embedded intake engine with branching logic, reusable packages,
    and multi-document automation while keeping generated records inside Open Practice.
6.  **Local AI Drafting Assist**: Add disabled-by-default Ollama/LM Studio review workflows for
    draft assistance and matter/document summarization; generated text remains non-authoritative
    draft material.
7.  **Calendaring and Meeting Management**: Grow the existing `calendar_events` schema and
    `calendar_event` permissions into matter-scoped events with attendees, reminders,
    rescheduling/cancellation records, audit events, outbound iCalendar/webcal sync, and optional
    self-hostable WebRTC meeting links behind explicit configuration.
8.  **Specialized Workflows**: Add focused support for legal clinics, nonprofit fiscal hosts,
    complex trust accounting, and multi-jurisdiction trust reporting without making
    jurisdiction-certified compliance claims.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run `pnpm ci:local` before handoff for stack, schema, worker, API, or lockfile changes.
