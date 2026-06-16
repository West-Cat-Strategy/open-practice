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

The workflow-step history projection candidate is shipped in the 2026-06-16 workflow history
branch. Future workflow candidates should compare against the read-only `GET /api/jobs/workflows`
projection over redacted job lifecycle records and workflow audit events before proposing a new
workflow/activity history surface.

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

The live workboard has no active core-suite Clio parity candidate after OP-T144 through OP-T152.

Any future candidate must compare against shipped proof before implementation so it deepens the
relevant workflow without duplicating the completed shell, review-only, or projection slices.
Enterprise-only Operate/Docket, native mobile apps, e-filing, and practice-specific add-ons remain
watch items outside this core-suite pass.

### Reference Review Candidates - 2026-05-22

This catalogue came from a clean-room comparison of the current Open Practice repo against the
central reference corpus at `/Users/bryan/projects/reference-repos`. OP-T108 through OP-T113 are
treated as shipped work and are not re-proposed here. No third-party code, schemas, UI, tests,
assets, or distinctive prose are copied into this repo by this catalogue.

OP-T155 shipped the first intake widget registry and validator adapter slice, and OP-T157 shipped
the first staff visual branch-rule authoring slice, so those former intake candidates are no longer
re-proposed here.

OP-T157 shipped the first staff-only intake submissions operations surface, so the former
staff-only intake submissions operations queue candidate is no longer re-proposed here.

The first signature envelope metadata slice shipped on 2026-06-16. OP-authored signer-order and
field-placement metadata now lives on existing signature requests with provider-neutral validation,
safe evidence-packet summaries, and dashboard posture. Future signing candidates should compare
against OP-T133 document-assembly envelopes, OP-T156 client portal embedded signer actions, and the
signature request metadata proof before proposing another envelope slice.

#### Intake, Documents, And Signing

- **Advanced intake rule simulation matrix**
  - **First slice:** Add saved staff QA scenarios across multiple branch paths and package
    combinations without changing public form semantics.
  - **Local gap / shipped boundary:** OP-T157 gives staff a visual rule editor and per-rule draft
    preview summaries, but it does not persist named scenario matrices or approval history for
    multi-path QA.
  - **References:** `surveyjs__survey-creator`, `surveyjs__survey-library`, and `formio__formio.js`.
  - **Reuse and snippets:** Survey Creator and Form.io remain reference-only; SurveyJS runtime
    snippets would need attribution and a documented reuse decision.

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

- **Inbound provider webhook intake boundary**
  - **Shipped slice:** The first Mailgun raw-MIME provider webhook validates the provider
    signature, stores raw MIME in object storage, and queues the existing inbound parser.
  - **Remaining gap / future boundary:** Other provider adapters, durable replay recovery, and
    automatic document promotion remain future work.
  - **References:** `chatwoot__chatwoot` and inbound-channel patterns in `paperless-ngx__paperless-ngx`.
  - **Reuse and snippets:** Chatwoot has MIT core plus enterprise directories; use architecture only
    unless a file-level review excludes enterprise-only material.

- **Meeting availability request review**
  - **First slice:** Add staff-reviewed availability/request records for meeting scheduling without
    public room URLs, native media, signaling, chat, recordings, or provider sync.
  - **Local gap / shipped boundary:** OP-T102 and OP-T113 shipped hosted guest-session controls and
    status-only admitted handoff, not availability booking or public scheduling.
  - **References:** `calcom__cal.diy` and `jitsi__jitsi-meet`.
  - **Reuse and snippets:** Cal.diy is MIT/adapt-with-attribution and Jitsi is Apache-2.0
    adopt-selectively; keep this as behavior-level planning unless implementation scope opens reuse.

#### Authorization, Matters, Portals, And Records

- **Authorization fixture catalogue deepening**
  - **Shipped first slice:** OP now catalogues relation vocabulary plus denial/list-visible fixtures
    for matters, documents, jobs, and portal links, backed by domain and API route tests without
    replacing RBAC, matter-scope checks, public-token policies, portal grants, or the route
    authorization manifest.
  - **Remaining gap:** Future work should only add a policy-engine spike, relationship query
    planner, or broader list-query matrix after comparing against the shipped fixture catalogue and
    proving it will deepen behavior rather than duplicate current authorization tests.
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
  - **Shipped slice:** 2026-06-16 staff-confirmed review-only matter drafts can be prepared from
    unscoped inbound email using safe source cues, proposed matter fields, and a staff-authored
    redacted body summary.
  - **Shipped boundary:** The slice does not auto-create matters, change provider ingestion, persist
    raw client text in job metadata, expose raw body/object-storage/provider metadata, or widen
    matter permissions.
  - **References:** `jlawyerorg__j-lawyer-org`.
  - **Reuse and snippets:** AGPL/reference-only; no direct snippets.

- **Contact relationship graph expansion**
  - **Shipped slices:** OP-T130 added the first contact relationship graph and CRM taxonomy surface.
    The 2026-06-15 Full CRM Contacts mainline work adds contact maintenance APIs, organization contacts,
    matter-contact association state, portal-access state, relationship editing, conflict matching,
    and authorization-filtered CRM UI panels.
  - **Remaining gap:** Future work should focus on task/follow-up integration, richer activity
    filtering, and jurisdiction-reviewed retention/privacy policies for contact-history exports. The
    [contact-history export, retention, and privacy decision packet](contact-history-export-retention-privacy-decision-packet.md)
    is the prerequisite policy surface before any contact-history export runtime implementation.
    Review-only duplicate assistance now derives safe contact dossier/review-queue cues without
    automatic merges or contact mutation.
  - **References:** `civicrm__civicrm-core`, `espocrm__espocrm`, `suitecrm__suitecrm`,
    `twenty__twenty`, `jlawyerorg__j-lawyer-org`, and `arkcase__arkcase`.
  - **Reuse and snippets:** AGPL/LGPL/high-risk reference-only; no direct snippets.

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

- **Reconciliation freshness report expansion**
  - **Shipped slices:** Trust/accounting diagnostics and reporting surfaces now expose review-only
    reconciliation depth and staff reporting cues.
  - **Remaining gap:** A future slice could add account-level freshness aging with stale-days, last
    statement period, last matched/reviewed reconciliation, and exception counts without changing
    posting behavior.
  - **References:** `ledgersmb__ledgersmb` aging/reporting vocabulary and `blnkfinance__blnk`
    reconciliation progress concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only; no snippets. Blnk patterns may inform
    original OP code.

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
  - **Shipped first slice:** Manual payments now start in `pending_reconciliation` with reviewer
    evidence required before an effective allocation can change invoice paid/balance status.
  - **Remaining boundary:** Future payment-processor imports, deposit matching, refunds,
    chargebacks, and trust posting remain separate future work.
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

- **Invoice aging report expansion**
  - **Shipped slices:** Billing dashboards and staff reporting now expose review-only billing
    posture and issued-balance surfaces.
  - **Remaining gap:** A future slice could add an aged receivables report grouped by client, matter,
    and invoice with current/30/60/90-style buckets and export-profile alignment.
  - **References:** `ledgersmb__ledgersmb` aging-report vocabulary and Open Collective overdue
    billing concepts.
  - **Reuse and snippets:** LedgerSMB is GPL/reference-only and Open Collective is architecture-only;
    snippets are not recommended.

- **Timer-generated draft time entries**
  - **Shipped first slice:** OP-T134 added time and expense capture with rate rules, approvals,
    write-off, and billing-period locks.
  - **Remaining gap:** A future timer-to-draft-time-entry flow should always create reviewable draft
    records and respect billing-period locks before submit/approve.
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
