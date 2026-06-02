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
    [Clio product specification review](reference-review-clio-2026-05-26.md) as the planning lens
    for the remaining live parity rows. OP-T135 and OP-T136 are Done, and OP-T138 and OP-T139
    remain the next Candidate picks. Shipped OP-T127 through OP-T137 and OP-T140 through OP-T142
    work remains archived proof rather than future backlog.

### Phase 4: Clio-Informed Functional Parity (Candidate)

This product phase translates the Clio-only product-spec review into independently authored Open
Practice planning. Clio remains proprietary reference research: no Clio assets, prose, screenshots,
schemas, templates, API examples, or UI structure should be copied into Open Practice. Candidate
rows live in `docs/planning-and-progress.md`; this section holds the durable product direction.

1.  **Completed Parity Slices**: OP-T127 through OP-T137 and OP-T140 through OP-T142 are shipped in
    the live workboard. Their future work belongs in new candidate rows rather than stale
    reimplementation language here.
2.  **Billing, Payments, Trust, And Accounting**: OP-T135 delivered the hosted payment-request shell
    boundary, and OP-T136 delivered operating-vs-trust account posture, match-rule profiles,
    protected-funds cues, metadata-only bank-feed shell posture, and review-only accounting
    dashboards. Live settlement, card storage, bank-feed automation, automatic trust posting,
    payment-plan enforcement, automatic matching/disbursement, and certified accounting claims stay
    out of scope until their processor, reconciliation, and compliance profiles are approved.
3.  **AI And Legal Work**: OP-T138 and OP-T139 should expand async assist into review-first
    operational proposals and a staff-only legal research workspace shell. Generated content, source
    text, and research artifacts must remain redacted from jobs/audit metadata, and AI output must
    require human approval before changing source records.

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
