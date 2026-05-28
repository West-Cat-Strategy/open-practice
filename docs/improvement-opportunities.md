# Development Backlog

This document captures candidate opportunities for Open Practice. Use `docs/planning.md` for the
durable roadmap, `docs/planning-and-progress.md` for live workboard tasks, and `docs/archive/` for
completed proof. Items here are not active commitments until promoted to the live workboard.

Keep this file candidate-only: if a slice is already shipped, the archive owns the evidence and the
row should not stay here as future work.

## Candidate Backlog

These candidates name the next smallest useful unimplemented slice. Each row also states the shipped
surface it must not duplicate.

The persistent trust statement import batch metadata gap is shipped as OP-T118; future trust
statement match-rule profiles should be promoted as their own candidate only after comparing
against the shipped OP-T104 preview, OP-T107 exception-resolution, and OP-T118 batch metadata
proof.

### Clio-Informed Functional-Parity Candidates - 2026-05-27

These candidates mirror the live Candidate rows OP-T127 through OP-T142 in
`docs/planning-and-progress.md`. They come from the Clio-only product-spec review and the local Open
Practice audit. Clio remains proprietary public-product research; use this section for independent
planning only, with no copied Clio prose, assets, screenshots, templates, schemas, API examples, or
UI structure. Older reference-review candidates below remain useful source detail, but they should be
promoted through these parity rows rather than as duplicate live work.

- **OP-T127 matter stage and setup model**
  - **First slice:** Add reviewed matter stage/setup semantics with custom-field definitions,
    responsible-user posture, reusable setup checklist templates, and matter financial snapshot cues.
  - **Local gap / shipped boundary:** OP has matter records, assignments, conflicts, billing/trust
    projections, and a first-matter create path, but not Clio-like stage/setup depth.
  - **Out of scope:** Automatic workflow transitions, external sync, and jurisdiction-specific rule
    automation.

- **OP-T128 client portal account workspace**
  - **First slice:** Add the smallest logged-in client account workspace over existing secure-share,
    external-upload, intake, guest-session, receipt, and client-action records.
  - **Local gap / shipped boundary:** OP has strong public-token actions and portal-access activity
    proof, but no durable client account workspace. Do not duplicate OP-T117 or rewrite token routes.
  - **Out of scope:** Realtime chat, broad document browsing, live payments, native mobile apps, and
    token-route rewrites.

- **OP-T129 intake pipeline and source reporting**
  - **First slice:** Promote public consultation and intake-session records into a lead
    pipeline/source reporting model with staff statuses, conflict-review posture, appointment/request
    links, and conversion counts.
  - **Local gap / shipped boundary:** Public consultation intake is review-first and staff-owned, but
    pipeline/source analytics are not modeled as a CRM surface.
  - **Out of scope:** Marketing automation, ad-spend ingestion, SMS outreach, bulk campaign delivery,
    and automatic matter creation.

- **OP-T130 contact relationship graph and CRM taxonomy**
  - **First slice:** Add read-only contact-to-contact relationship records and CRM-style taxonomy cues
    in contact dossiers.
  - **Local gap / shipped boundary:** Contact dossiers expose matter-party links and review signals,
    while duplicate/conflict/data-quality controls remain separate; relationship modeling is absent.
  - **Out of scope:** Automatic merges, deduplication writes, external CRM sync, and conflict
    disposition automation.

- **OP-T131 calendar deadline and scheduling depth**
  - **First slice:** Add a reviewed deadline/scheduling request model that connects tasks, calendar
    events, reminder posture, scheduling-source context, owner assignment, privacy, and time-capture
    cues.
  - **Local gap / shipped boundary:** Calendar lifecycle and email reminder jobs shipped, but
    scheduling request depth, court-rule-style review posture, and preference routing are not first
    class.
  - **Out of scope:** Court-rule automation, provider calendar sync, meeting media, public room URLs,
    automatic deadline creation, and automatic reminder cancellation.

