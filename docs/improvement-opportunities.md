# Development Backlog

This document captures candidate opportunities for Open Practice. Use `docs/planning.md` for the
durable roadmap, `docs/planning-and-progress.md` for live workboard tasks, and `docs/archive/` for
completed proof. Items here are not active commitments until promoted to the live workboard.

Keep this file candidate-only: if a slice is already shipped, the archive owns the evidence and the
row should not stay here as future work.

## Candidate Backlog

These candidates name the next smallest useful unimplemented slice. Each row also states the shipped
surface it must not duplicate.

The persistent trust statement import batch metadata gap is shipped as OP-T118, and the review-only
statement match-rule/accounting-profile depth is shipped as OP-T136. Future trust/accounting
candidates should compare against OP-T104 preview, OP-T107 exception-resolution, OP-T118 batch
metadata, and OP-T136 accounting-review proof before proposing another slice.

The first financial command approval journal slice shipped on 2026-06-16. Future maker-checker or
command-audit candidates should compare against the read-only trust controls
`financialCommandJournal` projection over existing financial audit metadata before proposing new
command storage or posting behavior.

The workflow-step history projection candidate is shipped in the 2026-06-16 workflow history
branch. Future workflow candidates should compare against the read-only `GET /api/jobs/workflows`
projection over redacted job lifecycle records and workflow audit events before proposing a new
workflow/activity history surface.

### Database Access Efficiency Follow-Ups - 2026-06-18

The 2026-06-18 hot-path efficiency branch shipped the first database-access slice: indexes, batched
Drizzle repository reads, selected-parent child-row loading, simple SQL filter pushdowns, and
matter-workspace grouping. The contact list/dossier split candidate is also implemented in the
`refactor/contact-list-efficiency` branch: the Drizzle `/api/contacts` list path now avoids full
dossier hydration while preserving public response shape, search/sort/pagination compatibility,
matter-scoped access, standalone creator visibility, and dossier/detail/history/export behavior.

Future candidates should stay behavior-preserving unless promoted explicitly, and should compare
against the shipped database-efficiency proofs before widening scope.

- **Client portal batch projection:** Build a portal-facing batch projection for existing
  client-visible grants, actions, documents, billing cues, and messages while preserving current
  client/matter visibility gates.
- **Communications and email bulk reads:** Add focused bulk-read helpers for message/email views
  that currently compose repeated matter or related-resource lookups, without surfacing raw private
  body text outside existing boundaries.
- **Operational views and report read models:** Consider durable read-model helpers for high-volume
  operational dashboards and report slices once the selected views are stable enough to justify
  pre-shaped query paths.
- **Filtered audit reads:** Add firm/matter/resource filtered audit repository reads for dashboards
  that need bounded audit activity, while preserving redaction and audit-chain verification
  posture.

### Core-Suite Clio Parity Candidates - 2026-06-04

The 2026-06-04 [core-suite parity gap audit](validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md)
refreshes the active parity goal after OP-T127 through OP-T143. Clio remains proprietary
public-product research: use this section for independent planning only, with no copied Clio prose,
assets, screenshots, templates, schemas, API examples, UI structure, or private tenant observations.
OP-T144, OP-T145, OP-T146, OP-T147, OP-T148, OP-T149, OP-T150, OP-T151, and OP-T152 are now shipped
as the first client portal action-workspace, client-visible billing workspace, staff-only
task/deadline review surface, review-first intake follow-up/source-attribution,
scheduled-reporting/report-builder posture, payment settlement/reconciliation review, bank-feed
reconciliation review, legal-research provider job boundary, and scoped developer API/webhook
replay boundary slices and should not be re-proposed here as future work.

The 2026-06-16 Clio parity closure branch treats Open Practice as broad-category parity across the
remaining core workflow-depth gaps. It closes safety-first audit redaction issues, queued
report/contact export UX gaps, pending trust-posting review controls, pending manual-payment
reconciliation UI, email-template preview hydration, research shell-model coverage, metadata-only
document conversion review, staff-reviewed scheduling requests, CRM retention-hold cues and
matter-scoped exports, reconciliation freshness, accounting/report dimensions, and legal-clinic
cadence signals without adding live payment, bank-feed, SMS, legal-research-provider, mobile,
e-filing, automatic trust-posting, public booking, retained export bodies, raw document-text storage,
or provider side-effect behavior.

