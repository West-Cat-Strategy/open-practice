# Clio Parity Workflow-Depth Gap Closure Proof

Date: 2026-06-16 PDT

Branch: `audit/clio-parity-gap-closure-2026-06-16`

## Scope

This proof records the final workflow-depth closure pass for the remaining core Clio parity gaps
identified after the earlier safety-first gap closure. It treats Open Practice as broad-category
parity for the core workflow surfaces, not a clone of Clio or an implementation of enterprise-only,
native mobile, SMS, e-filing, live bank-feed, public booking, or external legal AI/citator behavior.

The clean-room comparison sources were public Clio product pages for Features, Manage, CRM,
Documents, Work, Accounting, Reporting, Scheduler, and Legal Aid. No Clio prose, screenshots,
schemas, API examples, UI structure, assets, or private tenant observations were copied.

## Shipped Workflow Closure

- **Document conversion review:** added
  `POST /api/document-processing/documents/:documentId/conversion-review/jobs`, workbench
  `conversionReview` posture, a metadata-only `document_conversion_review` OCR worker path, and
  `document_analysis_status` research artifacts. The worker may read OCR text transiently, but
  durable metadata stores only IDs, counts, lengths, statuses, posture labels,
  `summaryPosture: op_authored_metadata_only`, policy flags, and review state.
- **Scheduling and clinic cadence:** added staff-only matter-scoped scheduling request create/review
  APIs, redacted scheduling audit metadata, repository get/update support, dashboard review
  controls, and legal-clinic cadence follow-up signals that persist through existing
  `operational_view` task sources with `legal_clinic_cadence:<profileId>:<signal>` IDs.
- **CRM retention and exports:** added `retention_hold_review` dossier signals, migration/check
  constraint support, `retentionHoldCueCount`, Contacts UI cues, and optional strict `matterId`
  scoping for synchronous and queued contact-history exports. Matter scoping requires
  `contact:export`, visible matter access, and a contact link to the requested matter.
- **Financial freshness and dimensions:** added firm-wide trust reconciliation freshness rows and
  summary counts, plus derived read-only trust/reporting dimensions for `jurisdiction`,
  `practiceArea`, `clinicProgramId`, and `restrictedFundReviewStatus` in API payloads, exports,
  worker regeneration, and dashboard/report chips.
- **Shared integration:** updated route authorization manifest coverage, API/state-machine docs,
  planning/workboard notes, validation index, and improvement opportunities so the six workflow
  gaps are retired rather than re-proposed as active candidates.
- **Closeout fixes:** made reminder-refresh queue idempotency deterministic by ensuring reminder
  PATCH timestamps are monotonic, and tightened inbound-email tests around raw-storage-key presence
  flags versus actual raw object pointers.

## Boundaries Preserved

- No live settlement, card vaulting, bank-feed connection, automatic reconciliation, SMS, e-filing,
  public scheduling room, media/signaling/chat/recording, native mobile app, external legal-research
  provider, embeddings provider, or legal citator behavior was added.
- No automatic trust posting or trust-transfer settlement behavior was added. Trust/reporting
  dimensions are derived read-only projections, not ledger-dimension tables or posting semantics.
- No raw OCR text, raw converted Markdown, annotation bodies, chunks, embeddings, provider payloads,
  raw storage keys, export bodies, private contact history, raw matched values, client text, tokens,
  credentials, or private evidence is stored in audit/job metadata or proof notes.
- Contact-history exports remain transient/regenerated authorized projections. No retained export
  body, object-storage export artifact, deletion workflow, retention deadline, legal-hold override,
  or jurisdiction-certified retention/accounting claim was added.
- Scheduling requests remain staff-reviewed. Review decisions do not automatically create events,
  tasks, reminders, time entries, provider sync, or public booking rooms.

## Selector Command

Ran with the exact final changed path set:

```sh
paths=($(git diff --name-only --diff-filter=ACMRT) $(git ls-files --others --exclude-standard))
pnpm verify:select -- --files "${paths[@]}"
```

The selector recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation Evidence

Passing local validation:

- `pnpm --dir apps/api exec vitest run src/routes/contacts.test.ts`
- `pnpm --dir apps/api exec vitest run src/routes/document-processing.test.ts src/routes/calendar.test.ts src/routes/contacts.test.ts src/routes/ledger.test.ts src/routes/tasks.test.ts src/routes/reports.test.ts`
- `pnpm --dir apps/web exec vitest run app/dashboard/documents-section.test.tsx app/dashboard/tasks-section.test.tsx app/dashboard/trust-controls-section.test.tsx app/dashboard/reports-section.test.tsx app/dashboard-client.test.ts app/dashboard/billing-section.test.tsx app/_features/dashboard/dashboard-shell-model.test.ts app/_features/email-templates/server-resources.test.ts`
- `pnpm --dir apps/worker exec vitest run src/processors.test.ts src/processors/inbound-email-poll.test.ts`
- `pnpm --dir packages/database exec vitest run test/repository.calendar.test.ts test/repository.contact-dossier.test.ts`
- `pnpm --dir packages/domain exec vitest run src/legal-clinics.test.ts src/tasks.test.ts src/contacts.test.ts src/ledger.test.ts src/reports.test.ts src/audit-taxonomy.test.ts src/permissions.test.ts src/operational-views.test.ts`
- `pnpm --dir apps/api exec tsc --noEmit --pretty false`
- `pnpm --dir apps/web exec tsc --noEmit --pretty false`
- `pnpm --dir apps/worker exec tsc --noEmit --pretty false`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm test`
- `pnpm build`

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm migrations:check`
- `git diff --check`

## Owned Path Set

Final changed path count: 92

- `apps/api/src/routes/audit-events.ts`
- `apps/api/src/routes/auth.test.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/calendar.test.ts`
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/routes/calendar/reminders.ts`
- `apps/api/src/routes/contacts.test.ts`
- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing/queue.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/document-processing/workbench.ts`
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/inbound-email/mailgun-raw-mime.ts`
- `apps/api/src/routes/inbound-email/parser-jobs.ts`
- `apps/api/src/routes/ledger.test.ts`
- `apps/api/src/routes/ledger/read.ts`
- `apps/api/src/routes/ledger/reports.ts`
- `apps/api/src/routes/matters.test.ts`
- `apps/api/src/routes/mfa.test.ts`
- `apps/api/src/routes/recovery.ts`
- `apps/api/src/routes/reports.test.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/routes/webauthn.test.ts`
- `apps/api/src/routes/webauthn.ts`
- `apps/web/app/_features/billing/models.ts`
- `apps/web/app/_features/contacts/models.ts`
- `apps/web/app/_features/contacts/server-resources.ts`
- `apps/web/app/_features/dashboard/dashboard-shell-model.test.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/_features/email-templates/server-resources.test.ts`
- `apps/web/app/_features/email-templates/server-resources.ts`
- `apps/web/app/contact-dossiers-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/billing-section.test.tsx`
- `apps/web/app/dashboard/billing-section.tsx`
- `apps/web/app/dashboard/contacts-section.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `apps/web/app/dashboard/reports-section.test.tsx`
- `apps/web/app/dashboard/reports-section.tsx`
- `apps/web/app/dashboard/tasks-section.test.tsx`
- `apps/web/app/dashboard/trust-controls-section.test.tsx`
- `apps/web/app/dashboard/trust-controls-section.tsx`
- `apps/web/app/document-processing-dashboard.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/trust-controls-dashboard.ts`
- `apps/web/app/types.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/processors/inbound-email-poll.test.ts`
- `apps/worker/src/processors/inbound-email-poll.ts`
- `apps/worker/src/processors/ocr.ts`
- `apps/worker/src/processors/reports.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md`
- `docs/validation/README.md`
- `packages/database/migrations/0063_contact_retention_hold_review_signal.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/calendar-events-contracts.ts`
- `packages/database/src/repository/calendar-events/drizzle.ts`
- `packages/database/src/repository/calendar-events/memory.ts`
- `packages/database/src/repository/conflict-checks/drizzle.ts`
- `packages/database/src/repository/conflict-checks/memory.ts`
- `packages/database/src/repository/contacts/drizzle.ts`
- `packages/database/src/repository/contacts/memory.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/schema/contacts.ts`
- `packages/database/test/repository.calendar.test.ts`
- `packages/database/test/repository.contact-dossier.test.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/contacts.test.ts`
- `packages/domain/src/contacts.ts`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/ledger.ts`
- `packages/domain/src/legal-clinics.test.ts`
- `packages/domain/src/legal-clinics.ts`
- `packages/domain/src/operational-views.test.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/reports.test.ts`
- `packages/domain/src/reports.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/route-authorization-manifest.mjs`