- **OP-T132 communications channel history and client updates**
  - **First slice:** Deepen matter-linked communication history across inbound email, outbound email,
    internal conversations, phone/text note placeholders, and client-update draft requests.
  - **Local gap / shipped boundary:** OP has communication records and notifications, but no
    Clio-like channel-history layer that also prepares staff-reviewed client updates.
  - **Out of scope:** Live SMS delivery, public portal composer, realtime chat, and automatic
    client-update sends.

- **OP-T133 document assembly and signature-envelope model**
  - **First slice:** Add OP-authored envelope/document-assembly metadata for signer order,
    field-placement validation, package assembly status, matter-data population posture, and reusable
    document-set definitions.
  - **Local gap / shipped boundary:** Document storage, exports, generated package metadata, and
    embedded signatures exist, but reusable envelope and field-placement models do not.
  - **Out of scope:** Third-party template import, copied forms, automatic legal drafting, and public
    signing UX rewrites.

- **OP-T134 time and expense capture depth**
  - **First slice:** Add a local timer-to-draft-time-entry flow plus expense category/profile cues
    that always create reviewable draft records and respect billing period locks before submit or
    approve.
  - **Local gap / shipped boundary:** Time-entry capture, rate rules, approvals, write-off, expenses,
    and locks exist, but no timer capture or managed expense-category depth exists.
  - **Out of scope:** Native mobile capture, automatic billing, external time-tool sync, and lock
    bypasses.

- **OP-T135 billing approval and payment collection flow**
  - **First slice:** Add hosted payment-request/link shell records tied to issued invoices, bill
    delivery/reminder state, payment-plan placeholders, credits/write-offs posture, and manual
    payment evidence without moving funds.
  - **Local gap / shipped boundary:** Manual payments and trust-transfer review exist, but no hosted
    client-facing payment request shell or payment-plan posture exists.
  - **Out of scope:** Card storage, processor settlement, tap-to-pay, automatic reconciliation, trust
    posting, and payment-plan enforcement.

- **OP-T136 trust/accounting reconciliation depth**
  - **First slice:** Add operating-vs-trust account posture, reconciliation freshness, statement
    match-rule profiles, protected-funds cues, bank-feed import shell records, vendor/expense
    accounting dimensions, and review-only accounting dashboards.
  - **Local gap / shipped boundary:** Trust ledger guards, statement previews, exception decisions,
    import batches, and jurisdictional reports exist, but accounting-style reconciliation depth is
    still partial.
  - **Out of scope:** Live bank feeds, automatic transaction matching, automatic disbursement,
    accounting certification, and jurisdiction-specific compliance claims.

- **OP-T137 reporting workspace and saved report definitions**
  - **First slice:** Add a staff reporting workspace with saved report definitions, filters/grouping
    metadata, export profiles, history, and first reports for invoice aging, reconciliation freshness,
    productivity, and operational follow-up.
  - **Local gap / shipped boundary:** Async exports and operational dashboards exist, but repeatable
    management reports remain scattered across projections.
  - **Out of scope:** Custom SQL, BI embeds, scheduled report email delivery, raw report bodies in
    job metadata, and certified accounting reports.

- **OP-T138 AI operational action proposals**
  - **First slice:** Expand async assist into review-first operational proposals for deadlines,
    tasks, document organization, draft invoice cues, and client-update drafts with source context.
  - **Local gap / shipped boundary:** Async assist jobs create non-authoritative records, but AI does
    not yet propose operational changes for staff approval.
  - **Out of scope:** Autonomous mutation, provider-specific LLM commitments, privileged text in
    jobs/audits, and legal advice claims.

