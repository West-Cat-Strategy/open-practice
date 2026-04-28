# Open Practice Planning

This is the durable roadmap for Open Practice. Use `docs/planning-and-progress.md` for live task status and immediate next moves.

## Current Baseline

Open Practice is an Apache-2.0 TypeScript monorepo that has stabilized its **Phase 1: Foundation**. Key accomplishments include:

- **Core Architecture**: Provider-neutral `packages/domain`, Drizzle-backed `packages/database`, and Fastify `apps/api`.
- **Operational Dashboard**: API-backed `apps/web` with permission-aware navigation and route catalogs.
- **Worker Foundation**: Redis/BullMQ `apps/worker` scaffold with job lifecycle persistence.
- **Provider Adapters**: Embedded signature and document-automation adapters in `packages/providers`.
- **Hardened Features**: WebAuthn first-run setup, matter-scoped RBAC, audit hash chains, trust ledger invariants, and billing/reporting foundations.
- **Module extraction**: Extraction of Auth, Session, Matters, Ledger, Documents, Signatures, and Intake into owned API registrars.

## Strategic Phases

### Phase 2: Hardening & Integration (Current Focus)

Strengthen the system of record and automate high-frequency workflows.

1.  **Worker Processors**: Implement concrete Tesseract OCR and Whisper transcription processors for verified documents.
2.  **Notification Delivery**: Implement outbound email delivery (Postal/Mailpit) for signature requests and alerts.
3.  **Advanced Auth**: Full SimpleWebAuthn MFA, passkey authentication, and multi-factor recovery paths.
4.  **Drafting & Templates**: TipTap/ProseMirror foundation for structured drafting and template management.
5.  **Inbound Triage**: Mail parsing and automated matter triage/filing for inbound correspondence.

### Phase 3: Operational Scale (Future Phase)

Expand the ecosystem for secure collaboration and intelligent assistance.

1.  **Secure Shares**: Secure, time-bound portal sharing for documents and intake sessions.
2.  **External Uploads**: Guarded S3 upload intents for external parties/clients.
3.  **Assistive AI**: Ollama/LM Studio integration for drafting assistance and document summarization.
4.  **Specialized Workflows**: Deeper integration for legal clinics, nonprofit fiscal hosts, and complex trust accounting.

10. **Calendaring and meeting management**
    Grow the existing `calendar_events` schema and `calendar_event` permissions into matter-scoped
    events with attendees, reminders, rescheduling/cancellation records, audit events, and outbound
    email invitations. Plan WebRTC meeting support behind self-hostable/private signaling plus
    STUN/TURN configuration, disabled until explicitly configured. Meeting request emails should
    carry both the iCalendar invite and meeting link in the same message. Recipient meeting links
    should work without Open Practice authentication, but only through tokenized,
    expiring/revocable capabilities scoped to the meeting room, meeting chat, and document upload
    during that meeting. Meeting chat and uploads should become audited matter-linked records
    without exposing broader matter, portal, document, billing, trust/funds, or firm data. Calendar
    sync v1 should be outbound iCalendar/webcal subscription, including iOS one-click setup; two-way
    provider sync stays deferred until a provider-auth, conflict-resolution, and privacy plan lands.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run `pnpm verify` before handoff for stack, schema, worker, API, or lockfile changes.
