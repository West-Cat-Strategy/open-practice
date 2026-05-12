# Open Practice Planning

This is the durable roadmap for Open Practice. Use `docs/planning-and-progress.md` for live task status and immediate next moves.

## Current Baseline

Open Practice is an Apache-2.0 TypeScript monorepo that has stabilized **Phase 1:
Foundation** and **Phase 2: Hardening & Integration**. Key accomplishments include:

- **Core Architecture**: Provider-neutral `packages/domain`, Drizzle-backed `packages/database`, and Fastify `apps/api`.
- **Operational Dashboard**: API-backed `apps/web` with permission-aware navigation and route catalogs.
- **Worker Foundation**: Redis/BullMQ `apps/worker` scaffold with job lifecycle persistence.
- **Provider Adapters**: Embedded signature and document-automation adapters in `packages/providers`.
- **Hardened Features**: WebAuthn first-run setup, matter-scoped RBAC, audit hash chains, persistent trust ledger balance guards, billing/reporting foundations, secure share links, and external upload links.
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

Completed Phase 3 slices:

1.  **Public Document Exchange**: Secure share links, external-upload links, public upload status,
    and staff upload review loops are live with token hashing, access logs, audit events, and
    storage-disabled fallbacks.
2.  **Operational Queues And Workbenches**: Audit taxonomy/coverage, document-processing status,
    worker-run inspection, task/deadline projections, built-in operational views, matter timelines,
    contact dossiers, contact review queues, and operations focus panels are live as read-only or
    constrained workflow surfaces.
3.  **Communications And Connectors Foundation**: SMTP outbox queueing, email delivery state,
    inbound email triage, communications inbox aggregation, conversation topics/lifecycle,
    connector registry/outbox, and preview-only outbound webhook guardrails are live.
4.  **Intake, Drafting, And Assistive Review**: Guided intake packages, answer snapshots,
    staff QA/preview, public draft save/reload, office-style draft exports, and synchronous
    review-first draft/document assist are live without automatic source-record mutation.
5.  **Calendar, Meeting, Trust, And Specialized Controls**: Calendar attendee/invitation flows,
    CalDAV/iCalendar export, stored meeting-link boundary, fiscal-host metadata cues, trust
    reconciliation records, and read-only jurisdictional trust reports are live with cautious
    non-certified compliance language.

Next operational scale priorities:

1.  **Document Suggestions Review Queue**: Promote OP-T85 as the next concrete backlog pick:
    reviewer-only OCR/extraction suggestions for classification, duplicate/supersession,
    matter/contact hints, and missing metadata without automatic merge or classification.
2.  **Calendar And Native Meeting Controls**: Add calendar event write/reschedule/reminder records
    and later native WebRTC guest-session controls without redoing shipped attendees, iCalendar,
    invitations, or stored meeting-link boundaries.
3.  **Async Local AI Jobs**: Move selected matter/document summary and drafting-assist requests
    behind disabled-by-default queue jobs while preserving reviewed, non-authoritative outputs.
4.  **Connector/Webhook Delivery**: Turn existing connector outbox rows into a first delivery worker
    slice with HTTPS allowlists, signing, leases, delivery attempts, and redacted dead-letter state.
5.  **Conversation And Communications Follow-Through**: Add matter-scoped conversation message
    records, communications ownership, private staff notes, and consent/channel follow-up state
    without adding realtime chat or duplicating existing inbox triage.
6.  **Resolution And Reporting Surfaces**: Add contact data-quality decision records, audit
    projection summaries, async report export requests, delivery receipt tokens, and saved
    operational-view expansion beyond the current queue-dashboard surface.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run `pnpm ci:local` before handoff for stack, schema, worker, API, or lockfile changes.
