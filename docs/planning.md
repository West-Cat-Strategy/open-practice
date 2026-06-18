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

1.  **Core-Suite Clio Parity Goal**: The 2026-05-26
    [Clio product specification review](reference-review-clio-2026-05-26.md) has been reconciled
    through OP-T142, OP-T143 closed the follow-up provider/object-encryption lane, and the
    2026-06-04 [core-suite parity gap audit](validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md)
    refreshed the next practical parity backlog. OP-T144 has shipped the first client portal
    action-workspace slice, OP-T145 has shipped the first client-visible billing workspace slice,
    OP-T146 has shipped the first staff-only task/deadline review surface, OP-T147 has shipped the
    first review-first intake follow-up/source-attribution slice, OP-T148 has shipped the first
    scheduled-reporting/report-builder posture slice, OP-T149 has shipped the first payment
    settlement/reconciliation review slice, OP-T150 has shipped the first bank-feed reconciliation
    review slice, OP-T151 has shipped the first legal-research provider job boundary slice, OP-T152
    has shipped the scoped developer API enforcement/webhook replay boundary, and OP-T156 has
    shipped a follow-up client portal permissioned workspace slice over safe matter details,
    account-bound per-file document visibility, embedded signer actions, and browser UI/UX proof.
    No active candidate remains in this core-suite parity pass.

### Phase 4: Clio-Informed Functional Parity (Active Candidate Refresh)

This product phase translates the Clio-only product-spec review into independently authored Open
Practice planning. Clio remains proprietary reference research: no Clio assets, prose, screenshots,
schemas, templates, API examples, or UI structure should be copied into Open Practice. Candidate
rows live in `docs/planning-and-progress.md`; this section holds the durable product direction.

1.  **Completed Parity Slices**: OP-T127 through OP-T152 plus the OP-T156 follow-up are shipped in
    the live workboard. OP-T144 adds the first grouped logged-in client action workspace over
    existing portal grants, document exchange records, redacted conversation cues, calendar
    guest-session cues, and contact-bound payment-request summaries. OP-T145 adds a read-only
    client billing projection over contact-matched visible invoices and hosted payment-request
    shell records without checkout, settlement, processor, trust-posting, or invoice-balance
    mutation behavior. OP-T156 follows those completed rows with account-bound portal grants,
    explicit per-file document visibility, safe matter metadata, and embedded signer actions while
    leaving raw document delivery, previews, storage keys, signing URLs, provider evidence, live
    chat, SMS, and public-token rewrites out of scope. OP-T146 adds a
    staff-only task/deadline review projection and Queues dashboard surface with priority,
    assignment, matter labels, privacy visibility, and scheduling-review cues while leaving
    automation and client-visible deadline views out of scope. OP-T147 adds a review-first intake
    follow-up/source-attribution projection over the existing staff intake pipeline with safe source
    label provenance, canned follow-up review cues, source-quality counters, and explicit false
    automation-boundary flags while leaving matter creation, campaigns, SMS, bulk delivery,
    ad-spend ingestion, automatic client contact, and private source material out of scope. OP-T148
    adds schedule-readiness, report-builder, and export-job posture metadata over the existing
    staff reporting workspace and manual export flow while leaving scheduler tables, scheduled
    execution, scheduled email delivery, custom SQL, BI embeds, mutable report-builder execution,
    raw report-body storage, and broad report execution out of scope. OP-T149 adds authenticated
    staff-side normalized settlement-event review posture on hosted payment-request shells with
    Billing dashboard review copy while leaving raw webhook bodies, signing material, public
    provider webhooks, replay recovery, manual-payment creation, invoice-balance mutation,
    reconciliation creation, refund/chargeback handling, card vaulting, trust posting, and
    production Stripe claims out of scope. OP-T150 adds derived bank-feed reconciliation review
    posture and import-batch metadata to the trust controls workspace while leaving live bank feeds,
    provider credentials/payloads, statement rows/evidence storage, automatic matching, automatic
    ledger posting, automatic reconciliation, trust disbursement automation, operating account
    taxonomy changes, and certified accounting claims out of scope. OP-T151 adds a reserved
    matter-scoped legal-research provider job boundary and citation-review controls over the
    existing research workspace while leaving prompts, source text, provider evidence, scraped
    authority storage, citation-verification claims, legal-advice automation, client/public research
    access, and downstream source-record mutation out of scope. OP-T152 adds explicit developer app
    enforcement posture, requires the registered `webhook.deliver` scope for webhook subscription
    posture, and adds app-scoped confirmed replay over failed/dead-letter connector outbox rows
    while leaving public developer auth, marketplace behavior, broad external API coverage, live
    payment-link API exposure, custom-action execution, raw webhook replay, inbound webhook
    recovery, and provider-specific recovery tools out of scope. Future work belongs in new
    candidate rows rather than
    stale reimplementation language here. The 2026-06-04 audit keeps the active goal focused on
    practical core-suite parity, not cloning every Clio feature or making production-equivalence
    claims.
2.  **Billing, Payments, Trust, And Accounting**: OP-T135 delivered the hosted payment-request shell
    boundary, and OP-T136 delivered operating-vs-trust account posture, match-rule profiles,
    protected-funds cues, metadata-only bank-feed shell posture, and review-only accounting
    dashboards. The 2026-06-17 payment import/deposit matching boundary packet keeps processor
    imports, deposit proposals, refunds, and chargebacks as reviewer-owned evidence only until a
    later runtime slice proves payload redaction, reviewer evidence, and funds controls. Live
    settlement, provider payload retention, card storage, bank-feed automation, automatic trust
    posting, payment-plan enforcement, automatic matching/disbursement, invoice-balance mutation
    without reviewer evidence, and certified accounting claims stay out of scope until their
    processor, reconciliation, and compliance profiles are approved.
3.  **AI And Legal Work**: OP-T138 adds review-first operational proposals over the existing async
    assist boundary, and OP-T139 adds the staff-only legal research workspace shell for bounded
    cited-source notes, matter-context attachments, document-analysis status, strategy/timeline
    notes, and review checkpoints. Generated content or staff-authored notes can live only on
    authorized review artifacts; source text, prompts, generated proposal bodies, research notes,
    scraped authority text, and provider evidence must remain redacted from jobs/audit metadata, and
    AI output or research status must require human approval before any future source-record change.
4.  **Current Candidate Backlog**: No active candidate remains in the 2026-06-04 core-suite parity
    pass after OP-T144 through OP-T152 shipped their first slices with row-local proof.
    Enterprise-only Operate/Docket, native mobile apps, e-filing, and practice-specific add-ons are
    watch items, not part of this core-suite pass.

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