- **OP-T139 legal research workspace shell**
  - **First slice:** Add a staff-only legal research workspace shell for cited-source notes,
    matter-context attachment, document-analysis artifact status, strategy/timeline notes, and review
    checkpoints without connecting a live provider.
  - **Local gap / shipped boundary:** OP has drafting and document review foundations, but no
    substantive legal research workspace boundary.
  - **Out of scope:** Proprietary research content, scraped authority storage, automated advice, and
    source-citation claims.

- **OP-T140 integration developer boundary**
  - **First slice:** Define OAuth-style app registration, scoped API credentials, webhook
    subscriptions, regional endpoint posture, rate-limit posture, custom-action placeholders, and
    redacted delivery history using the existing connector registry/outbox as the base.
  - **Local gap / shipped boundary:** Connector registry/outbox and owner-only recovery controls
    exist, but no public developer boundary or app registration model exists.
  - **Out of scope:** Public app marketplace behavior, third-party app review, broad model coverage,
    live payment-link API exposure, and provider-specific recovery tools.

- **OP-T141 mobile field workflow readiness**
  - **First slice:** Inventory and harden mobile-sized staff/client web workflows for matter lookup,
    task review, time capture, document upload/scanning handoff, client response, bill/payment
    status, and security posture.
  - **Local gap / shipped boundary:** Responsive dashboard proof exists across specific slices, but
    mobile field workflows are not planned as a cohesive product surface.
  - **Out of scope:** Native iOS/Android delivery, offline sync, push notifications, device
    biometrics, and payment capture.

- **OP-T142 admin, migration, and data portability readiness**
  - **First slice:** Make admin/security/migration posture product-visible with role/support-access
    controls, export/import readiness, onboarding/migration checklists, regional/privacy posture
    notes, training/support surfaces, and tenant-safe backup/restore evidence.
  - **Local gap / shipped boundary:** OP has strong local-first policy and release proof surfaces, but
    migration/onboarding/data-portability readiness is not a visible product workflow.
  - **Out of scope:** Public compliance claims, production migration services, regional hosting
    guarantees, and support impersonation.

### Reference Review Candidates - 2026-05-22

This catalogue came from a clean-room comparison of the current Open Practice repo against the
central reference corpus at `/Users/bryan/projects/reference-repos`. OP-T108 through OP-T113 are
treated as shipped work and are not re-proposed here. No third-party code, schemas, UI, tests,
assets, or distinctive prose are copied into this repo by this catalogue.

#### Intake, Documents, And Signing

- **Intake widget registry and validator adapter**
  - **First slice:** Add an original domain/web registry that maps OP intake item kinds to renderer,
    validation, and preview adapters while preserving the existing public runner behavior.
  - **Local gap / shipped boundary:** Intake item types and rendering are still directly switched in
    `packages/domain/src/intake.ts` and the intake form renderer; OP-T92 diagnostics shipped, but
    not a pluggable widget boundary.
  - **References:** `rjsf-team__react-jsonschema-form`,
    `surveyjs__survey-library`, and `formio__formio.js` source indexes.
  - **Reuse and snippets:** SurveyJS runtime is permissive enough for tiny attributed snippets after
    a reuse decision, but this candidate should stay behavior-level unless implementation scope
    explicitly opens provenance review. RJSF/Form.io stay reference-only in the current corpus.

- **Visual branch-rule authoring**
  - **First slice:** Add a structured branch-rule editor with preview path summaries; keep public
    form semantics unchanged.
  - **Local gap / shipped boundary:** Branch rules exist in the domain and runner, but definition
    editing still falls back to advanced JSON for complex rule work; OP-T92 diagnostics do not give
    staff a visual rule editor.
  - **References:** `surveyjs__survey-creator`, `surveyjs__survey-library`, and `formio__formio.js`.
  - **Reuse and snippets:** Survey Creator and Form.io remain reference-only; SurveyJS runtime
    snippets would need attribution and a documented reuse decision.