The live workboard has no active core-suite Clio parity candidate after this closure. Any future
candidate must compare against shipped proof before implementation so it deepens the relevant
workflow without duplicating completed shell, review-only, projection, metadata-only, or
bounded-command slices. Enterprise-only Operate/Docket, native mobile apps, e-filing, and
practice-specific add-ons remain watch items outside this core-suite pass.

### Reference Review Candidates - 2026-05-22

This catalogue came from a clean-room comparison of the current Open Practice repo against the
central reference corpus at `/Users/bryan/projects/reference-repos`. OP-T108 through OP-T113 are
treated as shipped work and are not re-proposed here. No third-party code, schemas, UI, tests,
assets, or distinctive prose are copied into this repo by this catalogue.

OP-T155 shipped the first intake widget registry and validator adapter slice, OP-T157 shipped the
first staff visual branch-rule authoring slice, and the 2026-06-16 staff intake QA scenario matrix
follow-up shipped named staff QA scenarios for multi-path/package checks. Those former
intake candidates are no longer re-proposed here.

OP-T157 shipped the first staff-only intake submissions operations surface, so the former
staff-only intake submissions operations queue candidate is no longer re-proposed here.

The first signature envelope metadata slice shipped on 2026-06-16. OP-authored signer-order and
field-placement metadata now lives on existing signature requests with provider-neutral validation,
safe evidence-packet summaries, and dashboard posture. Future signing candidates should compare
against OP-T133 document-assembly envelopes, OP-T156 client portal embedded signer actions, and the
signature request metadata proof before proposing another envelope slice.

#### Intake, Documents, And Signing

The advanced intake rule simulation matrix first slice shipped on 2026-06-16. Saved staff QA
scenarios now persist across multiple branch paths and package combinations inside existing V2
template definitions, staff QA previews summarize them without answer bodies, and public intake
payloads omit scenario metadata. Future intake QA work should only add explicit reviewed approval
history or broader matrix reporting after comparing against this shipped staff-only scenario
surface.

- **Immutable intake template draft/publish versions**
  - **Status:** Shipped first slice on 2026-06-16; keep future work focused on staff UI affordances
    for version history and explicit publish controls.
  - **Shipped boundary:** Mutable staff drafts are separated from immutable published template
    versions, publish metadata is recorded, new sessions pin the latest published definition, and
    existing public link token/header/path semantics are unchanged.
  - **References:** `heyform__heyform` and `jhumanj__opnform`.
  - **Reuse and snippets:** Reference-only because of license posture; no direct snippets.

- **Interview-to-document assembly queue**
  - **First slice:** Queue generated package assembly from existing OP snapshots and draft export
    providers, with redacted job metadata and no source-record mutation.
  - **Local gap / shipped boundary:** Shipped in the OP-T133 worker-owned package assembly slice:
    `POST /api/intake-sessions/:id/generated-packages` now records a redacted
    `document_assembly` lifecycle job and worker envelope over existing answer snapshots, while
    the worker reloads the session/snapshot and persists generated-document metadata through the
    existing embedded automation provider. Do not revive docassemble as a runtime dependency.
  - **References:** `jhpyle__docassemble`.
  - **Reuse and snippets:** The project is MIT, but current OP posture is reference-only; no direct
    snippets without a reuse decision.

