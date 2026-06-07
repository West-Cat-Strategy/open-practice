# OP-MOD-001 Modularization Foundation Proof - 2026-06-06

## 2026-06-07 Mainline Consolidation Closeout

The 2026-06-07 consolidation merged both local OP-MOD branches into
`chore/op-mainline-consolidation-2026-06-07`: the broad backup branch
`codex/op-modularization-2026-06-06-broad-backup-20260607` and the active review-slice branch
`codex/op-modularization-2026-06-06`. The resolved tree keeps the broad backup's API route,
dashboard component/resource, worker processor, database schema-module, domain/provider export, and
repository modularization payload while layering in the active branch's dashboard shell-state
helper/tests, selector/boundary guardrails, and updated proof/workboard language.

Public behavior remains intentionally unchanged: no external HTTP route, response shape,
authorization, matter-scope, audit-redaction, public-token, worker queue, provider, or migration
contract changes are intended. The final consolidation delta is 330 paths relative to `origin/main`,
and the changed-path proof list below matches that set after adding the dashboard shell-state helper
and test paths.

## Summary

OP-MOD-001 is the first modularization remediation slice for `/Users/bryan/projects/open-practice`.
It strengthens package-boundary enforcement, hydrates selector output for shared-package builds,
adds child route registrar wiring enforcement, adds explicit package root exports, introduces
narrower internal API dependency ports, moves two provider defaults to API/test bootstrap, removes
direct test imports from package source paths, and
extracts dashboard formatter helpers into the new web feature directory plus server API fetch/error
helpers into the new web shared directory, moves connector operations loading into a server-only
feature resource, moves connector operations model types and client reload fetching into a connector
feature module, moves audit projection loading into a server-only feature resource, extracts the
first repository capability contracts for setup, provider settings, connectors, and jobs/email,
moves provider settings, connector, and jobs/email Drizzle/memory implementation details into
repository submodules, moves
billing dashboard loading and operations/status loading into server-only feature resources, moves
communications inbox loading, intake form/pipeline/public consultation loading, legal-clinic
loading, and legal-research loading into feature-owned server resources, moves
billing export, billing control, billing dashboard, expense-entry, invoice, manual payment,
time-entry, ledger jurisdictional-trust report/export, ledger read/control/transaction/approval, and
ledger reconciliation/import/accounting-review routes behind registrar-owned submodules, moves
document-processing status/provider/workbench/OCR queue routes behind registrar-owned submodules,
moves review-rail preference persistence
into a dashboard feature hook,
moves communications dashboard model types into a feature barrel, moves
billing/funds dashboard model types into a billing feature barrel, moves document-processing
dashboard model types into a document-processing feature barrel, splits worker report, connector,
email, OCR, and AI-triage queue-family processors out of the main worker dispatcher, and starts the
database schema split with enum, core, matter, AI/research, legal-clinic, provider-settings,
connector/integration, auth/session/MFA/passkey/recovery, jobs/email, tasks, calendar, contact,
operational-view, conversation-thread, conflict-check, firm-settings, public-consultation,
audit-event, billing-control, portal-link, document-ingestion/media, inbound-email, drafting,
signature-request, intake, document-assembly/signature-envelope, access-log, ledger, and billing
submodules while leaving `schema.ts` as a pure compatibility export aggregator. It moves the
stateless document assembly dashboard block into a focused dashboard component while leaving
URL, focus, and sessionStorage shell behavior in `dashboard-client.tsx`, then moves the stateless
first-matter workspace form into a focused dashboard component with a static render guard while
leaving create-matter mutation state, URL, focus, and sessionStorage shell behavior in
`dashboard-client.tsx`. It then adds a web-safe calendar model subpath export from
`@open-practice/domain`, moves calendar dashboard model types into a calendar feature barrel,
calendar dashboard server loading into a server-only calendar feature resource, and the calendar
dashboard section into a focused dashboard component with a static render guard while leaving
calendar mutation state, invitation confirmation, active section routing, URL, focus, and
sessionStorage shell behavior in `dashboard-client.tsx`. It also moves manual connector outbox
list/create/retry/dead-letter routes, connector developer delivery-history/webhook-replay routes,
and connector developer app/credential/subscription registration routes behind connector
registrar-owned submodules, with shared connector redaction, payload-summary, DNS guardrail,
recovery, developer app, audit, and delivery job scheduling helpers extracted into connector route
shared modules. It also moves draft export and draft template handlers behind draft
registrar-owned submodules while preserving draft route contracts. It continues the calendar
route-family split by moving calendar
attendee create/update/delete handlers, credential create/list/revoke handlers, event reminder
create/update/delete handlers, meeting-link update handlers, invitation queueing handlers,
iCalendar feed handlers, and hosted guest-session/public-token handlers behind calendar
registrar-owned submodules with shared calendar route dependency, access, params, base URL,
meeting-boundary, event-response, and audit helpers.
It also moves staff intake template builder create/update/preview/QA handlers, staff intake form
link/list/revoke/review-decision/variable-proposal handlers, and public intake
portal/draft/submit/upload/signature handlers behind intake-form registrar-owned submodules with
shared intake access, template lookup, params, link status, review-task, and signature-item
helpers. It then moves the public Mailgun raw-MIME webhook route behind an inbound-email
registrar-owned submodule, moves inbound parser job retry/dead-letter handlers behind an
inbound-email registrar-owned submodule with shared Mailgun parser constants plus inbound email and
parser job recovery access helpers, moves inbound-email status reporting into an inbound status
submodule, and moves inbound attachment promotion into a focused promotion submodule with shared
attachment redaction, then moves inbound message list/detail read routes into a focused message
submodule with shared message, attachment, and staff-triage redaction helpers, and moves the
communications inbox inbound-email triage update route into a focused triage submodule.
It also moves the redacted communications inbox aggregate route behind a communications
registrar-owned inbox submodule while keeping `registerCommunicationsRoutes` stable.
It also moves intake generated-document and generated-package routes behind an intake
registrar-owned generated-documents submodule with shared intake access and automation-provider
helpers while keeping `registerIntakeRoutes` stable.
It also moves external-upload dashboard model types into an external-upload feature barrel and
extracts the external-upload dashboard section into a focused dashboard component with a static
render guard while leaving link creation, revoke/review mutations, status/busy state, active matter
routing, URL, focus, and sessionStorage shell behavior in `dashboard-client.tsx`.
It also moves secure share-link dashboard model types into a share-link feature barrel and extracts
the share-link dashboard section into a focused dashboard component with a static render guard while
leaving share creation, revoke, client-account setup mutations, active matter/contact selection,
status/token state, URL, focus, and sessionStorage shell behavior in `dashboard-client.tsx`.
It also extracts the trust-controls workbench into a focused dashboard component with a static
render guard while leaving trust-controls loading, active matter selection, active section routing,
URL, focus, and sessionStorage shell behavior in `dashboard-client.tsx`.
It also extracts the billing dashboard section into a focused dashboard component with a static
render guard while leaving billing visibility, mutation state, API request builders, active
matter/section routing, URL, focus, and sessionStorage shell behavior in `dashboard-client.tsx`.
It also extracts the document-processing documents section into a focused dashboard component with a
static render guard while leaving workbench cache, metadata filters, OCR queueing, active document
rows, API refresh callbacks, URL, focus, and sessionStorage shell behavior in
`dashboard-client.tsx`.
It also extracts the signatures dashboard section into a focused dashboard component with a static
render guard while leaving active matter filtering, active section routing, URL, focus, and
sessionStorage shell behavior in `dashboard-client.tsx`.
It also extracts the audit dashboard body into a focused dashboard component with a static render
guard while leaving the zero-matter article wrapper, matter detail shell placement, refresh state,
refresh callback, active section routing, URL, focus, and sessionStorage shell behavior in
`dashboard-client.tsx`.
It also extracts the drafting dashboard body into a focused dashboard component with a static render
guard while leaving selected draft state, editor JSON state, draft create/save/export/assist
callbacks, active matter derivations, active section routing, URL, focus, and sessionStorage shell
behavior in `dashboard-client.tsx`.
It also moves secure share-link status loading into a server-only share-link feature resource while
preserving the existing disabled fallback behavior.
It also adds a web-safe contact model subpath export from `@open-practice/domain` and moves contacts
dashboard model/helper types into a contacts feature barrel while keeping `types.ts` as the
temporary compatibility re-export surface.
It also moves contact review queue and contact data-quality resolution dashboard loading into a
server-only contacts feature resource while preserving the existing optional fallback behavior.
It also extracts the inbound-email repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also moves email-delivery dashboard model types into an email-delivery feature barrel while
keeping `types.ts` as the temporary compatibility re-export surface.
It also moves email-delivery dashboard loading into a server-only email-delivery feature resource
while leaving render-only delivery-state formatting outside the server resource.
It also extracts the legal-clinic repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also extracts the portal-access repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the document repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also extracts the task repository capability contract plus Drizzle/memory implementation helpers
while keeping `OpenPracticeRepository` and the database root exports as compatibility surfaces.
It also extracts the conversation-thread repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the signature repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also extracts the audit repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also extracts the conflict-check repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the document-assembly repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the draft workbench repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the AI operational proposal repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the legal research artifact repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the contact repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also extracts the intake-template repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the calendar credential repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the non-credential calendar event repository capability contract plus
Drizzle/memory implementation helpers while keeping `OpenPracticeRepository` and the database root
exports as compatibility surfaces.
It also extracts the auth repository capability contract plus Drizzle/memory implementation helpers
while keeping `OpenPracticeRepository` and the database root exports as compatibility surfaces.
It also extracts the firm-settings repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the billing-controls repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the trust-transfer request repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the ledger review/reconciliation repository capability contract plus
Drizzle/memory implementation helpers while keeping `OpenPracticeRepository` and the database root
exports as compatibility surfaces.
It also extracts the public consultation intake CRUD/review repository capability contract plus
Drizzle/memory implementation helpers while preserving `OpenPracticeRepository` and the database
root exports as compatibility surfaces.
It also extracts the billing entries/time-expense repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the hosted payment request repository capability contract plus Drizzle/memory
implementation helpers while keeping `OpenPracticeRepository` and the database root exports as
compatibility surfaces.
It also extracts the billing invoice/manual-payment repository capability contract plus
Drizzle/memory implementation helpers while keeping `OpenPracticeRepository` and the database root
exports as compatibility surfaces.
It also extracts the intake form/session/link/review/action/snapshot/proposal repository capability
contract plus Drizzle/memory implementation helpers while keeping `OpenPracticeRepository` and the
database root exports as compatibility surfaces.
It also extracts the ledger core repository capability contract plus Drizzle/memory implementation
helpers while keeping `OpenPracticeRepository` and the database root exports as compatibility
surfaces.
It also moves first-run setup status, configured-firm resolution, and setup completion
Drizzle/memory implementation helpers behind the existing setup repository contract while keeping
`OpenPracticeRepository` and the database root exports as compatibility surfaces.
It also extracts the matter workspace read-model repository capability contract plus
Drizzle/memory implementation helpers while preserving `OpenPracticeRepository` plus database root
exports as compatibility surfaces.
It also extracts the matter lifecycle write-path repository capability contract plus
Drizzle/memory implementation helpers while preserving create-matter and
convert-public-consultation-intake behavior through the unchanged aggregate repository facade.
It also moves public-consultation intake Drizzle row/insert mapping into the
public-consultation-intakes repository submodule while keeping `drizzle-mappers.ts` as a
compatibility re-export surface.
It also moves connector repository facade construction into the connector-owned Drizzle and memory
modules, so the aggregate repository classes keep the same `OpenPracticeRepository` connector
methods through typed facade assignment while removing the duplicate method-by-method connector
wrapper blocks from `drizzle.ts` and `memory.ts`.
It also moves jobs/email repository facade construction into the jobs-email Drizzle and memory
modules, so the aggregate repository classes keep the same `OpenPracticeRepository` job lifecycle,
email outbox, email event, and email receipt-token methods through typed facade assignment while
removing the duplicate jobs/email wrapper blocks from `drizzle.ts` and `memory.ts`.
It also moves email provider status reporting into an email registrar-owned status submodule while
keeping `registerEmailRoutes` and the parent `buildEmailStatus` re-export stable for provider-status
aggregation.
It also moves hosted payment request and billing trust-transfer request routes behind focused
billing registrar-owned submodules while keeping `registerBillingRoutes` stable.
It also moves provider-settings repository facade construction into the provider-settings Drizzle
and memory modules, so the aggregate repository classes keep the same `OpenPracticeRepository`
provider settings list/upsert methods through typed facade assignment while removing the duplicate
provider-settings wrapper blocks from `drizzle.ts` and `memory.ts`.
It also moves firm-settings repository facade construction into the firm-settings Drizzle and
memory modules, so the aggregate repository classes keep the same `OpenPracticeRepository` firm
settings lookup method through typed facade assignment while removing the duplicate firm-settings
wrapper blocks from `drizzle.ts` and `memory.ts`; the memory facade reads the current settings array
lazily so first-run setup replacement semantics are preserved.
It also moves secure share-link staff status/list/create/revoke routes and public
token/email-verification routes behind share registrar-owned submodules with shared access,
token-reading, serialization, verification, document-response, and audit-log helpers.
It also moves conversation-thread export request/poll/download routes behind a
conversation-thread registrar-owned export submodule with shared thread params and access helpers.
It also moves conversation-thread lifecycle PATCH handling behind a conversation-thread
registrar-owned lifecycle submodule with shared authorized lookup and serialization helpers.
It also moves email outbox history/preview/create/retry routes behind an email registrar-owned
outbox submodule and public email receipt confirmation/record routes behind an email
registrar-owned receipt submodule with shared email access and receipt-secret helpers while keeping
`registerEmailRoutes` stable.
It also moves public external-upload portal view/intent/completion routes behind an external-upload
registrar-owned public submodule with shared external-upload repository, token, link-status,
document-link, quota, and access-log helpers while keeping `registerExternalUploadRoutes` stable.
It also moves staff external-upload status/list/create/revoke/review routes behind an
external-upload registrar-owned staff submodule while keeping public portal routes separate and the
parent `buildExternalUploadsStatus` re-export stable.
It also moves the public consultation submission route behind a public-consultation registrar-owned
public submodule with shared notification settings and ID helpers while keeping
`registerPublicConsultationIntakeRoutes` stable and staff settings/list/dismiss/convert routes in
the parent registrar.
It also moves the logged-in client-portal workspace route behind a client-portal registrar-owned
workspace submodule with shared email, grant, permission, and sanitized-user helpers while keeping
`registerClientPortalRoutes` stable.
It also moves staff client-portal account setup behind a client-portal registrar-owned account
submodule while keeping `registerClientPortalRoutes` stable.
It also moves staff public-consultation settings/list/dismiss/convert routes behind a
public-consultation registrar-owned staff submodule while keeping the public submission submodule
separate and `registerPublicConsultationIntakeRoutes` stable.
It also moves auth repository facade construction into auth-owned Drizzle and memory modules, so
the aggregate repository classes keep the same `OpenPracticeRepository` auth methods through typed
facade assignment while removing duplicate auth wrapper blocks from `drizzle.ts` and `memory.ts`.
It also extracts the intake dashboard section into a focused dashboard component with static render
coverage while leaving intake template/link/review/proposal/public-consultation mutation state,
pending-delivery confirmation state, active matter routing, URL, focus, and sessionStorage shell
behavior in `dashboard-client.tsx`.

This slice preserves shipped HTTP routes, payloads, response shapes, authorization behavior, audit
redaction, public-token behavior, repository behavior, dashboard copy, and dashboard visual
behavior. It does not add runtime dependencies, migrations, provider SDKs, public routes, queues, or
Docker/runtime configuration.

## Changed Path Set

- `apps/api/src/routes/communications.test.ts`
- `apps/api/src/routes/communications.ts`
- `apps/api/src/routes/communications/inbox.ts`
- `apps/api/src/routes/conversation-threads.test.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/billing/controls.ts`
- `apps/api/src/routes/billing/dashboard.ts`
- `apps/api/src/routes/billing/expenses.ts`
- `apps/api/src/routes/billing/export-requests.ts`
- `apps/api/src/routes/billing/invoices.ts`
- `apps/api/src/routes/billing/payments.ts`
- `apps/api/src/routes/billing/payment-requests.ts`
- `apps/api/src/routes/billing/shared.ts`
- `apps/api/src/routes/billing/time-entries.ts`
- `apps/api/src/routes/billing/trust-transfer-requests.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/calendar/attendees.ts`
- `apps/api/src/routes/calendar/credentials.ts`
- `apps/api/src/routes/calendar/feed.ts`
- `apps/api/src/routes/calendar/guest-sessions.ts`
- `apps/api/src/routes/calendar/invitations.ts`
- `apps/api/src/routes/calendar/meeting-links.ts`
- `apps/api/src/routes/calendar/reminders.ts`
- `apps/api/src/routes/calendar/shared.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/client-portal/accounts.ts`
- `apps/api/src/routes/client-portal/shared.ts`
- `apps/api/src/routes/client-portal/workspace.ts`
- `apps/api/src/routes/connectors.ts`
- `apps/api/src/routes/connectors/developer-registration.ts`
- `apps/api/src/routes/connectors/developer-recovery.ts`
- `apps/api/src/routes/connectors/developer-shared.ts`
- `apps/api/src/routes/connectors/outbox.ts`
- `apps/api/src/routes/connectors/shared.ts`
- `apps/api/src/routes/conversation-threads.ts`
- `apps/api/src/routes/conversation-threads/export-requests.ts`
- `apps/api/src/routes/conversation-threads/lifecycle.ts`
- `apps/api/src/routes/conversation-threads/shared.ts`
- `apps/api/src/routes/document-processing.ts`
- `apps/api/src/routes/document-processing/queue.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/document-processing/status.ts`
- `apps/api/src/routes/document-processing/workbench.ts`
- `apps/api/src/routes/drafts.ts`
- `apps/api/src/routes/drafts/exports.ts`
- `apps/api/src/routes/drafts/shared.ts`
- `apps/api/src/routes/drafts/templates.ts`
- `apps/api/src/routes/email.ts`
- `apps/api/src/routes/email/outbox.ts`
- `apps/api/src/routes/email/receipts.ts`
- `apps/api/src/routes/email/shared.ts`
- `apps/api/src/routes/email/status.ts`
- `apps/api/src/routes/external-uploads.ts`
- `apps/api/src/routes/external-uploads/public.ts`
- `apps/api/src/routes/external-uploads/shared.ts`
- `apps/api/src/routes/external-uploads/staff.ts`
- `apps/api/src/routes/inbound-email.ts`
- `apps/api/src/routes/inbound-email/attachment-promotion.ts`
- `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts`
- `apps/api/src/routes/inbound-email/messages.ts`
- `apps/api/src/routes/inbound-email/parser-jobs.ts`
- `apps/api/src/routes/inbound-email/shared.ts`
- `apps/api/src/routes/inbound-email/status.ts`
- `apps/api/src/routes/inbound-email/triage.ts`
- `apps/api/src/routes/intake-forms.test.ts`
- `apps/api/src/routes/intake-forms.ts`
- `apps/api/src/routes/intake-forms/links.ts`
- `apps/api/src/routes/intake-forms/public.ts`
- `apps/api/src/routes/intake-forms/shared.ts`
- `apps/api/src/routes/intake-forms/templates.ts`
- `apps/api/src/routes/intake.test.ts`
- `apps/api/src/routes/intake.ts`
- `apps/api/src/routes/intake/generated-documents.ts`
- `apps/api/src/routes/intake/shared.ts`
- `apps/api/src/routes/public-consultation-intakes.ts`
- `apps/api/src/routes/public-consultation-intakes/public.ts`
- `apps/api/src/routes/public-consultation-intakes/shared.ts`
- `apps/api/src/routes/public-consultation-intakes/staff.ts`
- `apps/api/src/routes/ledger.ts`
- `apps/api/src/routes/ledger/read.ts`
- `apps/api/src/routes/ledger/reconciliations.ts`
- `apps/api/src/routes/ledger/reports.ts`
- `apps/api/src/routes/ledger/shared.ts`
- `apps/api/src/routes/ledger/transactions.ts`
- `apps/api/src/routes/providers-status.ts`
- `apps/api/src/routes/shares.ts`
- `apps/api/src/routes/shares/public.ts`
- `apps/api/src/routes/shares/shared.ts`
- `apps/api/src/routes/shares/staff.ts`
- `apps/api/src/routes/types.ts`
- `apps/api/src/server.ts`
- `apps/web/app/_features/audit/server-resources.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/_features/billing/server-resources.ts`
- `apps/web/app/_features/calendar/models.ts`
- `apps/web/app/_features/calendar/server-resources.ts`
- `apps/web/app/_features/communications/models.ts`
- `apps/web/app/_features/communications/server-resources.ts`
- `apps/web/app/_features/connectors/client-resources.ts`
- `apps/web/app/_features/connectors/models.ts`
- `apps/web/app/_features/connectors/server-resources.ts`
- `apps/web/app/_features/contacts/models.ts`
- `apps/web/app/_features/contacts/server-resources.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-state.test.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-state.ts`
- `apps/web/app/_features/dashboard/formatters.ts`
- `apps/web/app/_features/dashboard/review-rail-preference.ts`
- `apps/web/app/_features/document-assembly/models.ts`
- `apps/web/app/_features/document-assembly/server-resources.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/_features/email-delivery/models.ts`
- `apps/web/app/_features/email-delivery/server-resources.ts`
- `apps/web/app/_features/external-uploads/models.ts`
- `apps/web/app/_features/external-uploads/server-resources.ts`
- `apps/web/app/_features/intake/server-resources.ts`
- `apps/web/app/_features/legal-clinic/server-resources.ts`
- `apps/web/app/_features/legal-research/server-resources.ts`
- `apps/web/app/_features/share-links/models.ts`
- `apps/web/app/_features/share-links/server-resources.ts`
- `apps/web/app/_features/operations/server-resources.ts`
- `apps/web/app/_shared/server-api.ts`
- `apps/web/app/calendar-dashboard.ts`
- `apps/web/app/communications-inbox-dashboard.ts`
- `apps/web/app/connector-outbox-dashboard.ts`
- `apps/web/app/contact-dossiers-dashboard.ts`
- `apps/web/app/dashboard/billing-section.test.tsx`
- `apps/web/app/dashboard/billing-section.tsx`
- `apps/web/app/dashboard/audit-section.test.tsx`
- `apps/web/app/dashboard/audit-section.tsx`
- `apps/web/app/dashboard/calendar-section.test.tsx`
- `apps/web/app/dashboard/calendar-section.tsx`
- `apps/web/app/dashboard/contacts-section.tsx`
- `apps/web/app/dashboard/document-assembly-dashboard-block.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `apps/web/app/dashboard/drafting-section.test.tsx`
- `apps/web/app/dashboard/drafting-section.tsx`
- `apps/web/app/dashboard/external-uploads-section.test.tsx`
- `apps/web/app/dashboard/external-uploads-section.tsx`
- `apps/web/app/dashboard/first-matter-workspace.test.tsx`
- `apps/web/app/dashboard/first-matter-workspace.tsx`
- `apps/web/app/dashboard/intake-section.test.tsx`
- `apps/web/app/dashboard/intake-section.tsx`
- `apps/web/app/dashboard/matter-overview-section.tsx`
- `apps/web/app/dashboard/queues-section.tsx`
- `apps/web/app/dashboard/share-links-section.test.tsx`
- `apps/web/app/dashboard/share-links-section.tsx`
- `apps/web/app/dashboard/signatures-section.test.tsx`
- `apps/web/app/dashboard/signatures-section.tsx`
- `apps/web/app/dashboard/trust-controls-section.test.tsx`
- `apps/web/app/dashboard/trust-controls-section.tsx`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/document-processing-dashboard.ts`
- `apps/web/app/billing-dashboard.ts`
- `apps/web/app/document-assembly-dashboard.ts`
- `apps/web/app/email-delivery-dashboard.ts`
- `apps/web/app/external-uploads-dashboard.ts`
- `apps/web/app/matter-command-center.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/share-links-dashboard.ts`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `apps/worker/src/processors/ai-triage.ts`
- `apps/worker/src/processors/connectors.ts`
- `apps/worker/src/processors/email.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/processors/inbound-email.ts`
- `apps/worker/src/processors/metadata.ts`
- `apps/worker/src/processors/ocr.ts`
- `apps/worker/src/processors/reports.ts`
- `apps/worker/src/processors/types.ts`
- `docs/development/repo-guide.md`
- `docs/planning-and-progress.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
- `docs/validation/README.md`
- `packages/domain/package.json`
- `packages/domain/src/calendar-models.ts`
- `packages/domain/src/contact-models.ts`
- `packages/database/package.json`
- `packages/database/src/repository/audit-contracts.ts`
- `packages/database/src/repository/audit/drizzle.ts`
- `packages/database/src/repository/audit/memory.ts`
- `packages/database/src/repository/auth-contracts.ts`
- `packages/database/src/repository/auth/drizzle.ts`
- `packages/database/src/repository/auth/memory.ts`
- `packages/database/src/repository/calendar-credentials-contracts.ts`
- `packages/database/src/repository/calendar-credentials/drizzle.ts`
- `packages/database/src/repository/calendar-credentials/memory.ts`
- `packages/database/src/repository/calendar-events-contracts.ts`
- `packages/database/src/repository/calendar-events/drizzle.ts`
- `packages/database/src/repository/calendar-events/memory.ts`
- `packages/database/src/repository/conflict-checks-contracts.ts`
- `packages/database/src/repository/conflict-checks/drizzle.ts`
- `packages/database/src/repository/conflict-checks/memory.ts`
- `packages/database/src/repository/connector-contracts.ts`
- `packages/database/src/repository/connectors/drizzle.ts`
- `packages/database/src/repository/connectors/memory.ts`
- `packages/database/src/repository/contacts-contracts.ts`
- `packages/database/src/repository/contacts/drizzle.ts`
- `packages/database/src/repository/contacts/memory.ts`
- `packages/database/src/repository/conversation-threads-contracts.ts`
- `packages/database/src/repository/conversation-threads/drizzle.ts`
- `packages/database/src/repository/conversation-threads/memory.ts`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/document-assembly-contracts.ts`
- `packages/database/src/repository/document-assembly/drizzle.ts`
- `packages/database/src/repository/document-assembly/memory.ts`
- `packages/database/src/repository/documents-contracts.ts`
- `packages/database/src/repository/documents/drizzle.ts`
- `packages/database/src/repository/documents/memory.ts`
- `packages/database/src/repository/drafts-contracts.ts`
- `packages/database/src/repository/drafts/drizzle.ts`
- `packages/database/src/repository/drafts/memory.ts`
- `packages/database/src/repository/billing-controls-contracts.ts`
- `packages/database/src/repository/billing-controls/drizzle.ts`
- `packages/database/src/repository/billing-controls/memory.ts`
- `packages/database/src/repository/billing-entries-contracts.ts`
- `packages/database/src/repository/billing-entries/drizzle.ts`
- `packages/database/src/repository/billing-entries/memory.ts`
- `packages/database/src/repository/billing-invoices-payments-contracts.ts`
- `packages/database/src/repository/billing-invoices-payments/drizzle.ts`
- `packages/database/src/repository/billing-invoices-payments/memory.ts`
- `packages/database/src/repository/hosted-payment-requests-contracts.ts`
- `packages/database/src/repository/hosted-payment-requests/drizzle.ts`
- `packages/database/src/repository/hosted-payment-requests/memory.ts`
- `packages/database/src/repository/trust-transfer-requests-contracts.ts`
- `packages/database/src/repository/trust-transfer-requests/drizzle.ts`
- `packages/database/src/repository/trust-transfer-requests/memory.ts`
- `packages/database/src/repository/firm-settings-contracts.ts`
- `packages/database/src/repository/firm-settings/drizzle.ts`
- `packages/database/src/repository/firm-settings/memory.ts`
- `packages/database/src/repository/jobs-email-contracts.ts`
- `packages/database/src/repository/jobs-email/drizzle.ts`
- `packages/database/src/repository/jobs-email/memory.ts`
- `packages/database/src/repository/ledger-core-contracts.ts`
- `packages/database/src/repository/ledger-core/drizzle.ts`
- `packages/database/src/repository/ledger-core/memory.ts`
- `packages/database/src/repository/matter-workspace-contracts.ts`
- `packages/database/src/repository/matter-workspace/drizzle.ts`
- `packages/database/src/repository/matter-workspace/memory.ts`
- `packages/database/src/repository/matter-lifecycle-contracts.ts`
- `packages/database/src/repository/matter-lifecycle/drizzle.ts`
- `packages/database/src/repository/matter-lifecycle/memory.ts`
- `packages/database/src/repository/ledger-review-contracts.ts`
- `packages/database/src/repository/ledger-review/drizzle.ts`
- `packages/database/src/repository/ledger-review/memory.ts`
- `packages/database/src/repository/legal-clinics-contracts.ts`
- `packages/database/src/repository/legal-clinics/drizzle.ts`
- `packages/database/src/repository/legal-clinics/memory.ts`
- `packages/database/src/repository/operational-views-contracts.ts`
- `packages/database/src/repository/operational-views/drizzle.ts`
- `packages/database/src/repository/operational-views/memory.ts`
- `packages/database/src/repository/portal-access-contracts.ts`
- `packages/database/src/repository/portal-access/drizzle.ts`
- `packages/database/src/repository/portal-access/memory.ts`
- `packages/database/src/repository/provider-settings-contracts.ts`
- `packages/database/src/repository/provider-settings/drizzle.ts`
- `packages/database/src/repository/provider-settings/encryption.ts`
- `packages/database/src/repository/provider-settings/memory.ts`
- `packages/database/src/repository/public-consultation-intakes-contracts.ts`
- `packages/database/src/repository/public-consultation-intakes/drizzle.ts`
- `packages/database/src/repository/public-consultation-intakes/mappers.ts`
- `packages/database/src/repository/public-consultation-intakes/memory.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/inbound-email-contracts.ts`
- `packages/database/src/repository/inbound-email/drizzle.ts`
- `packages/database/src/repository/inbound-email/memory.ts`
- `packages/database/src/repository/intake-forms-contracts.ts`
- `packages/database/src/repository/intake-forms/drizzle.ts`
- `packages/database/src/repository/intake-forms/memory.ts`
- `packages/database/src/repository/intake-templates-contracts.ts`
- `packages/database/src/repository/intake-templates/drizzle.ts`
- `packages/database/src/repository/intake-templates/memory.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/repository/setup-contracts.ts`
- `packages/database/src/repository/setup/drizzle.ts`
- `packages/database/src/repository/setup/memory.ts`
- `packages/database/src/repository/signatures-contracts.ts`
- `packages/database/src/repository/signatures/drizzle.ts`
- `packages/database/src/repository/signatures/memory.ts`
- `packages/database/src/repository/tasks-contracts.ts`
- `packages/database/src/repository/tasks/drizzle.ts`
- `packages/database/src/repository/tasks/memory.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/schema/access-logs.ts`
- `packages/database/src/schema/audit-events.ts`
- `packages/database/src/schema/ai.ts`
- `packages/database/src/schema/auth.ts`
- `packages/database/src/schema/billing.ts`
- `packages/database/src/schema/billing-controls.ts`
- `packages/database/src/schema/calendar.ts`
- `packages/database/src/schema/conflict-checks.ts`
- `packages/database/src/schema/contacts.ts`
- `packages/database/src/schema/connectors.ts`
- `packages/database/src/schema/conversation-threads.ts`
- `packages/database/src/schema/core.ts`
- `packages/database/src/schema/document-assembly.ts`
- `packages/database/src/schema/documents.ts`
- `packages/database/src/schema/drafts.ts`
- `packages/database/src/schema/enums.ts`
- `packages/database/src/schema/firm-settings.ts`
- `packages/database/src/schema/inbound-email.ts`
- `packages/database/src/schema/intake.ts`
- `packages/database/src/schema/jobs-email.ts`
- `packages/database/src/schema/ledger.ts`
- `packages/database/src/schema/legal-clinics.ts`
- `packages/database/src/schema/matters.ts`
- `packages/database/src/schema/operational-views.ts`
- `packages/database/src/schema/portal-links.ts`
- `packages/database/src/schema/provider-settings.ts`
- `packages/database/src/schema/public-consultation.ts`
- `packages/database/src/schema/signatures.ts`
- `packages/database/src/schema/tasks.ts`
- `packages/database/test/schema.test.ts`
- `packages/providers/package.json`
- `scripts/security-hot-path-rescan.mjs`
- `scripts/security-hot-path-rescan.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`
- `scripts/validate-open-practice-boundaries.mjs`
- `scripts/validate-open-practice-boundaries.test.mjs`
- `packages/database/src/repository/ai-operational-proposals-contracts.ts`
- `packages/database/src/repository/ai-operational-proposals/drizzle.ts`
- `packages/database/src/repository/ai-operational-proposals/memory.ts`
- `packages/database/src/repository/legal-research-artifacts-contracts.ts`
- `packages/database/src/repository/legal-research-artifacts/drizzle.ts`
- `packages/database/src/repository/legal-research-artifacts/memory.ts`

## Implementation Notes

- `scripts/validate-open-practice-boundaries.mjs` now scans source imports in API, worker, web,
  domain, database, and providers workspaces; enforces allowed workspace import direction; blocks
  app imports from `packages/*/src`; ratchets broad web root imports from `@open-practice/domain`;
  requires package root export consistency for domain, database, and providers; and can collect API
  route declarations from registrar-owned subfiles for stable feature route splits.
- `scripts/validate-open-practice-boundaries.mjs` now also verifies child route registrar wiring:
  every route-declaring `apps/api/src/routes/*/*.ts` file must be listed in exactly one
  `ROUTE_REGISTRARS` `routeFiles` owner, and each listed child file that exports a
  `register*Routes` function must be imported and called by the parent registrar. Helper-only
  shared modules remain allowed.
- `scripts/select-validation.mjs` now selects `@open-practice/domain build` and
  `@open-practice/database build` for shared-package changes before downstream package checks.
- `scripts/security-hot-path-rescan.mjs` now recognizes the selector's new database build command
  with a stable command id so the hot-path proof helper remains deterministic.
- `packages/database/package.json` and `packages/providers/package.json` now declare explicit
  `exports["."]` entries that match `main` and `types`.
- `packages/domain/package.json` now exposes `@open-practice/domain/calendar-models` as a
  type-safe calendar model subpath backed by `packages/domain/src/calendar-models.ts`; new calendar
  web feature imports use that subpath instead of adding root `@open-practice/domain` imports, so
  the web root-domain import ratchet stays enforced.
- `packages/domain/package.json` now also exposes `@open-practice/domain/contact-models` as a
  web-safe contact model subpath backed by `packages/domain/src/contact-models.ts`; new contacts web
  feature imports use that subpath instead of adding root `@open-practice/domain` imports, so the
  web root-domain import ratchet stays enforced.
- First-run setup repository types moved to `packages/database/src/repository/setup-contracts.ts`;
  `OpenPracticeRepository` now extends `PracticeSetupRepository` while `contracts.ts` re-exports
  the existing setup types and `FirstRunSetupConflictError` value for compatibility.
- Provider settings repository methods moved to
  `packages/database/src/repository/provider-settings-contracts.ts`; `OpenPracticeRepository` now
  extends `ProviderSettingsRepository` while `contracts.ts` re-exports the existing provider
  settings capability for compatibility.
- Provider settings encryption, Drizzle list/upsert, and memory list/upsert implementation helpers
  moved to `packages/database/src/repository/provider-settings/`; the Drizzle and memory
  repository classes now delegate to those helpers while preserving encrypted missing-key errors,
  ordering, and memory clone semantics.
- Provider settings repository facade construction now lives in
  `packages/database/src/repository/provider-settings/`; the Drizzle and memory aggregate
  repositories assign the focused facade with the existing config cipher while preserving encrypted
  missing-key errors, ordering, and memory clone semantics.
- Provider settings schema definitions moved to
  `packages/database/src/schema/provider-settings.ts`; `schema.ts` re-exports the module so
  existing `schema.providerSettings` and `schema.providerSettingKind` consumers keep the same import
  surface. The `provider_setting_kind` enum name, `provider_settings` table name, firm foreign key,
  and `provider_settings_firm_kind_key_idx` unique index are unchanged.
- Legal clinic schema definitions moved to `packages/database/src/schema/legal-clinics.ts`;
  `schema.ts` re-exports the module so existing legal clinic seed, mapper, and repository consumers
  keep the same aggregator import surface. The legal-clinic enum names, `legal_clinic_programs` and
  `legal_clinic_matter_profiles` table names, firm/matter/program/user foreign keys, and existing
  legal-clinic index names are unchanged.
- Connector and integration developer schema definitions moved to
  `packages/database/src/schema/connectors.ts`; `schema.ts` re-exports the module so existing
  repository, Drizzle config, and API consumers keep the same aggregator import surface. The
  `connectors`, `connector_outbox`, `connector_delivery_attempts`, `integration_developer_apps`,
  `integration_api_credentials`, and `integration_webhook_subscriptions` table names, foreign keys,
  check names, index names, JSONB type annotations, defaults, and migration posture are unchanged.