- **Immutable intake template draft/publish versions**
  - **First slice:** Separate mutable staff drafts from immutable published template versions and
    record publish metadata without changing active public links.
  - **Local gap / shipped boundary:** Intake template create/patch flows update current records and
    caller-provided definition versions; no candidate should duplicate the shipped preview or
    diagnostics lane.
  - **References:** `heyform__heyform` and `jhumanj__opnform`.
  - **Reuse and snippets:** Reference-only because of license posture; no direct snippets.

- **Staff-only intake submissions operations queue**
  - **First slice:** Add a redacted submissions operations surface with status, counts, assigned
    review posture, and export-safe summaries.
  - **Local gap / shipped boundary:** OP has answer snapshots, review decisions, follow-up links,
    and proposal decisions, but no dedicated submissions table for staff triage.
  - **References:** `heyform__heyform`, `jhumanj__opnform`, and `kobotoolbox__kpi`.
  - **Reuse and snippets:** Reference-only; no direct snippets.

- **Interview-to-document assembly queue**
  - **First slice:** Queue generated package assembly from existing OP snapshots and draft export
    providers, with redacted job metadata and no source-record mutation.
  - **Local gap / shipped boundary:** OP stores generated-document metadata and package replay
    proof, but assembly is not a worker-owned queue. Do not revive docassemble as a runtime
    dependency.
  - **References:** `jhpyle__docassemble`.
  - **Reuse and snippets:** The project is MIT, but current OP posture is reference-only; no direct
    snippets without a reuse decision.

- **Signature envelope, field placement, and signing-order model**
  - **First slice:** Add OP-authored envelope metadata for signer order and field placement
    validation over existing embedded signature records.
  - **Local gap / shipped boundary:** OP tracks signers, events, and evidence packets, but not a
    reusable envelope/template/field-placement model.
  - **References:** `documenso__documenso` and `docusealco__docuseal`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Private document conversion and annotation research spike**
  - **First slice:** Prototype an optional local conversion/annotation boundary that stores only
    redacted summaries, not raw client text in job metadata.
  - **Local gap / shipped boundary:** OCR extraction exists, but annotation, redaction, chunking,
    Markdown conversion, and semantic review surfaces are absent.
  - **References:** `unstructured-io__unstructured`, `microsoft__markitdown`,
    `getomni-ai__zerox`, and `open-source-legal__opencontracts`.
  - **Reuse and snippets:** Current posture is research/reference-only despite some permissive
    licenses; no snippets until privacy, provider, and provenance posture are documented.

#### Communications, Workflows, And Meetings

- **Structured email template drafts**
  - **First slice:** Add provider-neutral saved email template drafts plus preview snapshots, without
    campaign automation or live sends.
  - **Local gap / shipped boundary:** Email preview is render-only and future template management is
    documented as out of scope.
  - **References:** `usewaypoint__email-builder-js`.
  - **Reuse and snippets:** MIT/adapt-with-attribution; a dependency or tiny attributed excerpt may
    be allowable after `docs/reuse-decision-policy.md` review.

- **Reminder cancellation and pending-job refresh**
  - **First slice:** Reconcile queued reminder notification jobs when a staff user cancels,
    reschedules, or refreshes a pending reminder record, keeping dashboard reminders as the source
    of truth.
  - **Local gap / shipped boundary:** OP-T121 shipped delayed email reminder delivery; cancellation,
    pending-job refresh, non-email delivery, and user preference routing remain future work.
  - **References:** `calcom__cal.diy`.
  - **Reuse and snippets:** MIT/adapt-with-attribution; behavior-level reuse should be enough.

- **Inbound provider webhook intake boundary**
  - **First slice:** Add one inbound-email provider webhook adapter that validates a provider
    signature and stores raw messages for the existing parser.
  - **Local gap / shipped boundary:** Existing inbound parsing handles raw messages already stored in
    object storage; provider webhooks remain deferred.
  - **References:** `chatwoot__chatwoot` and inbound-channel patterns in `paperless-ngx__paperless-ngx`.
  - **Reuse and snippets:** Chatwoot has MIT core plus enterprise directories; use architecture only
    unless a file-level review excludes enterprise-only material.