- **Private document conversion and annotation research spike**
  - **Status:** Metadata-only conversion review shipped on 2026-06-16; the 2026-06-17
    provider-backed boundary proof records the reviewed design guardrails for future conversion,
    annotation, chunking, embedding, and semantic-review slices. Runtime expansion remains a
    separate future implementation.
  - **Shipped boundary:** Open Practice now queues `document_conversion_review` jobs after verified
    upload, safe scan posture, and completed OCR extraction, then surfaces posture in Documents and
    Research through `document_analysis_status` artifacts. Retained state is limited to OP-authored
    redacted posture, `summaryPosture: op_authored_metadata_only`, counts, lengths, statuses,
    policy flags, and review metadata; raw client text, raw converted Markdown, raw annotations,
    provider payloads, prompts, sensitive chunks, embeddings, storage keys, object bodies, free-form
    generated summaries, and private excerpts must not enter job metadata, audit metadata, API
    posture, artifacts, or proof notes.
  - **Remaining boundary:** Provider-backed conversion, annotation bodies, chunk storage,
    embeddings, and external semantic-review providers remain out of scope until a later runtime
    slice proves the same metadata-only, review-only, no-raw-text/no-provider-payload boundary.
  - **References:** `unstructured-io__unstructured`, `microsoft__markitdown`,
    `getomni-ai__zerox`, `open-source-legal__opencontracts`, `paperless-ngx__paperless-ngx`, and
    `papermerge__papermerge-core`.
  - **Reuse and snippets:** Current posture is research/reference-only despite some permissive
    licenses; no snippets, schemas, migrations, UI, tests, styles, assets, or dependencies until a
    separate reuse decision records source, commit/tag, license, reuse class, touched files,
    notices, reviewer, and date.

#### Communications, Workflows, And Meetings

- **Structured email template drafts**
  - **Shipped slice:** OP-T158 adds provider-neutral firm-scoped saved email template drafts and
    matter-scoped persisted preview snapshots. The 2026-06-16 parity closure hydrates recent matter
    preview snapshots into dashboard resources and removes the unused empty preview placeholder.
  - **Remaining gap / future boundary:** Campaign automation, bulk sends, subscription management,
    provider delivery side effects, queue/send jobs, and live delivery from template management
    remain future work. `/api/email/previews` stays render-only.
  - **References:** `usewaypoint__email-builder-js`.
  - **Reuse and snippets:** Reference-only for OP-T158; no dependency, copied excerpt, vendored
    asset, or reference-derived code was added.

- **Inbound provider webhook intake boundary**
  - **Shipped slice:** The first Mailgun raw-MIME provider webhook validates the provider
    signature, stores raw MIME in object storage, and queues the existing inbound parser. The
    follow-up recovery metadata slice adds owner-reviewed, metadata-only recovery posture for
    Mailgun and IMAP parser/poll lifecycle failures through existing job APIs.
  - **Remaining gap / future boundary:** Other provider adapters, historical replay-cache or
    object-copy repair, provider-specific recovery tools, and automatic document promotion remain
    future work.
  - **References:** `chatwoot__chatwoot` and inbound-channel patterns in `paperless-ngx__paperless-ngx`.
  - **Reuse and snippets:** Chatwoot has MIT core plus enterprise directories; use architecture only
    unless a file-level review excludes enterprise-only material.

- **Meeting availability request review**
  - **Shipped slice:** Staff-reviewed availability/request records now live in
    `calendar_scheduling_requests`, with explicit review decisions and optional links to existing
    staff-created events.
  - **Remaining boundary:** Public booking rooms, public room URLs, native media, signaling, chat,
    recordings, automatic event creation, and provider sync remain out of scope unless a future
    design explicitly widens scheduling.
  - **References:** `calcom__cal.diy` and `jitsi__jitsi-meet`.
  - **Reuse and snippets:** Cal.diy is MIT/adapt-with-attribution and Jitsi is Apache-2.0
    adopt-selectively; keep this as behavior-level planning unless implementation scope opens reuse.

#### Authorization, Matters, Portals, And Records

- **Authorization fixture catalogue deepening**
  - **Shipped slices:** OP now catalogues relation vocabulary plus denial/list-visible fixtures for
    matters, contact dossier/list queries, documents, jobs, and portal links, backed by domain and
    API route tests without replacing RBAC, matter-scope checks, public-token policies, portal
    grants, or the route authorization manifest.
  - **Remaining gap:** Future work should only add a policy-engine spike, relationship query
    planner, or a non-contact list-query matrix after comparing against the shipped fixture
    catalogue and proving it will deepen behavior rather than duplicate current authorization tests.
  - **References:** `openfga__openfga`.
  - **Reuse and snippets:** Apache-2.0/architecture-only; snippets require an explicit reuse decision.