- Auth/session/MFA/passkey/recovery schema definitions moved to
  `packages/database/src/schema/auth.ts`; `schema.ts` re-exports the module so repository, auth
  route, setup, and API consumers keep the same aggregator import surface. The
  `auth_challenge_purpose` and `auth_action_token_purpose` enum names plus the `auth_accounts`,
  `auth_sessions`, `auth_password_setup_tokens`, `webauthn_credentials`, `auth_challenges`,
  `auth_action_tokens`, `totp_credentials`, and `recovery_codes` table names, foreign keys,
  defaults, primary keys, unique indexes, and secondary index names are unchanged.
- Connector repository methods moved to `packages/database/src/repository/connector-contracts.ts`;
  `OpenPracticeRepository` now extends `ConnectorRepository` while `contracts.ts` re-exports the
  connector capability for compatibility.
- Connector Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/connectors/`; the aggregate repository classes now delegate
  connector, durable outbox, delivery-attempt, integration app, integration credential, and
  integration webhook subscription behavior to those helpers while preserving idempotency conflict
  checks, Drizzle transaction boundaries, missing connector/app errors, memory clone semantics, and
  sorted list behavior.
- Connector repository facade factories now also live in
  `packages/database/src/repository/connectors/drizzle.ts` and
  `packages/database/src/repository/connectors/memory.ts`; the aggregate Drizzle and memory
  repositories keep the same `OpenPracticeRepository` connector method names via typed
  `ConnectorRepository` declarations and constructor assignment while removing the duplicate
  aggregate connector wrapper blocks.
- Jobs/email repository methods moved to `packages/database/src/repository/jobs-email-contracts.ts`;
  `OpenPracticeRepository` now extends `EmailJobsRepository` while `contracts.ts` re-exports the
  existing job lifecycle, email outbox, email event, and email receipt-token capability for
  compatibility.
- Jobs/email Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/jobs-email/`; the aggregate repository classes now delegate job
  lifecycle, queued email outbox, delivery result, retry, event, and receipt-token behavior to those
  helpers while preserving existing idempotency fingerprints, Drizzle transaction boundaries for
  queued email creation/receipt recording/delivery result/retry, receipt token matter matching,
  delivery metadata sanitization, memory clone semantics, and in-place memory array mutation.
  Follow-up lint cleanup removed now-unused Drizzle connector/order imports left behind by earlier
  repository helper extraction without changing repository behavior.
- Jobs/email repository facade factories now also live in
  `packages/database/src/repository/jobs-email/drizzle.ts` and
  `packages/database/src/repository/jobs-email/memory.ts`; the aggregate Drizzle and memory
  repositories keep the same `OpenPracticeRepository` job/email method names via typed
  `EmailJobsRepository` declarations and constructor assignment while removing the duplicate
  aggregate jobs/email wrapper blocks.
- Inbound-email repository methods moved to
  `packages/database/src/repository/inbound-email-contracts.ts`; `OpenPracticeRepository` now
  extends `InboundEmailRepository` while `contracts.ts` re-exports the existing inbound promotion
  input/result types and repository capability for compatibility.
- Inbound-email Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/inbound-email/`; the aggregate repository classes now delegate
  address lookup/list/create, message list/get/create/update, attachment create/list, and attachment
  promotion behavior to those helpers while preserving case-insensitive address normalization,
  received-at ordering, not-found errors, checksum requirements, duplicate-document detection,
  Drizzle advisory transaction locking, attachment document linking, and memory clone semantics.
- The duplicate-document advisory-lock schema ratchet now checks both the aggregate document upload
  path and the extracted inbound-email Drizzle helper so future refactors still preserve the same
  checksum lock boundary before duplicate lookup.
- Legal-clinic repository methods moved to
  `packages/database/src/repository/legal-clinics-contracts.ts`; `OpenPracticeRepository` now
  extends `LegalClinicRepository` while `contracts.ts` re-exports the legal-clinic capability for
  compatibility.
- Legal-clinic Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/legal-clinics/`; the aggregate repository classes now delegate
  program list/create and matter-profile lookup/upsert behavior to those helpers while preserving
  program name ordering, firm/status filtering, the in-memory duplicate-name guard,
  firm/matter-scoped profile lookup, Drizzle upsert conflict target, ISO date mapping, and clone
  semantics.
- Saved operational-view repository methods moved to
  `packages/database/src/repository/operational-views-contracts.ts`; `OpenPracticeRepository` now
  extends `OperationalViewsRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Saved operational-view Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/operational-views/`; the aggregate repository classes now
  delegate list/get/create/update/archive behavior to those helpers while preserving owner/firm
  scoping, active-vs-archived filtering, name ordering, default filters/columns/sort/row limit,
  default `matter:read` permission scope, Drizzle timestamp mapping, and memory clone semantics.
- Portal-access repository methods moved to
  `packages/database/src/repository/portal-access-contracts.ts`; `OpenPracticeRepository` now
  extends `PortalAccessRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Portal-access Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/portal-access/`; the aggregate repository classes now delegate
  portal grant, share link, external-upload link, and access-log behavior to those helpers while
  preserving firmless token-hash lookups, share-link matter/grantor validation in memory,
  external-upload idempotency conflict handling, strict external-upload claim expiry/max-use/revoke
  checks, access-log filtering, ordering, and clone semantics.
- Document repository methods moved to `packages/database/src/repository/documents-contracts.ts`;
  `OpenPracticeRepository` now extends `DocumentRepository` while `contracts.ts` re-exports the
  document upload intent and document/text-extraction capability for compatibility.
- Document Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/documents/`; the aggregate repository classes now delegate
  document read/list, upload intent, upload completion, scan-status update, review decision, and
  document text-extraction behavior to those helpers while preserving superseded-document version
  handling, duplicate checksum semantics, Drizzle advisory transaction locking, review metadata,
  and memory clone semantics. The duplicate-document advisory-lock schema ratchet now checks the
  extracted document Drizzle helper plus the inbound-email promotion helper so future refactors
  still preserve the same checksum lock boundary before duplicate lookup.
- Task repository methods moved to `packages/database/src/repository/tasks-contracts.ts`;
  `OpenPracticeRepository` now extends `TaskRepository` while `contracts.ts` re-exports the task
  deadline completion input and capability for compatibility.
- Task Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/tasks/`; the aggregate repository classes now delegate task
  deadline list/get/create/complete behavior to those helpers while preserving matterId precedence
  over matterIds, empty matterIds returning no rows, hidden completed tasks by default, due-date/id
  ordering, idempotent completion, duplicate task guard behavior in memory, and memory clone
  semantics.
- Conversation-thread repository methods moved to
  `packages/database/src/repository/conversation-threads-contracts.ts`; `OpenPracticeRepository`
  now extends `ConversationThreadRepository` while `contracts.ts` re-exports the thread/message and
  notification capability for compatibility.
- Conversation-thread Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/conversation-threads/`; the aggregate repository classes now
  delegate thread lifecycle, message, and notification behavior to those helpers while preserving
  lifecycle transition semantics, internal-only notification fan-out, conversation-thread read
  access filtering, recipient-owned notification posture updates, message-created thread
  `updatedAt` updates, the existing Drizzle/memory matterIds and notification-id quirks, and memory
  clone semantics.
- Signature repository methods moved to `packages/database/src/repository/signatures-contracts.ts`;
  `OpenPracticeRepository` now extends `SignatureRepository` while `contracts.ts` re-exports the
  signature request/event/webhook capability for compatibility.
- Signature Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/signatures/`; the aggregate repository classes now delegate
  signature request, signer, provider-event, and webhook-attempt behavior to those helpers while
  preserving transactional request/signers/initial-event creation, monotonic request status
  advancement, terminal `completedAt`/`declinedAt` assignment, provider-event and webhook-attempt
  ordering, Drizzle webhook-attempt firm query plus in-memory provider/external-id filtering, and
  memory clone plus array-replacement semantics.
- Audit repository methods moved to `packages/database/src/repository/audit-contracts.ts`;
  `OpenPracticeRepository` now extends `AuditRepository` while `contracts.ts` re-exports the audit
  event capability for compatibility.
- Audit Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/audit/`; the aggregate repository classes now delegate
  list/append/record behavior to those helpers while preserving firm-scoped hash-chain
  verification, Drizzle advisory transaction locking, previous-event sequence lookup, timestamp and
  metadata mapping, `recordAuditEvent` append compatibility, and memory clone plus array-replacement
  semantics.
- Conflict-check repository methods moved to
  `packages/database/src/repository/conflict-checks-contracts.ts`; `OpenPracticeRepository` now
  extends `ConflictCheckRepository` while `contracts.ts` re-exports the conflict-check run input and
  result capability for compatibility.
- Conflict-check Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/conflict-checks/`; the aggregate repository classes now
  delegate conflict-check execution to those helpers while preserving the Drizzle contact and
  matter-party dependency loaders, direct Drizzle matter loading plus mapping, generated check IDs,
  query/result snapshots, pending-review disposition, conflict-check audit metadata, Drizzle
  audit-chain validation via `listAuditEvents`, memory sequential check/audit IDs, cloned memory
  result snapshots, and the existing memory `auditChainValid: auditEvents.length > 0` quirk.
- Document-assembly repository methods moved to
  `packages/database/src/repository/document-assembly-contracts.ts`; `OpenPracticeRepository` now
  extends `DocumentAssemblyRepository` while `contracts.ts` re-exports the generated document,
  assembly definition/package, and signature-envelope workbench capability for compatibility.
- Document-assembly Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/document-assembly/`; the aggregate repository classes now
  delegate generated-document, assembly-definition, assembly-package, and signature-envelope
  behavior to those helpers while preserving generated-document `createdAt` ordering, definition
  name ordering, package/envelope `updatedAt` ordering, Drizzle `intakeSessionId` and `createdAt`
  insert normalization, no additional generated-document side effects, and memory clone plus
  immutable generated-document append semantics.
- Draft workbench repository methods moved to `packages/database/src/repository/drafts-contracts.ts`;
  `OpenPracticeRepository` now extends `DraftRepository` while `contracts.ts` re-exports the draft,
  draft-assist, and draft-template capability for compatibility.
- Draft workbench Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/drafts/`; the aggregate repository classes now delegate draft,
  draft-assist, and draft-template behavior to those helpers while preserving draft update version
  increments and internal `updatedAt` assignment, hard-delete behavior, Drizzle draft/template
  ordering, memory draft/template insertion order, draft-assist newest-first ordering, review/status
  field persistence for draft-assist updates, missing-record errors, and memory clone plus
  array-replacement semantics.
- AI operational proposal repository methods moved to
  `packages/database/src/repository/ai-operational-proposals-contracts.ts`;
  `OpenPracticeRepository` now extends `AiOperationalProposalRepository` while `contracts.ts`
  re-exports the proposal capability for compatibility.
- AI operational proposal Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/ai-operational-proposals/`; the aggregate repository classes now
  delegate proposal list/get/create/update behavior to those helpers while preserving firm-scoped
  optional matter/status/kind filtering, newest-first `createdAt` ordering, domain validation,
  Drizzle timestamp coercion for `createdAt`/`updatedAt`/`reviewedAt`, create clone semantics, the
  existing not-found error text, and the current Drizzle/memory update difference where Drizzle
  persists review/status/metadata fields while memory replaces the full cloned record.
- Legal research artifact repository methods moved to
  `packages/database/src/repository/legal-research-artifacts-contracts.ts`;
  `OpenPracticeRepository` now extends `LegalResearchArtifactRepository` while `contracts.ts`
  re-exports the legal research artifact capability for compatibility.
- Legal research artifact Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/legal-research-artifacts/`; the aggregate repository classes now
  delegate artifact list/get/create/update behavior to those helpers while preserving firm-scoped
  optional matter/status/kind filtering, newest-first `updatedAt` ordering, domain validation,
  Drizzle null normalization for optional note/analysis/timeline/checkpoint/review fields, Drizzle
  timestamp coercion, create clone semantics, Drizzle full-field review/content updates without
  mutating identity fields, memory global duplicate-id checks, memory full-record replacement, and
  existing duplicate/not-found error text.
- Contact repository methods moved to `packages/database/src/repository/contacts-contracts.ts`;
  `OpenPracticeRepository` now extends `ContactRepository` while `contracts.ts` re-exports the
  contact dossier and data-quality capability for compatibility.
- Contact Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/contacts/`; the aggregate repository classes now delegate
  dossier list, relationship create, contact lookup, and data-quality resolution behavior to those
  helpers while preserving dossier scoping through `listMattersForUser(user)`, hidden-contact and
  related-contact ID suppression from the domain dossier builder, append-only newest-first
  data-quality resolutions, Drizzle validation/constraint posture, and memory-only target contact,
  related-contact, and matter existence checks.
- Intake-template repository methods moved to
  `packages/database/src/repository/intake-templates-contracts.ts`; `OpenPracticeRepository` now
  extends `IntakeTemplateRepository` while `contracts.ts` re-exports the intake-template capability
  for compatibility.
- Intake-template Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/intake-templates/`; the aggregate repository classes now
  delegate template list/create/update behavior to those helpers while preserving firm-scoped list
  filtering without adding ordering, Drizzle create returning the input record, Drizzle update
  mutating editable fields without changing identity/created-at fields, Drizzle mapped-row return
  behavior, memory global duplicate-id checks, memory full-record replacement, clone semantics, and
  existing duplicate/not-found error text.
- Calendar credential repository methods moved to
  `packages/database/src/repository/calendar-credentials-contracts.ts`; `OpenPracticeRepository`
  now extends `CalendarCredentialRepository` while `contracts.ts` re-exports the credential
  capability for compatibility.
- Calendar credential Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/calendar-credentials/`; the aggregate repository classes now
  delegate create/list/username lookup/touch/revoke behavior to those helpers while preserving
  revoked-including created-at list ordering, global active-only username lookup, ID-only touch
  no-op behavior, firm/user-scoped revoke with repeated revoke timestamp overwrite, Drizzle date
  coercion/mapping, and the current memory constraint posture.
- Non-credential calendar event repository methods moved to
  `packages/database/src/repository/calendar-events-contracts.ts`; `OpenPracticeRepository` now
  extends `CalendarEventsRepository` while `contracts.ts` re-exports the event/scheduling/meeting
  session/guest-link capability for compatibility.
- Calendar event Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/calendar-events/`; the aggregate repository classes now
  delegate matter-scoped event list/get/upsert/delete, attendee/reminder CRUD and replace,
  scheduling request list/create, meeting-session list/create/status transitions, and guest-link
  list/create/token lookup/status/revoke behavior to those helpers while preserving active child
  filtering and ordering, event scope/UID conflict errors, soft deletes with sequence increments,
  token-hash-only guest lookup, transition helpers, Drizzle date coercion and uniqueness handling,
  nested memory child storage, and the existing Drizzle idempotent-vs-memory replacing scheduling
  request posture.
- Auth repository methods moved to `packages/database/src/repository/auth-contracts.ts`;
  `OpenPracticeRepository` now extends `AuthRepository` while `contracts.ts` re-exports the
  account, session, password setup token, user, WebAuthn, and recovery-code capability for
  compatibility.
- Auth Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/auth/`; the aggregate repository classes now delegate
  user/account/password/session/password-setup-token/WebAuthn/recovery-code behavior to those
  helpers while preserving assigned-matter user enrichment, case-insensitive email lookup, password
  account upsert, session touch/fresh/revoke semantics, single-use password setup tokens with
  expiry checks, single-use WebAuthn challenges, global and firm-scoped credential lookup, counter
  updates with last-used timestamps, scoped credential deletion, user MFA flag updates, Drizzle
  transactional recovery-code replacement, and memory clone plus array-replacement semantics.
- Firm settings repository methods moved to
  `packages/database/src/repository/firm-settings-contracts.ts`; `OpenPracticeRepository` now
  extends `FirmSettingsRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Firm settings Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/firm-settings/`; the aggregate repository classes now delegate
  firm-scoped settings lookup to those helpers while preserving Drizzle row mapping and memory clone
  semantics.
- Firm settings repository facade construction now lives in
  `packages/database/src/repository/firm-settings/`; the aggregate Drizzle and memory repositories
  assign the focused facade while preserving Drizzle row mapping, memory clone semantics, and
  first-run setup replacement semantics through a lazy memory settings reader.
- Billing controls repository methods moved to
  `packages/database/src/repository/billing-controls-contracts.ts`; `OpenPracticeRepository` now
  extends `BillingControlsRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Billing controls Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/billing-controls/`; the aggregate repository classes now
  delegate period-lock and rate-rule listing/creation to those helpers while preserving validation,
  overlap rejection, adjacent allowance, Drizzle row mapping/insert mapping, Drizzle descending
  rate-rule ordering, memory ascending rate-rule ordering, scoped fallback filtering, and memory
  clone semantics.
- Billing time/expense entry repository methods moved to
  `packages/database/src/repository/billing-entries-contracts.ts`; `OpenPracticeRepository` now
  extends `BillingEntriesRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Billing time/expense entry Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/billing-entries/`; the aggregate repository classes now
  delegate list/get/create/update behavior to those helpers while preserving firm/matter/status
  filtering, Drizzle performed/incurred date coercion, Drizzle update date coercion and optional
  `rateRuleId`/`rateSnapshot` nulling only when present, exact not-found error strings, memory
  append-on-create behavior, memory shallow-merge update behavior, memory no-date-conversion
  posture, and memory clone semantics.
- Hosted payment request repository methods and update types moved to
  `packages/database/src/repository/hosted-payment-requests-contracts.ts`;
  `OpenPracticeRepository` now extends `HostedPaymentRequestRepository` while `contracts.ts`
  re-exports the capability for compatibility.
- Hosted payment request Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/hosted-payment-requests/`; the aggregate repository classes now
  delegate create/get/list/update behavior to those helpers while preserving firm-scoped reads and
  updates, matter/invoice/status filters, existing unsorted list behavior, Drizzle insert mapping,
  Drizzle `expiresAt`/`updatedAt` date/null coercion, exact not-found error strings, no-op Drizzle
  update return behavior, memory shallow-merge update behavior, and clone semantics.
- Billing invoice/manual-payment repository methods moved to
  `packages/database/src/repository/billing-invoices-payments-contracts.ts`;
  `OpenPracticeRepository` now extends `BillingInvoicePaymentRepository` while `contracts.ts`
  re-exports the capability for compatibility.
- Billing invoice/manual-payment Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/billing-invoices-payments/`; the aggregate repository classes
  now delegate invoice list/read/create/update and manual payment create/list behavior to those
  helpers while preserving route-computed invoice totals, firm/matter/status/manual-payment
  filtering, selected line attachment by invoice, allocation invoice ownership and balance checks,
  unallocated payment remainder allowance, exact not-found/allocation error strings, Drizzle date
  mapping, memory clone semantics, and the existing Drizzle-vs-memory recalculation timing posture
  for multi-allocation manual payments.
- Intake form/session/link/review/action/snapshot/proposal repository methods moved to
  `packages/database/src/repository/intake-forms-contracts.ts`; `OpenPracticeRepository` now extends
  `IntakeFormsRepository` while `contracts.ts` re-exports the capability for compatibility.
- Intake form/session/link/review/action/snapshot/proposal Drizzle and memory implementation
  helpers moved to `packages/database/src/repository/intake-forms/`; the aggregate repository
  classes now delegate intake session, public form link, review, item action, answer snapshot, and
  variable proposal behavior to those helpers while preserving newest-first link/review ordering,
  unordered session/action/snapshot behavior, Drizzle date mapping, token-hash duplicate/review
  duplicate error strings, reserve/draft blocked-link fallback returns, submit revoked/submitted
  `undefined` behavior, proposal pending-only review behavior, Drizzle transactional proposal
  approval, memory clone semantics, memory duplicate-proposal replacement behavior, and the existing
  Drizzle-vs-memory proposal target handling posture.
- Trust-transfer request repository methods and update types moved to
  `packages/database/src/repository/trust-transfer-requests-contracts.ts`; `OpenPracticeRepository`
  now extends `TrustTransferRequestRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Trust-transfer request Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/trust-transfer-requests/`; the aggregate repository classes now
  delegate create/get/list/update behavior to those helpers while preserving firm-scoped reads and
  updates, no-op update return behavior, not-found and conflict error strings, expected-status and
  ledger-unlinked update guards, Drizzle row/insert mapping with date/null coercion, memory clone
  semantics, and the evidence-only linking posture without automatic ledger posting or invoice
  mutation.
- Ledger transaction approval, reconciliation, statement import batch, statement match-rule
  profile, accounting review profile, and reconciliation exception resolution repository methods
  moved to `packages/database/src/repository/ledger-review-contracts.ts`; `OpenPracticeRepository`
  now extends `LedgerReviewRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Ledger review/reconciliation Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/ledger-review/`; the aggregate repository classes now delegate
  record create/list behavior to those helpers while preserving transaction/account/profile
  existence checks, duplicate approval reviewer rejection, trust-asset account requirements,
  account-type matching, matching-profile ownership checks, Drizzle date coercion and row mapping,
  memory clone semantics, memory creator/reviewer checks, and existing list ordering.
- Public consultation intake list/get/create/update methods and list/update types moved to
  `packages/database/src/repository/public-consultation-intakes-contracts.ts`;
  `OpenPracticeRepository` now extends `PublicConsultationIntakeRepository` while `contracts.ts`
  re-exports the capability for compatibility.
- Public consultation intake Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/public-consultation-intakes/`; the aggregate repository classes
  now delegate CRUD/review behavior to those helpers while preserving firm/status filtering, default
  limit 50, submitted-at descending ordering, Drizzle insert/update mapping, reviewed-at date/null
  coercion, memory duplicate-id rejection, metadata preservation when updates omit metadata, and
  memory clone semantics.
- Public consultation intake Drizzle row and insert mappers moved to
  `packages/database/src/repository/public-consultation-intakes/mappers.ts`; the public
  consultation CRUD helper and matter lifecycle conversion helper now import the mapper from that
  feature-owned module, while `drizzle-mappers.ts` re-exports the same mapper names for temporary
  compatibility. Email/source optionality, disclosure/submitted/reviewed date coercion,
  dismissed/converted/notification null handling, and metadata passthrough are unchanged.
- Matter lifecycle create/convert input types and methods moved to
  `packages/database/src/repository/matter-lifecycle-contracts.ts`; `OpenPracticeRepository` now
  extends `MatterLifecycleRepository` while `contracts.ts` re-exports the capability for
  compatibility.
- Matter lifecycle Drizzle and memory implementation helpers moved to
  `packages/database/src/repository/matter-lifecycle/`; the aggregate repository classes now
  delegate matter creation and public-consultation-intake conversion behavior to those helpers while
  preserving user lookup, visible-matter summary loading, sequential matter-number generation,
  contact reuse/creation, party assignment, source-intake status/metadata updates, audit metadata,
  transaction boundaries, exact error strings, and memory clone semantics.
- API route dependencies now expose `QueueProducerPort`, `ObjectStoragePort`,
  `ProviderAdapterPorts`, and `DraftExportRenderer` while keeping `ApiRouteDependencies` as the
  compatibility facade for existing route registrars.
- Draft export rendering now enters draft routes through `draftExportRenderer`; `createApiServer`
  supplies the existing `renderDraftExport` default.
- Draft export handlers moved from `apps/api/src/routes/drafts.ts` to
  `apps/api/src/routes/drafts/exports.ts`, draft template list/create handlers moved to
  `apps/api/src/routes/drafts/templates.ts`, and shared draft route access/id params moved to
  `apps/api/src/routes/drafts/shared.ts`. `registerDraftRoutes` remains the server-facing
  compatibility entrypoint and the boundary registry now scans the draft-owned export/template
  subfiles.
- Intake automation now enters intake routes through `automationProvider`; `createApiServer` and
  route tests supply the existing `EmbeddedAutomationProvider` default.
- Dashboard metadata option lists and formatting helpers moved from `dashboard-client.tsx` to
  `apps/web/app/_features/dashboard/formatters.ts`.
- Server-side dashboard API fetch helpers moved from `page.tsx` to
  `apps/web/app/_shared/server-api.ts`; `ApiRequestError`, dev headers, cookie-aware headers,
  optional fetch fallback handling, and `access_denied`/`unavailable` status handling are unchanged.
- Connector operations loading moved from `page.tsx` to
  `apps/web/app/_features/connectors/server-resources.ts`; it still reads `/api/connectors` and
  `/api/connectors/outbox` through the shared optional-with-status helper and keeps
  `access_denied` precedence over `unavailable`.
- Connector operations dashboard model types moved from `types.ts` to
  `apps/web/app/_features/connectors/models.ts`; `types.ts` keeps a temporary compatibility
  re-export while `dashboard-client.tsx`, `dashboard/queues-section.tsx`,
  `connector-outbox-dashboard.ts`, `_shared/server-api.ts`, and connector server resources import
  the feature model types directly.
- Connector operations client reload fetching moved from `dashboard-client.tsx` to
  `apps/web/app/_features/connectors/client-resources.ts`; it still reads `/api/connectors` and
  `/api/connectors/outbox` with the same dashboard JSON helper and preserves the `403` to
  `access_denied`, `404` to `unavailable`, and throw-on-other-error behavior. Connector recovery
  mutation state, queue freshness state, visible JSX, copy, CSS classes, URL, focus, and
  sessionStorage behavior stayed in place.
- Audit projection loading moved from `page.tsx` to
  `apps/web/app/_features/audit/server-resources.ts`; it still reads `/api/audit` through the
  shared API helper and preserves the existing 403/404 fallback statuses.
- Billing dashboard fallback/loading moved from `page.tsx` to
  `apps/web/app/_features/billing/server-resources.ts`; it still reads `/api/billing/dashboard`
  through the shared optional helper and preserves the populated fallback plus empty
  access-denied fallback.
- The stateless first-matter workspace form moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/first-matter-workspace.tsx`; `dashboard-client.tsx` still owns the
  create-matter mutation, first-matter form state, active section routing, URL/history behavior,
  focus handoff, and review rail sessionStorage preference. The component preserves
  `id="matter-workspace"`, `tabIndex={-1}`, first-matter CSS class names, zero-matter copy, disabled
  matter-creation behavior, and the existing synthetic starter-intake form fields.
- Calendar dashboard response, mutation, credential, guest-session, and matter-link model types
  moved from `apps/web/app/types.ts` to `apps/web/app/_features/calendar/models.ts`; `types.ts`
  keeps temporary re-export compatibility and retains `PublicGuestSessionResponse` while importing
  the shared calendar guest status types from the feature model barrel.
- Calendar dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/calendar/server-resources.ts`; disabled calendar capability still returns
  the same empty dashboard object, and enabled calendar loading still delegates through
  `loadCalendarDashboardData` and the existing server API helper paths for events and credentials.
- The calendar dashboard JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/calendar-section.tsx`; `dashboard-client.tsx` still owns calendar state,
  mutations, invitation delivery confirmation, active matter/section routing, URL/history behavior,
  focus handoff, and review rail sessionStorage preference. The component preserves calendar CSS
  class names and copy, moves the render-only meeting-link mode/URL helpers into the section, and
  receives the selected meeting-link mode/URL through the update callback instead of reaching into
  dashboard shell state.
- The trust-controls workbench JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/trust-controls-section.tsx`; `dashboard-client.tsx` still owns
  trust-controls loading/cache state, active matter/section routing, URL/history behavior, focus
  handoff, and review rail sessionStorage preference. The component preserves trust-control CSS
  class names and copy, including the review-only accounting profile, bank-feed reconciliation,
  jurisdiction report, recent posting, reconciliation exception, and diagnostics surfaces, while
  deriving local render-only display rows from the passed controls payload.
- Billing export request/status/download handlers and route declarations moved from
  `apps/api/src/routes/billing.ts` to `apps/api/src/routes/billing/export-requests.ts`;
  `registerBillingRoutes` remains the server-facing compatibility entrypoint and the boundary
  registry now scans the subfile as owned by that registrar.
- Billing period-lock and rate-rule control handlers, request schemas, and firm-wide trust-ledger
  access assertion moved from `apps/api/src/routes/billing.ts` to
  `apps/api/src/routes/billing/controls.ts`; `registerBillingRoutes` remains the server-facing
  compatibility entrypoint, the route authorization manifest keeps the existing billing registrar
  ownership, and the boundary registry now scans the controls subfile as owned by that registrar.
  Period-lock/rate-rule response shapes, audit metadata, trust-ledger read/create authorization,
  and firm-wide ledger access checks are unchanged.
- Billing dashboard projection and `GET /api/billing/dashboard` route declaration moved from
  `apps/api/src/routes/billing.ts` to `apps/api/src/routes/billing/dashboard.ts`;
  `registerBillingRoutes` remains the server-facing compatibility entrypoint, the route
  authorization manifest keeps the existing billing registrar ownership, and the boundary registry
  now scans the dashboard subfile as owned by that registrar. Trust-ledger read authorization,
  visible-matter scoping, summary math, capture-review rows, hosted-payment request evidence flags,
  period-lock/rate-rule fields, timer draft policy, expense category profiles, and response shape
  are unchanged.
- Manual payment list/create handlers, request schemas, invoice ownership checks, allocation
  creation, and `manual_payment.created` audit metadata moved from `apps/api/src/routes/billing.ts`
  to `apps/api/src/routes/billing/payments.ts`; `registerBillingRoutes` remains the server-facing
  compatibility entrypoint, the route authorization manifest keeps the existing billing registrar
  ownership, and the boundary registry now scans the payments subfile as owned by that registrar.
  `GET /api/payments` matter-scoped and assigned-matter fallback behavior, `POST /api/payments`
  invoice validation errors, manual payment response shape, allocation behavior, and evidence flags
  are unchanged.
- Time-entry list/create/timer-draft/update/status-transition handlers and time-entry request
  schemas moved from `apps/api/src/routes/billing.ts` to
  `apps/api/src/routes/billing/time-entries.ts`; shared billing entry query/id schemas,
  matter-access assertion, billing-period lock checks, timer-window lock checks, and rate-rule
  resolution moved to `apps/api/src/routes/billing/shared.ts` for reuse by billing submodules.
  `registerBillingRoutes` remains the server-facing compatibility entrypoint, the route
  authorization manifest keeps the existing billing registrar ownership, and the boundary registry
  now scans the time-entry subfile as owned by that registrar. `GET /api/time-entries`,
  `POST /api/time-entries`,
  `POST /api/time-entries/timer-drafts`, `PATCH /api/time-entries/:id`, and the submit/approve/
  write-off routes preserve assigned-matter fallback behavior, access checks, lock conflict
  messages, rate-rule/manual rate snapshots, response shapes, and redacted audit metadata.
- Expense-entry list/create/review-draft/update/status-transition handlers and expense request
  schemas moved from `apps/api/src/routes/billing.ts` to
  `apps/api/src/routes/billing/expenses.ts`; the route authorization manifest keeps the existing
  billing registrar ownership, and the boundary registry now scans the expense subfile as owned by
  that registrar. Assigned-matter fallback behavior, review-draft category profile coercion,
  period-lock checks, finalized-entry edit conflicts, status transitions, response shapes, and
  redacted audit metadata are unchanged.
- Invoice list/create/read/approve/issue/void handlers and invoice request schemas moved from
  `apps/api/src/routes/billing.ts` to `apps/api/src/routes/billing/invoices.ts`;
  `registerBillingRoutes` remains the server-facing compatibility entrypoint, the route
  authorization manifest keeps the existing billing registrar ownership, and the boundary registry
  now scans the invoice subfile as owned by that registrar. `GET /api/invoices`,
  `POST /api/invoices`, `GET /api/invoices/:id`, and the approve/issue/void routes preserve
  assigned-matter fallback behavior, selected source-entry validation, duplicate non-void invoice
  conflict handling, approved-unbilled checks, period-lock checks before approval, response shapes,
  and redacted audit metadata.
- The logged-in client workspace handler and redacted workspace projection helpers moved from
  `apps/api/src/routes/client-portal.ts` to
  `apps/api/src/routes/client-portal/workspace.ts`, while normalized email, contact/grant matching,
  portal-permission, and sanitized-user helpers moved to
  `apps/api/src/routes/client-portal/shared.ts`. `registerClientPortalRoutes` remains the
  server-facing compatibility entrypoint and delegates `GET /api/client-portal/workspace` to the
  workspace submodule. The boundary registry now scans the workspace subfile as owned by the
  client-portal registrar, and the
  client-only role check, contact-matched active-grant lookup, read-only redacted projection,
  grouped/flat action ordering, billing summary shape, and raw-token/storage-key/body redaction are
  unchanged.
- Staff client-portal account setup moved from `apps/api/src/routes/client-portal.ts` to
  `apps/api/src/routes/client-portal/accounts.ts`; `registerClientPortalRoutes` now delegates the
  account submodule plus the existing workspace submodule. The `/api/client-portal/accounts` route,
  `auth_credential:create`, matter/contact read checks, adverse-contact blocking, contact-email
  requirement, non-client email conflict, portal grant reuse/create semantics, password setup token
  behavior, `201` versus reused `200` response status, `{ account, grant, setup }` response shape,
  and `portal.account_setup.created` audit metadata remain unchanged.
- Ledger jurisdictional trust report/read, export request, export status, and export download
  handlers moved from `apps/api/src/routes/ledger.ts` to
  `apps/api/src/routes/ledger/reports.ts`; `registerLedgerRoutes` remains the server-facing
  compatibility entrypoint while delegating the report submodule, the route authorization manifest
  keeps the existing ledger registrar ownership, and the boundary registry now scans the reports
  subfile as owned by that registrar. Jurisdictional trust export authorization, report-job
  idempotency metadata, queue enqueue behavior, audit redaction, not-ready/failed status handling,
  and report response shapes are unchanged.
- Ledger reconciliation preview, statement import batch list/create, statement match-rule profile
  list/create, accounting review profile list/create, reconciliation exception resolution
  list/create, and reconciliation creation handlers moved from `apps/api/src/routes/ledger.ts` to
  `apps/api/src/routes/ledger/reconciliations.ts`; shared ledger access and account lookup helpers
  now live in `apps/api/src/routes/ledger/shared.ts`. `registerLedgerRoutes` remains the
  server-facing compatibility entrypoint while delegating the reconciliation submodule, the route
  authorization manifest keeps the existing ledger registrar ownership, and the boundary registry
  now scans the reconciliation subfile as owned by that registrar. Firm-wide trust-ledger approval,
  trust-asset account checks, review-only/no-posting behavior, response shapes, legacy invalid-body
  error shape, and redacted audit metadata are unchanged.
- Ledger dashboard read/control handlers moved from `apps/api/src/routes/ledger.ts` to
  `apps/api/src/routes/ledger/read.ts`, and ledger transaction creation/approval handlers moved to
  `apps/api/src/routes/ledger/transactions.ts`; `apps/api/src/routes/ledger.ts` is now a parent
  registrar that delegates read, report, transaction, and reconciliation submodules. Matter-scoped
  read requirements, firm-wide reconciliation/accounting diagnostics, trust-control-policy
  summaries, transaction idempotency conflicts, invalid scope errors, workflow audit metadata,
  approval audit metadata, and transaction-derived approval access are unchanged.
- Manual connector outbox list, create, retry, and dead-letter handlers and route declarations moved
  from `apps/api/src/routes/connectors.ts` to `apps/api/src/routes/connectors/outbox.ts`; shared
  connector access, redaction, payload-summary allowlisting, recovery confirmation, outbox audit,
  and delivery job scheduling helpers moved to `apps/api/src/routes/connectors/shared.ts`.
  `registerConnectorRoutes` remains the server-facing compatibility entrypoint for the connector
  route family, developer app/webhook replay routes still preserve their existing contracts, and the
  boundary registry now scans the outbox subfile as owned by that registrar.
- Connector developer delivery-history and webhook-replay handlers and route declarations moved from
  `apps/api/src/routes/connectors.ts` to
  `apps/api/src/routes/connectors/developer-recovery.ts`; shared developer app scope checks,
  serializers, webhook replay audit metadata, and credential/subscription/app serializers moved to
  `apps/api/src/routes/connectors/developer-shared.ts`; shared masked-secret serialization moved to
  `apps/api/src/routes/connectors/shared.ts`. `registerConnectorRoutes` remains the server-facing
  compatibility entrypoint and now delegates the developer recovery and manual outbox submodules,
  while the boundary registry scans both connector-owned subfiles.
- Connector developer app list/create, credential create/revoke, and webhook subscription create
  handlers and route declarations moved from `apps/api/src/routes/connectors.ts` to
  `apps/api/src/routes/connectors/developer-registration.ts`; developer-only validation schemas,
  HTTPS normalization, scope sorting, endpoint posture, and rate-limit posture helpers moved with
  those handlers. Shared outbound webhook DNS validation moved to
  `apps/api/src/routes/connectors/shared.ts` so base connector `deliveryUrl` validation and
  developer webhook subscription destination validation keep the same guardrail path and error
  split. `registerConnectorRoutes` remains the server-facing compatibility entrypoint and now
  delegates developer registration, developer recovery, and manual outbox submodules, while the
  boundary registry scans all three connector-owned subfiles.