- **Workflow-step history projection**
  - **First slice:** Add a read-only workflow-step history projection over existing jobs and audit
    events for multi-step OP actions; do not adopt Temporal as a service.
  - **Local gap / shipped boundary:** OP has redacted job lifecycle records and worker health, but no
    higher-level workflow/activity history for compound actions.
  - **References:** `temporalio__temporal`, `activepieces__activepieces`.
  - **Reuse and snippets:** Temporal is MIT/adopt-selectively, but Go snippets are unnecessary; use
    vocabulary and event-history semantics.

- **Meeting availability request review**
  - **First slice:** Add staff-reviewed availability/request records for meeting scheduling without
    public room URLs, native media, signaling, chat, recordings, or provider sync.
  - **Local gap / shipped boundary:** OP-T102 and OP-T113 shipped hosted guest-session controls and
    status-only admitted handoff, not availability booking or public scheduling.
  - **References:** `calcom__cal.diy` and `jitsi__jitsi-meet`.
  - **Reuse and snippets:** Cal.diy is MIT/adapt-with-attribution and Jitsi is Apache-2.0
    adopt-selectively; keep this as behavior-level planning unless implementation scope opens reuse.

#### Authorization, Matters, Portals, And Records

- **ReBAC denial and list-visible matrix**
  - **First slice:** Catalogue relation vocabulary plus denial/list-visible fixtures for matters,
    documents, jobs, and portal links.
  - **Local gap / shipped boundary:** OP has RBAC, assigned-matter checks, and a route authorization
    manifest, but no relationship/list-object behavior matrix.
  - **References:** `openfga__openfga`.
  - **Reuse and snippets:** Apache-2.0/architecture-only; snippets require an explicit reuse decision.

- **Matter lifecycle transition journal**
  - **First slice:** Add review-only matter transition records for pause, close, archive, and reopen
    readiness with reasons and blockers.
  - **Local gap / shipped boundary:** Matter status is stored, but transitions are not journaled as a
    first-class lifecycle with blocker evidence.
  - **References:** `primeroims__primero`, `arkcase__arkcase`, and `jlawyerorg__j-lawyer-org`.
  - **Reuse and snippets:** AGPL/LGPL/reference-only; no direct snippets.

- **Inbound email to matter draft**
  - **First slice:** Create a staff-confirmed matter draft from safe inbound email headers and a
    redacted body summary; do not auto-create matters.
  - **Local gap / shipped boundary:** Inbound email triage exists, but there is no create/draft matter
    flow from an inbound message.
  - **References:** `jlawyerorg__j-lawyer-org`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Contact relationship graph**
  - **First slice:** Add read-only contact-to-contact relationship records in contact dossiers,
    separate from duplicate/conflict/data-quality controls.
  - **Local gap / shipped boundary:** Contact dossiers derive matter-party links, aliases,
    identifiers, portal grants, and review signals; they do not model relationships between contacts.
  - **References:** `civicrm__civicrm-core`, `espocrm__espocrm`.
  - **Reuse and snippets:** AGPL/high-risk architecture-only; no direct snippets.

- **Document retention and hold review**
  - **Shipped first slice:** OP-T120 surfaces read-only retention-review hints based on legal hold,
    supersession, upload/checksum/scan state, and review state in the document-processing workbench;
    no deletion automation, retention deadline, retention-policy eligibility, or compliance claim was
    added.
  - **Remaining gap:** Future work would need an explicit reviewed policy design before adding
    retention timelines, deletion workflows, or jurisdiction-specific records-disposition claims.
  - **References:** `arkcase__arkcase`, `nextcloud__server`, and `paperless-ngx__paperless-ngx`.
  - **Reuse and snippets:** LGPL/AGPL/GPL/reference-only; no direct snippets.