- **Matter lifecycle transition journal**
  - **Shipped first slice:** OP now journals review-only pause, close, archive, and reopen readiness
    records with current/target status snapshots, concise reasons/blockers, matter-scoped API
    access, safe audit metadata, and dashboard evidence for already-visible matters.
  - **Drafted policy/API plan:** The 2026-06-17 docs-only plan defines a future, unshipped
    `POST /api/matters/:matterId/lifecycle-commands` contract and pause/close/archive/reopen
    consequences across portal visibility, billing, tasks, assignments, audit metadata, and cleanup
    boundaries.
  - **Remaining gap:** Future work should only implement explicit lifecycle commands after a
    separate implementation scope is approved. The shipped journal remains evidence-only and does
    not mutate matter status.
  - **References:** `primeroims__primero`, `arkcase__arkcase`, and `jlawyerorg__j-lawyer-org`.
  - **Reuse and snippets:** AGPL/LGPL/reference-only; no direct snippets.

- **Inbound email to matter draft**
  - **Shipped slice:** 2026-06-16 staff-confirmed review-only matter drafts can be prepared from
    unscoped inbound email using safe source cues, proposed matter fields, and a staff-authored
    redacted body summary. The review surface now also carries safe duplicate-contact,
    existing-visible-matter, and checklist cues from authorized projections.
  - **Shipped boundary:** The slice does not auto-create matters, change provider ingestion, persist
    raw client text in job metadata, expose raw body/object-storage/provider metadata, or widen
    matter permissions. Duplicate and existing-matter cues are reviewer-facing only and do not add
    merge automation, matter routing, or task/checklist persistence.
  - **References:** `jlawyerorg__j-lawyer-org`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Contact relationship graph expansion**
  - **Shipped slices:** OP-T130 added the first contact relationship graph and CRM taxonomy surface.
    The 2026-06-15 Full CRM Contacts mainline work adds contact maintenance APIs, organization contacts,
    matter-contact association state, portal-access state, relationship editing, conflict matching,
    and authorization-filtered CRM UI panels. The 2026-06-16 contact-history export follow-ups add
    the synchronous single-contact `staff_review` export route plus the queued request/poll/
    short-lived authenticated download-link path, both under existing `contact:export`; the
    timeline now also has an authorized/redacted `activity` filter for safe dashboard review.
  - **Shipped retention/export depth:** The 2026-06-16 parity closure adds `retention_hold_review`
    dossier cues, contact data-quality resolution support, `retentionHoldCueCount`, and optional
    strict `matterId` scoping for synchronous and queued contact-history exports. The
    [contact-history export, retention, and privacy decision packet](contact-history-export-retention-privacy-decision-packet.md)
    now records the selected single-contact runtime posture: `staff_review` JSON generated from
    authorized projections with a required review reason, and queued/download metadata that stores
    no retained export body.
    Review-only duplicate assistance now derives safe contact dossier/review-queue cues without
    automatic merges or contact mutation.
  - **Remaining boundary:** Deletion workflows, legal-hold overrides, jurisdiction-certified
    retention deadlines, and retained export bodies remain out of scope.
  - **References:** `civicrm__civicrm-core`, `espocrm__espocrm`, `suitecrm__suitecrm`,
    `twenty__twenty`, `jlawyerorg__j-lawyer-org`, and `arkcase__arkcase`.
  - **Reuse and snippets:** AGPL/LGPL/high-risk reference-only; no direct snippets.

- **Document retention and hold review**
  - **Shipped first slice:** OP-T120 surfaces read-only retention-review hints based on legal hold,
    supersession, upload/checksum/scan state, and review state in the document-processing workbench;
    no deletion automation, retention deadline, retention-policy eligibility, or compliance claim was
    added.
  - **Docs-first design:** The
    [document retention and hold workflow design](document-retention-hold-workflow-design.md) now
    records practice-configured review schedules, hold-blocking rules, deletion-review gates, and
    records-disposition language for future reviewed implementation planning.
  - **Remaining boundary:** Runtime deletion workflows, retention-deadline enforcement,
    legal-hold override commands, and jurisdiction-certified records-disposition claims remain
    deferred until separately reviewed.
  - **References:** `arkcase__arkcase`, `nextcloud__server`, and `paperless-ngx__paperless-ngx`.
  - **Reuse and snippets:** LGPL/AGPL/GPL/reference-only; no direct snippets.