- Hosted payment request list/create/update/checkout-session/settlement-review handlers moved from
  `apps/api/src/routes/billing.ts` to `apps/api/src/routes/billing/payment-requests.ts`; billing
  trust-transfer list/create/approve/reject/link handlers moved to
  `apps/api/src/routes/billing/trust-transfer-requests.ts`. `registerBillingRoutes` remains the
  server-facing compatibility entrypoint and now delegates both submodules between manual payment
  routes and billing dashboard/export routes. Existing `/api/billing/payment-requests[/:id]`,
  `/api/billing/payment-requests/:id/checkout-session`,
  `/api/billing/payment-requests/:id/settlement-events`, and
  `/api/billing/trust-transfer-requests[/:id/(approve|reject|link)]` routes, list `{ requests }`
  shapes, record return shapes, checkout `{ request, checkout }` shape, settlement
  `{ request, settlementReview }` shape, `expense_entry`/`trust_ledger` matter access, staff
  assigned-matter fan-out, payment processor not-configured and session-mismatch errors, checkout
  URL redaction, review-only settlement posture, trust approval balance checks, ledger-link matching,
  duplicate-link guard, and redacted audit metadata are unchanged.
- Conversation-thread export request, poll, and download handlers moved from
  `apps/api/src/routes/conversation-threads.ts` to
  `apps/api/src/routes/conversation-threads/export-requests.ts`; shared conversation-thread params
  and conversation-thread access checks moved to
  `apps/api/src/routes/conversation-threads/shared.ts`. `registerConversationThreadRoutes` remains
  the server-facing compatibility entrypoint and delegates the export submodule while keeping core
  list/read/message/lifecycle routes in the parent registrar. Export response status codes,
  poll/download URL shapes, queue-vs-inline behavior, idempotency metadata, wrong-thread 404,
  not-ready/failed/revoked 409 behavior, audit metadata redaction, and downloaded redacted artifact
  generation are unchanged.
- Conversation-thread lifecycle PATCH handling moved from
  `apps/api/src/routes/conversation-threads.ts` to
  `apps/api/src/routes/conversation-threads/lifecycle.ts`; shared authorized lookup and
  serialization now live in `apps/api/src/routes/conversation-threads/shared.ts`.
  `registerConversationThreadRoutes` remains the server-facing compatibility entrypoint and
  delegates both export and lifecycle submodules. `PATCH /api/conversation-threads/:id/lifecycle`
  preserves read-first thread existence/matter access checks, per-action update/export permission
  checks, close/reopen/revoke/export action mapping, revoked-thread 409 handling, `{ thread }`
  response shape, and lifecycle audit actions plus redacted metadata.
- Email outbox history, preview, create, and manual retry handlers moved from
  `apps/api/src/routes/email.ts` to `apps/api/src/routes/email/outbox.ts`; public email receipt
  confirmation and record handlers remain in `apps/api/src/routes/email/receipts.ts`; and shared
  email access plus receipt-token signing configuration helpers now live in
  `apps/api/src/routes/email/shared.ts`. `registerEmailRoutes` remains the server-facing
  compatibility entrypoint and delegates the status, outbox, and receipt submodules while keeping
  the parent `buildEmailStatus` re-export used by `providers-status`. Existing `/api/email/status`,
  `/api/mail/outbox`,
  `/api/email/previews`, `/api/mail/outbox/:emailId/retry`, `/api/portal/email-receipts[/:token]`,
  and `/api/portal/mail/receipts[/:token]` routes, access checks, response shapes, delivery receipt
  token hashing, retry idempotency metadata, queue lifecycle behavior, audit redaction, receipt
  header/path token fallback, cache-control/noindex headers, expired-token 410, not-found 404, and
  POST replay `recorded` semantics are unchanged.
- Public external-upload portal view, upload-intent, and upload-complete handlers moved from
  `apps/api/src/routes/external-uploads.ts` to
  `apps/api/src/routes/external-uploads/public.ts`; shared external-upload repository checks,
  token-signing configuration errors, public token header/path parsing, link status, document
  link-id resolution, legacy revoke/claim adapter calls, access-log writing, and public link
  resolution moved to `apps/api/src/routes/external-uploads/shared.ts`.
  `registerExternalUploadRoutes` remains the server-facing compatibility entrypoint and delegates
  the public submodule. The `/api/portal/external-uploads[/:token]`,
  `/api/portal/external-uploads[/:token]/intents`, and
  `/api/portal/external-uploads[/:token]/documents/:documentId/complete` route aliases,
  header/path token fallback, signed S3 header requirements, SSE-S3 header behavior, upload quota
  handling, exhausted-link view semantics, completion verification, checksum-mismatch failure
  response, public response redaction, public rate limit policy, and access-log metadata are
  unchanged.
- Staff external-upload status/list/create/revoke/review handlers moved from
  `apps/api/src/routes/external-uploads.ts` to
  `apps/api/src/routes/external-uploads/staff.ts`; `registerExternalUploadRoutes` now delegates the
  staff submodule before the public submodule, and the parent registrar re-exports
  `buildExternalUploadsStatus` for provider-status aggregation. The `/api/external-uploads/status`,
  `/api/external-uploads?matterId=...`, `/api/external-uploads`,
  `/api/external-uploads/:id/revoke`, and
  `/api/external-uploads/documents/:documentId/review` routes, status payload,
  `{ uploads, reviewItems }`, `{ upload, token, created, queuedEmail }`, `{ upload }`,
  `{ reviewItem }`, access checks, idempotent raw-token return behavior, notification queueing,
  access-log behavior, note sanitization, and audit note-length redaction are unchanged.
- Public consultation submission handling moved from
  `apps/api/src/routes/public-consultation-intakes.ts` to
  `apps/api/src/routes/public-consultation-intakes/public.ts`, and shared notification settings,
  settings response, provider-setting persistence, and ID helpers moved to
  `apps/api/src/routes/public-consultation-intakes/shared.ts`.
  `registerPublicConsultationIntakeRoutes` remains the server-facing compatibility entrypoint and
  delegates the public submodule while keeping staff settings, review-list, dismiss, and convert
  routes in the parent registrar. `POST /api/public/consultation-intakes` preserves bearer-token
  hashing, origin enforcement, rate-limit keying, honeypot absorption, pending-intake creation,
  matter-less notification email queueing, redacted job metadata, redacted audit metadata, and
  response shapes.
- Document-processing status/provider, workbench, and OCR queue handlers moved from
  `apps/api/src/routes/document-processing.ts` to
  `apps/api/src/routes/document-processing/status.ts`,
  `apps/api/src/routes/document-processing/workbench.ts`, and
  `apps/api/src/routes/document-processing/queue.ts`; shared access checks, schemas,
  local-Tesseract provider setting construction, document sanitization, latest job/extraction
  lookup, review queue summaries, OCR eligibility, and OCR provider assertions moved to
  `apps/api/src/routes/document-processing/shared.ts`. `registerDocumentProcessingRoutes` remains
  the server-facing compatibility entrypoint, `buildDocumentProcessingStatus` remains exported for
  `providers-status`, and the boundary registry now scans the document-processing-owned subfiles.
  `/api/document-processing/status`, `/api/document-processing/ocr-provider`,
  `/api/document-processing/workbench`, and `/api/document-processing/documents/:id/queue` preserve
  access checks, response shapes, provider/storage disabled reasons, metadata search filters,
  reviewer-suggestion read-only posture, OCR idempotency metadata, queue enqueue failure handling,
  workflow audit metadata, and raw text/storage-key redaction.
- Calendar attendee create/update/delete handlers and route declarations moved from
  `apps/api/src/routes/calendar.ts` to `apps/api/src/routes/calendar/attendees.ts`; calendar
  credential create/list/revoke handlers and route declarations moved to
  `apps/api/src/routes/calendar/credentials.ts`; and calendar event reminder create/update/delete
  handlers and route declarations moved to `apps/api/src/routes/calendar/reminders.ts`. Calendar
  meeting-link update handlers and route declarations moved to
  `apps/api/src/routes/calendar/meeting-links.ts`, and invitation queueing handlers and route
  declarations moved to `apps/api/src/routes/calendar/invitations.ts`; iCalendar feed handling and
  subscription URL generation moved to `apps/api/src/routes/calendar/feed.ts`; and hosted
  guest-session/public-token staff and portal handlers moved to
  `apps/api/src/routes/calendar/guest-sessions.ts`. Meeting-link validation, hosted-room field
  derivation, invitation delivery confirmation, invitation text, delivery audit/job metadata,
  guest-session token handling, public guest access logging, and guest-session response shaping
  remain module-private to those submodules except for the guest-session serializer used by the
  calendar event list. Shared calendar route dependency typing, base URL resolution, event params
  parsing, matter-scoped calendar access assertion, meeting invitation boundary resolution, event
  response shaping, and redacted audit append helper moved to
  `apps/api/src/routes/calendar/shared.ts`. `registerCalendarRoutes` remains the server-facing
  compatibility entrypoint and now delegates the attendee, credential, reminder, meeting-link,
  invitation, feed, and guest-session submodules, while the boundary registry scans all seven
  calendar-owned subfiles.
- Staff intake template create/update/preview/QA handlers and route declarations moved from
  `apps/api/src/routes/intake-forms.ts` to
  `apps/api/src/routes/intake-forms/templates.ts`; staff link list/create/revoke, submitted-review
  load/accept/reject/request-more-info, and intake variable proposal list/approve/reject handlers
  moved to `apps/api/src/routes/intake-forms/links.ts`; and public token/header/path portal
  view/draft/submit/upload/signature handlers moved to
  `apps/api/src/routes/intake-forms/public.ts`. Shared intake-form route dependency typing,
  template params, intake access assertion, template lookup, link status, review-task helpers, and
  signature-item traversal moved to `apps/api/src/routes/intake-forms/shared.ts`.
  `registerIntakeFormRoutes` remains the server-facing compatibility entrypoint, delegates all
  three intake-form submodules, and the boundary registry now scans all three subfiles as owned by
  the registrar.
- The public Mailgun raw-MIME provider webhook route, form parser, signing config parser, HMAC
  freshness verification, raw-storage key builder, S3 raw-object write, parser job lifecycle
  creation, and parser queue enqueue handling moved from `apps/api/src/routes/inbound-email.ts` to
  `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts`. `registerInboundEmailRoutes` remains the
  server-facing compatibility entrypoint, the route authorization manifest keeps the existing
  public `POST /api/inbound-email/provider-webhooks/mailgun/raw-mime` entry, the boundary registry
  now scans the Mailgun subfile as owned by the registrar, and the security hot-path rescan helper
  includes the new module so raw-MIME storage/signature evidence follows the split.
- Inbound parser job retry/dead-letter handlers and recovery-only schemas/helpers moved from
  `apps/api/src/routes/inbound-email.ts` to `apps/api/src/routes/inbound-email/parser-jobs.ts`;
  shared parser/Mailgun constants and inbound/job access helpers moved to
  `apps/api/src/routes/inbound-email/shared.ts`. `registerInboundEmailRoutes` remains the
  server-facing compatibility entrypoint and delegates parser job recovery while preserving the
  existing retry/dead-letter response shapes, redacted audit metadata, idempotency behavior, and
  queue metadata; the boundary registry now scans the parser-jobs subfile as owned by the
  registrar.
- Inbound email status access checks, `buildInboundEmailStatus`, and
  `GET /api/inbound-email/status` moved from `apps/api/src/routes/inbound-email.ts` to
  `apps/api/src/routes/inbound-email/status.ts`; `apps/api/src/routes/providers-status.ts` now
  imports the narrower status helper directly. Owner/auditor provider visibility, matter-scoped
  address filtering, client-external denial, and provider-secret redaction stay unchanged, and the
  boundary registry now scans the status subfile as owned by the registrar.
- Inbound attachment promotion route declarations, promotion-only schemas, promotion document
  redaction, document-create/update authorization checks, checksum/OCR guards, and redacted audit
  metadata moved from `apps/api/src/routes/inbound-email.ts` to
  `apps/api/src/routes/inbound-email/attachment-promotion.ts`; shared attachment redaction moved to
  `apps/api/src/routes/inbound-email/shared.ts` so message detail and promotion responses keep the
  same storage-key redaction. `registerInboundEmailRoutes` remains the server-facing compatibility
  entrypoint and the boundary registry now scans the promotion subfile as owned by the registrar.
- Inbound message list/detail route declarations and read-only authorization checks moved from
  `apps/api/src/routes/inbound-email.ts` to
  `apps/api/src/routes/inbound-email/messages.ts`; shared message id params, message redaction,
  attachment redaction, and staff-triage redaction helpers now live in
  `apps/api/src/routes/inbound-email/shared.ts`. `registerInboundEmailRoutes` remains the
  server-facing compatibility entrypoint, the boundary registry now scans the message subfile as
  owned by the registrar, and the security hot-path rescan helper includes the new message module so
  inbound-email redaction evidence follows the split.
- The communications inbox inbound-email triage update route, triage body schemas, triage metadata
  update helpers, matter/assignee/contact authorization checks, private-note cap handling, and
  redacted triage audit metadata moved from `apps/api/src/routes/inbound-email.ts` to
  `apps/api/src/routes/inbound-email/triage.ts`. `registerInboundEmailRoutes` remains the
  server-facing compatibility entrypoint, the route authorization manifest keeps the existing
  registrar-owned `PATCH /api/communications/inbox/inbound-email/:id` entry, the boundary registry
  now scans the triage subfile as owned by the registrar, and the security hot-path rescan helper
  includes the new triage module so private-note/audit redaction evidence follows the split.
- The redacted communications inbox aggregate route moved from
  `apps/api/src/routes/communications.ts` to
  `apps/api/src/routes/communications/inbox.ts`; `registerCommunicationsRoutes` remains the
  server-facing compatibility entrypoint, and the boundary registry now scans the inbox subfile as
  owned by the communications registrar. Existing matter-scoped inbound-email, outbound-email,
  conversation, channel-history, client-update draft, provider-status, and contact-cue response
  shapes and redaction behavior are unchanged.
- Intake generated document and generated package route declarations, generated-document/package
  body schemas, generated-document response redaction, package runtime summary serialization,
  package eligibility checks, generated-document audit metadata, and package-generation audit
  metadata moved from `apps/api/src/routes/intake.ts` to
  `apps/api/src/routes/intake/generated-documents.ts`. Shared intake route ID params, access checks,
  and automation-provider availability checks now live in
  `apps/api/src/routes/intake/shared.ts`. `registerIntakeRoutes` remains the server-facing
  compatibility entrypoint, and the boundary registry now scans the generated-documents subfile as
  owned by the intake registrar. Existing generated-document/package routes, response shapes,
  email-queue summaries, docassemble deprecation behavior, storage-key/checksum/evidence redaction,
  answer-snapshot eligibility checks, and audit redaction are unchanged.
- Operations/status loading moved from `page.tsx` to
  `apps/web/app/_features/operations/server-resources.ts`; worker runs, worker health, provider
  status, operational views, AI proposals, reports, and task workbench fallbacks preserve their
  existing optional response semantics.
- Review-rail sessionStorage persistence moved from `dashboard-client.tsx` to
  `apps/web/app/_features/dashboard/review-rail-preference.ts`; dashboard URL/focus behavior and
  visual/copy behavior remain in `DashboardClient`.
- Dashboard active-section URL selection, history updates, detail-panel focus restoration, and
  review-rail collapse/expand refs now live in
  `apps/web/app/_features/dashboard/dashboard-shell-state.ts` with helper-level unit coverage.
  `dashboard-client.tsx` keeps the composed dashboard state consumers, mutation flows, and section
  mounting.
- The stateless document assembly dashboard rendering block moved from `dashboard-client.tsx` to
  `apps/web/app/dashboard/document-assembly-dashboard-block.tsx`; it imports only the existing
  document assembly status/summary helpers and `DocumentAssemblyWorkbenchResponse`, while
  `DashboardClient` keeps active matter selection, section routing, URL/focus behavior, and state.
- Communications dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/communications/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `communications-inbox-dashboard.ts` imports the feature models
  directly.
- Billing/funds dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/billing/models.ts`; `types.ts` keeps a temporary re-export compatibility
  surface while billing, trust-controls, dashboard, page, and dashboard test helpers import the
  feature models directly.
- Document-processing dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/document-processing/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `document-processing-dashboard.ts` imports the feature models
  directly. Dashboard URL/focus/sessionStorage behavior, document-processing UI copy, fetch paths,
  and fallback response semantics are unchanged.
- Document-assembly dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/document-assembly/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `document-assembly-dashboard.ts`,
  `dashboard/document-assembly-dashboard-block.tsx`, `page.tsx`, and `dashboard-client.tsx` import
  the feature models directly. The new feature model file uses local API wire-shape declarations
  instead of adding a new broad root `@open-practice/domain` import, and dashboard
  URL/focus/sessionStorage behavior, document-assembly UI copy, fetch paths, redaction posture, and
  fallback response semantics are unchanged.
- Document-assembly dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/document-assembly/server-resources.ts`; `page.tsx` now calls the
  server-only document-assembly resource loader while preserving the disabled document-capability
  empty dashboard, per-matter `/api/document-assembly/workbench` fetch paths, 404 unavailable
  workbench fallback, 403 access-denied workbench fallback, and non-optional error behavior.
- External-upload dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/external-uploads/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `external-uploads-dashboard.ts`, `matter-command-center.ts`,
  `page.tsx`, `dashboard-client.tsx`, and dashboard tests import the feature models directly.
- External-upload dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/external-uploads/server-resources.ts`; `page.tsx` now calls the
  server-only external-upload resource loader while preserving `/api/external-uploads/status`,
  per-matter `/api/external-uploads?matterId=...` fetch paths, 404/403 status fallback behavior,
  empty upload/review-item fallbacks, and missing `reviewItems` normalization.
- The external-upload dashboard JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/external-uploads-section.tsx`; `dashboard-client.tsx` still owns active
  matter/section routing, link creation, revoke and review mutations, token/status/busy state,
  review maps, URL/history behavior, focus handoff, and review rail sessionStorage preference. The
  component preserves the existing external-upload copy, CSS class names, controls, and aria labels,
  and the static render guard covers active-link, no-link, and uploaded-document review states with
  synthetic data.
- Contacts dashboard model/helper types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/contacts/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `page.tsx`, `dashboard-client.tsx`,
  `dashboard-client.test.ts`, `contact-dossiers-dashboard.ts`, and
  `dashboard/contacts-section.tsx` import the contacts feature models directly. Dashboard
  URL/focus/sessionStorage behavior, contacts dashboard copy, API fetch paths, capability checks,
  and contact data-quality response semantics are unchanged.
- Contact review queue and contact data-quality resolution loading moved from
  `apps/web/app/page.tsx` to `apps/web/app/_features/contacts/server-resources.ts`; `page.tsx`
  now calls the server-only contacts loader and passes the returned data through unchanged. The
  `/api/contacts/review-queue` and `/api/contacts/data-quality-resolutions` paths, optional 404/403
  fallback behavior, empty review summary counts, and dashboard shell behavior are unchanged.
- Email-delivery dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/email-delivery/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `email-delivery-dashboard.ts`, `page.tsx`, `dashboard-client.tsx`,
  and `dashboard/matter-overview-section.tsx` import the feature models directly. Email history
  fetch paths, matter overview delivery-state copy, dashboard URL/focus/sessionStorage behavior,
  and response semantics are unchanged.
- Email-delivery dashboard server loading moved from `apps/web/app/page.tsx` and the root
  `email-delivery-dashboard.ts` helper to
  `apps/web/app/_features/email-delivery/server-resources.ts`; `page.tsx` now imports the
  server-only resource loader directly while `email-delivery-dashboard.ts` keeps only the render
  formatter used by the matter overview section. Email history fetch paths, optional fallback
  behavior, response shape, and matter overview copy are unchanged.
- Communications inbox dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/communications/server-resources.ts`; `page.tsx` now imports the
  server-only resource while preserving the `/api/communications/inbox` matter endpoint,
  unavailable fallback, access-denied fallback, disabled channel-state defaults, empty conversation
  and delivery arrays, and the existing dashboard response shape.
- Intake form link/proposal loading, intake pipeline loading, and public consultation
  settings/intake loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/intake/server-resources.ts`; `page.tsx` now imports the server-only
  resources while preserving the existing intake-form empty link/proposal fallbacks, intake
  pipeline status mapping from `apiGetOptionalWithStatus`, public consultation
  `access_denied`-before-`unavailable` status precedence, pending-intake filter, and response
  shapes.
- Legal-clinic dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/legal-clinic/server-resources.ts`; `page.tsx` now imports the
  server-only resource while preserving the `/api/legal-clinic/programs` and
  `/api/legal-clinic/profiles` endpoints, empty program/profile fallbacks, and profile response
  coercion.
- Legal-research dashboard server loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/legal-research/server-resources.ts`; `page.tsx` now imports the
  server-only resource while preserving the research capability gate, per-matter workspace
  endpoint, unavailable fallback, access-denied fallback, and empty disabled workspace shape.
- Share-link dashboard model types moved from `apps/web/app/types.ts` to
  `apps/web/app/_features/share-links/models.ts`; `types.ts` keeps a temporary re-export
  compatibility surface while `share-links-dashboard.ts`, `matter-command-center.ts`, `page.tsx`,
  `dashboard-client.tsx`, and dashboard tests import the feature models directly.
- The share-link dashboard JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/share-links-section.tsx`; `dashboard-client.tsx` still owns active
  matter/section routing, share creation, revoke and client-account setup mutations, selected
  client contact, token/status state, URL/history behavior, focus handoff, and review rail
  sessionStorage preference. The component preserves the existing secure-share copy, CSS class
  names, controls, and status regions, and the static render guard covers active-link and empty
  share-link states with synthetic data.
- The billing dashboard section JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/billing-section.tsx`; `dashboard-client.tsx` still owns the billing
  visibility guard and hidden-role copy, mutation state, API request builders, active matter/section
  routing, URL/history behavior, focus handoff, and review rail sessionStorage preference. The
  component preserves billing CSS class names and copy, timer, expense, draft invoice, payment
  request, settlement review, and manual payment controls, the `.slice(0, 16)` datetime-local
  behavior, expense profile default-reimbursable behavior, and the no-balance/no-trust/no-auto
  settlement boundary copy; the static render guard covers visible billing dashboard rendering with
  synthetic data.
- The document-processing documents section JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/documents-section.tsx`; `dashboard-client.tsx` still owns the workbench
  cache, metadata filter state, OCR queueing state, workbench refresh, metadata search/tag
  callbacks, queue API callback, active matter derivations, URL/history behavior, focus handoff, and
  review rail sessionStorage preference. The component preserves document-processing CSS class
  names and copy, metadata search controls, provider/worker summaries, `DocumentAssemblyDashboardBlock`
  placement, metadata tag/result rendering, read-only reviewer suggestions, and OCR queue disabled
  behavior; the static render guard covers metadata search, provider/worker, document assembly,
  reviewer suggestion, and OCR queue rendering with synthetic data.
- The signatures dashboard JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/signatures-section.tsx`; `dashboard-client.tsx` still owns active matter
  filtering, active section routing, URL/history behavior, focus handoff, and review rail
  sessionStorage preference. The component preserves signature request CSS class names, title,
  provider/external-id, first-underscore status formatting, and empty-state copy; the static render
  guard covers populated and empty signature request states with synthetic data.
- The audit dashboard body JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/audit-section.tsx`; `dashboard-client.tsx` still owns the zero-matter
  article wrapper, matter detail shell placement, refresh state, refresh callback, active section
  routing, URL/history behavior, focus handoff, and review rail sessionStorage preference. The
  component preserves audit refresh panel copy/classes, projection summary copy/classes, zero-matter
  summary-only rendering, matter activity list rendering, mismatch detail formatting, and empty
  activity copy; the static render guard covers zero-matter and matter-scoped audit states with
  synthetic data.
- The drafting dashboard body JSX moved from `apps/web/app/dashboard-client.tsx` to
  `apps/web/app/dashboard/drafting-section.tsx`; `dashboard-client.tsx` still owns selected draft
  state, editor JSON state, draft create/save/export/assist callbacks, active matter derivations,
  active section routing, URL/history behavior, focus handoff, and review rail sessionStorage
  preference. The component preserves drafting template cards, matter draft rows, selected-draft
  editor header, merge-field/export controls, draft assist controls, status live regions, disabled
  save/export behavior, export checksum/size formatting, assist review actions, and empty-state
  copy/classes; the static render guard covers list and selected-draft states with synthetic data.
- Share-link status loading moved from `apps/web/app/page.tsx` to
  `apps/web/app/_features/share-links/server-resources.ts`; `page.tsx` now calls the server-only
  share-link loader and passes the returned status through unchanged. The `/api/shares/status`
  path and the shared 404/403 fallback to `{ createStatus: "disabled", reason:
"share_routes_unavailable" }` are unchanged.
- Secure share-link staff status/list/create/revoke handlers moved from
  `apps/api/src/routes/shares.ts` to `apps/api/src/routes/shares/staff.ts`, public token
  read/email-verification handlers moved to `apps/api/src/routes/shares/public.ts`, and shared
  access assertions, public-token reading, share sanitization, email-verification code helpers,
  document response shaping, availability checks, access-log builders, and dependency typing moved
  to `apps/api/src/routes/shares/shared.ts`. `registerShareRoutes` remains the server-facing
  compatibility entrypoint while delegating the staff and public submodules, the boundary registry
  now scans both share-owned subfiles, and share route response shapes, token hash redaction, raw
  token return-on-create behavior, email-verification behavior, public header/path token
  compatibility, and public access logging are unchanged.
- Worker processor ports moved to `apps/worker/src/processors/types.ts`, shared metadata helpers
  moved to `apps/worker/src/processors/metadata.ts`, the report queue-family implementation moved
  to `apps/worker/src/processors/reports.ts`, connector delivery/retry processing moved to
  `apps/worker/src/processors/connectors.ts`, email delivery processing moved to
  `apps/worker/src/processors/email.ts`, and OCR processing moved to
  `apps/worker/src/processors/ocr.ts`, and AI-triage draft-assist/operational-proposal/reserved
  legal-research handling moved to `apps/worker/src/processors/ai-triage.ts`;
  `processOpenPracticeJob` remains the compatibility dispatcher and re-exports the existing worker
  processor types.
- Database schema enum, core, matter, and AI/research table groups moved to
  `packages/database/src/schema/`; `schema.ts` remains the compatibility export aggregator, and
  downstream schema submodules import sibling table values directly for foreign-key declarations.
  No migrations or generated SQL changed in this first schema split.
- Follow-up provider-settings, legal-clinic, connector/integration, and
  auth/session/MFA/passkey/recovery schema groups moved into focused schema submodules while
  `schema.ts` remains the compatibility aggregator. No migrations or generated SQL changed in these
  schema extraction passes.
- Job queue enum definitions moved to `packages/database/src/schema/enums.ts`, and job lifecycle,
  email outbox, email receipt-token, and email event schema definitions moved to
  `packages/database/src/schema/jobs-email.ts`; `schema.ts` re-exports the module. The
  `job_queue_name` and `job_lifecycle_status` enum names plus
  `job_lifecycle_records`, `email_outbox`, `email_receipt_tokens`, and `email_events` table names,
  foreign keys, defaults, check names, unique indexes, secondary indexes, and migration posture are
  unchanged.
- Task deadline schema moved to `packages/database/src/schema/tasks.ts` so calendar scheduling
  request foreign keys can import a leaf task schema module instead of depending on the root
  aggregator. `schema.ts` re-exports the module, preserving existing `schema.tasks` consumers.
- Calendar credential, event, attendee, reminder, scheduling request, meeting session, and guest
  link schema definitions moved to `packages/database/src/schema/calendar.ts`; `schema.ts`
  re-exports the module so Drizzle config, repository mappers, seed data, and API consumers keep
  resolving `schema.calendar*` and `schema.calendarCredentials` through the compatibility
  aggregator. The `calendar_credentials`, `calendar_events`, `calendar_event_attendees`,
  `calendar_event_reminders`, `calendar_scheduling_requests`, `calendar_meeting_sessions`, and
  `calendar_guest_links` table names, foreign keys, defaults, check names, unique indexes,
  secondary indexes, and migration posture are unchanged.
- Contact kind and party-role enums plus contact, contact data-quality resolution, contact
  relationship, and matter-party schema definitions moved to
  `packages/database/src/schema/contacts.ts`; `schema.ts` re-exports the module while downstream
  schema submodules import `contacts` directly for contact foreign-key declarations. The
  `contact_kind` and `party_role` enum names plus `contacts`,
  `contact_data_quality_resolutions`, `contact_relationships`, and `matter_parties` table names,
  foreign keys, indexes, checks, JSON identifier typing, and migration posture are unchanged.
- Saved operational view surface/status enums and saved operational view definition schema moved to
  `packages/database/src/schema/operational-views.ts`; `schema.ts` re-exports the module so Drizzle
  config, repository mappers, and API consumers keep resolving `schema.savedOperationalView*`
  through the compatibility aggregator. The `saved_operational_view_surface` and
  `saved_operational_view_status` enum names plus `saved_operational_view_definitions` table name,
  foreign keys, JSON type bindings, indexes, positive row-limit check, defaults, and migration
  posture are unchanged.
- Conversation thread status/export/notification-boundary/message-kind enums plus conversation
  thread, message, and notification schemas moved to
  `packages/database/src/schema/conversation-threads.ts`; `schema.ts` re-exports the module so
  Drizzle config, repository mappers, route tests, and API consumers keep resolving
  `schema.conversation*` through the compatibility aggregator. The
  `conversation_thread_status`, `conversation_thread_export_state`,
  `conversation_thread_notification_boundary`, and `conversation_message_kind` enum names plus the
  `conversation_threads`, `conversation_messages`, and `conversation_message_notifications` table
  names, foreign keys, JSON metadata type bindings, indexes, unique indexes, defaults, and migration
  posture are unchanged.
- Conflict-check schema moved to `packages/database/src/schema/conflict-checks.ts`; `schema.ts`
  re-exports the module so the focused conflict-check repository implementation and API consumers
  keep resolving `schema.conflictChecks` through the compatibility aggregator. The
  `conflict_checks` table name, firm/requester/reviewer foreign keys, snapshot JSON columns,
  disposition default, and migration posture are unchanged. `packages/database/test/schema.test.ts`
  now asserts the aggregator-visible conflict-check review snapshot columns.
- Firm-settings and notification-preference schemas moved to
  `packages/database/src/schema/firm-settings.ts`; `schema.ts` re-exports the module so setup,
  repository mappers, and API consumers keep resolving `schema.firmSettings` and
  `schema.notificationPreferences` through the compatibility aggregator. The `firm_settings` and
  `notification_preferences` table names, firm/user foreign keys, routing-key unique index,
  defaults, and migration posture are unchanged. `packages/database/test/schema.test.ts` now
  asserts the aggregator-visible notification preference routing columns and unique index.
- Public consultation intake status enum and intake schema moved to
  `packages/database/src/schema/public-consultation.ts`; `schema.ts` re-exports the module so
  repository mappers, public-consultation routes, and API tests keep resolving
  `schema.publicConsultation*` through the compatibility aggregator. The
  `public_consultation_intake_status` enum name plus `public_consultation_intakes` table name,
  firm/reviewer/converted-matter foreign keys, metadata JSON binding, indexes, defaults, and
  migration posture are unchanged. `packages/database/test/schema.test.ts` now asserts the
  aggregator-visible public consultation review columns and indexes.
- Audit-event schema moved to `packages/database/src/schema/audit-events.ts`; `schema.ts`
  re-exports the module so seed data, repository implementations, audit mappers, and API consumers
  keep resolving `schema.auditEvents` through the compatibility aggregator. The `audit_events`
  table name, firm foreign key, required per-firm sequence column, hash-chain columns, unique
  sequence index, and migration posture are unchanged. Existing schema hardening coverage continues
  to assert the required sequence and unique index through the root schema export.
- Billing period-lock and rate-rule schemas moved to
  `packages/database/src/schema/billing-controls.ts`; `schema.ts` re-exports the module while the
  billing schema submodule imports `billingRateRules` directly for the `timeEntries.rateRuleId`
  foreign key. The `billing_period_locks` and `billing_rate_rules` table names, firm/matter/user
  foreign keys, period/rate integrity checks, active-scope index, defaults, and migration posture
  are unchanged. Existing schema hardening coverage continues to assert the billing workflow columns
  through the root schema export.
- Portal grant, secure share-link, and external-upload link schemas moved to
  `packages/database/src/schema/portal-links.ts`; `schema.ts` re-exports the module while
  access-log and document schema submodules import `shareLinks`/`externalUploadLinks` directly for
  their foreign keys. The `portal_grants`, `share_links`, and `external_upload_links` table names,
  firm/matter/contact/user foreign keys, token/idempotency unique indexes, matter expiry indexes,
  permission/default columns, and migration posture are unchanged.
  `packages/database/test/schema.test.ts` now asserts aggregator-visible portal grant columns
  alongside the existing share-link and external-upload checks.
- Document classification, document ingestion, document version/text extraction, media transcript,
  and media derivative schemas moved to `packages/database/src/schema/documents.ts`; `schema.ts`
  re-exports the module while downstream schema submodules import `documents` directly for their
  foreign keys. The
  `document_classification` enum name, `documents`, `document_versions`,
  `document_text_extractions`, `media_transcripts`, and `media_derivatives` table names,
  firm/matter/user/external-upload/document foreign keys, processing status defaults, version and
  document-kind indexes, and migration posture are unchanged. Existing schema hardening coverage
  continues to assert the aggregator-visible document ingestion and media-processing columns
  through the root schema export.
- Inbound email address, message, and attachment schemas moved to
  `packages/database/src/schema/inbound-email.ts`; `schema.ts` re-exports the module without a
  compatibility import because the three inbound-email tables moved together and now reference the
  document schema submodule directly. The `inbound_email_addresses`, `inbound_email_messages`, and
  `inbound_email_attachments` table names, firm/matter/document foreign keys, firm-address unique
  index, firm-received index, JSON defaults, enabled/status defaults, and migration posture are
  unchanged. Existing schema hardening coverage continues to assert the aggregator-visible inbound
  email workflow columns through the root schema export.
- Draft, draft-template, and draft-assist schemas moved to
  `packages/database/src/schema/drafts.ts`; `schema.ts` re-exports the module while the document
  assembly schema submodule imports `drafts` directly for `documentAssemblyPackages.sourceDraftId`.
  The `drafts`, `draft_templates`, and `draft_assist_records` table
  names, firm/matter/user/document foreign keys, editor JSON and metadata bindings, firm/matter,
  firm/category, draft-assist firm/matter, firm/draft, and firm/document indexes, defaults, and
  migration posture are unchanged. Existing schema hardening coverage continues to assert the
  aggregator-visible draft and draft-assist columns through the root schema export.
- Signature request, signer, provider-event, and webhook-attempt schemas moved to
  `packages/database/src/schema/signatures.ts`; `schema.ts` re-exports the module while intake and
  document assembly schema submodules import `signatureRequests` directly for signature action and
  envelope foreign keys. The `signature_requests`, `signature_request_signers`,
  `signature_provider_events`, and `signature_webhook_attempts` table names,
  firm/matter/document/user/signature-request foreign keys, consent/default columns, evidence and
  payload JSON columns, timestamps, and migration posture are unchanged. Existing schema hardening
  coverage continues to assert the aggregator-visible signature request, signer, provider-event,
  and webhook-attempt columns through the root schema export.
- Intake template, session, answer snapshot, form-link, form-review, item-action, and variable
  proposal schemas moved to `packages/database/src/schema/intake.ts`; `schema.ts` re-exports the
  module while access logs and document assembly import `intakeFormLinks`/`intakeSessions`
  directly. The `intake_templates`, `intake_sessions`, `answer_snapshots`, `intake_form_links`,
  `intake_form_reviews`, `intake_form_item_actions`, and `intake_variable_proposals` table names,
  firm/matter/contact/user/document/signature foreign keys, self-referential follow-up link,
  token/snapshot/submission indexes, answer resolution JSON binding, action/proposal status
  bindings, defaults, and migration posture are unchanged. Existing schema hardening coverage
  continues to assert the aggregator-visible intake template/session/form-link/review columns
  through the root schema export.
- Generated document, document assembly set/package, and signature-envelope schemas moved to
  `packages/database/src/schema/document-assembly.ts`; `schema.ts` re-exports the module without
  keeping local document/draft/intake/signature imports. The `generated_documents`,
  `document_assembly_set_definitions`, `document_assembly_packages`, and `signature_envelopes`
  table names, firm/matter/user/document/draft/intake/signature foreign keys, package/envelope
  indexes, JSON metadata bindings, status checks, defaults, and migration posture are unchanged.
  Existing schema hardening coverage continues to assert the aggregator-visible generated document,
  assembly package, and signature envelope columns through the root schema export.
- Access-log schema moved to `packages/database/src/schema/access-logs.ts`; `schema.ts` re-exports
  the module and no longer imports share-link, external-upload-link, or intake-form-link tables for
  local declarations. The `access_logs` table name, firm/actor/share/external-upload/intake-link
  foreign keys, resource/action columns, metadata JSON default, firm-resource index, and migration
  posture are unchanged. Existing schema hardening coverage continues to assert the
  aggregator-visible access-log columns through the root schema export.
- Ledger account, trust transaction, trust ledger entry, client balance, approval,
  reconciliation/import, match-rule, accounting-review, and exception-resolution schemas moved to
  `packages/database/src/schema/ledger.ts`; `schema.ts` re-exports the module while billing imports
  `trustTransactions` directly for billing trust-transfer foreign keys. The
  `ledger_account_type` enum name, trust table names, firm/matter/contact/user/account/transaction
  foreign keys, ledger entry primary key, trust indexes, amount checks, JSON metadata defaults, and
  migration posture are unchanged.
- Billing time/expense entry, invoice, invoice-line, manual-payment, payment-allocation, hosted
  payment request, and billing trust-transfer schemas moved to
  `packages/database/src/schema/billing.ts`; `schema.ts` re-exports the module and now contains only
  compatibility exports. The billing table names, firm/matter/contact/user/rate-rule/invoice/trust
  transaction foreign keys, invoice and hosted-payment indexes, hosted-payment checks, JSON type
  bindings/defaults, and migration posture are unchanged.

## Validation

Completed before the final docs/proof selector pass:

- `node --test scripts/validate-open-practice-boundaries.test.mjs scripts/select-validation.test.mjs`
  - Passed: 20 tests.
- `node scripts/validate-open-practice-boundaries.mjs`
  - Passed: `Open Practice boundary policy passed.`
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`
  - Passed.