- **Legal clinic referral cadence**
  - **First slice:** Generate review checklist/task signals from legal-clinic profiles with
    audit-safe referral handoff metadata.
  - **Local gap / shipped boundary:** Legal-clinic profiles include review/referral dates and tasks
    exist separately, but there is no cadence/checklist bridge.
  - **References:** `primeroims__primero`, `avniproject__avni-server`, and
    `avniproject__avni-webapp`.
  - **Reuse and snippets:** Reference-only/architecture-only; no direct snippets.

- **Action-state descriptor coverage expansion**
  - **Shipped slices:** OP-T123 added the first shared descriptor for connector recovery and
    document OCR queue actions; OP-T124 extended the same boundary to public consultation Intake
    review actions; OP-T126 extended it to submitted intake review load, accept, reject, and
    more-info actions.
  - **Remaining gap:** Additional dashboard actions still need candidate-by-candidate adoption
    before a broader registry is justified; future slices should pick one implemented operational
    surface and keep explanation data read-only and domain-owned.
  - **References:** `opencrvs__opencrvs-core`, `espocrm__espocrm`.
  - **Reuse and snippets:** Architecture-only/reference-only; no direct snippets.

#### Trust, Billing, And Accounting Controls

- **Pre-post trust posting approval commands**
  - **First slice:** Add `trust_posting_requests` create/list/approve/reject semantics so selected
    trust postings can be prepared by one staff user and posted only after checker approval.
  - **Local gap / shipped boundary:** Trust transactions can post immediately today, while existing
    approval records are post-facto; do not duplicate the shipped trust-transfer approve/reject/link
    flow.
  - **References:** `apache__fineract` command, maker-checker, and command-audit modules.
  - **Reuse and snippets:** Apache-2.0/adopt-selectively; tiny snippets may be allowable only after a
    reuse decision and notices, but clean-room TypeScript should be preferred.

- **Reconciliation freshness report**
  - **First slice:** Add read-only reconciliation freshness by trust asset account with stale-days,
    last statement period, last matched/reviewed reconciliation, and exception counts.
  - **Local gap / shipped boundary:** Current diagnostics identify missing reviewed reconciliation,
    but do not expose staleness or last-period review posture.
  - **References:** `ledgersmb__ledgersmb` aging/reporting vocabulary and `blnkfinance__blnk`
    reconciliation progress concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only; no snippets. Blnk patterns may inform
    original OP code.

- **Trust statement match-rule profiles**
  - **First slice:** Persist review-only match-rule profiles for statement previews, including
    normalized date/amount/reference strategy, variance category, and reviewer explanation.
  - **Local gap / shipped boundary:** OP-T104 and OP-T107 added import previews and exception
    resolutions, but match rules are not persisted as operator-reviewable profiles.
  - **References:** `blnkfinance__blnk`, `apache__fineract`, and `ledgersmb__ledgersmb`.
  - **Reuse and snippets:** Blnk/Fineract are Apache-2.0 adopt-selectively; LedgerSMB is GPL
    reference-only. Prefer clean-room implementation over snippets.

- **Ledger balance snapshot comparison**
  - **First slice:** Add a read-only balance snapshot comparison between current OP trust balances,
    latest posted transaction, and latest reconciliation preview.
  - **Local gap / shipped boundary:** OP protects non-negative balances and records reconciliations,
    but there is no consolidated balance-drift view across ledger, preview, and report surfaces.
  - **References:** `blnkfinance__blnk`, `apache__fineract`.
  - **Reuse and snippets:** Apache-2.0/adopt-selectively; snippets are possible only with provenance,
    but domain behavior is simple enough to author locally.

- **Financial command approval journal**
  - **First slice:** Add a read-only command/decision journal for trust-transfer, trust-transaction,
    invoice approval, and reconciliation decisions using existing audit metadata.
  - **Local gap / shipped boundary:** OP has maker-checker-like approvals in separate domains, but no
    unified financial command journal for reviewers.
  - **References:** `apache__fineract`.
  - **Reuse and snippets:** Apache-2.0/adopt-selectively; use module vocabulary, not Java code.