- **Legal clinic referral cadence**
  - **Shipped slice:** The task workbench now derives legal-clinic cadence signals from referral and
    review dates, eligibility/referral status, and program/profile posture. Staff-created tasks use
    existing `operational_view` sources with `legal_clinic_cadence:<profileId>:<signal>` IDs.
  - **Remaining boundary:** Cadence signals stay review-only until staff explicitly create normal
    tasks; no migration, automatic task creation, provider sync, or client-visible cadence workflow
    was added.
  - **References:** `primeroims__primero`, `avniproject__avni-server`, and
    `avniproject__avni-webapp`.
  - **Reuse and snippets:** Reference-only/architecture-only; no direct snippets.

- **Action-state descriptor coverage expansion**
  - **Shipped slices:** OP-T123 added the first shared descriptor for connector recovery and
    document OCR queue actions; OP-T124 extended the same boundary to public consultation Intake
    review actions; OP-T126 extended it to submitted intake review load, accept, reject, and
    more-info actions; the 2026-06-17 trust posting follow-up extends the same read-only descriptor
    boundary to Trust Controls posting-request approve/reject buttons.
  - **Remaining gap:** Additional dashboard actions still need candidate-by-candidate adoption
    before a broader registry is justified; future slices should pick one implemented operational
    surface and keep explanation data read-only and domain-owned.
  - **References:** `opencrvs__opencrvs-core`, `espocrm__espocrm`.
  - **Reuse and snippets:** Architecture-only/reference-only; no direct snippets.

#### Trust, Billing, And Accounting Controls

- **Pre-post trust posting approval commands**
  - **Shipped first slice:** `trust_posting_requests` now provide prepare/list/approve/reject
    semantics so selected trust postings can be prepared by one staff user and posted only after
    checker approval. The 2026-06-16 parity closure wires pending requests into Trust Controls
    approve/reject UI actions without changing posting semantics. The 2026-06-17 action-descriptor
    follow-up keeps those command semantics unchanged while deriving the Trust Controls button
    labels, busy/disabled state, accessible labels, and action keys from domain-owned descriptors.
  - **Remaining boundary:** Direct trust transactions still post immediately for non-selected
    postings. The posting-request commands reuse the existing ledger transaction posting path at
    approval time, stay separate from the shipped trust-transfer approve/reject/link flow, and do not
    automate settlement, bank-feed matching, or jurisdiction-certified trust accounting.
  - **References:** `apache__fineract` command, maker-checker, and command-audit modules.
  - **Reuse and snippets:** Apache-2.0/adopt-selectively; tiny snippets may be allowable only after a
    reuse decision and notices, but clean-room TypeScript should be preferred.

- **Reconciliation freshness report expansion**
  - **Shipped slices:** Trust/accounting diagnostics and reporting surfaces now expose review-only
    reconciliation depth, account-level freshness aging, stale-days, last reviewed statement period,
    exception counts, unmatched-row counts, and staff reporting cues without changing posting
    behavior.
  - **Remaining boundary:** Automatic reconciliation, live bank feeds, certified trust-accounting
    claims, and posting automation remain out of scope.
  - **References:** `ledgersmb__ledgersmb` aging/reporting vocabulary and `blnkfinance__blnk`
    reconciliation progress concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only; no snippets. Blnk patterns may inform
    original OP code.

- **Ledger balance snapshot comparison**
  - **Shipped first slice:** The trust controls payload and Funds dashboard now expose a read-only
    balance snapshot comparison across current OP trust balances, latest posted transaction posture,
    latest statement import batch metadata as preview posture, and latest reconciliation snapshot.
  - **Remaining boundary:** The comparison is a reviewer cue only. It does not persist preview rows,
    post ledger entries, run automatic matching or reconciliation, connect bank feeds, settle funds,
    or claim jurisdiction-certified trust accounting.
  - **References:** `blnkfinance__blnk`, `apache__fineract`.
  - **Reuse and snippets:** Apache-2.0/adopt-selectively; snippets are possible only with provenance,
    but domain behavior is simple enough to author locally.