- `pnpm --filter @open-practice/api exec vitest run src/routes/drafts.test.ts src/routes/intake.test.ts src/routes/communications.test.ts src/routes/conversation-threads.test.ts`
  - Passed: 4 files, 44 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/drafts.test.ts src/routes/intake.test.ts`
  - Passed: 2 files, 25 tests after the intake provider-default cleanup.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after replacing the two remaining route-local `EmbeddedAutomationProvider` references.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after extracting `apps/web/app/_shared/server-api.ts`.
- `pnpm --filter @open-practice/web test`
  - Passed: 20 files, 141 tests after extracting `apps/web/app/_shared/server-api.ts`.
- `pnpm --filter @open-practice/worker lint`
  - Passed after extracting worker processor types and report jobs.
- `pnpm --filter @open-practice/worker typecheck`
  - Passed after extracting worker processor types and report jobs.
- `pnpm --filter @open-practice/worker test`
  - Passed: 3 files, 36 tests after extracting worker processor types and report jobs.
- `pnpm --filter @open-practice/worker typecheck && pnpm --filter @open-practice/worker test && pnpm --filter @open-practice/worker build`
  - Passed after extracting connector delivery/retry processing to `processors/connectors.ts`.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test`
  - Passed: 20 files, 141 tests after extracting connector server resource loading.
- `pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build`
  - Passed after extracting `PracticeSetupRepository` and setup contracts.
- `pnpm --filter @open-practice/worker typecheck && pnpm --filter @open-practice/worker test && pnpm --filter @open-practice/worker build`
  - Passed after extracting email delivery and OCR processing to queue-family modules.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test`
  - Passed: 20 files, 141 tests after extracting audit projection server resource loading.
- `pnpm --filter @open-practice/worker typecheck && pnpm --filter @open-practice/worker test && pnpm --filter @open-practice/worker build`
  - Passed after extracting AI-triage processing to a queue-family module.
- `pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build`
  - Passed after extracting `ProviderSettingsRepository`.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test && node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed after extracting billing dashboard server resource loading.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts && pnpm --filter @open-practice/api typecheck && node --test scripts/validate-open-practice-boundaries.test.mjs && node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed after extracting billing export route declarations and handlers to a registrar-owned
    subfile.
- `pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/api/src/routes/connectors/shared.ts apps/api/src/routes/connectors/outbox.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the connector outbox route submodule extraction.
- `pnpm policy:check`
  - Passed after extracting connector outbox route declarations/handlers and updating the boundary
    registry for the connector-owned subfile.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files, 498 tests after extracting connector outbox route declarations and handlers.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting connector outbox route declarations and shared connector route helpers.
- `node --test scripts/validate-open-practice-boundaries.test.mjs && node scripts/validate-open-practice-boundaries.mjs`
  - Passed: 11 boundary contract tests plus `Open Practice boundary policy passed` after adding the
    connector outbox registrar-owned route subfile.
- `pnpm test`
  - Passed after the connector outbox extraction: 9 Turbo test/build tasks succeeded, including API
    `src/routes/connectors.test.ts` with 25 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/api/src/routes/connectors/shared.ts apps/api/src/routes/connectors/developer-shared.ts apps/api/src/routes/connectors/developer-recovery.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the connector developer recovery route submodule extraction.
- `pnpm policy:check`
  - Passed after extracting connector developer delivery-history/webhook-replay route declarations
    and handlers and updating the boundary registry for the connector-owned developer recovery
    subfile.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files, 498 tests after extracting connector developer recovery route declarations and
    handlers.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting connector developer recovery route declarations and shared developer
    connector route helpers.
- `node --test scripts/validate-open-practice-boundaries.test.mjs && node scripts/validate-open-practice-boundaries.mjs`
  - Passed: 11 boundary contract tests plus `Open Practice boundary policy passed` after adding the
    connector developer recovery registrar-owned route subfile.
- `pnpm test`
  - Passed after the connector developer recovery extraction: 9 Turbo test/build tasks succeeded,
    including API `src/routes/connectors.test.ts` with 25 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/shared.ts apps/api/src/routes/calendar/reminders.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the calendar reminder route submodule extraction.
- `pnpm --filter @open-practice/api test -- src/routes/calendar.test.ts`
  - Passed after the reminder route extraction; the API test script ran the full API suite, 41 files
    and 498 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving reminder handlers and shared calendar access/audit helpers.
- `node --test scripts/validate-open-practice-boundaries.test.mjs && node scripts/validate-open-practice-boundaries.mjs`
  - Passed: 11 boundary contract tests plus `Open Practice boundary policy passed` after adding the
    calendar reminder registrar-owned route subfile.
- `pnpm policy:check`
  - Passed after the calendar reminder route submodule extraction.
- `pnpm test`
  - Passed after the calendar reminder extraction: 9 Turbo test/build tasks succeeded, including API
    41 files and 498 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/shared.ts apps/api/src/routes/calendar/credentials.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the calendar credential route submodule extraction.
- `pnpm --filter @open-practice/api test -- src/routes/calendar.test.ts`
  - Passed after the credential route extraction; the API test script ran the full API suite, 41
    files and 498 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving credential handlers and shared calendar base URL helpers.
- `node --test scripts/validate-open-practice-boundaries.test.mjs && node scripts/validate-open-practice-boundaries.mjs`
  - Passed: 11 boundary contract tests plus `Open Practice boundary policy passed` after adding the
    calendar credential registrar-owned route subfile.
- `pnpm policy:check`
  - Passed after the calendar credential route submodule extraction.
- `pnpm test`
  - Passed after the calendar credential extraction: 9 Turbo test/build tasks succeeded, including
    API 41 files and 498 tests, plus 58 script contract tests.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test && node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed after extracting operations/status dashboard resources.
- `pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build && git diff --check`
  - Passed after extracting `ConnectorRepository`.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test && git diff --check`
  - Passed after extracting review-rail preference persistence to a dashboard feature hook.
- `pnpm --filter @open-practice/web typecheck && pnpm --filter @open-practice/web test && node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed: 20 files, 141 tests after moving communications model types to a feature barrel.
- `pnpm --filter @open-practice/database exec vitest run test/repository.providers-jobs-email.test.ts && pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build && node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed: 1 file, 7 tests after moving provider-settings encryption and Drizzle/memory
    implementation helpers to repository submodules.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files, 107 tests after moving enum, core, matter, and AI/research schema groups to
    schema submodules.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the schema split.
- `pnpm migrations:check`
  - Passed: 52 SQL files matched 52 journal entries after the schema split.
- `pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build`
  - Passed after the schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files, 498 tests after the schema split.
- `node scripts/validate-open-practice-boundaries.mjs && git diff --check`
  - Passed after the schema split.
- `pnpm --filter @open-practice/web test && pnpm --filter @open-practice/web typecheck && pnpm build`
  - Passed: 20 web test files, 141 tests after moving billing/funds dashboard model types to a
    billing feature barrel.

Broad selector-driven validation and follow-up slice validation:

- `pnpm verify:select -- --files <changed paths...>`
  - Passed and selected: `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`,
    `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`, database
    test/db-check/migration-check/typecheck/build, providers test/typecheck/build, API
    test/typecheck, worker test/typecheck/build, web test/typecheck, and `pnpm build`.
- `pnpm deps:audit`
  - Passed: production and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed: 550 packages and 579 versions summarized; existing review-required license groups were
    reported without failing the command.
- `node --test scripts/security-hot-path-rescan.test.mjs scripts/select-validation.test.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed: 26 tests after adding the database build command to the hot-path-rescan contract.
- `pnpm ci:local`
  - Passed on the final path set after the boundary/selector changes, API port/default cleanup,
    setup/provider-settings/connector repository extraction, provider-settings implementation
    extraction, web shared/resource/model/hook extraction including communications and
    billing/funds feature model barrels, worker report/connector/email/OCR/AI processor extraction,
    billing route submodule extraction, connector outbox and developer recovery route submodule
    extraction, calendar reminder and credential route submodule extraction, and first schema
    submodule split. This covered `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm policy:check`, `pnpm build`, and
    `git diff --check`.
- `pnpm docs:check && node scripts/validate-validation-proof-index.mjs && git diff --check`
  - Passed after the final proof/workboard updates.
- `pnpm e2e:host`
  - Passed after the final OP-MOD path set: 33 Playwright host checks passed and 3 were skipped.
    The harness stopped the dev API/web processes after completion; the expected watcher shutdown
    exit status was reported during teardown.
- `pnpm e2e:docker`
  - Passed after the final OP-MOD path set: migrations applied against Docker-backed Postgres and 5
    Docker-backed Playwright checks passed. The harness stopped the API/web/worker processes and
    removed the E2E Postgres, Redis, MinIO, Mailpit containers, volumes, and network during
    teardown.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/document-assembly-dashboard-block.tsx apps/web/app/dashboard-client.test.ts`
  - Passed and selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the document assembly
    dashboard block extraction.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`
  - Passed: 1 file and 70 tests after moving the directly render-tested document assembly block.
- `pnpm --filter @open-practice/web test`
  - Passed: 20 files and 141 tests after moving the document assembly block.
- `pnpm build`
  - Passed after moving the document assembly block.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `pnpm build` regenerated stable Next `.next/types`; the first concurrent
    typecheck/build attempt hit missing generated `.next/types` files while build was rewriting
    them.
- `pnpm ci:local`
  - Passed after the document assembly block extraction and proof/workboard updates; this covered
    format, lint, typecheck, tests, database `db:check`, policy checks, build, and whitespace.
- `pnpm deps:audit`
  - Passed after the document assembly block extraction and proof/workboard updates: production and
    development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the document assembly block extraction and proof/workboard updates: 550 packages
    and 579 versions summarized, with the existing review-required license groups reported without
    failing the command.
- `pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/attendees.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the calendar attendee route submodule extraction.
- `pnpm policy:check`
  - Passed after extracting calendar attendee route declarations and handlers and updating the
    boundary registry for the calendar-owned attendee subfile.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving attendee create/update/delete handlers behind the calendar attendee
    submodule.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 498 tests after extracting the calendar attendee route declarations and
    handlers.
- `pnpm test`
  - Passed after the calendar attendee extraction: 9 Turbo test/build tasks succeeded, including
    API 41 files and 498 tests, plus 58 script contract tests.
- `pnpm ci:local`
  - Passed after the calendar attendee extraction and proof/workboard updates; this covered format,
    lint, typecheck, tests, database `db:check`, policy checks, build, and whitespace on the full
    OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the calendar attendee extraction and proof/workboard updates: production and
    development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the calendar attendee extraction and proof/workboard updates: 550 packages and 579
    versions summarized, with the existing review-required license groups reported without failing
    the command.
- `pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/shared.ts apps/api/src/routes/calendar/invitations.ts apps/api/src/routes/calendar/meeting-links.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed and selected `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the calendar meeting-link and invitation route submodule extraction.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving meeting-link and invitation handlers behind calendar registrar-owned
    submodules.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 498 tests after extracting the calendar meeting-link and invitation route
    declarations and handlers.
- `pnpm policy:check`
  - Passed after extracting calendar meeting-link and invitation route declarations/handlers and
    updating the boundary registry for the new calendar-owned subfiles.
- `pnpm test`
  - Passed after the calendar meeting-link and invitation extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 498 tests, plus 58 script contract tests.
- `pnpm ci:local`
  - Passed after the calendar meeting-link and invitation extraction and proof/workboard updates;
    this covered format, lint, typecheck, tests, database `db:check`, policy checks, build, and
    whitespace on the full OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the calendar meeting-link and invitation extraction and proof/workboard updates:
    production and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the calendar meeting-link and invitation extraction and proof/workboard updates:
    550 packages and 579 versions summarized, with the existing review-required license groups
    reported without failing the command.
- `pnpm verify:select -- --files apps/api/src/routes/calendar.ts apps/api/src/routes/calendar/feed.ts apps/api/src/routes/calendar/guest-sessions.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the calendar feed and
    guest-session/public-token route submodule extraction.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting iCalendar feed and hosted guest-session/public-token handlers behind
    calendar registrar-owned submodules.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 498 tests after extracting calendar feed and guest-session/public-token
    route declarations/handlers while preserving public-token header/path behavior and redacted
    public access-log assertions.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/calendar/feed.ts` and
    `apps/api/src/routes/calendar/guest-sessions.ts` as calendar-owned route subfiles; the live
    boundary policy, validation proof index, migration parity, docs links, package manifest policy,
    OSS reuse policy, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the calendar feed and guest-session/public-token extraction: 9 Turbo test/build
    tasks succeeded, including API calendar coverage, and 58 script tests passed including the
    registrar-owned subfile route-collection contract.
- `pnpm docs:check`
  - Passed after the proof/index/workboard updates; documentation links remain valid.
- `node scripts/validate-validation-proof-index.mjs`
  - Passed after adding the calendar feed and guest-session/public-token extraction to the active
    OP-MOD proof/index entries.
- `git diff --check`
  - Passed after the proof/index/workboard updates.
- `pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)`
  - Selected the full OP-MOD dirty-lane gate set, including `pnpm ci:local`, dependency audit and
    license evidence, package tests/typechecks/builds, docs/policy checks, database checks, and root
    test/build coverage.
- `pnpm ci:local`
  - Passed after the calendar feed and guest-session/public-token extraction and proof/workboard
    updates; this covered format, lint, typecheck, tests, database `db:check`, policy checks, build,
    and whitespace on the full OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the calendar feed and guest-session/public-token extraction and proof/workboard
    updates: production and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the calendar feed and guest-session/public-token extraction and proof/workboard
    updates: 550 packages and 579 versions summarized, with the existing review-required license
    groups reported without failing the command.
- `pnpm verify:select -- --files apps/api/src/routes/intake-forms.ts apps/api/src/routes/intake-forms/shared.ts apps/api/src/routes/intake-forms/templates.ts apps/api/src/routes/intake-forms.test.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the intake template builder route submodule extraction and proof/workboard updates.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving staff intake template builder handlers behind the registrar-owned submodule.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting the intake template builder route declarations
    and adding focused create/update response-shape and audit-metadata coverage.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/intake-forms/templates.ts` as an intake-form-owned
    route subfile; the live boundary policy, validation proof index, migration parity, docs links,
    package manifest policy, OSS reuse policy, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the intake template builder extraction: 9 Turbo test/build tasks succeeded,
    including API intake-form coverage with 499 API tests, plus 58 script contract tests.
- `pnpm ci:local`
  - Passed after the intake template builder extraction and proof/workboard updates; this covered
    format, lint, typecheck, tests, database `db:check`, policy checks, build, and whitespace on
    the full OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the intake template builder extraction and proof/workboard updates: production and
    development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the intake template builder extraction and proof/workboard updates: 550 packages
    and 579 versions summarized, with the existing review-required license groups reported without
    failing the command.
- `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/shared.ts apps/api/src/routes/inbound-email/parser-jobs.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the inbound parser job recovery route submodule
    extraction.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving inbound parser job retry/dead-letter handlers behind the registrar-owned
    submodule.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting the inbound parser job recovery route
    declarations and handlers.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/inbound-email/parser-jobs.ts` as an
    inbound-email-owned route subfile; the live boundary policy, validation proof index, migration
    parity, docs links, package manifest policy, OSS reuse policy, and tracked-secret scan all
    passed.
- `pnpm test`
  - Passed after the inbound parser job recovery extraction: 9 Turbo test/build tasks succeeded,
    including API inbound-email coverage with 499 API tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/shared.ts apps/api/src/routes/inbound-email/status.ts apps/api/src/routes/inbound-email/attachment-promotion.ts apps/api/src/routes/providers-status.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the inbound status and attachment-promotion
    route submodule extraction.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving inbound status and attachment promotion behind registrar-owned submodules.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting inbound status and attachment promotion route
    declarations and handlers while preserving provider-status posture and promotion redaction
    coverage.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/inbound-email/status.ts` and
    `apps/api/src/routes/inbound-email/attachment-promotion.ts` as inbound-email-owned route
    subfiles; the live boundary policy, validation proof index, migration parity, docs links,
    package manifest policy, OSS reuse policy, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the inbound status and attachment-promotion extraction: 9 Turbo test/build tasks
    succeeded, including API inbound-email and providers-status coverage with 499 API tests, plus
    58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/shared.ts apps/api/src/routes/inbound-email/messages.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/security-hot-path-rescan.mjs scripts/security-hot-path-rescan.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the inbound message list/detail route submodule extraction, security hot-path rescan update, and
    proof/workboard updates.
- `pnpm format:check`
  - Passed after Prettier reflowed `docs/planning-and-progress.md` and `docs/validation/README.md`.
- `pnpm docs:check`
  - Passed after the inbound message list/detail extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/inbound-email/messages.ts` as an
    inbound-email-owned route subfile and adding it to the security hot-path rescan list; the live
    boundary policy, validation proof index, migration parity, docs links, package manifest policy,
    OSS reuse policy, local evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the inbound message list/detail extraction: 9 Turbo test/build tasks succeeded,
    including API inbound-email coverage with 499 API tests, plus 58 script contract tests including
    the updated boundary and security hot-path rescan contracts.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting inbound message list/detail route declarations
    and read handlers while preserving raw/HTML storage-key, attachment storage-key, and private
    staff-note redaction coverage.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the message serializer and staff-triage redaction helpers moved to
    `apps/api/src/routes/inbound-email/shared.ts`.
- `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/triage.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/security-hot-path-rescan.mjs scripts/security-hot-path-rescan.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the communications inbox inbound-email triage route extraction, security hot-path rescan update,
    and proof/workboard updates.
- `pnpm format:check`
  - Passed after Prettier reflowed the proof/workboard docs.
- `pnpm docs:check`
  - Passed after the inbound communications triage extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/inbound-email/triage.ts` as an
    inbound-email-owned route subfile and adding it to the security hot-path rescan list; the live
    boundary policy, validation proof index, migration parity, docs links, package manifest policy,
    OSS reuse policy, local evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the inbound communications triage extraction and boundary expected-order update:
    9 Turbo test/build tasks succeeded, including API inbound-email coverage with 499 API tests,
    plus 58 script contract tests including the updated boundary and security hot-path rescan
    contracts.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting inbound communications triage route
    declarations and handlers while preserving assignment, follow-up, private-note redaction, and
    audit-metadata coverage.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving the triage body schemas, triage metadata builders, and update handler to
    `apps/api/src/routes/inbound-email/triage.ts`.
- `pnpm verify:select -- --files apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/mailgun-raw-mime.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/security-hot-path-rescan.mjs scripts/security-hot-path-rescan.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the public Mailgun raw-MIME route extraction, security hot-path rescan update, and
    proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the Mailgun raw-MIME submodule extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the public Mailgun raw-MIME extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts` as an
    inbound-email-owned route subfile and adding it to the security hot-path rescan list; the live
    boundary policy, validation proof index, migration parity, docs links, package manifest policy,
    OSS reuse policy, local evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the public Mailgun raw-MIME extraction: 9 Turbo test/build tasks succeeded,
    including API inbound-email coverage with 499 API tests, plus 58 script contract tests including
    the updated boundary and security hot-path rescan contracts.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting the signed public Mailgun raw-MIME route while
    preserving HMAC validation, body limit, raw object namespace, conditional SSE-S3, idempotent
    parser job creation, enqueue failure handling, and redacted accepted/job summary responses.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after moving the Mailgun signing, storage, lifecycle job, and queue-enqueue helpers to
    `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts`.
- `pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)`
  - Selected the full OP-MOD dirty-lane gate set after the inbound parser job recovery extraction,
    including `pnpm ci:local`, dependency audit/license evidence, docs/policy checks, database
    checks, root test/build coverage, and package-specific tests/typechecks/builds.
- `pnpm ci:local`
  - Passed after the inbound parser job recovery extraction and proof/workboard updates; this
    covered format, lint, typecheck, tests, database `db:check`, policy checks, build, and
    whitespace on the full OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the inbound parser job recovery extraction and proof/workboard updates: production
    and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the inbound parser job recovery extraction and proof/workboard updates: 550
    packages and 579 versions summarized, with the existing review-required license groups reported
    without failing the command.
- `pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard)`
  - Selected the full OP-MOD dirty-lane gate set after the inbound status and attachment-promotion
    extraction, including `pnpm ci:local`, dependency audit/license evidence, docs/policy checks,
    database checks, root test/build coverage, and package-specific tests/typechecks/builds.
- `pnpm ci:local`
  - Passed after the inbound status and attachment-promotion extraction and proof/workboard updates;
    this covered format, lint, typecheck, tests, database `db:check`, policy checks, build, and
    whitespace on the full OP-MOD dirty path set.
- `pnpm deps:audit`
  - Passed after the inbound status and attachment-promotion extraction and proof/workboard updates:
    production and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the inbound status and attachment-promotion extraction and proof/workboard updates:
    550 packages and 579 versions summarized, with the existing review-required license groups
    reported without failing the command.
- `pnpm verify:select -- --files apps/api/src/routes/intake-forms.ts apps/api/src/routes/intake-forms/shared.ts apps/api/src/routes/intake-forms/links.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the staff intake form link/review/proposal route extraction, boundary registry update, and
    proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the staff intake form link/review/proposal route extraction and
    proof/workboard docs.
- `pnpm docs:check`
  - Passed after the staff intake form link/review/proposal extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/intake-forms/links.ts` as an
    intake-form-owned route subfile; the live boundary policy, validation proof index, migration
    parity, docs links, package manifest policy, OSS reuse policy, local evidence Docker ignore
    check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the staff intake form link/review/proposal extraction and boundary
    expected-order update: 9 Turbo test/build tasks succeeded, including API intake-form coverage
    with 499 API tests, plus 58 script contract tests including the updated boundary collector
    contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting staff intake form link list/create/revoke,
    submitted review load/accept/reject/request-more-info, and intake variable proposal
    list/approve/reject route declarations and handlers while preserving token redaction,
    review-task completion, request-more-info follow-up token behavior, matter scope, and audit
    redaction coverage.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerIntakeFormRoutes` delegated the staff link/review/proposal submodule and
    kept public portal/upload/signature handlers in the parent route file.
- `pnpm verify:select -- --files apps/api/src/routes/intake-forms.ts apps/api/src/routes/intake-forms/public.ts apps/api/src/routes/intake-forms/shared.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the public intake portal/upload/signature route extraction, boundary registry update, and
    proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the public intake portal route extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the public intake portal extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/intake-forms/public.ts` as an
    intake-form-owned route subfile; the live boundary policy, validation proof index, migration
    parity, docs links, package manifest policy, OSS reuse policy, local evidence Docker ignore
    check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the public intake portal extraction and boundary fixture update: 9 Turbo
    test/build tasks succeeded, including API intake-form coverage with 499 API tests, plus 58
    script contract tests including the updated registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting public intake portal view/draft/submit,
    upload-intent/upload-complete, and embedded signature route declarations and handlers while
    preserving token header/path fallback, `publicTokenPolicyOptions` scopes, upload signing
    headers/SSE metadata, idempotent submission conflict behavior, public response redaction,
    access logging, and trusted signature evidence coverage.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerIntakeFormRoutes` delegated the public intake portal submodule and the
    parent route file became the stable compatibility registrar only.
- `pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/api/src/routes/connectors/shared.ts apps/api/src/routes/connectors/developer-registration.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the connector developer registration extraction, shared connector DNS guardrail relocation,
    boundary registry update, and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the connector developer registration extraction and proof/workboard
    docs.
- `pnpm docs:check`
  - Passed after the connector developer registration extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/connectors/developer-registration.ts` as a
    connector-owned route subfile and moving connector delivery URL DNS guardrails into shared
    connector route helpers; the live boundary policy, validation proof index, migration parity,
    docs links, package manifest policy, OSS reuse policy, local evidence Docker ignore check, and
    tracked-secret scan all passed.
- `pnpm test`
  - Passed after the connector developer registration extraction and boundary fixture update:
    9 Turbo test/build tasks succeeded, including API connector coverage with 499 API tests, plus
    58 script contract tests including the updated registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting connector developer app list/create,
    credential create/revoke, and webhook subscription create route declarations and handlers while
    preserving 200/201 response shapes, secret-reference masking, allowed redirect/origin URL
    validation, app-scope subset checks, webhook deliver-scope enforcement, destination DNS
    guardrails, audit redaction, and enqueue error split coverage.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerConnectorRoutes` delegated the connector developer registration submodule
    while keeping connector CRUD, developer recovery, and outbox entrypoints stable.
- `pnpm verify:select -- --files apps/api/src/routes/drafts.ts apps/api/src/routes/drafts/shared.ts apps/api/src/routes/drafts/exports.ts apps/api/src/routes/drafts/templates.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the draft export/template route extraction, boundary registry update, and proof/workboard
    updates.
- `pnpm format:check`
  - Passed after formatting the draft export/template extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the draft export/template extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/drafts/exports.ts` and
    `apps/api/src/routes/drafts/templates.ts` as draft-owned route subfiles; the live boundary
    policy, validation proof index, migration parity, docs links, package manifest policy, OSS
    reuse policy, local evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the draft export/template extraction and boundary fixture update: 9 Turbo
    test/build tasks succeeded, including API draft coverage with 499 API tests, plus 58 script
    contract tests including the updated registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting draft export and draft template route
    declarations and handlers while preserving draft template list/create permissions and audit
    metadata, S3 export storage behavior, checksum/SSE metadata, generated-document response shape,
    merge-field error details, and draft export provider/storage unavailable errors.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerDraftRoutes` delegated the draft export and template submodules while
    keeping draft CRUD, template lookup during draft creation, and route entrypoint compatibility
    stable.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/provider-settings.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the provider-settings schema extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the provider-settings schema split and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the provider-settings schema split proof/workboard updates.
- `pnpm policy:check`
  - Passed after the provider-settings schema split; the live boundary policy, validation proof
    index, migration parity, docs links, package manifest policy, OSS reuse policy, local evidence
    Docker ignore check, and tracked-secret scan all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving `providerSettingKind` and `providerSettings` into
    the provider-settings schema submodule while keeping the aggregator export intact.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the provider-settings schema split; Drizzle reported the schema configuration was
    valid.
- `pnpm migrations:check`
  - Passed after the provider-settings schema split; migration parity stayed at 52 SQL files and
    52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/provider-settings.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the provider-settings schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the provider-settings schema split, confirming API
    consumers still read provider settings through the compatibility schema aggregator.
- `pnpm verify:select -- --files apps/web/app/types.ts apps/web/app/_features/document-processing/models.ts apps/web/app/document-processing-dashboard.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the document-processing feature model extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the document-processing model extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the document-processing model extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after the document-processing model extraction; the live boundary policy, validation
    proof index, migration parity, docs links, package manifest policy, OSS reuse policy, local
    evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 20 files and 141 tests after moving document-processing model types into the feature
    barrel while keeping `types.ts` re-export compatibility.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `document-processing-dashboard.ts` imported document-processing models directly
    from the feature module.
- `pnpm build`
  - Passed after the document-processing model extraction: 6 Turbo build tasks succeeded,
    including the Next.js production build and API/worker/database/domain/provider builds.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/legal-clinics.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the legal-clinic schema extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the legal-clinic schema split and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the legal-clinic schema split proof/workboard updates.
- `pnpm policy:check`
  - Passed after the legal-clinic schema split; the live boundary policy, validation proof index,
    migration parity, docs links, package manifest policy, OSS reuse policy, local evidence Docker
    ignore check, and tracked-secret scan all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving legal clinic enums and tables into the legal-clinic
    schema submodule while keeping the aggregator export intact.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the legal-clinic schema split; Drizzle reported the schema configuration was
    valid.
- `pnpm migrations:check`
  - Passed after the legal-clinic schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/legal-clinics.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the legal-clinic schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the legal-clinic schema split, confirming API consumers
    still read legal clinic schema definitions through the compatibility schema aggregator.
- `pnpm verify:select -- --files apps/web/app/types.ts apps/web/app/_features/document-assembly/models.ts apps/web/app/document-assembly-dashboard.ts apps/web/app/dashboard/document-assembly-dashboard-block.tsx apps/web/app/page.tsx apps/web/app/dashboard-client.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the document-assembly
    feature model extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 20 files and 141 tests after moving document-assembly model types into the feature
    barrel while keeping `types.ts` re-export compatibility.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `document-assembly-dashboard.ts`, the document assembly dashboard block,
    `page.tsx`, and `dashboard-client.tsx` imported document-assembly models directly from the
    feature module.
- `pnpm build`
  - Passed after the document-assembly model extraction: 6 Turbo build tasks succeeded, including
    the Next.js production build and API/worker/database/domain/provider builds.
- `pnpm verify:select -- --files apps/web/app/types.ts apps/web/app/_features/document-assembly/models.ts apps/web/app/document-assembly-dashboard.ts apps/web/app/dashboard/document-assembly-dashboard-block.tsx apps/web/app/page.tsx apps/web/app/dashboard-client.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the document-assembly model extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the document-assembly model extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the document-assembly model extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after the document-assembly model extraction; the live boundary policy, validation proof
    index, migration parity, docs links, package manifest policy, OSS reuse policy, local evidence
    Docker ignore check, and tracked-secret scan all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 20 files and 141 tests after the document-assembly model extraction proof/workboard
    updates.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the document-assembly model extraction proof/workboard updates.
- `pnpm build`
  - Passed after the document-assembly model extraction proof/workboard updates: 6 Turbo build
    tasks succeeded, including the Next.js production build and API/worker/database/domain/provider
    builds.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/controls.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing controls route extraction and
    boundary fixture update.
- `pnpm policy:check`
  - Passed after the billing controls route extraction; the live boundary policy, validation proof
    index, migration parity, docs links, package manifest policy, OSS reuse policy, local evidence
    Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the billing controls route extraction: 9 Turbo test/build tasks succeeded,
    including API billing coverage with 499 API tests, plus 58 script contract tests including the
    updated registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting billing period-lock and rate-rule control
    routes while preserving firm-wide trust-ledger authorization, response shapes, and redacted
    audit metadata.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerBillingRoutes` delegated billing controls to the registrar-owned
    submodule while keeping time/expense/invoice/payment/trust-transfer helpers in the parent
    billing module.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/controls.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the billing controls route extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the billing controls route extraction and proof/workboard docs.
- `pnpm docs:check`
  - Passed after the billing controls route extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after the billing controls proof/workboard updates; the live boundary policy, validation
    proof index, migration parity, docs links, package manifest policy, OSS reuse policy, local
    evidence Docker ignore check, and tracked-secret scan all passed.
- `pnpm test`
  - Passed after the billing controls proof/workboard updates: 9 Turbo test/build tasks succeeded,
    including API billing coverage with 499 API tests, plus 58 script contract tests including the
    updated registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing controls proof/workboard updates.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the billing controls proof/workboard updates.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/connectors/drizzle.ts packages/database/src/repository/connectors/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and
    `pnpm --filter @open-practice/api test` for the connector repository implementation
    extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving connector Drizzle and memory implementation
    details into repository submodules while keeping `OpenPracticeRepository` as the compatibility
    facade.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the connector repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the connector repository implementation extraction; migration parity stayed at 52
    SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated connector behavior
    to `packages/database/src/repository/connectors/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the connector repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the connector repository implementation extraction,
    confirming API consumers still reach connector behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/connectors/drizzle.ts packages/database/src/repository/connectors/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and
    `pnpm --filter @open-practice/api test` for the connector repository implementation
    extraction and proof/workboard updates.
- `pnpm format:check`
  - Passed after formatting the connector repository implementation extraction and
    proof/workboard docs.
- `pnpm docs:check`
  - Passed after the connector repository implementation extraction proof/workboard updates.
- `pnpm policy:check`
  - Passed after the connector repository implementation extraction proof/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the connector repository implementation extraction
    proof/workboard updates.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the connector repository implementation extraction proof/workboard updates.
- `pnpm migrations:check`
  - Passed after the connector repository implementation extraction proof/workboard updates;
    migration parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the connector repository implementation extraction proof/workboard updates.
- `pnpm --filter @open-practice/database build`
  - Passed after the connector repository implementation extraction proof/workboard updates.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the connector repository implementation extraction
    proof/workboard updates.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/reports.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the ledger jurisdictional trust report/export
    route extraction and boundary fixture update.
- `pnpm policy:check`
  - Passed after the ledger report route extraction; the tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the ledger report route extraction: 9 Turbo test/build tasks succeeded, including
    API ledger coverage with 499 API tests, plus 58 script contract tests including the updated
    registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving jurisdictional trust report/export routes behind
    the ledger registrar-owned report submodule.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerLedgerRoutes` delegated jurisdictional trust report/export routes to the
    ledger report submodule.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/reports.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the ledger route extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the ledger report extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the ledger report extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the ledger report extraction proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the ledger report extraction proof/index/workboard updates: 9 Turbo test/build tasks
    succeeded, plus 58 script contract tests including the updated registrar-owned route collector.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the ledger report extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the ledger report extraction proof/index/workboard updates.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the final
    ledger report extraction proof/index/workboard-only update.
- `pnpm format:check`
  - Passed after the final ledger report extraction proof/index/workboard-only update.
- `pnpm docs:check`
  - Passed after the final ledger report extraction proof/index/workboard-only update.
- `pnpm policy:check`
  - Passed after the final ledger report extraction proof/index/workboard-only update; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/first-matter-workspace.tsx apps/web/app/dashboard/first-matter-workspace.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
    and `pnpm build` for the first-matter workspace component extraction and static render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 21 files and 143 tests after moving the first-matter workspace into a focused dashboard
    component.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the first-matter workspace component extraction.
- `pnpm build`
  - Passed after the first-matter workspace component extraction: 6 package builds succeeded, with
    domain/providers/database cached and web/API/worker rebuilt.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/first-matter-workspace.tsx apps/web/app/dashboard/first-matter-workspace.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the first-matter workspace extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the first-matter workspace extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the first-matter workspace extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the first-matter workspace extraction proof/index/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 21 files and 143 tests after the first-matter workspace extraction
    proof/index/workboard updates.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the first-matter workspace extraction proof/index/workboard updates.
- `pnpm build`
  - Passed after the first-matter workspace extraction proof/index/workboard updates: all 6 package
    builds were cache hits in the final docs-aware run.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/connectors.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the connector/integration schema submodule extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving connector and integration developer tables into the
    connector schema submodule.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the connector schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the connector schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/connectors.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the connector schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the connector schema split, confirming API consumers still
    resolve connector and integration tables through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/auth.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the auth/session/MFA/passkey/recovery schema submodule extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving auth/session/MFA/passkey/recovery tables into the
    auth schema submodule.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the auth schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the auth schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/auth.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the auth schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the auth schema split, confirming API consumers still
    resolve auth/session/MFA/passkey/recovery tables through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/connectors.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the connector schema extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the connector schema split proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the connector schema split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the connector schema split proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the connector schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the connector schema split proof/index/workboard updates.
- `pnpm migrations:check`
  - Passed after the connector schema split proof/index/workboard updates; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the connector schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/database build`
  - Passed after the connector schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the connector schema split proof/index/workboard updates.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/auth.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the auth schema extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the auth schema split proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the auth schema split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the auth schema split proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the auth schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the auth schema split proof/index/workboard updates.
