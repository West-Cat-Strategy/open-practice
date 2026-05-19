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
    contact dossiers, contact review queues, append-only contact data-quality reviewer decisions,
    reviewer-only document suggestion summaries, and operations focus panels are live as read-only
    or constrained workflow surfaces.
3.  **Communications And Connectors Foundation**: SMTP outbox queueing, email delivery state,
    inbound email triage, communications inbox aggregation, conversation topics/lifecycle,
    connector registry/outbox, and preview-only outbound webhook guardrails are live.
4.  **Intake, Drafting, And Assistive Review**: Guided intake packages, answer snapshots,
    staff QA/preview, public draft save/reload, office-style draft exports, and synchronous
    review-first draft/document assist are live without automatic source-record mutation.
5.  **Calendar, Meeting, Trust, And Specialized Controls**: Calendar attendee/invitation flows,
    CalDAV/iCalendar export, stored meeting-link boundary, native guest-session lobby controls,
    fiscal-host metadata cues, trust reconciliation records, and read-only jurisdictional trust
    reports are live with cautious non-certified compliance language.

Next operational scale priorities:

1.  **Async Billing And Trust Exports**: Move larger billing or trust exports behind capped direct
    responses and async job status while keeping export bodies out of job metadata.
2.  **Trust And Billing Follow-Through**: Add reconciliation exception resolution records and
    billing-period/rate controls while keeping trust ledger posting explicit and separate.
3.  **Delivery Receipt Tokens**: Add purpose-scoped public receipt links for selected outbound
    emails without exposing sessions, recipient lists, or message bodies.
4.  **Calendar Meeting Media Follow-Through**: Build only after the shipped hosted guest-session
    control plane is reviewed; future work should stay out of attendee, iCalendar, invitation,
    stored meeting-link, and status-token contracts unless those seams need targeted hardening.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run `pnpm ci:local` before handoff for stack, schema, worker, API, or lockfile changes.