- **Manual payment reconciliation gate**
  - **Shipped first slice:** Manual payments now start in `pending_reconciliation` with reviewer
    evidence required before an effective allocation can change invoice paid/balance status. The
    2026-06-16 parity closure adds Billing dashboard reconciliation controls for pending manual
    payments while preserving review-only evidence boundaries.
  - **Docs-first boundary packet:** The 2026-06-17
    [payment import and deposit matching boundary packet](payment-import-deposit-matching-boundary-packet.md)
    defines processor imports, deposit matching, refunds, and chargebacks as normalized
    reviewer-owned evidence only. It preserves no live settlement, no trust posting, no provider
    payload retention, and no invoice-balance mutation without reviewer evidence.
  - **Remaining boundary:** Runtime processor import, deposit matching, refund, chargeback, and
    trust posting behavior remain separate future work after the packet.
  - **References:** `opencollective__opencollective-api` settlement/reconciliation concepts and
    `blnkfinance__blnk` reconciliation boundaries.
  - **Reuse and snippets:** Open Collective is MIT but architecture-only in this corpus; Blnk is
    Apache-2.0/adopt-selectively. No direct snippets recommended.

- **Financial export field profiles**
  - **Status:** Shipped first slice on 2026-06-17; keep future work focused on reviewed UI
    affordances or true format negotiation only after comparing against this profile metadata.
  - **Shipped boundary:** Billing and jurisdictional trust downloads now include OP-authored
    reusable field-profile metadata with allowlisted generated-projection keys. Job lifecycle,
    queue, and audit metadata carry profile IDs only, and downloads still regenerate current local
    projections without retained export bodies or serialization rewrites.
  - **References:** `opencollective__opencollective-api` export-request patterns and
    `kimai__kimai` spreadsheet column vocabulary.
  - **Reuse and snippets:** Open Collective is MIT/architecture-only; Kimai is AGPL/reference-only.
    Keep OP export serialization original.

- **Expense accounting category registry**
  - **Shipped slice:** Firm-managed `billing_expense_categories` now provide managed category codes,
    labels, reimbursable defaults/allowance, and matter/practice/jurisdiction applicability for new
    expense entries while legacy free-text rows stay readable.
  - **Local gap / shipped boundary:** Category deactivation blocks future use without mutating
    existing expense rows, invoices, payment evidence, or trust records. A future accounting-export
    slice can still map these local codes to external accounting packages.
  - **References:** `opencollective__opencollective-api` accounting category and rule concepts.
  - **Reuse and snippets:** MIT/architecture-only; no direct code without a reuse decision.

- **Invoice aging report expansion**
  - **Shipped slices:** Billing dashboards and staff reporting now expose review-only billing
    posture, issued-balance surfaces, and a staff-only aged receivables report grouped by visible
    client, matter, invoice, or current/30/60/90-style aging bucket with manual export-profile
    alignment.
  - **Remaining boundary:** Payment-processor imports, automatic payment allocation, invoice
    mutation, write-off automation, settlement handling, trust posting, and accounting certification
    remain separate future work.
  - **References:** `ledgersmb__ledgersmb` aging-report vocabulary and Open Collective overdue
    billing concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only and Open Collective is architecture-only;
    snippets are not recommended.

- **Timer-generated draft time entries**
  - **Shipped first slice:** OP-T134 added time and expense capture with rate rules, approvals,
    write-off, billing-period locks, and local timer-to-draft capture.
  - **Current boundary:** The timer flow creates reviewable draft records only and respects
    billing-period locks before submit or approve; future native mobile capture or external
    time-tool sync should preserve that posture.
  - **References:** `kimai__kimai`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Accounting dimension filters for trust and fiscal-host reports**
  - **Shipped slice:** Jurisdictional trust and staff reporting payloads now expose derived
    read-only dimensions for jurisdiction, practice area, clinic program, and restricted-fund review
    status, with filters/grouping and export metadata but no posting changes.
  - **Remaining boundary:** These dimensions are projections over existing matter/profile data, not
    new ledger-dimension tables or certified accounting classifications.
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