- `pnpm migrations:check`
  - Passed after the auth schema split proof/index/workboard updates; migration parity stayed at 52
    SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the auth schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/database build`
  - Passed after the auth schema split proof/index/workboard updates.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the auth schema split proof/index/workboard updates.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/enums.ts packages/database/src/schema/jobs-email.ts packages/database/src/repository/contracts.ts packages/database/src/repository/jobs-email-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/jobs-email/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the jobs/email schema and repository implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving jobs/email repository helpers and schema tables
    into focused modules.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the jobs/email extraction; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the jobs/email extraction; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/jobs-email.js` from `schema.ts` and `EmailJobsRepository`
    from `contracts.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the jobs/email repository and schema extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the jobs/email extraction, confirming API consumers still
    resolve job lifecycle, email outbox, event, and receipt-token behavior through the compatibility
    repository and schema aggregators.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/enums.ts packages/database/src/schema/jobs-email.ts packages/database/src/repository/contracts.ts packages/database/src/repository/jobs-email-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/jobs-email/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the jobs/email extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the jobs/email extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the jobs/email extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the jobs/email extraction proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the jobs/email extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the jobs/email extraction proof/index/workboard updates.
- `pnpm migrations:check`
  - Passed after the jobs/email extraction proof/index/workboard updates; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the jobs/email extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/database build`
  - Passed after the jobs/email extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the jobs/email extraction proof/index/workboard updates.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/page.tsx apps/web/app/types.ts apps/web/app/calendar-dashboard.ts apps/web/app/_features/calendar/models.ts apps/web/app/_features/calendar/server-resources.ts apps/web/app/dashboard/calendar-section.tsx apps/web/app/dashboard/calendar-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the calendar dashboard
    model/resource/section extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 22 files and 144 tests after extracting the calendar feature models, server resource,
    and dashboard section static render guard.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after moving calendar model imports to the feature barrel and reducing
    `dashboard-client.tsx` to calendar shell state/callback wiring.
- `pnpm build`
  - Passed after the calendar dashboard extraction: all 6 package builds succeeded, including the
    Next production build and API/worker/database rebuilds.
- `pnpm policy:check`
  - Initially failed after the calendar feature extraction because new web files added root
    `@open-practice/domain` imports and exceeded the web import ratchet. The remediation added the
    `@open-practice/domain/calendar-models` package subpath, moved the new calendar web imports to
    that subpath, and reran `pnpm policy:check` successfully.
- `pnpm verify:select -- --files packages/domain/package.json packages/domain/src/calendar-models.ts packages/database/src/repository/drizzle.ts apps/web/app/dashboard-client.tsx apps/web/app/page.tsx apps/web/app/types.ts apps/web/app/calendar-dashboard.ts apps/web/app/_features/calendar/models.ts apps/web/app/_features/calendar/server-resources.ts apps/web/app/dashboard/calendar-section.tsx apps/web/app/dashboard/calendar-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`,
    `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/domain test`, `pnpm --filter @open-practice/domain typecheck`,
    `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`,
    `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/api test`,
    `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the calendar subpath export,
    calendar web extraction, database import cleanup, and proof/index/workboard updates.
- `pnpm --filter @open-practice/domain test`
  - Passed: 24 files and 173 tests after adding the calendar model subpath export.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed after adding `calendar-models.ts`.
- `pnpm --filter @open-practice/domain build`
  - Passed after adding `calendar-models.ts` and the package subpath export.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the Drizzle import cleanup.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the Drizzle import cleanup; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the Drizzle import cleanup; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the Drizzle import cleanup.
- `pnpm --filter @open-practice/database build`
  - Passed after the Drizzle import cleanup.
- `pnpm --filter @open-practice/providers test`
  - Passed: 7 files and 18 tests after the calendar model subpath export.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the calendar model subpath export and Drizzle import
    cleanup.
- `pnpm --filter @open-practice/worker test`
  - Passed: 3 files and 36 tests after the calendar model subpath export and Drizzle import
    cleanup.
- `pnpm --filter @open-practice/web test`
  - Passed: 22 files and 144 tests after the calendar model subpath export and calendar section
    test lint cleanup.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after moving the calendar web imports to `@open-practice/domain/calendar-models`.
- `pnpm deps:audit`
  - Passed: production and development dependency audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed: dependency license report covered 550 packages and 579 versions, with the existing
    review-required license groups unchanged.
- `pnpm build`
  - Passed after the calendar model subpath export and Drizzle import cleanup: all 6 package builds
    succeeded, including the Next production build.
- `pnpm ci:local`
  - Passed after the calendar model subpath export, calendar dashboard extraction, Drizzle import
    cleanup, and calendar section test lint cleanup. The gate covered format, lint, workspace
    typecheck, all package tests plus 58 script tests, database `db:check`, policy checks, all
    package builds, and a clean trailing `git diff --check`.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/calendar.ts packages/database/src/schema/tasks.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the calendar/tasks schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving task deadline and calendar schema declarations
    into leaf schema modules while preserving root aggregator exports.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the calendar/tasks schema extraction; Drizzle reported the schema configuration
    was valid.
- `pnpm migrations:check`
  - Passed after the calendar/tasks schema extraction; migration parity stayed at 52 SQL files and
    52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/tasks.js` and `./schema/calendar.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the calendar/tasks schema extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the calendar/tasks schema extraction, confirming API and
    repository consumers still resolve task and calendar schema definitions through the
    compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/calendar.ts packages/database/src/schema/tasks.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the calendar/tasks schema extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the calendar/tasks schema extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates; the tracked
    secret scan, package manifest dependency policy, migration parity, OSS reuse policy, docs
    links, proof index, local evidence Docker ignore validation, and Open Practice boundary policy
    all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the calendar/tasks schema extraction proof/index/workboard
    updates.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates.
- `pnpm migrations:check`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/database build`
  - Passed after the calendar/tasks schema extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the calendar/tasks schema extraction proof/index/workboard
    updates.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/types.ts apps/web/app/external-uploads-dashboard.ts apps/web/app/page.tsx apps/web/app/matter-command-center.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/external-uploads-section.tsx apps/web/app/dashboard/external-uploads-section.test.tsx apps/web/app/_features/external-uploads/models.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the external-upload model
    barrel extraction, dashboard section extraction, and static render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 23 files and 145 tests after moving external-upload model types into the feature
    barrel and extracting the external-upload dashboard section.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `external-uploads-dashboard.ts`, `matter-command-center.ts`, `page.tsx`,
    `dashboard-client.tsx`, and dashboard tests imported external-upload models directly from the
    feature module.
- `pnpm build`
  - Passed after the external-upload extraction: all 6 package builds succeeded, including the
    Next production build.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/types.ts apps/web/app/external-uploads-dashboard.ts apps/web/app/page.tsx apps/web/app/matter-command-center.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/external-uploads-section.tsx apps/web/app/dashboard/external-uploads-section.test.tsx apps/web/app/_features/external-uploads/models.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the external-upload extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the external-upload extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the external-upload extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the external-upload extraction proof/index/workboard updates; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 23 files and 145 tests after the external-upload extraction proof/index/workboard
    updates.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the external-upload extraction proof/index/workboard updates.
- `pnpm build`
  - Passed after the external-upload extraction proof/index/workboard updates: all 6 package builds
    succeeded, including the Next production build.
- `pnpm verify:select -- --files apps/web/app/_features/share-links/models.ts apps/web/app/dashboard/share-links-section.tsx apps/web/app/dashboard/share-links-section.test.tsx apps/web/app/types.ts apps/web/app/share-links-dashboard.ts apps/web/app/matter-command-center.ts apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the share-link model barrel
    extraction, dashboard section extraction, and static render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving share-link model types into the feature barrel and
    extracting the share-link dashboard section.
- `pnpm --filter @open-practice/web typecheck`
  - Initially failed because the new static render test's synthetic contact party omitted required
    `MatterParty` and `Contact` fields; passed after the fixture included required synthetic
    `id`, `firmId`, `matterId`, `confidential`, `kind`, and `aliases` fields.
- `pnpm build`
  - Passed after the share-link extraction: all 6 package builds succeeded, including the Next
    production build.
- `pnpm verify:select -- --files apps/web/app/_features/share-links/models.ts apps/web/app/dashboard/share-links-section.tsx apps/web/app/dashboard/share-links-section.test.tsx apps/web/app/types.ts apps/web/app/share-links-dashboard.ts apps/web/app/matter-command-center.ts apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the share-link extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the share-link extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the share-link extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the share-link extraction proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after the share-link extraction proof/index/workboard updates.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the share-link extraction proof/index/workboard updates.
- `pnpm build`
  - Passed after the share-link extraction proof/index/workboard updates: all 6 package builds
    succeeded, including the Next production build.
- `pnpm verify:select -- --files apps/web/app/_features/contacts/models.ts apps/web/app/types.ts apps/web/app/contact-dossiers-dashboard.ts apps/web/app/dashboard/contacts-section.tsx apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts packages/domain/package.json packages/domain/src/contact-models.ts`
  - Selected `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`,
    `pnpm --filter @open-practice/domain test`,
    `pnpm --filter @open-practice/domain typecheck`,
    `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/api test`,
    `pnpm --filter @open-practice/worker test`, `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the contact model barrel
    and web-safe domain contact subpath.
- `pnpm --filter @open-practice/domain test`
  - Passed: 24 files and 173 tests after adding the contact model subpath.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed after adding the contact model subpath.
- `pnpm --filter @open-practice/domain build`
  - Passed after adding the contact model subpath.
- `pnpm --filter @open-practice/providers test`
  - Passed: 7 files and 18 tests after adding the contact model subpath; Node reported the existing
    localStorage experimental warnings.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the contacts model barrel/subpath extraction.
- `pnpm --filter @open-practice/worker test`
  - Passed: 3 files and 36 tests after the contacts model barrel/subpath extraction; Node reported
    the existing localStorage experimental warnings.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving contacts dashboard model/helper types into the
    contacts feature barrel.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after moving contacts dashboard model/helper types into the contacts feature barrel.
- `pnpm build`
  - Passed after the contacts model barrel/subpath extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm deps:audit`
  - Passed: production and development audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed: 550 packages and 579 versions checked; the existing review-required license groups were
    unchanged.
- `pnpm ci:local`
  - Passed after the contacts model barrel/subpath extraction: format, lint, typecheck, root tests
    plus script contract tests, database check, policy, build, and `git diff --check` all passed.
- `pnpm verify:select -- --files apps/web/app/_features/contacts/models.ts apps/web/app/types.ts apps/web/app/contact-dossiers-dashboard.ts apps/web/app/dashboard/contacts-section.tsx apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts packages/domain/package.json packages/domain/src/contact-models.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`, `pnpm format:check`,
    `pnpm docs:check`, `pnpm policy:check`, domain test/typecheck/build, providers/API/worker/web
    tests, web typecheck, and `pnpm build` for the contacts extraction plus proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after the contacts extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the contacts extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the contacts extraction proof/index/workboard updates; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm deps:audit`
  - Passed after the contacts extraction proof/index/workboard updates: production and development
    audits reported no known vulnerabilities.
- `pnpm deps:licenses`
  - Passed after the contacts extraction proof/index/workboard updates: 550 packages and 579
    versions checked; the existing review-required license groups were unchanged.
- `pnpm ci:local`
  - Passed after the contacts extraction proof/index/workboard updates: format, lint, typecheck,
    root tests plus 58 script contract tests, database check, policy, build, and `git diff --check`
    all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/inbound-email-contracts.ts packages/database/src/repository/inbound-email/drizzle.ts packages/database/src/repository/inbound-email/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/schema.test.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the inbound-email repository capability and implementation helper extraction.
- `pnpm --filter @open-practice/database test`
  - Initially failed because the advisory-lock source ratchet still expected inbound promotion to
    live inline in `drizzle.ts`; passed after the ratchet followed
    `packages/database/src/repository/inbound-email/drizzle.ts`: 18 files and 107 tests.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the inbound-email repository capability extraction.
- `pnpm --filter @open-practice/database build`
  - Passed after the inbound-email repository capability extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the inbound-email repository capability extraction.
- `pnpm migrations:check`
  - Passed after the inbound-email repository capability extraction: 52 SQL files match 52 journal
    entries.
- `pnpm --filter @open-practice/api test`
  - Passed after the inbound-email repository capability extraction: 41 files and 499 tests.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/inbound-email-contracts.ts packages/database/src/repository/inbound-email/drizzle.ts packages/database/src/repository/inbound-email/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/schema.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, the same database
    test/db-check/migration/typecheck/build commands, and API tests for the inbound-email
    extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the inbound-email extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the inbound-email extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the inbound-email extraction proof/index/workboard updates; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/web/app/_features/email-delivery/models.ts apps/web/app/types.ts apps/web/app/email-delivery-dashboard.ts apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard/matter-overview-section.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the email-delivery model
    barrel extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving email-delivery dashboard model types into the
    feature barrel and importing them directly from page/dashboard consumers.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the email-delivery model barrel extraction.
- `pnpm build`
  - Passed after the email-delivery model barrel extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm verify:select -- --files apps/web/app/_features/email-delivery/server-resources.ts apps/web/app/email-delivery-dashboard.ts apps/web/app/page.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the email-delivery server
    resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving email-delivery dashboard loading into the
    server-only feature resource.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the email-delivery server resource extraction.
- `pnpm build`
  - Passed after the email-delivery server resource extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/legal-clinics-contracts.ts packages/database/src/repository/legal-clinics/drizzle.ts packages/database/src/repository/legal-clinics/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the legal-clinic repository capability and implementation helper extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after extracting the legal-clinic repository capability and
    helper modules.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the legal-clinic repository capability extraction.
- `pnpm --filter @open-practice/database build`
  - Passed after the legal-clinic repository capability extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the legal-clinic repository capability extraction.
- `pnpm migrations:check`
  - Passed after the legal-clinic repository capability extraction: 52 SQL files match 52 journal
    entries.
- `pnpm --filter @open-practice/api test`
  - Passed after the legal-clinic repository capability extraction: 41 files and 499 tests; Node
    reported the existing localStorage experimental warnings.
- `pnpm verify:select -- --files apps/web/app/_features/email-delivery/models.ts apps/web/app/types.ts apps/web/app/email-delivery-dashboard.ts apps/web/app/page.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard/matter-overview-section.tsx packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/legal-clinics-contracts.ts packages/database/src/repository/legal-clinics/drizzle.ts packages/database/src/repository/legal-clinics/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, the same database
    test/db-check/migration/typecheck/build commands, API tests, web tests/typecheck, and
    `pnpm build` for the email-delivery and legal-clinic extractions plus proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after the email-delivery and legal-clinic extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the email-delivery and legal-clinic extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the email-delivery and legal-clinic extraction proof/index/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the final
    docs-only proof path-list correction.
- `pnpm format:check && pnpm docs:check && node scripts/validate-validation-proof-index.mjs && git diff --check`
  - Passed after adding `apps/web/app/dashboard/matter-overview-section.tsx` to the proof path
    list.
- Proof-vs-diff equality check
  - Passed after the final proof correction: 146 changed paths, 146 proof paths, no missing or
    extra paths.
- `pnpm policy:check`
  - Passed after the final proof path-list correction.
- `pnpm verify:select -- --files apps/api/src/routes/shares.ts apps/api/src/routes/shares/shared.ts apps/api/src/routes/shares/staff.ts apps/api/src/routes/shares/public.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the secure share-link staff/public route
    submodule split and boundary registry update.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/shares/staff.ts` and
    `apps/api/src/routes/shares/public.ts` as share-owned route subfiles; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerShareRoutes` delegated the staff and public share submodules while keeping
    the registrar entrypoint stable.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting secure share-link staff and public route
    handlers while preserving create-token response shape, token-hash redaction, email-verification
    behavior, public header/path token compatibility, and public access-log semantics.
- `pnpm test`
  - Passed after the secure share-link route extraction: 9 Turbo test/build tasks succeeded,
    including API share/e2e-support coverage with 499 API tests, plus 58 script contract tests
    including the updated registrar-owned route collector contract.
- `pnpm verify:select -- --files apps/web/app/_features/email-delivery/server-resources.ts apps/web/app/email-delivery-dashboard.ts apps/web/app/page.tsx apps/api/src/routes/shares.ts apps/api/src/routes/shares/shared.ts apps/api/src/routes/shares/staff.ts apps/api/src/routes/shares/public.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the email-delivery server-resource extraction, secure share route split,
    boundary registry update, and proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware OP-MOD proof/index/workboard update.
- `pnpm docs:check`
  - Passed after the docs-aware OP-MOD proof/index/workboard update.
- `pnpm policy:check`
  - Passed after the docs-aware OP-MOD proof/index/workboard update; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware secure share route split proof update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware secure share route split proof update.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after the docs-aware email-delivery server-resource proof
    update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware email-delivery server-resource proof update.
- `pnpm build`
  - Passed after the docs-aware OP-MOD proof/index/workboard update: all 6 package builds
    succeeded, including the cached Next production build and rebuilt API package.
- `pnpm test`
  - Passed after the docs-aware OP-MOD proof/index/workboard update: 9 Turbo test/build tasks
    succeeded, including API 41 files/499 tests and web 24 files/147 tests, plus 58 script contract
    tests including the updated registrar-owned route collector contract.
- Proof-vs-diff equality check
  - Passed after adding the secure share route submodules to the proof path list: 151 changed paths,
    151 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files apps/web/app/_features/contacts/server-resources.ts apps/web/app/page.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the contacts server-resource
    extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving contact review/data-quality dashboard loading into
    the server-only contacts feature resource.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `page.tsx` delegated contact review/data-quality loading to the contacts feature
    server resource.
- `pnpm build`
  - Passed after the contacts server-resource extraction: all 6 package builds succeeded, including
    the Next production build.
- `pnpm verify:select -- --files apps/web/app/_features/share-links/server-resources.ts apps/web/app/page.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the share-link status
    server-resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving share-link status loading into the server-only
    share-link feature resource.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `page.tsx` delegated share-link status loading to the share-link feature server
    resource.
- `pnpm build`
  - Passed after the share-link status server-resource extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm verify:select -- --files apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads/shared.ts apps/api/src/routes/conversation-threads/export-requests.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the conversation-thread export request route
    submodule split and boundary registry update.
- `pnpm --filter @open-practice/api exec vitest run src/routes/conversation-threads.test.ts`
  - Passed: 1 file and 15 tests after moving conversation-thread export request/poll/download
    routes behind the registrar-owned export submodule.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerConversationThreadRoutes` delegated the export request submodule while
    keeping the registrar entrypoint stable.
- `pnpm policy:check`
  - Passed after registering `apps/api/src/routes/conversation-threads/export-requests.ts` as a
    conversation-thread-owned route subfile; the tracked-secret scan, package manifest dependency
    policy, migration parity, OSS reuse policy, docs links, proof index, local evidence Docker
    ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting conversation-thread export request routes while
    preserving export queue metadata redaction, poll/download status codes, and redacted artifact
    generation.
- `pnpm test`
  - Passed after the conversation-thread export extraction: 9 Turbo test/build tasks succeeded,
    including API conversation-thread coverage with 499 API tests, plus 58 script contract tests
    including the updated registrar-owned route collector contract.
- `pnpm verify:select -- --files apps/web/app/_features/contacts/server-resources.ts apps/web/app/_features/share-links/server-resources.ts apps/web/app/page.tsx apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads/shared.ts apps/api/src/routes/conversation-threads/export-requests.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the contacts and share-link server-resource extractions,
    conversation-thread export route split, boundary registry update, and proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after the final docs-aware OP-MOD proof/index/workboard update.
- `pnpm docs:check`
  - Passed after the final docs-aware OP-MOD proof/index/workboard update.
- `pnpm policy:check`
  - Passed after the final docs-aware OP-MOD proof/index/workboard update; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the final docs-aware conversation-thread export route split proof update.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after the final docs-aware contacts and share-link
    server-resource proof update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the final docs-aware contacts and share-link server-resource proof update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the final docs-aware conversation-thread export route split
    proof update.
- `pnpm build`
  - Passed after the final docs-aware OP-MOD proof/index/workboard update: all 6 package builds
    succeeded, including the cached Next production build and API package.
- `pnpm test`
  - Passed after the final docs-aware OP-MOD proof/index/workboard update: 9 Turbo test/build tasks
    succeeded, including API 41 files/499 tests and web 24 files/147 tests, plus 58 script contract
    tests including the updated registrar-owned route collector contract.
- Proof-vs-diff equality check
  - Passed after the contacts server-resource, share-link server-resource, and conversation export
    split proof updates: 156 changed paths, 156 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the final
    proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the final proof ledger closeout update.
- `pnpm docs:check`
  - Passed after the final proof ledger closeout update.
- `pnpm policy:check`
  - Passed after the final proof ledger closeout update; the tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/operational-views-contracts.ts packages/database/src/repository/operational-views/drizzle.ts packages/database/src/repository/operational-views/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    for the saved operational-view repository capability and implementation helper extraction.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after extracting the saved operational-view repository capability and implementation
    helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after extracting the saved operational-view repository capability
    and implementation helpers while preserving owner/firm scoping and archive filtering.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the saved operational-view repository extraction; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed after the saved operational-view repository extraction: 52 SQL files match 52 journal
    entries.
- `pnpm --filter @open-practice/database build`
  - Passed after the saved operational-view repository extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting the saved operational-view repository
    capability; API consumers still see the aggregate repository compatibility surface.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/operational-views-contracts.ts packages/database/src/repository/operational-views/drizzle.ts packages/database/src/repository/operational-views/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    for the saved operational-view repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the saved operational-view repository extraction and
    proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the saved operational-view repository proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the saved operational-view repository proof/index/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the docs-aware saved operational-view repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware saved operational-view repository extraction update; Drizzle
    reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the docs-aware saved operational-view repository extraction update: 52 SQL files
    match 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware saved operational-view repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware saved operational-view repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware saved operational-view repository
    extraction update.
- Proof-vs-diff equality check
  - Passed after adding the saved operational-view repository capability and helper files to the
    proof path list: 159 changed paths, 159 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/external-uploads/server-resources.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the external-upload
    server-resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving external-upload status/list loading into the
    server-only external-upload feature resource.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `page.tsx` delegated external-upload loading to the external-upload feature server
    resource.
- `pnpm build`
  - Passed after the external-upload server-resource extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/external-uploads/server-resources.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the external-upload server-resource extraction plus proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after formatting the external-upload server-resource extraction and
    proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the external-upload server-resource proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the external-upload server-resource proof/index/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after the docs-aware external-upload server-resource extraction
    update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware external-upload server-resource extraction update.
- `pnpm build`
  - Passed after the docs-aware external-upload server-resource extraction update: all 6 package
    builds succeeded, including the Next production build.
- Proof-vs-diff equality check
  - Passed after adding the external-upload server resource to the proof path list: 160 changed
    paths, 160 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/document-assembly/server-resources.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the document-assembly
    server-resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after moving document-assembly workbench loading into the
    server-only document-assembly feature resource.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `page.tsx` delegated document-assembly loading to the document-assembly feature
    server resource.
- `pnpm build`
  - Passed after the document-assembly server-resource extraction: all 6 package builds succeeded,
    including the Next production build.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/document-assembly/server-resources.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the document-assembly server-resource extraction plus proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after formatting the document-assembly server-resource extraction and
    proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the document-assembly server-resource proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the document-assembly server-resource proof/index/workboard updates; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 24 files and 147 tests after the docs-aware document-assembly server-resource
    extraction update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware document-assembly server-resource extraction update.
- `pnpm build`
  - Passed after the docs-aware document-assembly server-resource extraction update: all 6 package
    builds succeeded, including the Next production build.
- Proof-vs-diff equality check
  - Passed after adding the document-assembly server resource to the proof path list: 161 changed
    paths, 161 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/receipts.ts apps/api/src/routes/email/shared.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the public email receipt route submodule
    extraction.
- `pnpm --filter @open-practice/api exec vitest run src/routes/email.test.ts`
  - Passed: 1 file and 20 tests after moving public email receipt confirmation/recording handlers
    behind the email receipt submodule.
- `pnpm policy:check`
  - Passed after extracting public email receipt routes and adding the email-owned subfiles to the
    boundary registry; tracked-secret scan, package manifest dependency policy, migration parity,
    OSS reuse policy, docs links, proof index, local evidence Docker ignore validation, and Open
    Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the public email receipt route submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the public email receipt route submodule extraction.
- `pnpm test`
  - Passed after the public email receipt route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/receipts.ts apps/api/src/routes/email/shared.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the public email receipt route submodule extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the public email receipt route split and proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the public email receipt route split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the public email receipt route split proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware public email receipt route split update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware public email receipt route split update.
- `pnpm test`
  - Passed after the docs-aware public email receipt route split update: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- Proof-vs-diff equality check
  - Passed after adding the public email receipt route split to the proof path list: 164 changed
    paths, 164 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    public email receipt route split closeout update.
- `pnpm format:check`
  - Passed after the docs-only public email receipt route split closeout update.
- `pnpm docs:check`
  - Passed after the docs-only public email receipt route split closeout update.
- `pnpm policy:check`
  - Passed after the docs-only public email receipt route split closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only public email receipt route split closeout update: 164 changed paths,
    164 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files apps/api/src/routes/external-uploads.ts apps/api/src/routes/external-uploads/public.ts apps/api/src/routes/external-uploads/shared.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the public external-upload route submodule
    extraction.
- `pnpm --filter @open-practice/api exec vitest run src/routes/external-uploads.test.ts`
  - Passed: 1 file and 22 tests after moving public external-upload portal view/intent/completion
    handlers behind the external-upload public submodule.
- `pnpm policy:check`
  - Passed after extracting public external-upload routes and adding the external-upload-owned
    subfiles to the boundary registry; tracked-secret scan, package manifest dependency policy,
    migration parity, OSS reuse policy, docs links, proof index, local evidence Docker ignore
    validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the public external-upload route submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the public external-upload route submodule extraction.
- `pnpm test`
  - Passed after the public external-upload route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/external-uploads.ts apps/api/src/routes/external-uploads/public.ts apps/api/src/routes/external-uploads/shared.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the public external-upload route submodule
    extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the public external-upload route split and proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the public external-upload route split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the public external-upload route split proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware public external-upload route split update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware public external-upload route split update.
- `pnpm test`
  - Passed after the docs-aware public external-upload route split update: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- Proof-vs-diff equality check
  - Passed after adding the public external-upload route split to the proof path list: 167 changed
    paths, 167 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    public external-upload route split closeout update.
- `pnpm format:check`
  - Passed after the docs-only public external-upload route split closeout update.
- `pnpm docs:check`
  - Passed after the docs-only public external-upload route split closeout update.
- `pnpm policy:check`
  - Passed after the docs-only public external-upload route split closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only public external-upload route split closeout update: 167 changed
    paths, 167 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the public external-upload route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/dashboard.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing dashboard route submodule
    extraction.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`
  - Passed: 1 file and 28 tests after moving the billing dashboard projection behind the billing
    dashboard submodule.
- `pnpm policy:check`
  - Passed after extracting the billing dashboard route and adding the billing-owned dashboard
    subfile to the boundary registry; tracked-secret scan, package manifest dependency policy,
    migration parity, OSS reuse policy, docs links, proof index, local evidence Docker ignore
    validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the billing dashboard route submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing dashboard route submodule extraction.
- `pnpm test`
  - Passed after the billing dashboard route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/dashboard.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing dashboard route submodule
    extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the billing dashboard route split and proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the billing dashboard route split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the billing dashboard route split proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware billing dashboard route split update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing dashboard route split update.
- `pnpm test`
  - Passed after the docs-aware billing dashboard route split update: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- Proof-vs-diff equality check
  - Passed after adding the billing dashboard route split to the proof path list: 168 changed paths,
    168 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    billing dashboard route split closeout update.
- `pnpm format:check`
  - Passed after the docs-only billing dashboard route split closeout update.
- `pnpm docs:check`
  - Passed after the docs-only billing dashboard route split closeout update.
- `pnpm policy:check`
  - Passed after the docs-only billing dashboard route split closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only billing dashboard route split closeout update: 168 changed paths, 168
    proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the billing dashboard route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/payments.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the manual payment route submodule
    extraction.
- `pnpm exec prettier --write apps/api/src/routes/billing.ts apps/api/src/routes/billing/payments.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed after formatting the manual payment route split.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`
  - Passed: 1 file and 28 tests after moving manual payment list/create handlers behind the
    billing payment submodule.
- `node --test scripts/validate-open-practice-boundaries.test.mjs`
  - Passed: 11 boundary contract tests after adding the billing-owned payment route subfile to the
    synthetic registrar fixture and expected route declarations.
- `pnpm policy:check`
  - Passed after extracting the manual payment route and adding the billing-owned payment subfile
    to the boundary registry; tracked-secret scan, package manifest dependency policy, migration
    parity, OSS reuse policy, docs links, proof index, local evidence Docker ignore validation, and
    Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the manual payment route submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the manual payment route submodule extraction.
- `pnpm test`
  - Passed after the manual payment route submodule extraction: 9 Turbo test/build tasks succeeded,
    including API 41 files and 499 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/payments.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the manual payment route submodule extraction
    plus proof/index/workboard updates.
- `pnpm exec prettier --write apps/api/src/routes/billing.ts apps/api/src/routes/billing/payments.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the manual payment route split and proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware manual payment route split update.
- `pnpm docs:check`
  - Passed after the manual payment route split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the manual payment route split proof/index/workboard updates; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware manual payment route split update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware manual payment route split update.
- `pnpm test`
  - Passed after the docs-aware manual payment route split update: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- Proof-vs-diff equality check
  - Passed after adding the manual payment route split to the proof path list: 169 changed paths,
    169 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    manual payment route split closeout update.
- `pnpm format:check`
  - Passed after the docs-only manual payment route split closeout update.
- `pnpm docs:check`
  - Passed after the docs-only manual payment route split closeout update.
- `pnpm policy:check`
  - Passed after the docs-only manual payment route split closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only manual payment route split closeout update: 169 changed paths, 169
    proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the manual payment route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the trust-controls
    dashboard section extraction.
- `pnpm exec prettier --write apps/web/app/dashboard-client.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx`
  - Passed after formatting the trust-controls dashboard section extraction.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/trust-controls-section.test.tsx`
  - Passed: 1 file and 2 tests after moving the trust-controls workbench JSX into a focused
    dashboard component with populated and empty static render coverage.
- `pnpm --filter @open-practice/web test`
  - Passed: 25 files and 149 tests after the trust-controls dashboard section extraction.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the trust-controls dashboard section extraction.
- `pnpm build`
  - Passed after the trust-controls dashboard section extraction: 6 Turbo build tasks succeeded,
    including a Next production build for `@open-practice/web`.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the trust-controls dashboard section extraction plus proof/index/workboard
    updates.
- `pnpm exec prettier --write apps/web/app/dashboard-client.tsx apps/web/app/dashboard/trust-controls-section.tsx apps/web/app/dashboard/trust-controls-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the trust-controls dashboard section extraction and
    proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware trust-controls dashboard section update.
- `pnpm docs:check`
  - Passed after the trust-controls dashboard section proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the trust-controls dashboard section proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 25 files and 149 tests after the docs-aware trust-controls dashboard section update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware trust-controls dashboard section update.
- `pnpm build`
  - Passed after the docs-aware trust-controls dashboard section update: 6 Turbo build tasks
    succeeded, including a Next production build for `@open-practice/web`.
- Proof-vs-diff equality check
  - Passed after adding the trust-controls dashboard section split to the proof path list: 171
    changed paths, 171 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    trust-controls dashboard section closeout update.
- `pnpm format:check`
  - Passed after the docs-only trust-controls dashboard section closeout update.
- `pnpm docs:check`
  - Passed after the docs-only trust-controls dashboard section closeout update.
- `pnpm policy:check`
  - Passed after the docs-only trust-controls dashboard section closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only trust-controls dashboard section closeout update: 171 changed paths,
    171 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the trust-controls dashboard section closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/portal-access-contracts.ts packages/database/src/repository/portal-access/drizzle.ts packages/database/src/repository/portal-access/memory.ts packages/database/test/repository.portal-links.test.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    for the portal-access repository capability/helper extraction.
- `pnpm exec prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/portal-access-contracts.ts packages/database/src/repository/portal-access/drizzle.ts packages/database/src/repository/portal-access/memory.ts`
  - Passed after formatting the portal-access repository extraction.
- `pnpm --filter @open-practice/database exec vitest run test/repository.portal-links.test.ts`
  - Passed: 1 file and 2 tests after moving portal grant, share-link, external-upload link, and
    access-log implementation details behind focused repository helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the portal-access repository extraction.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the portal-access repository extraction.
- `pnpm --filter @open-practice/database build`
  - Passed after the portal-access repository extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the portal-access repository extraction; `drizzle-kit check` reported the schema
    state is consistent.
- `pnpm migrations:check`
  - Passed after the portal-access repository extraction; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the portal-access repository extraction.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/portal-access-contracts.ts packages/database/src/repository/portal-access/drizzle.ts packages/database/src/repository/portal-access/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    for the portal-access repository extraction plus proof/index/workboard updates.
- `pnpm exec prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/portal-access-contracts.ts packages/database/src/repository/portal-access/drizzle.ts packages/database/src/repository/portal-access/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the portal-access repository extraction and proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after the docs-aware portal-access repository update.
- `pnpm docs:check`
  - Passed after the portal-access repository proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the portal-access repository proof/index/workboard updates; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the docs-aware portal-access repository update.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware portal-access repository update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware portal-access repository update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware portal-access repository update; `drizzle-kit check` reported the
    schema state is consistent.
- `pnpm migrations:check`
  - Passed after the docs-aware portal-access repository update; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware portal-access repository update.
- Proof-vs-diff equality check
  - Passed after adding the portal-access repository capability and helper files to the proof path
    list: 174 changed paths, 174 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    portal-access repository closeout update.
- `pnpm format:check`
  - Passed after the docs-only portal-access repository closeout update.
- `pnpm docs:check`
  - Passed after the docs-only portal-access repository closeout update.
- `pnpm policy:check`
  - Passed after the docs-only portal-access repository closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only portal-access repository closeout update: 174 changed paths, 174
    proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the portal-access repository closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/shared.ts apps/api/src/routes/billing/time-entries.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing time-entry route extraction and
    boundary fixture update.
- `pnpm exec prettier --write apps/api/src/routes/billing.ts apps/api/src/routes/billing/shared.ts apps/api/src/routes/billing/time-entries.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed after formatting the billing time-entry route extraction.
- `pnpm --filter @open-practice/api exec vitest run src/routes/billing.test.ts`
  - Passed: 1 file and 28 tests after moving time-entry routes behind the billing-owned
    time-entry submodule.
- `node --test scripts/validate-open-practice-boundaries.test.mjs`
  - Passed: 11 boundary contract tests after adding the billing-owned time-entry route subfile to
    the synthetic registrar fixture and expected route declarations.
- `pnpm policy:check`
  - Passed after extracting the billing time-entry route and adding the billing-owned time-entry
    subfile to the boundary registry; tracked-secret scan, package manifest dependency policy,
    migration parity, OSS reuse policy, docs links, proof index, local evidence Docker ignore
    validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the billing time-entry route submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing time-entry route submodule extraction.
- `pnpm test`
  - Passed after the billing time-entry route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/shared.ts apps/api/src/routes/billing/time-entries.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing time-entry route extraction plus
    proof/index/workboard updates.
- `pnpm exec prettier --write apps/api/src/routes/billing.ts apps/api/src/routes/billing/shared.ts apps/api/src/routes/billing/time-entries.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the billing time-entry route split and proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware billing time-entry route split update.
- `pnpm docs:check`
  - Passed after the billing time-entry route split proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the billing time-entry route split proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware billing time-entry route split update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing time-entry route split update.
- `pnpm test`
  - Passed after the docs-aware billing time-entry route split update: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests, plus 58 script contract tests.
- Proof-vs-diff equality check
  - Passed after adding the billing time-entry route split to the proof path list: 176 changed
    paths, 176 proof paths, no missing or extra paths.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    billing time-entry route split closeout update.
- `pnpm format:check`
  - Passed after the docs-only billing time-entry route split closeout update.
- `pnpm docs:check`
  - Passed after the docs-only billing time-entry route split closeout update.
- `pnpm policy:check`
  - Passed after the docs-only billing time-entry route split closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the docs-only billing time-entry route split closeout update: 176 changed paths,
    176 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the billing time-entry route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/dashboard/billing-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the billing dashboard
    section extraction.
- `pnpm exec prettier --write apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/dashboard/billing-section.test.tsx`
  - Passed after extracting the billing dashboard section.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/billing-section.test.tsx`
  - Passed: 1 file and 1 test after adding the billing section static render guard.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after adding the missing synthetic `effectiveFrom` fixture value to the billing section
    render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 26 files and 150 tests after the billing dashboard section extraction.
- `pnpm build`
  - Passed after the billing dashboard section extraction: 6 Turbo build tasks succeeded,
    including the Next production build.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/billing-section.tsx apps/web/app/dashboard/billing-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the billing dashboard section extraction plus proof/index/workboard updates.
- `pnpm exec prettier --write docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the billing dashboard section proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware billing dashboard section update.
- `pnpm docs:check`
  - Passed after the billing dashboard section proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the billing dashboard section proof/index/workboard updates; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 26 files and 150 tests after the docs-aware billing dashboard section update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware billing dashboard section update.