- **Manual payment reconciliation gate**
  - **First slice:** Add a `pending_reconciliation` manual-payment status and reviewer evidence
    before payment allocations can affect invoice paid/balance status.
  - **Local gap / shipped boundary:** Manual payments currently affect invoice balance immediately,
    while trust/funds caveats call for reconciliation before payment state changes.
  - **References:** `opencollective__opencollective-api` settlement/reconciliation concepts and
    `blnkfinance__blnk` reconciliation boundaries.
  - **Reuse and snippets:** Open Collective is MIT but architecture-only in this corpus; Blnk is
    Apache-2.0/adopt-selectively. No direct snippets recommended.

- **Financial export field profiles**
  - **First slice:** Add export profile metadata and allowlisted field keys for billing and trust
    downloads.
  - **Local gap / shipped boundary:** Async billing/trust exports exist, but export bodies are
    generated from local projections without reusable field-profile metadata.
  - **References:** `opencollective__opencollective-api` export-request patterns and
    `kimai__kimai` spreadsheet column vocabulary.
  - **Reuse and snippets:** Open Collective is MIT/architecture-only; Kimai is AGPL/reference-only.
    Keep OP export serialization original.

- **Expense accounting category registry**
  - **First slice:** Add a firm-managed `billing_expense_categories` registry plus validation for
    new expense entries while leaving legacy free-text rows readable.
  - **Local gap / shipped boundary:** Expense category is currently free text, with no managed codes
    or applicability rules.
  - **References:** `opencollective__opencollective-api` accounting category and rule concepts.
  - **Reuse and snippets:** MIT/architecture-only; no direct code without a reuse decision.

- **Invoice aging report**
  - **First slice:** Add a read-only invoice aging report grouped by client, matter, and invoice with
    current/30/60/90-style buckets.
  - **Local gap / shipped boundary:** Billing dashboards expose issued balances and exports, but not
    an aging report surface.
  - **References:** `ledgersmb__ledgersmb` aging-report vocabulary and Open Collective overdue
    billing concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only and Open Collective is architecture-only;
    snippets are not recommended.

- **Timer-generated draft time entries**
  - **First slice:** Add a local timer-to-draft-time-entry flow that always creates reviewable draft
    records and respects billing period locks before submit/approve.
  - **Local gap / shipped boundary:** OP has time-entry capture, rate rules, approvals, write-off, and
    locks, but no timer capture workflow.
  - **References:** `kimai__kimai`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Accounting dimension filters for trust and fiscal-host reports**
  - **First slice:** Add optional read-only dimensions such as jurisdiction, program, restricted-fund
    cue, and matter profile to report filters without changing postings.
  - **Local gap / shipped boundary:** Fiscal-host cues are operational summaries only, and
    jurisdictional trust reports are cautious aggregates; dimensions are not a first-class report
    filter model.
  - **References:** `opencollective__opencollective-api`, `frappe__erpnext`, and
    `apache__fineract`.
  - **Reuse and snippets:** Open Collective is MIT architecture-only; Frappe/ERPNext carries higher
    license risk; Fineract is Apache-2.0 adopt-selectively. Keep implementation original.

## Implementation Guardrails

- **Originality**: Keep Apache-2.0 core code original unless reuse passes
  `docs/reuse-decision-policy.md`.
- **Clean-Room Reference**: Treat AGPL/GPL/LGPL/EPL/source-available, mixed-license, and
  unclear-license projects as reference-only; do not fork or copy implementation.
- **Service Isolation**: Keep optional copyleft services in separate containers behind documented
  APIs.
- **Compliance**: Maintain cautious wording on records and withdrawals until jurisdiction-specific
  legal review is complete.
