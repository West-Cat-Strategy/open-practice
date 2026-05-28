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
    contact dossiers, contact review queues, reviewer-only document suggestion summaries, and
    operations focus panels are live as read-only or constrained workflow surfaces. Contact
    data-quality reviewer decisions and additional saved matter view preset families are now part of
    this constrained workflow baseline.
3.  **Communications And Connectors Foundation**: SMTP outbox queueing, email delivery state,
    inbound email triage, communications inbox aggregation, conversation topics/lifecycle,
    connector registry/outbox, opt-in delivery receipt tokens, and preview-only outbound webhook
    guardrails are live.
4.  **Intake, Drafting, And Assistive Review**: Guided intake packages, answer snapshots,
    staff QA/preview, public draft save/reload, office-style draft exports, and synchronous
    review-first draft/document assist are live without automatic source-record mutation.
5.  **Calendar, Meeting, Trust, And Specialized Controls**: Calendar attendee/invitation flows,
    CalDAV/iCalendar export, stored meeting-link boundary, native guest-session lobby controls,
    fiscal-host metadata cues, trust reconciliation records, review-only reconciliation exception
    records, async billing/trust export requests, billing-period/rate controls, and read-only
    jurisdictional trust reports are live with cautious non-certified compliance language.

Next operational scale priorities:

1.  **Clio-Informed Product Suite Completion**: Use the 2026-05-26
    [Clio product specification review](reference-review-clio-2026-05-26.md) as the next planning
    lens. The live Candidate rows OP-T127 through OP-T142 are the active backlog for functional
    parity with Clio-style practice-management expectations, while shipped OP-T108 through OP-T126
    work remains archived proof rather than future backlog.
2.  **Policy Gate Cleanup**: Resolve or explicitly document the OSS reuse lock/index policy block
    before claiming a fully green policy lane for the next implementation slice.

### Phase 4: Clio-Informed Functional Parity (Candidate)

This product phase translates the Clio-only product-spec review into independently authored Open
Practice planning. Clio remains proprietary reference research: no Clio assets, prose, screenshots,
schemas, templates, API examples, or UI structure should be copied into Open Practice. Candidate
rows live in `docs/planning-and-progress.md`; this section holds the durable product direction.

1.  **Matter System Of Record**: OP-T127 should add reviewed matter stage/setup semantics, custom
    field definitions, responsible-user posture, and reusable matter setup patterns before widening
    into workflow automation.
2.  **Client Collaboration And Portal Accounts**: OP-T128 should turn existing public-token,
    external-upload, intake, and guest-session records into the first logged-in client account
    workspace. Start with staff-owned account setup, client action summaries, and redacted access
    posture before realtime chat, broad document browsing, live payments, or native mobile work.
3.  **Growth, Intake, CRM, And Scheduling**: OP-T129 through OP-T132 should deepen intake pipeline
    status/source reporting, contact relationship modeling, reviewed scheduling/deadline workflows,
    and matter-linked channel history. The first slices should remain staff-reviewed and avoid
    marketing automation, SMS outreach, external CRM sync, court-rule automation, provider calendar
    sync, or automatic matter creation.
4.  **Documents, Signatures, Time, Billing, Payments, And Accounting**: OP-T133 through OP-T137
    should add original document-assembly/signature-envelope metadata, timer-to-draft time-entry
    capture, hosted payment request records, trust/accounting reconciliation depth, and saved report
    definitions. Live settlement, card storage, payment plans, bank-feed automation, automatic trust
    posting, custom SQL, scheduled report delivery, and certified accounting claims stay out of scope
    until their processor, reconciliation, and compliance profiles are approved.
5.  **AI And Legal Work**: OP-T138 and OP-T139 should expand async assist into review-first
    operational proposals and a staff-only legal research workspace shell. Generated content, source
    text, and research artifacts must remain redacted from jobs/audit metadata, and AI output must
    require human approval before changing source records.
6.  **Platform, Mobile, Admin, And Migration Readiness**: OP-T140 through OP-T142 should define the
    developer/integration boundary, mobile field-workflow readiness, and visible admin/migration/data
    portability posture. Start with scoped credentials, webhook subscription posture, responsive web
    proof, support-access controls, export/import vocabulary, and onboarding checklists before any
    app marketplace, native app, offline sync, push notification, or broad public developer launch.

Phase 4 validation should continue to start with
`pnpm verify:select -- --files <changed paths...>`, then run the selected package checks plus
`pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `git diff --check` unless a
specific slice justifies broader `pnpm ci:local` coverage.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run `pnpm ci:local` before handoff for stack, schema, worker, API, or lockfile changes.