- `pnpm build`
  - Passed after the docs-aware billing dashboard section update: 6 Turbo build tasks succeeded,
    including the Next production build.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    billing dashboard section closeout update.
- `pnpm format:check`
  - Passed after the docs-only billing dashboard section closeout update.
- `pnpm docs:check`
  - Passed after the docs-only billing dashboard section closeout update.
- `pnpm policy:check`
  - Passed after the docs-only billing dashboard section closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the billing dashboard section extraction to the proof path list: 178 changed
    paths, 178 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the billing dashboard section closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/documents-section.tsx apps/web/app/dashboard/documents-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the document-processing
    documents section extraction.
- `pnpm exec prettier --write apps/web/app/dashboard-client.tsx apps/web/app/dashboard/documents-section.tsx apps/web/app/dashboard/documents-section.test.tsx`
  - Passed after extracting the document-processing documents section.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx`
  - Passed: 1 file and 1 test after adding the document-processing documents section static render
    guard.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the document-processing documents section extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 27 files and 151 tests after the document-processing documents section extraction.
- `pnpm build`
  - Passed after the document-processing documents section extraction: 6 Turbo build tasks
    succeeded, including the Next production build.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/documents-section.tsx apps/web/app/dashboard/documents-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the document-processing documents section extraction plus
    proof/index/workboard updates.
- `pnpm exec prettier --write docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Passed after formatting the document-processing documents section proof/index/workboard
    updates.
- `pnpm format:check`
  - Passed after the docs-aware document-processing documents section update.
- `pnpm docs:check`
  - Passed after the document-processing documents section proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the document-processing documents section proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 27 files and 151 tests after the docs-aware document-processing documents section
    update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware document-processing documents section update.
- `pnpm build`
  - Passed after the docs-aware document-processing documents section update: 6 Turbo build tasks
    succeeded, including the Next production build.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    document-processing documents section closeout update.
- `pnpm format:check`
  - Passed after the docs-only document-processing documents section closeout update.
- `pnpm docs:check`
  - Passed after the docs-only document-processing documents section closeout update.
- `pnpm policy:check`
  - Passed after the docs-only document-processing documents section closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the document-processing documents section extraction to the proof path list:
    180 changed paths, 180 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the document-processing documents section closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/status.ts apps/api/src/routes/document-processing/workbench.ts apps/api/src/routes/document-processing/queue.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the document-processing API route submodule
    extraction.
- `pnpm exec prettier --write apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/status.ts apps/api/src/routes/document-processing/workbench.ts apps/api/src/routes/document-processing/queue.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Passed after extracting the document-processing API route submodules.
- `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts`
  - Passed: 1 file and 17 tests after the document-processing API route submodule extraction.
- `node --test scripts/validate-open-practice-boundaries.test.mjs`
  - Passed: 11 boundary contract tests after adding document-processing-owned route subfiles to
    the boundary registry and route-declaration fixture.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the document-processing API route submodule extraction.
- `pnpm policy:check`
  - Passed after the document-processing API route submodule extraction; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the document-processing API route submodule extraction.
- `pnpm test`
  - Passed after the document-processing API route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API 41 files and 499 tests and web 27 files and 151 tests, plus 58 script
    contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/status.ts apps/api/src/routes/document-processing/workbench.ts apps/api/src/routes/document-processing/queue.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the document-processing API route submodule
    extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after the docs-aware document-processing API route submodule update.
- `pnpm docs:check`
  - Passed after the document-processing API route submodule proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the document-processing API route submodule proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware document-processing API route submodule update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware document-processing API route submodule
    update.
- `pnpm test`
  - Passed after the docs-aware document-processing API route submodule update: 9 Turbo test/build
    tasks succeeded, including API 41 files and 499 tests and web 27 files and 151 tests, plus 58
    script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the docs-only
    document-processing API route submodule closeout update.
- `pnpm format:check`
  - Passed after the docs-only document-processing API route submodule closeout update.
- `pnpm docs:check`
  - Passed after the docs-only document-processing API route submodule closeout update.
- `pnpm policy:check`
  - Passed after the docs-only document-processing API route submodule closeout update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the document-processing API route submodule extraction to the proof path
    list: 185 changed paths, 185 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the document-processing API route submodule closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/documents-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/documents/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/documents/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after retargeting the duplicate-document advisory-lock schema
    ratchet to the extracted document Drizzle helper.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the document repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the document repository implementation extraction; migration parity stayed at 52
    SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated document behavior to
    `packages/database/src/repository/documents/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the document repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the document repository implementation extraction,
    confirming API consumers still reach document behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/documents-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/documents/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/documents/memory.ts packages/database/test/schema.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the document repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the document repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the document repository extraction proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/tasks-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/tasks/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/tasks/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the task repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the task repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the task repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the task repository implementation extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated task behavior to
    `packages/database/src/repository/tasks/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the task repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the task repository implementation extraction, confirming
    API consumers still reach task behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/tasks-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/tasks/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/tasks/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the task repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the task repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the task repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the task repository extraction proof/index/workboard updates; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/conversation-threads-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/conversation-threads/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/conversation-threads/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conversation-thread repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the conversation-thread repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the conversation-thread repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the conversation-thread repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated conversation-thread
    behavior to `packages/database/src/repository/conversation-threads/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the conversation-thread repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the conversation-thread repository implementation
    extraction, confirming API consumers still reach thread, message, and notification behavior
    through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/conversation-threads-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/conversation-threads/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/conversation-threads/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conversation-thread repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the conversation-thread repository extraction proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the conversation-thread repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the conversation-thread repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the conversation-thread repository extraction to the proof path list: 194
    changed paths, 194 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the conversation-thread repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/signatures-contracts.ts packages/database/src/repository/signatures/drizzle.ts packages/database/src/repository/signatures/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the signature repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the signature repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the signature repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the signature repository implementation extraction; migration parity stayed at 52
    SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated signature behavior
    to `packages/database/src/repository/signatures/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the signature repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the signature repository implementation extraction,
    confirming API consumers still reach signature behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/signatures-contracts.ts packages/database/src/repository/signatures/drizzle.ts packages/database/src/repository/signatures/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the signature repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the signature repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the signature repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the signature repository extraction proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the signature repository extraction to the proof path list: 197 changed
    paths, 197 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the signature repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/audit-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/audit/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/audit/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the audit repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the audit repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the audit repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the audit repository implementation extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated audit behavior to
    `packages/database/src/repository/audit/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the audit repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the audit repository implementation extraction,
    confirming API consumers still reach audit behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/audit-contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/audit/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/audit/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the audit repository extraction plus proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the audit repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the audit repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the audit repository extraction proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the audit repository extraction to the proof path list: 200 changed paths,
    200 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the audit repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/conflict-checks-contracts.ts packages/database/src/repository/conflict-checks/drizzle.ts packages/database/src/repository/conflict-checks/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conflict-check repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the conflict-check repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the conflict-check repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the conflict-check repository implementation extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated conflict-check
    behavior to `packages/database/src/repository/conflict-checks/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the conflict-check repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the conflict-check repository implementation extraction,
    confirming API consumers still reach conflict-check behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/conflict-checks-contracts.ts packages/database/src/repository/conflict-checks/drizzle.ts packages/database/src/repository/conflict-checks/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conflict-check repository extraction plus proof/index/workboard reconciliation.
  - The database/API code gates above had already passed after the unchanged conflict-check code
    path; the docs-facing selector closeout reran the format, docs, and policy checks after the
    proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the conflict-check repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the conflict-check repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the conflict-check repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the conflict-check repository extraction to the proof path list: 203 changed
    paths, 203 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the conflict-check repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/document-assembly-contracts.ts packages/database/src/repository/document-assembly/drizzle.ts packages/database/src/repository/document-assembly/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-assembly repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test -- repository.document-assembly.test.ts`
  - Passed: 18 files and 107 tests after the document-assembly repository implementation
    extraction; Vitest selected the package suite while covering the focused document-assembly
    repository parity tests.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the document-assembly repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the document-assembly repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the document-assembly repository implementation extraction; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated document-assembly
    behavior to `packages/database/src/repository/document-assembly/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the document-assembly repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the document-assembly repository implementation extraction,
    confirming API consumers still reach assembly workbench behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/document-assembly-contracts.ts packages/database/src/repository/document-assembly/drizzle.ts packages/database/src/repository/document-assembly/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-assembly repository extraction plus proof/index/workboard reconciliation.
  - The database/API code gates above had already passed after the unchanged document-assembly code
    path; the docs-facing selector closeout reran the format, docs, and policy checks after the
    proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the document-assembly repository extraction proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the document-assembly repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the document-assembly repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the document-assembly repository extraction to the proof path list: 206
    changed paths, 206 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the document-assembly repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/types.ts apps/web/app/_features/connectors/models.ts apps/web/app/_features/connectors/client-resources.ts apps/web/app/_features/connectors/server-resources.ts apps/web/app/connector-outbox-dashboard.ts apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard-client.test.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the connector operations
    model and client resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 27 files and 151 tests after moving connector operations model types and client reload
    fetching into `_features/connectors/`.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after connector consumers imported connector operations types from the feature model
    module.
- `pnpm build`
  - Passed after the connector web extraction: all 6 package builds succeeded, including the Next.js
    production build.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/types.ts apps/web/app/_features/connectors/models.ts apps/web/app/_features/connectors/client-resources.ts apps/web/app/_features/connectors/server-resources.ts apps/web/app/_shared/server-api.ts apps/web/app/connector-outbox-dashboard.ts apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard-client.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` for the connector operations model/client resource extraction plus
    proof/index/workboard reconciliation.
  - The web test/typecheck/build gates above had already passed after the unchanged connector web code
    path; the docs-facing selector closeout reran the format, docs, and policy checks after the
    proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the connector operations model/client resource proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the connector operations model/client resource proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the connector operations model/client resource proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the connector operations model/client resource extraction to the proof path
    list: 210 changed paths, 210 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the connector operations model/client resource extraction closeout; no whitespace
    errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/drafts-contracts.ts packages/database/src/repository/drafts/drizzle.ts packages/database/src/repository/drafts/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the draft workbench repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the draft workbench repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the draft workbench repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the draft workbench repository implementation extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated draft workbench
    behavior to `packages/database/src/repository/drafts/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the draft workbench repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the draft workbench repository implementation extraction,
    confirming API consumers still reach drafts, draft-assist, and draft-template behavior through
    the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/drafts-contracts.ts packages/database/src/repository/drafts/drizzle.ts packages/database/src/repository/drafts/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the draft workbench repository extraction plus proof/index/workboard reconciliation.
  - The database/API code gates above had already passed after the unchanged draft workbench code
    path; the docs-facing selector closeout reran the format, docs, and policy checks after the
    proof/index/workboard updates.
- `pnpm format:check`
  - Passed after formatting the draft workbench repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the draft workbench repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the draft workbench repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after adding the draft workbench repository extraction to the proof path list: 213 changed
    paths, 213 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the draft workbench repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ai-operational-proposals-contracts.ts packages/database/src/repository/ai-operational-proposals/drizzle.ts packages/database/src/repository/ai-operational-proposals/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the AI operational proposal repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the AI operational proposal repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the AI operational proposal repository implementation extraction; Drizzle reported
    the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the AI operational proposal repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated AI operational
    proposal behavior to `packages/database/src/repository/ai-operational-proposals/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the AI operational proposal repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the AI operational proposal repository implementation
    extraction, confirming API consumers still reach AI proposal behavior through the unchanged
    repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ai-operational-proposals-contracts.ts packages/database/src/repository/ai-operational-proposals/drizzle.ts packages/database/src/repository/ai-operational-proposals/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the AI operational proposal repository extraction plus proof/index/workboard reconciliation.
- `pnpm format:check`
  - Passed after formatting the AI operational proposal repository extraction proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the AI operational proposal repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the AI operational proposal repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm migrations:check`
  - Passed after the proof/index/workboard reconciliation; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database build`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the proof/index/workboard reconciliation.
- Proof-vs-diff equality check
  - Passed after adding the AI operational proposal repository extraction to the proof path list:
    216 changed paths, 216 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the AI operational proposal repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/legal-research-artifacts-contracts.ts packages/database/src/repository/legal-research-artifacts/drizzle.ts packages/database/src/repository/legal-research-artifacts/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the legal research artifact repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the legal research artifact repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the legal research artifact repository implementation extraction; Drizzle reported
    the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the legal research artifact repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated legal research
    artifact behavior to `packages/database/src/repository/legal-research-artifacts/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the legal research artifact repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the legal research artifact repository implementation
    extraction, confirming API consumers still reach legal research artifact behavior through the
    unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/legal-research-artifacts-contracts.ts packages/database/src/repository/legal-research-artifacts/drizzle.ts packages/database/src/repository/legal-research-artifacts/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the legal research artifact repository extraction plus proof/index/workboard reconciliation.
- `pnpm format:check`
  - Passed after formatting the legal research artifact repository extraction proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the legal research artifact repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the legal research artifact repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm migrations:check`
  - Passed after the proof/index/workboard reconciliation; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database build`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the proof/index/workboard reconciliation.
- Proof-vs-diff equality check
  - Passed after adding the legal research artifact repository extraction to the proof path list:
    219 changed paths, 219 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the legal research artifact repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/contacts-contracts.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the contact repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the contact repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the contact repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the contact repository implementation extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated contact dossier,
    relationship, lookup, and data-quality resolution behavior to
    `packages/database/src/repository/contacts/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the contact repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the contact repository implementation extraction,
    confirming API consumers still reach contact dossier and data-quality behavior through the
    unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/contacts-contracts.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the contact repository extraction plus proof/index/workboard reconciliation.
- `pnpm format:check`
  - Passed after formatting the contact repository extraction proof/index/workboard updates.
- `pnpm docs:check`
  - Passed after the contact repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the contact repository extraction proof/index/workboard updates; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm migrations:check`
  - Passed after the proof/index/workboard reconciliation; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database build`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the proof/index/workboard reconciliation.
- Proof-vs-diff equality check
  - Passed after adding the contact repository extraction to the proof path list: 222 changed paths,
    222 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the contact repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/intake-templates-contracts.ts packages/database/src/repository/intake-templates/drizzle.ts packages/database/src/repository/intake-templates/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the intake-template repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the intake-template repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the intake-template repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the intake-template repository implementation extraction; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated intake-template
    list/create/update behavior to `packages/database/src/repository/intake-templates/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the intake-template repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the intake-template repository implementation extraction,
    confirming API consumers still reach intake template behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/intake-templates-contracts.ts packages/database/src/repository/intake-templates/drizzle.ts packages/database/src/repository/intake-templates/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the intake-template repository extraction plus proof/index/workboard reconciliation.
- `pnpm format:check`
  - Passed after formatting the intake-template repository extraction proof/index/workboard updates
    and the Drizzle delegate wrapping.
- `pnpm docs:check`
  - Passed after the intake-template repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the intake-template repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm migrations:check`
  - Passed after the proof/index/workboard reconciliation; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database build`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the proof/index/workboard reconciliation.
- Proof-vs-diff equality check
  - Passed after adding the intake-template repository extraction to the proof path list: 225
    changed paths, 225 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the intake-template repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/calendar-credentials-contracts.ts packages/database/src/repository/calendar-credentials/drizzle.ts packages/database/src/repository/calendar-credentials/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the calendar credential repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the calendar credential repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the calendar credential repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the calendar credential repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated calendar credential
    create/list/lookup/touch/revoke behavior to
    `packages/database/src/repository/calendar-credentials/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the calendar credential repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the calendar credential repository implementation
    extraction, confirming calendar credential route and CalDAV consumers still reach credential
    behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/calendar-credentials-contracts.ts packages/database/src/repository/calendar-credentials/drizzle.ts packages/database/src/repository/calendar-credentials/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the calendar credential repository extraction plus proof/index/workboard reconciliation.
- `pnpm format:check`
  - Passed after formatting the calendar credential repository extraction proof/index/workboard
    updates.
- `pnpm docs:check`
  - Passed after the calendar credential repository extraction proof/index/workboard updates.
- `pnpm policy:check`
  - Passed after the calendar credential repository extraction proof/index/workboard updates;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm migrations:check`
  - Passed after the proof/index/workboard reconciliation; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/database build`
  - Passed after the proof/index/workboard reconciliation.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the proof/index/workboard reconciliation.
- Proof-vs-diff equality check
  - Passed after adding the calendar credential repository extraction to the proof path list: 228
    changed paths, 228 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the calendar credential repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/calendar-events-contracts.ts packages/database/src/repository/calendar-events/drizzle.ts packages/database/src/repository/calendar-events/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the non-credential calendar event repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the calendar event repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the calendar event repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the calendar event repository implementation extraction; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated event, attendee,
    reminder, scheduling request, meeting-session, and guest-link behavior to
    `packages/database/src/repository/calendar-events/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the calendar event repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the calendar event repository implementation extraction,
    confirming calendar route, CalDAV, portal, task, intake, and operational-view consumers still
    reach non-credential calendar behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/calendar-events-contracts.ts packages/database/src/repository/calendar-events/drizzle.ts packages/database/src/repository/calendar-events/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the calendar event repository extraction proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware calendar event repository extraction update.
- `pnpm docs:check`
  - Passed after the docs-aware calendar event repository extraction update.
- `pnpm policy:check`
  - Passed after the docs-aware calendar event repository extraction update; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the docs-aware calendar event repository extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware calendar event repository extraction update.
- `pnpm migrations:check`
  - Passed after the docs-aware calendar event repository extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware calendar event repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware calendar event repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware calendar event repository extraction
    update.
- Proof-vs-diff equality check
  - Passed after adding the calendar event repository extraction to the proof path list: 231
    changed paths, 231 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the calendar event repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/auth-contracts.ts packages/database/src/repository/auth/drizzle.ts packages/database/src/repository/auth/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the auth repository capability and implementation extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the auth repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the auth repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the auth repository implementation extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated user, account,
    password, session, WebAuthn, and recovery-code behavior to
    `packages/database/src/repository/auth/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the auth repository implementation extraction.
- `pnpm format:check`
  - Initially flagged the two new auth helper files; after running Prettier on
    `packages/database/src/repository/auth/drizzle.ts` and
    `packages/database/src/repository/auth/memory.ts`, it passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the auth repository implementation extraction,
    confirming auth, setup, WebAuthn, session, and downstream API consumers still reach behavior
    through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/auth-contracts.ts packages/database/src/repository/auth/drizzle.ts packages/database/src/repository/auth/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the auth repository extraction proof/index/workboard update.
- `pnpm format:check`
  - Passed after formatting the docs-aware auth repository extraction update.
- `pnpm docs:check`
  - Passed after the docs-aware auth repository extraction update.
- `pnpm policy:check`
  - Passed after the docs-aware auth repository extraction update; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the docs-aware auth repository extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware auth repository extraction update.
- `pnpm migrations:check`
  - Passed after the docs-aware auth repository extraction update; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware auth repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware auth repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware auth repository extraction update.
- Proof-vs-diff equality check
  - Passed after adding the auth repository extraction to the proof path list: 235 changed paths,
    235 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the auth repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/communications/server-resources.ts apps/web/app/_features/intake/server-resources.ts apps/web/app/_features/legal-clinic/server-resources.ts apps/web/app/_features/legal-research/server-resources.ts`
  - Selected `pnpm --filter @open-practice/web test`,
    `pnpm --filter @open-practice/web typecheck`, and `pnpm build` for the remaining
    `page.tsx` dashboard server-resource extraction.
- `pnpm --filter @open-practice/web test`
  - Passed: 27 files and 151 tests after moving communications, intake, public consultation,
    legal-clinic, and legal-research loading behind feature-owned server resources.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `page.tsx` delegated those loaders to feature-owned server resources.
- `pnpm build`
  - Passed after the `page.tsx` server-resource extraction: all 6 package builds succeeded, with
    the Next.js app compiling and collecting page data successfully.
- `pnpm verify:select -- --files apps/web/app/page.tsx apps/web/app/_features/communications/server-resources.ts apps/web/app/_features/intake/server-resources.ts apps/web/app/_features/legal-clinic/server-resources.ts apps/web/app/_features/legal-research/server-resources.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` after the `page.tsx` server-resource extraction proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware `page.tsx` server-resource extraction update.
- `pnpm docs:check`
  - Passed after the docs-aware `page.tsx` server-resource extraction update.
- `pnpm policy:check`
  - Passed after the docs-aware `page.tsx` server-resource extraction update; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 27 files and 151 tests after the docs-aware `page.tsx` server-resource extraction
    update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware `page.tsx` server-resource extraction update.
- `pnpm build`
  - Passed after the docs-aware `page.tsx` server-resource extraction update: all 6 package builds
    were cache hits, including the Next.js app build.
- Proof-vs-diff equality check
  - Passed after adding the `page.tsx` server-resource extraction to the proof path list: 239
    changed paths, 239 proof paths, no missing or extra paths.
- `git diff --check`
  - Passed after the `page.tsx` server-resource extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/shared.ts apps/api/src/routes/ledger/reconciliations.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the ledger reconciliation/import/accounting
    route submodule extraction and boundary registry update.
- `pnpm policy:check`
  - Passed after the ledger reconciliation/import/accounting route submodule extraction; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm test`
  - Passed after the ledger reconciliation/import/accounting route submodule extraction: all 9
    Turbo test/build tasks succeeded, and 58 script contract tests passed, including the updated
    registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving ledger reconciliation preview, statement import,
    match-rule, accounting-review, exception-resolution, and reconciliation creation routes behind a
    registrar-owned reconciliation submodule.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerLedgerRoutes` delegated the reconciliation submodule while keeping the
    parent ledger registrar and route dependency surface stable.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/shared.ts apps/api/src/routes/ledger/reconciliations.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the ledger reconciliation/import/accounting route submodule proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware ledger reconciliation/import/accounting route submodule update.
- `pnpm docs:check`
  - Passed after the docs-aware ledger reconciliation/import/accounting route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware ledger reconciliation/import/accounting route submodule update; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm test`
  - Passed after the docs-aware ledger reconciliation/import/accounting route submodule update: all
    9 Turbo test/build tasks were cache hits, and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware ledger reconciliation/import/accounting
    route submodule update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware ledger reconciliation/import/accounting route submodule update.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/read.ts apps/api/src/routes/ledger/transactions.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the ledger read/control and
    transaction/approval route submodule extraction plus boundary registry/test fixture update.
- `pnpm policy:check`
  - Passed after the ledger read/control and transaction/approval route submodule extraction; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy, docs
    links, proof index, local evidence Docker ignore validation, and Open Practice boundary policy all
    passed.
- `node --test scripts/validate-open-practice-boundaries.test.mjs`
  - Passed after aligning the registrar-owned route collector fixture with the deterministic ledger
    subfile declaration order.
- `pnpm test`
  - Initial run surfaced the same boundary-test fixture ordering mismatch after package tests
    completed; rerun passed after the fixture update with all 9 Turbo test/build tasks successful and
    58 script contract tests passing.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving ledger read/control and transaction/approval routes
    behind registrar-owned submodules.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerLedgerRoutes` became a parent registrar that delegates read, report,
    transaction, and reconciliation submodules while keeping the route dependency surface stable.
- `pnpm verify:select -- --files apps/api/src/routes/ledger.ts apps/api/src/routes/ledger/read.ts apps/api/src/routes/ledger/transactions.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the ledger read/control and transaction/approval route submodule proof/index/workboard update.
- `pnpm format:check`
  - Initial docs-aware run reported Markdown formatting drift in `docs/planning-and-progress.md` and
    `docs/validation/README.md`; rerun passed after `pnpm exec prettier --write
docs/planning-and-progress.md docs/validation/README.md`.
- `pnpm docs:check`
  - Passed after the docs-aware ledger read/control and transaction/approval route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware ledger read/control and transaction/approval route submodule update;
    the tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm test`
  - Passed after the docs-aware ledger read/control and transaction/approval route submodule update:
    all 9 Turbo test/build tasks succeeded and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware ledger read/control and transaction/approval
    route submodule update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware ledger read/control and transaction/approval route submodule update.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/expenses.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing expense-entry route submodule
    extraction plus boundary registry/test fixture update.
- `pnpm policy:check`
  - Passed after the billing expense-entry route submodule extraction; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the billing expense-entry route submodule extraction: all 9 Turbo test/build tasks
    succeeded and 58 script contract tests passed, including the registrar-owned route collector
    fixture with the billing expense subfile.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving expense-entry list/create/review/update/status routes
    behind the billing-owned expense submodule.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerBillingRoutes` delegated the billing expense submodule while keeping the
    route dependency surface stable.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/expenses.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the billing expense-entry route submodule proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware billing expense-entry route submodule update.
- `pnpm docs:check`
  - Passed after the docs-aware billing expense-entry route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware billing expense-entry route submodule update; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the docs-aware billing expense-entry route submodule update: all 9 Turbo test/build
    tasks were cache hits and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing expense-entry route submodule update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware billing expense-entry route submodule update.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/invoices.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the billing invoice route submodule
    extraction plus boundary registry/test fixture update.
- `pnpm policy:check`
  - Passed after the billing invoice route submodule extraction; the tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerBillingRoutes` delegated invoice routes to the billing invoice submodule
    while keeping the route dependency surface stable.
- `pnpm test`
  - Passed after the billing invoice route submodule extraction: all 9 Turbo test/build tasks
    succeeded and 58 script contract tests passed, including the registrar-owned route collector
    fixture with the billing invoice subfile.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving invoice list/create/read/approve/issue/void routes
    behind the billing-owned invoice submodule.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/invoices.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the billing invoice route submodule proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware billing invoice route submodule update.
- `pnpm docs:check`
  - Passed after the docs-aware billing invoice route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware billing invoice route submodule update; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware billing invoice route submodule update.
- `pnpm test`
  - Passed after the docs-aware billing invoice route submodule update: all 9 Turbo test/build tasks
    were cache hits and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing invoice route submodule update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the billing invoice
    route submodule proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only billing invoice route submodule closeout update.
- `pnpm docs:check`
  - Passed after the docs-only billing invoice route submodule closeout update.
- `pnpm policy:check`
  - Passed after the docs-only billing invoice route submodule closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/api/src/routes/client-portal.ts apps/api/src/routes/client-portal/shared.ts apps/api/src/routes/client-portal/workspace.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the client-portal workspace route submodule
    extraction plus boundary registry update.
- `pnpm policy:check`
  - Passed after the client-portal workspace route submodule extraction; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the workspace submodule typed contact/grant pairs with the repository `Contact`
    model while preserving the original projection flow.
- `pnpm test`
  - Passed after the client-portal workspace route submodule extraction: all 9 Turbo test/build
    tasks succeeded and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving `GET /api/client-portal/workspace` behind the
    client-portal-owned workspace submodule.
- `pnpm verify:select -- --files apps/api/src/routes/client-portal.ts apps/api/src/routes/client-portal/shared.ts apps/api/src/routes/client-portal/workspace.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the client-portal workspace route submodule proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware client-portal workspace route submodule update.
- `pnpm docs:check`
  - Passed after the docs-aware client-portal workspace route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware client-portal workspace route submodule update; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the docs-aware client-portal workspace route submodule update: all 9 Turbo
    test/build tasks were cache hits and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware client-portal workspace route submodule
    update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware client-portal workspace route submodule update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    client-portal workspace route submodule proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only client-portal workspace route submodule closeout update.
- `pnpm docs:check`
  - Passed after the docs-only client-portal workspace route submodule closeout update.
- `pnpm policy:check`
  - Passed after the docs-only client-portal workspace route submodule closeout update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files apps/api/src/routes/public-consultation-intakes.ts apps/api/src/routes/public-consultation-intakes/public.ts apps/api/src/routes/public-consultation-intakes/shared.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the public-consultation submission route
    submodule extraction plus boundary registry/test fixture update.
- `pnpm policy:check`
  - Passed after the public-consultation submission route submodule extraction; the tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the public-consultation submission route submodule extraction: all 9 Turbo
    test/build tasks succeeded and 58 script contract tests passed, including the updated
    registrar-owned route collector fixture.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after moving `POST /api/public/consultation-intakes` behind the
    public-consultation-owned public submodule.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerPublicConsultationIntakeRoutes` delegated the public submission submodule
    while keeping staff settings/list/dismiss/convert handlers in the parent registrar.
- `pnpm verify:select -- --files apps/api/src/routes/public-consultation-intakes.ts apps/api/src/routes/public-consultation-intakes/public.ts apps/api/src/routes/public-consultation-intakes/shared.ts scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` after
    the public-consultation submission route submodule proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware public-consultation submission route submodule update.
- `pnpm docs:check`
  - Passed after the docs-aware public-consultation submission route submodule update.
- `pnpm policy:check`
  - Passed after the docs-aware public-consultation submission route submodule update; the
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm test`
  - Passed after the docs-aware public-consultation submission route submodule update: all 9 Turbo
    test/build tasks were cache hits and 58 script contract tests passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware public-consultation submission route
    submodule update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware public-consultation submission route submodule update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    public-consultation submission route submodule proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only public-consultation submission route submodule closeout update.
- `pnpm docs:check`
  - Passed after the docs-only public-consultation submission route submodule closeout update.
- `pnpm policy:check`
  - Passed after the docs-only public-consultation submission route submodule closeout update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/signatures-section.tsx apps/web/app/dashboard/signatures-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
    and `pnpm build` for the signatures dashboard section extraction and static render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 28 files and 153 tests after the signatures dashboard section extraction.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after `dashboard-client.tsx` delegated signature request rendering to the focused
    signatures section while keeping active-matter filtering in the dashboard shell.
- `pnpm build`
  - Passed after the signatures dashboard section extraction: 6 Turbo build tasks succeeded, 4 from
    cache.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/signatures-section.tsx apps/web/app/dashboard/signatures-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` after the signatures dashboard section proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware signatures dashboard section update.
- `pnpm docs:check`
  - Passed after the docs-aware signatures dashboard section update.
- `pnpm policy:check`
  - Passed after the docs-aware signatures dashboard section update; the tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 28 files and 153 tests after the docs-aware signatures dashboard section update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware signatures dashboard section update.
- `pnpm build`
  - Passed after the docs-aware signatures dashboard section update: all 6 Turbo build tasks were
    cache hits.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the signatures
    dashboard section proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only signatures dashboard section closeout update.
- `pnpm docs:check`
  - Passed after the docs-only signatures dashboard section closeout update.
- `pnpm policy:check`
  - Passed after the docs-only signatures dashboard section closeout update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/audit-section.tsx apps/web/app/dashboard/audit-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
    and `pnpm build` for the audit dashboard body extraction and static render guard.
- `pnpm --filter @open-practice/web test`
  - Passed: 29 files and 155 tests after the audit dashboard body extraction.
- `pnpm --filter @open-practice/web typecheck`
  - Initially failed because the synthetic audit activity fixture omitted `firmId` and `metadata`;
    passed after the fixture matched the `ActivityTimelineEntry` shape.
- `pnpm build`
  - Passed after the audit dashboard body extraction: 6 Turbo build tasks succeeded, 5 from cache.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/audit-section.tsx apps/web/app/dashboard/audit-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` after the audit dashboard body proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware audit dashboard body update.
- `pnpm docs:check`
  - Passed after the docs-aware audit dashboard body update.
- `pnpm policy:check`
  - Passed after the docs-aware audit dashboard body update; the tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 29 files and 155 tests after the docs-aware audit dashboard body update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware audit dashboard body update.
- `pnpm build`
  - Passed after the docs-aware audit dashboard body update: all 6 Turbo build tasks were cache
    hits.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the audit dashboard
    body proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only audit dashboard body closeout update.
- `pnpm docs:check`
  - Passed after the docs-only audit dashboard body closeout update.
- `pnpm policy:check`
  - Passed after the docs-only audit dashboard body closeout update; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/drafting-section.tsx apps/web/app/dashboard/drafting-section.test.tsx`
  - Selected `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
    and `pnpm build` for the drafting dashboard body extraction and static render guard.
- `pnpm --filter @open-practice/web test`
  - Initially failed because the synthetic UTC-midnight draft fixture rendered as the previous local
    date; passed after moving the fixture timestamp to noon UTC: 30 files and 157 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Initially failed because the synthetic generated-document provider and draft-assist task list
    were too wide; passed after using the existing provider/task unions.
- `pnpm build`
  - Passed after the drafting dashboard body extraction: 6 Turbo build tasks succeeded, 5 from
    cache.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/drafting-section.tsx apps/web/app/dashboard/drafting-section.test.tsx docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
    `pnpm build` after the drafting dashboard body proof/index/workboard update.
- `pnpm format:check`
  - Passed after the docs-aware drafting dashboard body update.
- `pnpm docs:check`
  - Passed after the docs-aware drafting dashboard body update.
- `pnpm policy:check`
  - Passed after the docs-aware drafting dashboard body update; the tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 30 files and 157 tests after the docs-aware drafting dashboard body update.
- `pnpm --filter @open-practice/web typecheck`
  - Passed after the docs-aware drafting dashboard body update.
- `pnpm build`
  - Passed after the docs-aware drafting dashboard body update: all 6 Turbo build tasks were cache
    hits.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the drafting
    dashboard body proof/index/workboard closeout update.
- `pnpm format:check`
  - Passed after the docs-only drafting dashboard body closeout update.
- `pnpm docs:check`
  - Passed after the docs-only drafting dashboard body closeout update.
- `pnpm policy:check`
  - Passed after the docs-only drafting dashboard body closeout update; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/api/src/routes/communications.ts apps/api/src/routes/communications/inbox.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the communications inbox aggregate route
    extraction and boundary registry update.
- `pnpm policy:check`
  - Passed after the communications inbox aggregate route extraction; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerCommunicationsRoutes` delegated the inbox aggregate to the
    registrar-owned communications inbox submodule.
- `pnpm test`
  - Passed after the communications inbox aggregate route extraction: 9 Turbo test/build tasks
    succeeded, including API communications coverage with 499 API tests, plus 58 script contract
    tests including the registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting the communications inbox aggregate route while
    preserving matter-scoped response shapes and redaction.
- `pnpm verify:select -- --files apps/api/src/routes/communications.ts apps/api/src/routes/communications/inbox.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the communications inbox aggregate route extraction and proof/index/workboard update.
- `pnpm format:check`
  - Initially failed on `docs/planning-and-progress.md` and `docs/validation/README.md`; passed
    after formatting those touched Markdown files.
- `pnpm docs:check`
  - Passed after the communications inbox aggregate route proof/index/workboard update.
- `pnpm policy:check`
  - Passed after the communications inbox aggregate route proof/index/workboard update; tracked
    secret scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links,
    proof index, local evidence Docker ignore validation, and Open Practice boundary policy all
    passed.
- `pnpm test`
  - Passed after the communications inbox aggregate route proof/index/workboard update: 9 Turbo
    test/build tasks succeeded from cache, plus 58 script contract tests.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the communications inbox aggregate route
    proof/index/workboard update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the communications inbox aggregate route proof/index/workboard update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    communications inbox aggregate route docs-only closeout update.
- `pnpm format:check`
  - Passed after the docs-only communications inbox aggregate route closeout update.
- `pnpm docs:check`
  - Passed after the docs-only communications inbox aggregate route closeout update.
- `pnpm policy:check`
  - Passed after the docs-only communications inbox aggregate route closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/api/src/routes/intake.ts apps/api/src/routes/intake/generated-documents.ts apps/api/src/routes/intake/shared.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the intake generated-document/package route
    extraction and boundary registry update.
- `pnpm policy:check`
  - Passed after the intake generated-document/package route extraction; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerIntakeRoutes` delegated generated-document/package handlers to the
    registrar-owned intake generated-documents submodule.
- `pnpm test`
  - Passed after the intake generated-document/package route extraction: 9 Turbo test/build tasks
    succeeded, including API intake coverage with 499 API tests, plus 58 script contract tests
    including the registrar-owned route collector contract.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting intake generated-document/package routes while
    preserving generated artifact response shapes and redaction.
- `pnpm verify:select -- --files apps/api/src/routes/intake.ts apps/api/src/routes/intake/generated-documents.ts apps/api/src/routes/intake/shared.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the intake generated-document/package route proof/index/workboard update.
- `pnpm prettier --write apps/api/src/routes/intake.ts apps/api/src/routes/intake/generated-documents.ts docs/planning-and-progress.md docs/validation/README.md`
  - Applied after the first docs-aware `pnpm format:check` reported Prettier drift in the intake
    parent/submodule files and the long OP-MOD workboard/index rows.
- `pnpm format:check`
  - Passed after formatting the intake generated-document/package route proof/index/workboard
    update.
- `pnpm docs:check`
  - Passed after the intake generated-document/package route proof/index/workboard update.
- `pnpm policy:check`
  - Passed after the intake generated-document/package route proof/index/workboard update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the intake generated-document/package route proof/index/workboard update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the intake generated-document/package route
    proof/index/workboard update.
- `pnpm test`
  - Passed after the intake generated-document/package route proof/index/workboard update: 9 Turbo
    test/build tasks succeeded, including API route coverage with 499 API tests, plus 58 script
    contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the intake
    generated-document/package route docs-only closeout update.
- `pnpm format:check`
  - Passed after the docs-only intake generated-document/package route closeout update.
- `pnpm docs:check`
  - Passed after the docs-only intake generated-document/package route closeout update.
- `pnpm policy:check`
  - Passed after the docs-only intake generated-document/package route closeout update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/outbox.ts apps/api/src/routes/email/shared.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the email outbox/preview/retry route
    extraction and boundary registry update.
- `pnpm policy:check`
  - Passed after the email outbox/preview/retry route extraction; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after `registerEmailRoutes` delegated outbox, preview, create, and retry handlers to the
    registrar-owned email outbox submodule.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after extracting email outbox/preview/retry routes while
    preserving delivery, receipt, queue, idempotency, and audit response behavior.
- `pnpm test`
  - Passed after the email outbox/preview/retry route extraction: 9 Turbo test/build tasks
    succeeded, including API email coverage with 499 API tests, plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/outbox.ts apps/api/src/routes/email/shared.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the email outbox/preview/retry route proof/index/workboard update.
- `pnpm prettier --write apps/api/src/routes/email/outbox.ts docs/planning-and-progress.md docs/validation/README.md`
  - Applied after the first docs-aware `pnpm format:check` reported Prettier drift in the new email
    outbox submodule and the long OP-MOD workboard/index rows.
- `pnpm format:check`
  - Passed after formatting the email outbox/preview/retry route proof/index/workboard update.
- `pnpm docs:check`
  - Passed after the email outbox/preview/retry route proof/index/workboard update.
- `pnpm policy:check`
  - Passed after the email outbox/preview/retry route proof/index/workboard update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the email outbox/preview/retry route proof/index/workboard update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the email outbox/preview/retry route
    proof/index/workboard update.
- `pnpm test`
  - Passed after the email outbox/preview/retry route proof/index/workboard update: 9 Turbo
    test/build tasks succeeded, including API email coverage with 499 API tests, plus 58 script
    contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the email
    outbox/preview/retry route docs-only closeout update.
- `pnpm format:check`
  - Passed after the docs-only email outbox/preview/retry route closeout update.
- `pnpm docs:check`
  - Passed after the docs-only email outbox/preview/retry route closeout update.
- `pnpm policy:check`
  - Passed after the docs-only email outbox/preview/retry route closeout update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/contacts.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the contact schema split.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after moving contact enums, contact tables, contact relationship tables, and matter
    parties behind `packages/database/src/schema/contacts.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the contact schema split while keeping `schema.ts` as the compatibility
    aggregator.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after the contact schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the contact schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the contact schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the contact schema split, confirming API consumers still
    resolve contact schema through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/contacts.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the contact schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md packages/database/src/schema/contacts.ts`
  - Applied only after the first combined pass reported formatting drift in the touched workboard,
    validation index, and contact schema module.
- `pnpm format:check`
  - Passed after Prettier normalized the contact schema module and modularization docs.
- `pnpm docs:check`
  - Passed after documenting the contact schema split in the proof note, validation index, and
    workboard row.
- `pnpm policy:check`
  - Passed after the contact schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests during the contact schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the contact schema docs-aware pass; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed during the contact schema docs-aware pass; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the contact schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the contact schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the contact schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the contact
    schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the contact schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the contact schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the contact schema docs-aware validation evidence; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/operational-views.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the operational-view schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/operational-views.ts`
  - Normalized the new operational-view schema module; `schema.ts` was unchanged by Prettier.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving saved operational view enums and table definitions
    behind `packages/database/src/schema/operational-views.ts`.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the operational-view schema split; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed after the operational-view schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/operational-views.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the operational-view schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the operational-view schema split, confirming API
    consumers still resolve saved operational view schema through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/operational-views.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the operational-view schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md`
  - Applied only after the first combined pass reported formatting drift in the touched workboard
    and validation index table rows.
- `pnpm format:check`
  - Passed after Prettier normalized the operational-view schema split docs.
- `pnpm docs:check`
  - Passed after documenting the operational-view schema split in the proof note, validation index,
    and workboard row.
- `pnpm policy:check`
  - Passed after the operational-view schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests during the operational-view schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the operational-view schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the operational-view schema docs-aware pass; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the operational-view schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the operational-view schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the operational-view schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    operational-view schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the operational-view schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the operational-view schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the operational-view schema docs-aware validation evidence; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/conversation-threads.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conversation-thread schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/conversation-threads.ts`
  - Reported both touched schema files unchanged after the conversation-thread schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests after moving conversation-thread enums, messages, and
    notification tables behind `packages/database/src/schema/conversation-threads.ts`.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the conversation-thread schema split; Drizzle reported the schema configuration
    was fine.
- `pnpm migrations:check`
  - Passed after the conversation-thread schema split; migration parity stayed at 52 SQL files and
    52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/conversation-threads.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the conversation-thread schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the conversation-thread schema split, confirming API
    consumers still resolve conversation schema through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/conversation-threads.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conversation-thread schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md`
  - Applied only after the first combined pass reported formatting drift in the touched workboard
    and validation index table rows.
- `pnpm format:check`
  - Passed after Prettier normalized the conversation-thread schema split docs.
- `pnpm docs:check`
  - Passed after documenting the conversation-thread schema split in the proof note, validation
    index, and workboard row.
- `pnpm policy:check`
  - Passed after the conversation-thread schema docs-aware pass; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 107 tests during the conversation-thread schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the conversation-thread schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the conversation-thread schema docs-aware pass; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the conversation-thread schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the conversation-thread schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the conversation-thread schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    conversation-thread schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the conversation-thread schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the conversation-thread schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the conversation-thread schema docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/conflict-checks.ts packages/database/test/schema.test.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conflict-check schema split and schema-test coverage.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/conflict-checks.ts packages/database/test/schema.test.ts`
  - Reported all three touched database files unchanged after the conflict-check schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 108 tests after moving `conflict_checks` behind
    `packages/database/src/schema/conflict-checks.ts` and adding the aggregator-visible schema test.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the conflict-check schema split; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed after the conflict-check schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/conflict-checks.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the conflict-check schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the conflict-check schema split, confirming API consumers
    still resolve conflict-check schema through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/conflict-checks.ts packages/database/test/schema.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the conflict-check schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md`
  - Applied only after the first combined pass reported formatting drift in the touched workboard
    and validation index table rows.
- `pnpm format:check`
  - Passed after Prettier normalized the conflict-check schema split docs.
- `pnpm docs:check`
  - Passed after documenting the conflict-check schema split in the proof note, validation index,
    and workboard row.
- `pnpm policy:check`
  - Passed after the conflict-check schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 108 tests during the conflict-check schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the conflict-check schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the conflict-check schema docs-aware pass; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the conflict-check schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the conflict-check schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the conflict-check schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    conflict-check schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the conflict-check schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the conflict-check schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the conflict-check schema docs-aware validation evidence; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links,
    proof index, local evidence Docker ignore validation, and Open Practice boundary policy all
    passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/firm-settings.ts packages/database/src/schema/public-consultation.ts packages/database/test/schema.test.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the firm-settings/notification-preference and public-consultation schema splits plus
    schema-test coverage.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/firm-settings.ts packages/database/src/schema/public-consultation.ts packages/database/test/schema.test.ts`
  - Reported all four touched database files unchanged after the combined schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after moving firm settings, notification preferences, and public
    consultation intakes behind focused schema modules and adding aggregator-visible schema tests.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the combined schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the combined schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/firm-settings.js` and
    `./schema/public-consultation.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the combined schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the combined schema split, confirming API consumers still
    resolve firm settings, notification preferences, and public consultation intakes through the
    compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/firm-settings.ts packages/database/src/schema/public-consultation.ts packages/database/test/schema.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the firm-settings/public-consultation schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the combined schema split
    docs.
- `pnpm format:check`
  - Passed after documenting the firm-settings/public-consultation schema split.
- `pnpm docs:check`
  - Passed after documenting the firm-settings/public-consultation schema split in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the firm-settings/public-consultation schema docs-aware pass; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the firm-settings/public-consultation schema docs-aware
    pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the firm-settings/public-consultation schema docs-aware pass; Drizzle reported the
    schema configuration was fine.
- `pnpm migrations:check`
  - Passed during the firm-settings/public-consultation schema docs-aware pass; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the firm-settings/public-consultation schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the firm-settings/public-consultation schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the firm-settings/public-consultation schema docs-aware
    pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    firm-settings/public-consultation schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the firm-settings/public-consultation schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the firm-settings/public-consultation schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the firm-settings/public-consultation schema docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/audit-events.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the audit-event schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/audit-events.ts`
  - Reported both touched database files unchanged after the audit-event schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after moving `audit_events` behind
    `packages/database/src/schema/audit-events.ts`.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the audit-event schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the audit-event schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/audit-events.js` from `schema.ts`.
- `pnpm --filter @open-practice/database build`
  - Passed after the audit-event schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the audit-event schema split, confirming API consumers
    still resolve audit events through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/audit-events.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the audit-event schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the audit-event schema
    split docs.
- `pnpm format:check`
  - Passed after documenting the audit-event schema split.
- `pnpm docs:check`
  - Passed after documenting the audit-event schema split in the proof note, validation index, and
    workboard row.
- `pnpm policy:check`
  - Passed after the audit-event schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the audit-event schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the audit-event schema docs-aware pass; Drizzle reported the schema configuration
    was fine.
- `pnpm migrations:check`
  - Passed during the audit-event schema docs-aware pass; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the audit-event schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the audit-event schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the audit-event schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the audit-event
    schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the audit-event schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the audit-event schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the audit-event schema docs-aware validation evidence; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/billing-controls.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing-control schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/billing-controls.ts`
  - Reported both touched database files unchanged after the billing-control schema extraction.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after moving billing period locks and rate rules behind
    `packages/database/src/schema/billing-controls.ts`.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the billing-control schema split; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed after the billing-control schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/billing-controls.js` from `schema.ts` and keeping the local
    `billingRateRules` import for `timeEntries.rateRuleId`.
- `pnpm --filter @open-practice/database build`
  - Passed after the billing-control schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing-control schema split, confirming API consumers
    still resolve billing period locks and rate rules through the compatibility aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/billing-controls.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing-control schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the billing-control
    schema split docs.
- `pnpm format:check`
  - Passed after documenting the billing-control schema split.
- `pnpm docs:check`
  - Passed after documenting the billing-control schema split in the proof note, validation index,
    and workboard row.
- `pnpm policy:check`
  - Passed after the billing-control schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the billing-control schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the billing-control schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the billing-control schema docs-aware pass; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the billing-control schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the billing-control schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the billing-control schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    billing-control schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the billing-control schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the billing-control schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the billing-control schema docs-aware validation evidence; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/portal-links.ts packages/database/test/schema.test.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the portal-link schema split and schema-test coverage.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/portal-links.ts packages/database/test/schema.test.ts`
  - Formatted `packages/database/src/schema/portal-links.ts` after the portal-link schema
    extraction; the root schema and schema test were unchanged by Prettier.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after moving portal grants, share links, and external-upload
    links behind `packages/database/src/schema/portal-links.ts`.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the portal-link schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the portal-link schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after re-exporting `./schema/portal-links.js` from `schema.ts` and keeping local
    `shareLinks`/`externalUploadLinks` imports for remaining foreign keys.
- `pnpm --filter @open-practice/database build`
  - Passed after the portal-link schema submodule extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the portal-link schema split, confirming API consumers
    still resolve portal grants, share links, and external-upload links through the compatibility
    aggregator.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/portal-links.ts packages/database/test/schema.test.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the portal-link schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the portal-link schema
    split docs.
- `pnpm format:check`
  - Passed after documenting the portal-link schema split.
- `pnpm docs:check`
  - Passed after documenting the portal-link schema split in the proof note, validation index, and
    workboard row.
- `pnpm policy:check`
  - Passed after the portal-link schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the portal-link schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the portal-link schema docs-aware pass; Drizzle reported the schema configuration
    was fine.
- `pnpm migrations:check`
  - Passed during the portal-link schema docs-aware pass; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the portal-link schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the portal-link schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the portal-link schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the portal-link
    schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the portal-link schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the portal-link schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the portal-link schema docs-aware validation evidence; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/documents.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-ingestion/media schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/documents.ts`
  - Left the schema aggregator and new document schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the document-ingestion/media schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the document-ingestion/media schema split; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed after the document-ingestion/media schema split; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the document-ingestion/media schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the document-ingestion/media schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the document-ingestion/media schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/documents.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-ingestion/media schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the
    document-ingestion/media schema split docs.
- `pnpm format:check`
  - Passed after documenting the document-ingestion/media schema split.
- `pnpm docs:check`
  - Passed after documenting the document-ingestion/media schema split in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the document-ingestion/media schema docs-aware pass; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the document-ingestion/media schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the document-ingestion/media schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the document-ingestion/media schema docs-aware pass; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the document-ingestion/media schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the document-ingestion/media schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the document-ingestion/media schema docs-aware pass.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/inbound-email.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the inbound-email schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/inbound-email.ts`
  - Formatted the new inbound-email schema submodule and left the schema aggregator unchanged.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the inbound-email schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the inbound-email schema split; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed after the inbound-email schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the inbound-email schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the inbound-email schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the inbound-email schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/drafts.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the drafting schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/drafts.ts`
  - Left the schema aggregator and new drafting schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the drafting schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the drafting schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the drafting schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the drafting schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the drafting schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the drafting schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/documents.ts packages/database/src/schema/inbound-email.ts packages/database/src/schema/drafts.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-ingestion/media, inbound-email, and drafting schema splits plus
    proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the inbound-email and
    drafting schema split docs.
- `pnpm format:check`
  - Passed after documenting the inbound-email and drafting schema splits.
- `pnpm docs:check`
  - Passed after documenting the inbound-email and drafting schema splits in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the combined schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the combined schema docs-aware pass; Drizzle reported the schema configuration
    was fine.
- `pnpm migrations:check`
  - Passed during the combined schema docs-aware pass; migration parity stayed at 52 SQL files and
    52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the combined schema docs-aware pass.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/signatures.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the signature-request schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/signatures.ts`
  - Left the schema aggregator and new signature schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the signature-request schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the signature-request schema split; Drizzle reported the schema configuration was
    fine.
- `pnpm migrations:check`
  - Passed after the signature-request schema split; migration parity stayed at 52 SQL files and 52
    journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the signature-request schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the signature-request schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the signature-request schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/signatures.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the signature-request schema split plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the signature-request
    schema split docs; the proof note was already formatted.
- `pnpm format:check`
  - Passed after documenting the signature-request schema split.
- `pnpm docs:check`
  - Passed after documenting the signature-request schema split in the proof note, validation
    index, and workboard row.
- `pnpm policy:check`
  - Passed after the signature-request schema docs-aware pass; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the signature-request schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the signature-request schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the signature-request schema docs-aware pass; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the signature-request schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the signature-request schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the signature-request schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    signature-request schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the signature-request schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the signature-request schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the signature-request schema docs-aware validation evidence; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/intake.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the intake schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/intake.ts`
  - Left the schema aggregator and new intake schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the intake schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the intake schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the intake schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the intake schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the intake schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the intake schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/document-assembly.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the document-assembly/signature-envelope schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/document-assembly.ts`
  - Left the schema aggregator and new document-assembly schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the document-assembly/signature-envelope schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the document-assembly/signature-envelope schema split; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed after the document-assembly/signature-envelope schema split; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the document-assembly/signature-envelope schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the document-assembly/signature-envelope schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the document-assembly/signature-envelope schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/access-logs.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the access-log schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/access-logs.ts`
  - Left the schema aggregator and new access-log schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the access-log schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the access-log schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the access-log schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the access-log schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the access-log schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the access-log schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/ledger.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the ledger schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/ledger.ts`
  - Left the schema aggregator and new ledger schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the ledger schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the ledger schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the ledger schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the ledger schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the ledger schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the ledger schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/billing.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing schema split.
- `pnpm prettier --write packages/database/src/schema.ts packages/database/src/schema/billing.ts`
  - Left the pure export schema aggregator and new billing schema submodule formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the billing schema split.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the billing schema split; Drizzle reported the schema configuration was fine.
- `pnpm migrations:check`
  - Passed after the billing schema split; migration parity stayed at 52 SQL files and 52 journal
    entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the billing schema split.
- `pnpm --filter @open-practice/database build`
  - Passed after the billing schema split.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing schema split.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/access-logs.ts packages/database/src/schema/document-assembly.ts packages/database/src/schema/intake.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the intake, document-assembly/signature-envelope, and access-log schema splits plus
    proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the intake,
    document-assembly/signature-envelope, and access-log schema split docs; the proof note was
    already formatted.
- `pnpm format:check`
  - Passed after documenting the intake, document-assembly/signature-envelope, and access-log schema
    splits.
- `pnpm docs:check`
  - Passed after documenting the intake, document-assembly/signature-envelope, and access-log schema
    splits in the proof note, validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the combined schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the combined schema docs-aware pass; Drizzle reported the schema configuration
    was fine.
- `pnpm migrations:check`
  - Passed during the combined schema docs-aware pass; migration parity stayed at 52 SQL files and
    52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the combined schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the combined schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the intake,
    document-assembly/signature-envelope, and access-log schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the combined schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the combined schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the combined schema docs-aware validation evidence; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/schema.ts packages/database/src/schema/ledger.ts packages/database/src/schema/billing.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the ledger and billing schema splits plus proof/index/workboard updates.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the OP-MOD workboard row and validation index after adding the ledger/billing schema
    split docs; the proof note was already formatted.
- `pnpm format:check`
  - Passed after documenting the ledger and billing schema splits plus the pure schema export
    aggregator.
- `pnpm docs:check`
  - Passed after documenting the ledger and billing schema splits in the proof note, validation
    index, and workboard row.
- `pnpm policy:check`
  - Passed after the ledger/billing schema docs-aware pass; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests during the ledger/billing schema docs-aware pass.
- `pnpm --filter @open-practice/database db:check`
  - Passed during the ledger/billing schema docs-aware pass; Drizzle reported the schema
    configuration was fine.
- `pnpm migrations:check`
  - Passed during the ledger/billing schema docs-aware pass; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed during the ledger/billing schema docs-aware pass.
- `pnpm --filter @open-practice/database build`
  - Passed during the ledger/billing schema docs-aware pass.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests during the ledger/billing schema docs-aware pass.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the ledger/billing
    schema docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the ledger/billing schema docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the ledger/billing schema docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the ledger/billing schema docs-aware validation evidence; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/firm-settings-contracts.ts packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the firm-settings repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/firm-settings-contracts.ts packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts`
  - Normalized the aggregate repository files plus the new firm-settings contract and Drizzle/memory
    helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the firm-settings repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the firm-settings repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the firm-settings repository implementation extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated firm-scoped settings
    lookup to `packages/database/src/repository/firm-settings/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the firm-settings repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the firm-settings repository implementation extraction,
    confirming API consumers still reach firm settings through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/firm-settings-contracts.ts packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the firm-settings repository extraction proof/index/workboard update.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/firm-settings-contracts.ts packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware firm-settings repository extraction update after tightening the
    Drizzle helper return type to `FirmSettings`.
- `pnpm format:check`
  - Passed after the docs-aware firm-settings repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the firm-settings repository extraction in the proof note, validation
    index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware firm-settings repository extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware firm-settings repository extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware firm-settings repository extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware firm-settings repository extraction update; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware firm-settings repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware firm-settings repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware firm-settings repository extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    firm-settings repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the firm-settings repository extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the firm-settings repository extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the firm-settings repository extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-controls-contracts.ts packages/database/src/repository/billing-controls/drizzle.ts packages/database/src/repository/billing-controls/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing-controls repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-controls-contracts.ts packages/database/src/repository/billing-controls/drizzle.ts packages/database/src/repository/billing-controls/memory.ts`
  - Reported the aggregate repository files plus new billing-controls contract and Drizzle/memory
    helpers were already formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the billing-controls repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the billing-controls repository implementation extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the billing-controls repository implementation extraction; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated billing period-lock
    and rate-rule behavior to `packages/database/src/repository/billing-controls/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the billing-controls repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing-controls repository implementation extraction,
    confirming billing API consumers still reach locks and rate rules through the unchanged
    repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-controls-contracts.ts packages/database/src/repository/billing-controls/drizzle.ts packages/database/src/repository/billing-controls/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the billing-controls repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware billing-controls repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware billing-controls repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the billing-controls repository extraction in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware billing-controls repository extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware billing-controls repository extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware billing-controls repository extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware billing-controls repository extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware billing-controls repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware billing-controls repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing-controls repository extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    billing-controls repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the billing-controls repository extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the billing-controls repository extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the billing-controls repository extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/trust-transfer-requests-contracts.ts packages/database/src/repository/trust-transfer-requests/drizzle.ts packages/database/src/repository/trust-transfer-requests/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the trust-transfer request repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/trust-transfer-requests-contracts.ts packages/database/src/repository/trust-transfer-requests/drizzle.ts packages/database/src/repository/trust-transfer-requests/memory.ts`
  - Normalized the aggregate repository files plus the new trust-transfer request contract and
    Drizzle/memory helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the trust-transfer request repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the trust-transfer request repository implementation extraction; Drizzle reported
    the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the trust-transfer request repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated trust-transfer
    request behavior to `packages/database/src/repository/trust-transfer-requests/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the trust-transfer request repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the trust-transfer request repository implementation
    extraction, confirming billing/ledger API consumers still reach trust-transfer requests through
    the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/trust-transfer-requests-contracts.ts packages/database/src/repository/trust-transfer-requests/drizzle.ts packages/database/src/repository/trust-transfer-requests/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the trust-transfer request repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware trust-transfer request repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware trust-transfer request repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the trust-transfer request repository extraction in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware trust-transfer request repository extraction update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware trust-transfer request repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware trust-transfer request repository extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware trust-transfer request repository extraction update; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware trust-transfer request repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware trust-transfer request repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware trust-transfer request repository
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    trust-transfer request repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the trust-transfer request repository extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the trust-transfer request repository extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the trust-transfer request repository extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-review-contracts.ts packages/database/src/repository/ledger-review/drizzle.ts packages/database/src/repository/ledger-review/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the ledger review/reconciliation repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-review-contracts.ts packages/database/src/repository/ledger-review/drizzle.ts packages/database/src/repository/ledger-review/memory.ts`
  - Normalized the aggregate repository files plus the new ledger review contract and Drizzle/memory
    helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the ledger review/reconciliation repository
    implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the ledger review/reconciliation repository implementation extraction; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the ledger review/reconciliation repository implementation extraction; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated ledger
    review/reconciliation behavior to `packages/database/src/repository/ledger-review/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the ledger review/reconciliation repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the ledger review/reconciliation repository
    implementation extraction, confirming ledger/billing/report API consumers still reach review
    records through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-review-contracts.ts packages/database/src/repository/ledger-review/drizzle.ts packages/database/src/repository/ledger-review/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the ledger review/reconciliation repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware ledger review/reconciliation repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the ledger review/reconciliation repository extraction in the proof
    note, validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware ledger review/reconciliation repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware ledger review/reconciliation repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware ledger review/reconciliation repository
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the ledger
    review/reconciliation repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the ledger review/reconciliation repository extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the ledger review/reconciliation repository extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the ledger review/reconciliation repository extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/public-consultation-intakes-contracts.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the public consultation intake CRUD/review repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/public-consultation-intakes-contracts.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/memory.ts`
  - Reported the aggregate repository files plus the new public consultation intake contract and
    Drizzle/memory helpers were already formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the public consultation intake CRUD/review repository
    implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the public consultation intake CRUD/review repository implementation extraction;
    Drizzle reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the public consultation intake CRUD/review repository implementation extraction;
    migration parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated public consultation
    intake CRUD/review behavior to
    `packages/database/src/repository/public-consultation-intakes/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the public consultation intake CRUD/review repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the public consultation intake CRUD/review repository
    implementation extraction, confirming public-consultation and intake-pipeline API consumers
    still reach those records through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/public-consultation-intakes-contracts.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the public consultation intake CRUD/review repository extraction proof/index/workboard
    update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware public consultation intake CRUD/review repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the public consultation intake CRUD/review repository extraction in the
    proof note, validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware public consultation intake CRUD/review
    repository extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update;
    Drizzle reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update;
    migration parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware public consultation intake CRUD/review repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware public consultation intake CRUD/review
    repository extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the public
    consultation intake CRUD/review repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the public consultation intake CRUD/review repository extraction docs-aware
    validation evidence.
- `pnpm docs:check`
  - Passed after adding the public consultation intake CRUD/review repository extraction docs-aware
    validation evidence.
- `pnpm policy:check`
  - Passed after adding the public consultation intake CRUD/review repository extraction docs-aware
    validation evidence; tracked-secret scan, package manifest dependency policy, migration parity,
    OSS reuse policy, docs links, proof index, local evidence Docker ignore validation, and Open
    Practice boundary policy all passed.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-entries-contracts.ts packages/database/src/repository/billing-entries/drizzle.ts packages/database/src/repository/billing-entries/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing entries/time-expense repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-entries-contracts.ts packages/database/src/repository/billing-entries/drizzle.ts packages/database/src/repository/billing-entries/memory.ts`
  - Reported the aggregate repository files plus the new billing entries/time-expense contract and
    Drizzle/memory helpers were already formatted.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the billing entries/time-expense repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the billing entries/time-expense repository implementation extraction; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the billing entries/time-expense repository implementation extraction; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated time/expense entry
    behavior to `packages/database/src/repository/billing-entries/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the billing entries/time-expense repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing entries/time-expense repository implementation
    extraction, confirming billing API consumers still reach time and expense entries through the
    unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-entries-contracts.ts packages/database/src/repository/billing-entries/drizzle.ts packages/database/src/repository/billing-entries/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the billing entries/time-expense repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware billing entries/time-expense repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware billing entries/time-expense repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the billing entries/time-expense repository extraction in the proof
    note, validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware billing entries/time-expense repository extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware billing entries/time-expense repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware billing entries/time-expense repository extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware billing entries/time-expense repository extraction update; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware billing entries/time-expense repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware billing entries/time-expense repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing entries/time-expense repository
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the billing
    entries/time-expense repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the billing entries/time-expense repository extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the billing entries/time-expense repository extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the billing entries/time-expense repository extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the billing entries/time-expense repository extraction closeout: 298 actual changed
    paths, 298 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the billing entries/time-expense repository extraction closeout; no whitespace
    errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/hosted-payment-requests-contracts.ts packages/database/src/repository/hosted-payment-requests/drizzle.ts packages/database/src/repository/hosted-payment-requests/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the hosted payment request repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/hosted-payment-requests-contracts.ts packages/database/src/repository/hosted-payment-requests/drizzle.ts packages/database/src/repository/hosted-payment-requests/memory.ts`
  - Normalized the aggregate repository files plus the new hosted payment request contract and
    Drizzle/memory helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the hosted payment request repository implementation
    extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the hosted payment request repository implementation extraction; Drizzle reported
    the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the hosted payment request repository implementation extraction; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated hosted payment
    request behavior to `packages/database/src/repository/hosted-payment-requests/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the hosted payment request repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the hosted payment request repository implementation
    extraction, confirming billing and client-portal API consumers still reach hosted payment
    requests through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/hosted-payment-requests-contracts.ts packages/database/src/repository/hosted-payment-requests/drizzle.ts packages/database/src/repository/hosted-payment-requests/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the hosted payment request repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware hosted payment request repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware hosted payment request repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the hosted payment request repository extraction in the proof note,
    validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware hosted payment request repository extraction update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware hosted payment request repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware hosted payment request repository extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware hosted payment request repository extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware hosted payment request repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware hosted payment request repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware hosted payment request repository
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the hosted
    payment request repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the hosted payment request repository extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the hosted payment request repository extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the hosted payment request repository extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the hosted payment request repository extraction closeout: 301 actual changed
    paths, 301 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the hosted payment request repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-invoices-payments-contracts.ts packages/database/src/repository/billing-invoices-payments/drizzle.ts packages/database/src/repository/billing-invoices-payments/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the billing invoice/manual-payment repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-invoices-payments-contracts.ts packages/database/src/repository/billing-invoices-payments/drizzle.ts packages/database/src/repository/billing-invoices-payments/memory.ts`
  - Normalized the aggregate repository files plus the new billing invoice/manual-payment contract
    and Drizzle/memory helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the billing invoice/manual-payment repository
    implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the billing invoice/manual-payment repository implementation extraction; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the billing invoice/manual-payment repository implementation extraction; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated invoice and manual
    payment behavior to `packages/database/src/repository/billing-invoices-payments/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the billing invoice/manual-payment repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the billing invoice/manual-payment repository
    implementation extraction, confirming billing and client-portal API consumers still reach
    invoices and manual payments through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/billing-invoices-payments-contracts.ts packages/database/src/repository/billing-invoices-payments/drizzle.ts packages/database/src/repository/billing-invoices-payments/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the billing invoice/manual-payment repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware billing invoice/manual-payment repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the billing invoice/manual-payment repository extraction in the proof
    note, validation index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware billing invoice/manual-payment repository
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update;
    Drizzle reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update;
    migration parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware billing invoice/manual-payment repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware billing invoice/manual-payment repository
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the billing
    invoice/manual-payment repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the billing invoice/manual-payment repository extraction docs-aware
    validation evidence.
- `pnpm docs:check`
  - Passed after adding the billing invoice/manual-payment repository extraction docs-aware
    validation evidence.
- `pnpm policy:check`
  - Passed after adding the billing invoice/manual-payment repository extraction docs-aware
    validation evidence; tracked-secret scan, package manifest dependency policy, migration parity,
    OSS reuse policy, docs links, proof index, local evidence Docker ignore validation, and Open
    Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the billing invoice/manual-payment repository extraction closeout: 304 actual
    changed paths, 304 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the billing invoice/manual-payment repository extraction closeout; no whitespace
    errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/intake-forms-contracts.ts packages/database/src/repository/intake-forms/drizzle.ts packages/database/src/repository/intake-forms/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the intake form/session/link/review/action/snapshot/proposal repository capability and
    implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/intake-forms-contracts.ts packages/database/src/repository/intake-forms/drizzle.ts packages/database/src/repository/intake-forms/memory.ts`
  - Normalized the aggregate repository files plus the new intake-forms contract and Drizzle/memory
    helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the intake-forms repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the intake-forms repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the intake-forms repository implementation extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated intake form/session/
    link/review/action/snapshot/proposal behavior to `packages/database/src/repository/intake-forms/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the intake-forms repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the intake-forms repository implementation extraction,
    confirming staff/public intake API consumers still reach intake forms through the unchanged
    repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/intake-forms-contracts.ts packages/database/src/repository/intake-forms/drizzle.ts packages/database/src/repository/intake-forms/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the intake-forms repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware intake-forms repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware intake-forms repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the intake-forms repository extraction in the proof note, validation
    index, and workboard row.
- `pnpm policy:check`
  - Passed after the docs-aware intake-forms repository extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware intake-forms repository extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware intake-forms repository extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware intake-forms repository extraction update; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware intake-forms repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware intake-forms repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware intake-forms repository extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the intake-forms
    repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the intake-forms repository extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the intake-forms repository extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the intake-forms repository extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the intake-forms repository extraction closeout: 307 actual changed paths, 307
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the intake-forms repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-core-contracts.ts packages/database/src/repository/ledger-core/drizzle.ts packages/database/src/repository/ledger-core/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the ledger core repository capability and implementation extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-core-contracts.ts packages/database/src/repository/ledger-core/drizzle.ts packages/database/src/repository/ledger-core/memory.ts`
  - Normalized the aggregate repository files plus the new ledger core contract and
    Drizzle/memory helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the ledger core repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the ledger core repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the ledger core repository implementation extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated ledger read, scope
    validation, idempotent posting, and trust-balance guard behavior to
    `packages/database/src/repository/ledger-core/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the ledger core repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the ledger core repository implementation extraction,
    confirming ledger, billing, reporting, and client-facing API consumers still reach ledger core
    behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/ledger-core-contracts.ts packages/database/src/repository/ledger-core/drizzle.ts packages/database/src/repository/ledger-core/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the ledger core repository extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware ledger core repository extraction update.
- `pnpm format:check`
  - Passed after the docs-aware ledger core repository extraction update.
- `pnpm docs:check`
  - Passed after documenting the ledger core repository extraction in the proof note, validation
    index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware ledger core repository extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware ledger core repository extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware ledger core repository extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware ledger core repository extraction update; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware ledger core repository extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware ledger core repository extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware ledger core repository extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the ledger core
    repository extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the ledger core repository extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the ledger core repository extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the ledger core repository extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the ledger core repository extraction closeout: 310 actual changed paths, 310
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the ledger core repository extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/setup/drizzle.ts packages/database/src/repository/setup/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the first-run setup Drizzle/memory helper extraction behind the existing setup repository
    contract.
- `pnpm prettier --write packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/setup/drizzle.ts packages/database/src/repository/setup/memory.ts`
  - Normalized the aggregate repository files plus the new setup Drizzle/memory helpers.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the setup repository implementation extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the setup repository implementation extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the setup repository implementation extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated setup status,
    configured-firm resolution, setup completion, auth-account creation, preset-template seeding,
    optional first matter/contact seeding, WebAuthn credential seeding, and audit-event insertion
    to `packages/database/src/repository/setup/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the setup repository implementation extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the setup repository implementation extraction, confirming
    setup, auth, inbound-email configured-firm resolution, and server bootstrap consumers still
    reach setup behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/setup/drizzle.ts packages/database/src/repository/setup/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the setup repository helper extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware setup repository helper extraction update.
- `pnpm format:check`
  - Passed after the docs-aware setup repository helper extraction update.
- `pnpm docs:check`
  - Passed after documenting the setup repository helper extraction in the proof note, validation
    index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware setup repository helper extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware setup repository helper extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware setup repository helper extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware setup repository helper extraction update; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware setup repository helper extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware setup repository helper extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware setup repository helper extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the setup
    repository helper extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the setup repository helper extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the setup repository helper extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the setup repository helper extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the setup repository helper extraction closeout: 312 actual changed paths, 312
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the setup repository helper extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts packages/database/src/repository/matter-workspace-contracts.ts packages/database/src/repository/matter-workspace/drizzle.ts packages/database/src/repository/matter-workspace/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the matter workspace read-model repository capability and Drizzle/memory helper extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts packages/database/src/repository/matter-workspace-contracts.ts packages/database/src/repository/matter-workspace/drizzle.ts packages/database/src/repository/matter-workspace/memory.ts`
  - Normalized the aggregate repository files, contact helper imports, and new matter workspace
    contract plus Drizzle/memory helper modules.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the matter workspace read-model repository extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the matter workspace read-model repository extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the matter workspace read-model repository extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated overview and
    visible-matter summary loading to `packages/database/src/repository/matter-workspace/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the matter workspace read-model repository extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the matter workspace read-model repository extraction,
    confirming API consumers still reach overview and matter summary behavior through the unchanged
    repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/contacts/drizzle.ts packages/database/src/repository/contacts/memory.ts packages/database/src/repository/matter-workspace-contracts.ts packages/database/src/repository/matter-workspace/drizzle.ts packages/database/src/repository/matter-workspace/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the matter workspace read-model extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware matter workspace read-model extraction update.
- `pnpm format:check`
  - Passed after the docs-aware matter workspace read-model extraction update.
- `pnpm docs:check`
  - Passed after documenting the matter workspace read-model extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware matter workspace read-model extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware matter workspace read-model extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware matter workspace read-model extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware matter workspace read-model extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware matter workspace read-model extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware matter workspace read-model extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware matter workspace read-model extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the matter
    workspace read-model extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the matter workspace read-model extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the matter workspace read-model extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the matter workspace read-model extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the matter workspace read-model extraction closeout: 315 actual changed paths, 315
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the matter workspace read-model extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/matter-lifecycle-contracts.ts packages/database/src/repository/matter-lifecycle/drizzle.ts packages/database/src/repository/matter-lifecycle/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the matter lifecycle write-path repository capability and Drizzle/memory helper extraction.
- `pnpm prettier --write packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/matter-lifecycle-contracts.ts packages/database/src/repository/matter-lifecycle/drizzle.ts packages/database/src/repository/matter-lifecycle/memory.ts`
  - Normalized the aggregate repository files and new matter lifecycle contract plus
    Drizzle/memory helper modules.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the matter lifecycle write-path repository extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the matter lifecycle write-path repository extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the matter lifecycle write-path repository extraction; migration parity stayed at
    52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes delegated create/convert write
    paths to `packages/database/src/repository/matter-lifecycle/`.
- `pnpm --filter @open-practice/database build`
  - Passed after the matter lifecycle write-path repository extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the matter lifecycle write-path repository extraction,
    confirming API consumers still reach create/convert behavior through the unchanged repository
    facade.
- `pnpm verify:select -- --files packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/matter-lifecycle-contracts.ts packages/database/src/repository/matter-lifecycle/drizzle.ts packages/database/src/repository/matter-lifecycle/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the matter lifecycle write-path extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware matter lifecycle write-path extraction update.
- `pnpm format:check`
  - Passed after the docs-aware matter lifecycle write-path extraction update.
- `pnpm docs:check`
  - Passed after documenting the matter lifecycle write-path extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware matter lifecycle write-path extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware matter lifecycle write-path extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware matter lifecycle write-path extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware matter lifecycle write-path extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware matter lifecycle write-path extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware matter lifecycle write-path extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware matter lifecycle write-path extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the matter
    lifecycle write-path extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the matter lifecycle write-path extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the matter lifecycle write-path extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the matter lifecycle write-path extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the matter lifecycle write-path extraction closeout: 318 actual changed paths, 318
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the matter lifecycle write-path extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/mappers.ts packages/database/src/repository/matter-lifecycle/drizzle.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the public-consultation intake Drizzle mapper extraction.
- `pnpm prettier --write packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/mappers.ts packages/database/src/repository/matter-lifecycle/drizzle.ts`
  - Normalized the mapper barrel re-export, public-consultation Drizzle helper import, new
    feature-owned mapper module, and matter lifecycle mapper import.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the public-consultation intake Drizzle mapper extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the public-consultation intake Drizzle mapper extraction; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the public-consultation intake Drizzle mapper extraction; migration parity stayed
    at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the public-consultation intake Drizzle mapper extraction.
- `pnpm --filter @open-practice/database build`
  - Passed after the public-consultation intake Drizzle mapper extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the public-consultation intake Drizzle mapper extraction.
- `pnpm verify:select -- --files packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/public-consultation-intakes/drizzle.ts packages/database/src/repository/public-consultation-intakes/mappers.ts packages/database/src/repository/matter-lifecycle/drizzle.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the public-consultation intake Drizzle mapper extraction proof/index/workboard update.
- `pnpm prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware public-consultation intake Drizzle mapper extraction update.
- `pnpm format:check`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update.
- `pnpm docs:check`
  - Passed after documenting the public-consultation intake Drizzle mapper extraction in the proof
    note, validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware public-consultation intake Drizzle mapper
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update;
    migration parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware public-consultation intake Drizzle mapper extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware public-consultation intake Drizzle mapper
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    public-consultation intake Drizzle mapper extraction docs-only proof closeout.
- `pnpm format:check`
  - Passed after adding the public-consultation intake Drizzle mapper extraction docs-aware
    validation evidence.
- `pnpm docs:check`
  - Passed after adding the public-consultation intake Drizzle mapper extraction docs-aware
    validation evidence.
- `pnpm policy:check`
  - Passed after adding the public-consultation intake Drizzle mapper extraction docs-aware
    validation evidence; tracked-secret scan, package manifest dependency policy, migration parity,
    OSS reuse policy, docs links, proof index, local evidence Docker ignore validation, and Open
    Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the public-consultation intake Drizzle mapper extraction closeout: 319 actual
    changed paths, 319 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the public-consultation intake Drizzle mapper extraction closeout; no whitespace
    errors.
- `pnpm verify:select -- --files packages/database/src/repository/connectors/drizzle.ts packages/database/src/repository/connectors/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the connector repository facade extraction.
- `pnpm exec prettier --write packages/database/src/repository/connectors/drizzle.ts packages/database/src/repository/connectors/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Normalized the connector-owned Drizzle/memory facade factories and aggregate repository typed
    facade assignments.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the connector repository facade extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the connector repository facade extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the connector repository facade extraction; migration parity stayed at 52 SQL files
    and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes adopted typed connector facade
    assignment.
- `pnpm --filter @open-practice/database build`
  - Passed after the connector repository facade extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the connector repository facade extraction, confirming API
    consumers still reach connector, outbox, delivery-attempt, integration app, credential, and
    webhook-subscription behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/connectors/drizzle.ts packages/database/src/repository/connectors/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the connector repository facade extraction proof/index/workboard update.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware connector repository facade extraction update.
- `pnpm format:check`
  - Passed after the docs-aware connector repository facade extraction update.
- `pnpm docs:check`
  - Passed after documenting the connector repository facade extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware connector repository facade extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware connector repository facade extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware connector repository facade extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware connector repository facade extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware connector repository facade extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware connector repository facade extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware connector repository facade extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the connector
    repository facade extraction docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only connector repository facade extraction closeout update.
- `pnpm format:check`
  - Passed after adding the connector repository facade extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the connector repository facade extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the connector repository facade extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the connector repository facade extraction closeout: 319 actual changed paths, 319
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the connector repository facade extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the jobs/email repository facade extraction.
- `pnpm exec prettier --write packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Normalized the jobs/email Drizzle/memory facade factories and aggregate repository typed facade
    assignments.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the jobs/email repository facade extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the jobs/email repository facade extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the jobs/email repository facade extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes adopted typed jobs/email
    facade assignment.
- `pnpm --filter @open-practice/database build`
  - Passed after the jobs/email repository facade extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the jobs/email repository facade extraction, confirming
    API consumers still reach job lifecycle, email outbox, email event, and email receipt-token
    behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/jobs-email/drizzle.ts packages/database/src/repository/jobs-email/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the jobs/email repository facade extraction proof/index/workboard update.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware jobs/email repository facade extraction update.
- `pnpm format:check`
  - Passed after the docs-aware jobs/email repository facade extraction update.
- `pnpm docs:check`
  - Passed after documenting the jobs/email repository facade extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware jobs/email repository facade extraction update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware jobs/email repository facade extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware jobs/email repository facade extraction update; Drizzle reported the
    schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware jobs/email repository facade extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware jobs/email repository facade extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware jobs/email repository facade extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware jobs/email repository facade extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the jobs/email
    repository facade extraction docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only jobs/email repository facade extraction closeout update.
- `pnpm format:check`
  - Passed after adding the jobs/email repository facade extraction docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the jobs/email repository facade extraction docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the jobs/email repository facade extraction docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the jobs/email repository facade extraction closeout: 319 actual changed paths, 319
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the jobs/email repository facade extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/provider-settings/drizzle.ts packages/database/src/repository/provider-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the provider-settings repository facade extraction.
- `pnpm exec prettier --write packages/database/src/repository/provider-settings/drizzle.ts packages/database/src/repository/provider-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Normalized the provider-settings Drizzle/memory facade factories and aggregate repository typed
    facade assignments.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the provider-settings repository facade extraction.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the provider-settings repository facade extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the provider-settings repository facade extraction; migration parity stayed at 52
    SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes adopted typed
    provider-settings facade assignment.
- `pnpm --filter @open-practice/database build`
  - Passed after the provider-settings repository facade extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the provider-settings repository facade extraction,
    confirming API consumers still reach encrypted provider settings list/upsert behavior through
    the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/provider-settings/drizzle.ts packages/database/src/repository/provider-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the provider-settings repository facade extraction proof/index/workboard update.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware provider-settings repository facade extraction update.
- `pnpm format:check`
  - Passed after the docs-aware provider-settings repository facade extraction update.
- `pnpm docs:check`
  - Passed after documenting the provider-settings repository facade extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware provider-settings repository facade extraction update;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware provider-settings repository facade
    extraction update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware provider-settings repository facade extraction update; Drizzle
    reported the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware provider-settings repository facade extraction update; migration
    parity stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware provider-settings repository facade extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware provider-settings repository facade extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware provider-settings repository facade
    extraction update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    provider-settings repository facade extraction docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only provider-settings repository facade extraction closeout update.
- `pnpm format:check`
  - Passed after adding the provider-settings repository facade extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the provider-settings repository facade extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the provider-settings repository facade extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the provider-settings repository facade extraction closeout: 319 actual changed
    paths, 319 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the provider-settings repository facade extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Selected `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test` for
    the firm-settings repository facade extraction.
- `pnpm exec prettier --write packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts`
  - Normalized the firm-settings Drizzle/memory facade factories and aggregate repository typed
    facade assignments.
- `pnpm --filter @open-practice/database test`
  - Initial run caught a stale memory facade array capture in first-run setup; after switching the
    memory facade to read the current settings array lazily, passed 18 files and 110 tests.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the firm-settings repository facade extraction; Drizzle reported the schema
    configuration was valid.
- `pnpm migrations:check`
  - Passed after the firm-settings repository facade extraction; migration parity stayed at 52 SQL
    files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the aggregate Drizzle and memory repository classes adopted typed firm-settings
    facade assignment.
- `pnpm --filter @open-practice/database build`
  - Passed after the firm-settings repository facade extraction.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the firm-settings repository facade extraction, confirming
    API consumers still reach firm settings lookup behavior through the unchanged repository facade.
- `pnpm verify:select -- --files packages/database/src/repository/firm-settings/drizzle.ts packages/database/src/repository/firm-settings/memory.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm --filter @open-practice/database test`,
    `pnpm --filter @open-practice/database db:check`, `pnpm migrations:check`,
    `pnpm --filter @open-practice/database typecheck`,
    `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/api test`
    after the firm-settings repository facade extraction proof/index/workboard update.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-aware firm-settings repository facade extraction update.
- `pnpm format:check`
  - Passed after the docs-aware firm-settings repository facade extraction update.
- `pnpm docs:check`
  - Passed after documenting the firm-settings repository facade extraction in the proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware firm-settings repository facade extraction update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/database test`
  - Passed: 18 files and 110 tests after the docs-aware firm-settings repository facade extraction
    update.
- `pnpm --filter @open-practice/database db:check`
  - Passed after the docs-aware firm-settings repository facade extraction update; Drizzle reported
    the schema configuration was valid.
- `pnpm migrations:check`
  - Passed after the docs-aware firm-settings repository facade extraction update; migration parity
    stayed at 52 SQL files and 52 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed after the docs-aware firm-settings repository facade extraction update.
- `pnpm --filter @open-practice/database build`
  - Passed after the docs-aware firm-settings repository facade extraction update.
- `pnpm --filter @open-practice/api test`
  - Passed: 41 files and 499 tests after the docs-aware firm-settings repository facade extraction
    update.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the firm-settings
    repository facade extraction docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only firm-settings repository facade extraction closeout update.
- `pnpm format:check`
  - Passed after adding the firm-settings repository facade extraction docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the firm-settings repository facade extraction docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the firm-settings repository facade extraction docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the firm-settings repository facade extraction closeout: 319 actual changed paths,
    319 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the firm-settings repository facade extraction closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/status.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the email provider-status route submodule
    extraction.
- `pnpm exec prettier --write apps/api/src/routes/email.ts apps/api/src/routes/email/status.ts scripts/validate-open-practice-boundaries.mjs`
  - Confirmed the email status split and boundary registry update were already normalized.
- `pnpm --filter @open-practice/api typecheck`
  - Initial validation before the parent compatibility re-export failed because
    `apps/api/src/routes/providers-status.ts` still imports `buildEmailStatus` from
    `apps/api/src/routes/email.ts`. Keeping `export { buildEmailStatus } from "./email/status.js";`
    in the parent registrar restored that internal compatibility surface; the rerun passed.
- `pnpm --filter @open-practice/api test`
  - Initial validation before the parent compatibility re-export produced provider-status 500
    regressions. After restoring the `buildEmailStatus` re-export, passed: 41 files and 499 tests,
    including email/provider-status coverage for disabled/configured status and access behavior.
- `pnpm policy:check`
  - Passed after the email provider-status route submodule extraction; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the email provider-status route submodule extraction: 9 Turbo test/build tasks
    succeeded, including API `src/routes/email.test.ts` and `src/routes/providers-status.test.ts`,
    plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/email.ts apps/api/src/routes/email/status.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the docs-aware email provider-status route split proof/index/workboard update.
- `pnpm format:check`
  - Passed after synchronizing the email provider-status route split proof note, validation index,
    and workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the email provider-status route split proof note, validation index,
    and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware email provider-status route split update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware email provider-status route split update.
- `pnpm --filter @open-practice/api test`
  - Passed after the docs-aware email provider-status route split update: 41 files and 499 tests.
- `pnpm test`
  - Passed after the docs-aware email provider-status route split update: 9 Turbo test/build tasks
    succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the email
    provider-status route split docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only email provider-status route split closeout update.
- `pnpm format:check`
  - Passed after adding the email provider-status route split docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the email provider-status route split docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the email provider-status route split docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the email provider-status route split closeout: 320 actual changed paths, 320
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the email provider-status route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/payment-requests.ts apps/api/src/routes/billing/trust-transfer-requests.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the hosted payment request and billing
    trust-transfer route submodule extraction.
- `pnpm exec prettier --write apps/api/src/routes/billing.ts apps/api/src/routes/billing/payment-requests.ts apps/api/src/routes/billing/trust-transfer-requests.ts scripts/validate-open-practice-boundaries.mjs`
  - Normalized the billing payment/trust-transfer submodule extraction and boundary registry
    update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting hosted payment request and billing trust-transfer routes behind
    registrar-owned submodules.
- `pnpm --filter @open-practice/api test`
  - Passed after extracting hosted payment request and billing trust-transfer routes: 41 files and
    499 tests, including billing payment request, trust-transfer approval/linking, and audit
    regression coverage.
- `pnpm policy:check`
  - Passed after the billing payment/trust-transfer route submodule extraction; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the billing payment/trust-transfer route submodule extraction: 9 Turbo test/build
    tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/billing.ts apps/api/src/routes/billing/payment-requests.ts apps/api/src/routes/billing/trust-transfer-requests.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the docs-aware billing payment/trust-transfer route split proof/index/workboard update.
- `pnpm format:check`
  - Passed after synchronizing the billing payment/trust-transfer route split proof note,
    validation index, and workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the billing payment/trust-transfer route split proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware billing payment/trust-transfer route split update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware billing payment/trust-transfer route split update.
- `pnpm --filter @open-practice/api test`
  - Passed after the docs-aware billing payment/trust-transfer route split update: 41 files and 499
    tests.
- `pnpm test`
  - Passed after the docs-aware billing payment/trust-transfer route split update: 9 Turbo
    test/build tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the billing
    payment/trust-transfer route split docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the docs-only billing payment/trust-transfer route split closeout update.
- `pnpm format:check`
  - Passed after adding the billing payment/trust-transfer route split docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the billing payment/trust-transfer route split docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the billing payment/trust-transfer route split docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the billing payment/trust-transfer route split closeout: 322 actual changed paths,
    322 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the billing payment/trust-transfer route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/external-uploads.ts apps/api/src/routes/external-uploads/staff.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the staff external-upload route submodule
    extraction.
- `pnpm exec prettier --write apps/api/src/routes/external-uploads.ts apps/api/src/routes/external-uploads/staff.ts scripts/validate-open-practice-boundaries.mjs`
  - Normalized the staff external-upload submodule extraction and boundary registry update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting staff external-upload routes behind a registrar-owned staff submodule.
- `pnpm --filter @open-practice/api test`
  - Passed after extracting staff external-upload routes: 41 files and 499 tests, including
    external-upload status/list/create/revoke/review, token-signing, notification, and audit
    coverage.
- `pnpm policy:check`
  - Passed after the staff external-upload route submodule extraction; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the staff external-upload route submodule extraction: 9 Turbo test/build tasks
    succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/external-uploads.ts apps/api/src/routes/external-uploads/staff.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the docs-aware staff external-upload route split proof/index/workboard update.
- `pnpm format:check`
  - Passed after synchronizing the staff external-upload route split proof note, validation index,
    and workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the staff external-upload route split proof note, validation index,
    and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware staff external-upload route split update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware staff external-upload route split update.
- `pnpm --filter @open-practice/api test`
  - Passed after the docs-aware staff external-upload route split update: 41 files and 499 tests.
- `pnpm test`
  - Passed after the docs-aware staff external-upload route split update: 9 Turbo test/build tasks
    succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the staff
    external-upload route split docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Confirmed the docs-only staff external-upload route split closeout update was already
    normalized.
- `pnpm format:check`
  - Passed after adding the staff external-upload route split docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the staff external-upload route split docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the staff external-upload route split docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the staff external-upload route split closeout: 323 actual changed paths, 323
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the staff external-upload route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/client-portal.ts apps/api/src/routes/client-portal/accounts.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the staff client-portal account route
    submodule extraction.
- `pnpm exec prettier --write apps/api/src/routes/client-portal.ts apps/api/src/routes/client-portal/accounts.ts scripts/validate-open-practice-boundaries.mjs`
  - Normalized the client-portal account submodule extraction and boundary registry update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting staff client-portal account setup behind a registrar-owned account
    submodule.
- `pnpm --filter @open-practice/api test`
  - Passed after extracting staff client-portal account setup: 41 files and 499 tests, including
    client-portal account setup and workspace coverage.
- `pnpm policy:check`
  - Passed after the staff client-portal account route submodule extraction; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the staff client-portal account route submodule extraction: 9 Turbo test/build
    tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/client-portal.ts apps/api/src/routes/client-portal/accounts.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the docs-aware staff client-portal account route split proof/index/workboard update.
- `pnpm format:check`
  - Passed after synchronizing the staff client-portal account route split proof note, validation
    index, and workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the staff client-portal account route split proof note, validation
    index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware staff client-portal account route split update; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index,
    local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware staff client-portal account route split update.
- `pnpm --filter @open-practice/api test`
  - Passed after the docs-aware staff client-portal account route split update: 41 files and 499
    tests.
- `pnpm test`
  - Passed after the docs-aware staff client-portal account route split update: 9 Turbo test/build
    tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the staff
    client-portal account route split docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Confirmed the docs-only staff client-portal account route split closeout update was already
    normalized.
- `pnpm format:check`
  - Passed after adding the staff client-portal account route split docs-aware validation evidence.
- `pnpm docs:check`
  - Passed after adding the staff client-portal account route split docs-aware validation evidence.
- `pnpm policy:check`
  - Passed after adding the staff client-portal account route split docs-aware validation evidence;
    tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse policy,
    docs links, proof index, local evidence Docker ignore validation, and Open Practice boundary
    policy all passed.
- Proof-vs-diff equality check
  - Passed after the staff client-portal account route split closeout: 324 actual changed paths, 324
    proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the staff client-portal account route split closeout; no whitespace errors.
- `pnpm verify:select -- --files apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads/shared.ts apps/api/src/routes/conversation-threads/lifecycle.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, `pnpm --filter @open-practice/api test`, and
    `pnpm --filter @open-practice/api typecheck` for the conversation-thread lifecycle route
    submodule extraction.
- `pnpm exec prettier --write apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads/shared.ts apps/api/src/routes/conversation-threads/lifecycle.ts scripts/validate-open-practice-boundaries.mjs`
  - Normalized the lifecycle submodule extraction, shared helper movement, and boundary registry
    update.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after extracting conversation-thread lifecycle handling behind a registrar-owned
    lifecycle submodule.
- `pnpm --filter @open-practice/api test`
  - Passed after extracting conversation-thread lifecycle handling: 41 files and 499 tests,
    including conversation-thread lifecycle/export/list/message coverage.
- `pnpm policy:check`
  - Passed after the conversation-thread lifecycle route submodule extraction; tracked-secret scan,
    package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the conversation-thread lifecycle route submodule extraction: 9 Turbo test/build
    tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files apps/api/src/routes/conversation-threads.ts apps/api/src/routes/conversation-threads/shared.ts apps/api/src/routes/conversation-threads/lifecycle.ts scripts/validate-open-practice-boundaries.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
    `pnpm --filter @open-practice/api test`, and `pnpm --filter @open-practice/api typecheck` for
    the docs-aware conversation-thread lifecycle route split proof/index/workboard update.
- `pnpm format:check`
  - Passed after synchronizing the conversation-thread lifecycle route split proof note,
    validation index, and workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the conversation-thread lifecycle route split proof note,
    validation index, and workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware conversation-thread lifecycle route split update; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links,
    proof index, local evidence Docker ignore validation, and Open Practice boundary policy all
    passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed after the docs-aware conversation-thread lifecycle route split update.
- `pnpm --filter @open-practice/api test`
  - Passed after the docs-aware conversation-thread lifecycle route split update: 41 files and 499
    tests.
- `pnpm test`
  - Passed after the docs-aware conversation-thread lifecycle route split update: 9 Turbo
    test/build tasks succeeded plus 58 script contract tests.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the
    conversation-thread lifecycle route split docs-only proof closeout.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Confirmed the docs-only conversation-thread lifecycle route split closeout update was already
    normalized.
- `pnpm format:check`
  - Passed after adding the conversation-thread lifecycle route split docs-aware validation
    evidence.
- `pnpm docs:check`
  - Passed after adding the conversation-thread lifecycle route split docs-aware validation
    evidence.
- `pnpm policy:check`
  - Passed after adding the conversation-thread lifecycle route split docs-aware validation
    evidence; tracked-secret scan, package manifest dependency policy, migration parity, OSS reuse
    policy, docs links, proof index, local evidence Docker ignore validation, and Open Practice
    boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the conversation-thread lifecycle route split closeout: 325 actual changed paths,
    325 proof-listed paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the conversation-thread lifecycle route split closeout; no whitespace errors.
- `pnpm verify:select -- --files scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Selected `pnpm policy:check` and `pnpm test` for the child route registrar wiring boundary
    hardening.
- `pnpm exec prettier --write scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Normalized the child route registrar wiring boundary hardening and focused script tests.
- `node --test scripts/validate-open-practice-boundaries.test.mjs`
  - Passed after adding the child registrar wiring checks: 13 tests, including missing parent call,
    missing import, unlisted child route file, and duplicate child route ownership coverage.
- `node scripts/validate-open-practice-boundaries.mjs`
  - Passed after adding the child registrar wiring checks against the real route tree.
- `pnpm policy:check`
  - Passed after the child route registrar wiring boundary hardening; tracked-secret scan, package
    manifest dependency policy, migration parity, OSS reuse policy, docs links, proof index, local
    evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the child route registrar wiring boundary hardening: 9 Turbo test/build tasks
    succeeded plus 60 script contract tests.
- `pnpm verify:select -- --files scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `pnpm test` for the
    docs-aware child route registrar wiring boundary hardening.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md scripts/validate-open-practice-boundaries.mjs scripts/validate-open-practice-boundaries.test.mjs`
  - Confirmed the docs-aware child route registrar wiring hardening files were already normalized.
- `pnpm format:check`
  - Passed after synchronizing the child route registrar wiring proof note, validation index, and
    workboard addendum.
- `pnpm docs:check`
  - Passed after synchronizing the child route registrar wiring proof note, validation index, and
    workboard addendum.
- `pnpm policy:check`
  - Passed after the docs-aware child route registrar wiring boundary hardening; tracked-secret
    scan, package manifest dependency policy, migration parity, OSS reuse policy, docs links, proof
    index, local evidence Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm test`
  - Passed after the docs-aware child route registrar wiring boundary hardening: 9 Turbo test/build
    tasks succeeded plus 60 script contract tests.
- `pnpm --filter @open-practice/database lint`
  - Passed after removing stale aggregate repository imports and scoping the memory store facade
    `no-this-alias` lint exception to the live array getter/setter compatibility pattern.
- `pnpm --filter @open-practice/api lint`
  - Passed after removing a stale external-upload repository type import from the public portal
    route submodule.
- `pnpm verify:select -- --base origin/main`
  - Was a branch-local pre-consolidation selector pass; the final 2026-06-07 consolidation selector
    evidence is recorded below after both OP-MOD branches were merged.
- `pnpm ci:local`
  - Passed on the final modularization path set after lint cleanup; the local CI gate completed
    format, lint, typecheck, package tests, database schema check, policy checks, builds, and
    whitespace validation.
- `pnpm e2e:host`
  - Passed after the modularization closeout: 33 Playwright checks passed and 3 suite-defined checks
    were skipped while sweeping hosted setup/login, dashboard sections, and public-token flows
    against dynamic loopback API/web servers.
- `pnpm e2e:docker`
  - Passed after the modularization closeout: Docker brought up Postgres, Redis, MinIO, and Mailpit,
    applied existing migrations, passed the provider-backed dashboard sweep and external upload
    receipt flow, then removed the E2E containers, volumes, and network.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Confirmed the final local closeout proof, proof index, and workboard updates were already
    normalized.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the final
    docs-only proof closeout.
- `pnpm format:check`
  - Passed after the final local closeout proof update.
- `pnpm docs:check`
  - Passed after the final local closeout proof update.
- `pnpm policy:check`
  - Passed after the final local closeout proof update; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard/intake-section.tsx apps/web/app/dashboard/intake-section.test.tsx packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/repository/auth/drizzle.ts packages/database/src/repository/auth/memory.ts apps/api/src/routes/public-consultation-intakes.ts apps/api/src/routes/public-consultation-intakes/staff.ts scripts/validate-open-practice-boundaries.mjs`
  - Selected `pnpm policy:check`, `pnpm test`, database test/db-check/migration/typecheck/build
    checks, API test/typecheck, web test/typecheck, and `pnpm build` for the combined intake
    section extraction, auth facade extraction, and staff public-consultation route split.
- `pnpm policy:check && pnpm test && pnpm --filter @open-practice/database test && pnpm --filter @open-practice/database db:check && pnpm migrations:check && pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/api test && pnpm --filter @open-practice/api typecheck && pnpm --filter @open-practice/web test && pnpm --filter @open-practice/web typecheck && pnpm build`
  - Passed for the combined intake section extraction, auth facade extraction, and staff
    public-consultation route split. The integrated gate included 60 script tests, 110 database
    tests, 499 API tests, 159 web tests, migration parity, live boundary policy, database schema
    check, package typechecks, and the production build.
- `pnpm ci:local`
  - Passed on the pre-consolidation 328-path OP-MOD-001 tree after the intake dashboard section extraction, auth
    repository facade extraction, staff public-consultation route split, docs proof update, and auth
    Prettier normalization. The local CI gate completed format, lint, typecheck, package tests,
    database schema check, policy checks, builds, and whitespace validation.
- `pnpm e2e:host`
  - Passed on the pre-consolidation 328-path OP-MOD-001 tree: 33 Playwright checks passed and 3 suite-defined
    checks were skipped while sweeping hosted setup/login, dashboard sections, and public-token
    flows against dynamic loopback API/web servers.
- `pnpm e2e:docker`
  - Passed on the pre-consolidation 328-path OP-MOD-001 tree: Docker brought up Postgres, Redis, MinIO, and
    Mailpit, applied existing migrations, passed the provider-backed dashboard sweep and external
    upload receipt flow, then removed the E2E containers, volumes, and network.
- `pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md`
  - Normalized the final proof/index/workboard closeout after recording the latest E2E evidence.
- `pnpm verify:select -- --files docs/validation/OP-MOD-001_MODULARIZATION_FOUNDATION_PROOF_2026-06-06.md docs/validation/README.md docs/planning-and-progress.md`
  - Selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the final
    docs-only proof closeout after the latest extraction slices.
- `pnpm format:check`
  - Passed after the final docs-only proof closeout.
- `pnpm docs:check`
  - Passed after the final docs-only proof closeout.
- `pnpm policy:check`
  - Passed after the final docs-only proof closeout; tracked-secret scan, package manifest
    dependency policy, migration parity, OSS reuse policy, docs links, proof index, local evidence
    Docker ignore validation, and Open Practice boundary policy all passed.
- Proof-vs-diff equality check
  - Passed after the final docs-only proof closeout: 330 actual changed paths, 330 proof-listed
    paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the final docs-only proof closeout; no whitespace errors.
- `pnpm verify:select -- --base origin/main`
  - Passed on `chore/op-mainline-consolidation-2026-06-07` after both OP-MOD branches were merged.
    It selected the broad consolidation gate set: `pnpm ci:local`, `pnpm deps:audit`,
    `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
    `pnpm test`, package tests/typechecks/builds for domain, database, API, providers, worker, and
    web, database `db:check`, migration parity, and `pnpm build`.
- `node --test scripts/validate-open-practice-boundaries.test.mjs scripts/select-validation.test.mjs scripts/security-hot-path-rescan.test.mjs`
  - Passed after the integrated branch set updated the hot-path rescan contract for the new
    inbound-email child route modules and the database build selector id: 32 script contract tests.
- `pnpm --filter @open-practice/domain test && pnpm --filter @open-practice/domain typecheck`
  - Passed on the consolidation delta: 24 domain test files and 173 tests.
- `pnpm --filter @open-practice/database test && pnpm --filter @open-practice/database db:check && pnpm migrations:check && pnpm --filter @open-practice/database typecheck && pnpm --filter @open-practice/database build`
  - Passed on the consolidation delta: 18 database test files and 110 tests, Drizzle schema check
    reported everything fine, and migration parity found 52 SQL files matching 52 journal entries.
- `pnpm --filter @open-practice/providers test && pnpm --filter @open-practice/providers typecheck && pnpm --filter @open-practice/providers build`
  - Passed on the consolidation delta: 7 provider test files and 18 tests.
- `pnpm --filter @open-practice/api test && pnpm --filter @open-practice/api typecheck`
  - Passed on the consolidation delta: 41 API test files and 499 tests.
- `pnpm --filter @open-practice/worker test && pnpm --filter @open-practice/worker typecheck && pnpm --filter @open-practice/worker build`
  - Passed on the consolidation delta: 3 worker test files and 36 tests.
- `pnpm --filter @open-practice/web test && pnpm --filter @open-practice/web typecheck`
  - Passed on the consolidation delta: 32 web test files and 163 tests.
- `pnpm build`
  - Passed on the consolidation delta after package typechecks and tests; all six workspace
    packages built, including the Next.js production build.
- `pnpm docs:check`
  - Passed on the consolidation delta.
- `pnpm policy:check`
  - Passed on the consolidation delta; tracked-secret scan, package manifest dependency policy,
    migration parity, OSS reuse policy, docs links, proof index, local evidence Docker ignore
    validation, and Open Practice boundary policy all passed.
- `pnpm deps:audit`
  - Passed on the consolidation delta: production and development audits reported no known
    vulnerabilities.
- `pnpm deps:licenses`
  - Passed on the consolidation delta: 550 packages and 579 versions summarized; existing
    review-required license groups were reported without failing the command.
- `pnpm test`
  - Passed on the consolidation delta; package tests and script contract tests completed through
    Turbo/root test orchestration.
- `pnpm ci:local`
  - Passed on the consolidation delta; format, lint, typecheck, package tests, database schema
    check, policy checks, builds, and whitespace validation completed.
- `pnpm e2e:host`
  - Passed on the consolidation delta: 33 Playwright checks passed and 3 suite-defined checks were
    skipped while sweeping hosted setup/login, dashboard sections, and public-token flows against
    dynamic loopback API/web servers.
- `pnpm e2e:docker`
  - Passed on the consolidation delta: Docker brought up Postgres, Redis, MinIO, and Mailpit,
    applied existing migrations, passed 5 Docker-backed Playwright checks for the provider-backed
    dashboard sweep and external upload receipt flow, then removed the E2E containers, volumes, and
    network.
- Proof-vs-diff equality check
  - Passed after the 2026-06-07 consolidation closeout: 330 actual changed paths, 330 proof-listed
    paths, no missing paths, and no extra paths.
- `git diff --check`
  - Passed after the 2026-06-07 consolidation closeout; no whitespace errors.

## 2026-06-07 Push And Prune Closeout

- `git push origin main`
  - Passed after fast-forwarding local `main` from `ad25b758` to the validated consolidation
    commit `1afa4d85`; `origin/main` advanced to the same commit.
- `git branch --merged main`
  - Listed `chore/op-mainline-consolidation-2026-06-07`,
    `codex/op-modularization-2026-06-06`,
    `codex/op-modularization-2026-06-06-broad-backup-20260607`, and `main`, confirming all local
    OP-MOD branches were contained in final `main`.
- `git branch --no-merged main`
  - Returned no branches.
- `git worktree list --porcelain`
  - Listed only `/Users/bryan/projects/open-practice` on `refs/heads/main`.
- `git ls-remote --heads origin`
  - Advertised only `refs/heads/main` at `1afa4d85` before this docs-only closeout commit.
- `git branch -d chore/op-mainline-consolidation-2026-06-07 codex/op-modularization-2026-06-06 codex/op-modularization-2026-06-06-broad-backup-20260607`
  - Deleted the three proven-merged local branches.
- `git remote prune origin`
  - Passed with no remote topic refs to remove.
- `git worktree prune`
  - Passed with no stale worktree entries to remove.

## Deferred Follow-Up Slices

- Continue splitting large route families behind stable `register*Routes` entrypoints, starting
  with the next large route-family seam beyond the already extracted secure share, billing, ledger,
  draft, connector, conversation-thread export, conversation-thread lifecycle, client-portal
  workspace, client-portal account setup, billing payment request, billing trust-transfer request,
  email status, email
  outbox/preview/retry and public email receipt, public external-upload, staff external-upload,
  public-consultation submission, staff public-consultation settings/review, document-processing,
  calendar, intake-form, inbound-email, communications inbox, and intake generated-document/package
  submodules. The boundary validator can now collect route declarations from registrar-owned
  subfiles.
- Split remaining repository contracts into capability interfaces while keeping
  `OpenPracticeRepository` as the compatibility aggregate beyond the already extracted setup,
  provider-settings, audit, AI operational proposal, legal research artifact, conflict-check,
  connector, jobs/email, inbound-email, legal-clinic, operational-view, portal-access, document,
  document-assembly, draft, task, conversation-thread, signature, contact, intake-template, and
  calendar credential, calendar event, auth, firm-settings, billing-controls, billing
  entries/time-expense, hosted payment request, billing invoice/manual-payment, intake-forms,
  trust-transfer request, ledger core, ledger review, public consultation intake CRUD/review, and
  matter workspace read-model plus matter lifecycle write-path capabilities.
- Split remaining non-setup/non-provider-settings/non-audit/non-AI-operational-proposal/non-legal-research-artifact/non-contact/non-intake-template/non-intake-forms/non-calendar-credential/non-calendar-event/non-auth/non-firm-settings/non-billing-controls/non-billing-entries/non-hosted-payment-request/non-billing-invoices-payments/non-trust-transfer-request/non-ledger-core/non-ledger-review/non-public-consultation-intake/non-matter-workspace-read-model/non-matter-lifecycle/non-conflict-check/non-connector/non-jobs-email/non-inbound-email/non-legal-clinic/non-operational-view/non-portal-access/non-document/non-document-assembly/non-draft/non-task/non-conversation-thread/non-signature
  Drizzle and memory repository implementations and mappers by domain while preserving existing
  migrations during follow-up extraction waves.
- Split remaining worker processors by queue/job family and centralize queue defaults shared by API
  and worker bootstrap.
- Move remaining `apps/web/app/page.tsx` loading into feature resource modules using the shared
  optional-fetch helper now in `_shared/server-api.ts`, beyond the already extracted connector,
  audit, billing, calendar, document-assembly, operations, external-upload, email-delivery,
  contacts, share-link status, communications, intake, public-consultation, legal-clinic, and
  legal-research resources.
- Reduce `dashboard-client.tsx` to shell composition, active matter/section routing, URL/focus
  behavior, and feature mounting. The next low-risk dashboard slices are additional dashboard
  section/block extraction seams beyond the already extracted document assembly, first-matter,
  calendar, external-upload, share-link, billing, document-processing, trust-controls, and
  signatures, audit, drafting, and intake sections; leave URL/focus/sessionStorage behavior in the
  dashboard shell.
- Continue splitting `apps/web/app/types.ts` into feature model barrels while keeping the temporary
  re-export compatibility surface beyond the already extracted communications, billing/funds,
  document-processing, document-assembly, calendar, external-upload, share-link, contacts, and
  email-delivery barrels.
