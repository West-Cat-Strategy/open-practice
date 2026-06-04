# Core-Suite Clio Parity Gap Audit

Date: 2026-06-04 PDT

## Goal And Scope

This audit starts the active goal to achieve practical core-suite parity with Clio for Open Practice.
It refreshes the clean-room gap map after OP-T127 through OP-T143 and creates a candidate backlog for
small, branch-scoped implementation slices. The audit pass itself was docs-only: it changed no
runtime behavior, API contract, schema, dependency, provider integration, or UI surface.

In scope: Clio Manage, Grow, Draft, Accounting, Work, Clients, Payments, and Manage AI, as public
product categories. Out of scope for this core-suite pass: enterprise-only Operate/Docket, native
mobile apps, e-filing, and practice-specific add-ons. Those remain watch items unless a later
planning pass explicitly widens Open Practice's product target.

## Clean-Room Source Posture

Official Clio public pages checked as planning anchors:

- [Clio Manage](https://www.clio.com/manage/)
- [Navigate Clio Manage](https://help.clio.com/hc/en-us/articles/9290390462875-Navigate-Clio-Manage)
- [Clio Manage Matters Overview](https://help.clio.com/hc/en-us/articles/9285920226075-Clio-Manage-Matters-Overview)
- [Clio for Clients: Law Firm Setup](https://help.clio.com/hc/en-us/articles/9043484357147-Clio-for-Clients-Law-Firm-Setup)
- [Clio for Clients: Client Actions](https://help.clio.com/hc/en-us/articles/9156800144283-Clio-for-Clients-Client-Actions)
- [Send Bills for Billing in Clio](https://help.clio.com/hc/en-us/articles/9285343645595-Send-Bills-for-Billing-in-Clio)
- [Manage AI](https://www.clio.com/features/legal-ai-software/)
- [What is Manage AI and How to Access it](https://help.clio.com/hc/en-us/articles/29657814904475-What-is-Manage-AI-and-How-to-Access-it)
- [Understand Clio Work](https://help.clio.com/hc/en-150/articles/48791655710235-Understand-Clio-Work)

These sources were used only for neutral capability planning. No Clio prose, screenshots, UI
structure, schemas, examples, forms, assets, private tenant observations, or code were copied into
Open Practice. Candidate names and slice descriptions are independently authored around existing
Open Practice boundaries.

## Current Coverage

Open Practice already has broad staff-side parity coverage:

- Matter-centered dashboard routing for matters, contacts, funds, billing, documents, research,
  shares, uploads, drafting, calendar, signatures, intake, audit, reports, admin, and queues.
- Matter setup projections, contact dossiers/relationships, intake/source reporting,
  communications channel history, document assembly/signature envelopes, local time and expense
  capture, billing payment-request shells, reporting workspace, integration developer boundary,
  mobile/responsive QA, admin readiness, provider-config encryption, and object-storage SSE
  follow-ups.
- Audit-safe and matter-scoped backend posture across route authorization, portal tokens, job
  metadata redaction, billing/trust caveats, review-only accounting, disabled-by-default AI
  proposals, and staff-only legal research artifacts.

The main parity gap is no longer product-category coverage. The gap is workflow depth: several
surfaces intentionally stop at summary, shell, review-only, or reserved/provider-disabled behavior.

## Candidate Gap Backlog

| ID      | Candidate                                                             | Gap Summary                                                                                                                                            | Must Not Duplicate                                                                                                                                        |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-T144 | Client portal messaging and action workspace V1                       | Expand the logged-in client workspace beyond action summaries toward matter-linked messages, document actions, calendar cues, and bill/payment cues.   | OP-T128 account setup, secure shares, public intake links, external uploads, and broad document access safeguards.                                        |
| OP-T145 | Client-visible bills and payment request workspace V1                 | Add a client-facing read-only bill/payment request surface over existing issued invoice and hosted payment-request records.                            | OP-T135 processor shell, card storage, settlement, refunds, chargebacks, trust posting, and payment-plan enforcement.                                     |
| OP-T146 | Task list and deadline review surface V1                              | Promote task/deadline work from counters and calendar radar into a reviewable staff task list with priorities, assignments, privacy, and matter links. | OP-T131 calendar scheduling requests, court-rule automation, provider sync, and automatic deadline mutation.                                              |
| OP-T147 | Intake follow-up automation and source attribution V1                 | Add review-first follow-up posture for leads/intake sources without automatic conversion, campaigns, SMS delivery, or ad-spend ingestion.              | OP-T119 public consultation intake, OP-T129 pipeline/source reporting, and submitted-intake action descriptors.                                           |
| OP-T148 | Scheduled reporting and report-builder posture V1                     | Add scheduling/readiness metadata and report-builder posture over existing report definitions and export jobs.                                         | OP-T137 saved report definitions, manual exports, custom SQL, BI embeds, scheduled email delivery, and raw report-body storage.                           |
| OP-T149 | Payment settlement webhook and reconciliation review V1               | Plan a safe payment processor webhook/reconciliation review boundary for settlement evidence without changing invoice balances automatically.          | OP-T135 Checkout Session posture, card vaulting, automatic reconciliation, trust posting, refunds, chargebacks, and production processor claims.          |
| OP-T150 | Bank feed import and reconciliation review V1                         | Add metadata-first bank-feed import/reconciliation review posture over operating and trust accounts without automatic matching or ledger posting.      | OP-T104 preview, OP-T107 exception resolutions, OP-T118 import batches, OP-T136 accounting profiles, and certified accounting claims.                     |
| OP-T151 | Legal research provider job boundary with citation review controls V1 | Add a provider/job boundary plan for cited legal-work artifacts while preserving review checkpoints and redacted job/audit metadata.                   | OP-T138 operational proposals, OP-T139 research workspace shell, live legal-advice automation, scraped authority storage, and source-record mutation.     |
| OP-T152 | Scoped developer API enforcement and webhook replay boundary          | Deepen the integration developer boundary with enforceable scope/rate posture and safe replay/recovery review.                                         | OP-T140 app/credential/webhook posture, marketplace behavior, broad model coverage, live payment-link API exposure, and provider-specific recovery tools. |

OP-T144, OP-T145, OP-T146, OP-T147, OP-T148, OP-T149, OP-T150, OP-T151, and OP-T152 shipped their
first implementation slices after this audit. Their row-local proof notes are
[OP-T144 client portal action workspace proof](OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md),
[OP-T145 client billing workspace proof](OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md),
[OP-T146 task/deadline review surface proof](OP-T146_TASK_DEADLINE_REVIEW_SURFACE_PROOF_2026-06-04.md),
[OP-T147 intake follow-up/source attribution proof](OP-T147_INTAKE_FOLLOWUP_SOURCE_ATTRIBUTION_PROOF_2026-06-04.md),
[OP-T148 scheduled reporting/builder posture proof](OP-T148_SCHEDULED_REPORTING_BUILDER_POSTURE_PROOF_2026-06-04.md),
[OP-T149 payment settlement/reconciliation review proof](OP-T149_PAYMENT_SETTLEMENT_RECONCILIATION_REVIEW_PROOF_2026-06-04.md),
[OP-T150 bank-feed reconciliation review proof](OP-T150_BANK_FEED_RECONCILIATION_REVIEW_PROOF_2026-06-04.md),
[OP-T151 legal-research provider job boundary proof](OP-T151_LEGAL_RESEARCH_PROVIDER_JOB_BOUNDARY_PROOF_2026-06-04.md),
and
[OP-T152 scoped developer API/webhook replay proof](OP-T152_SCOPED_DEVELOPER_API_WEBHOOK_REPLAY_PROOF_2026-06-04.md).
No active core-suite parity candidate remains in this audit backlog.

## Prioritization

This core-suite parity pass is now closed for first-slice implementation. OP-T144 was the smallest
coherent first continuation because it built on existing client portal grants, action summaries,
secure shares, public upload/intake
links, billing shells, and communications projections without requiring settlement, realtime chat,
live SMS, or new provider integrations. OP-T145 then deepened the same client workspace with a
read-only billing projection over contact-matched visible invoices and hosted payment-request shell
records without adding checkout, settlement, processor, trust-posting, or invoice-balance mutation
behavior. OP-T146 then added a staff-only task/deadline review projection and Queues dashboard
surface over authorized task deadlines, visible matters, and OP-T131 scheduling request records
without court-rule automation, provider sync, automatic deadline mutation, automatic reminder
changes, queue delivery, automatic time-entry creation, or client-visible deadline views. OP-T147
then deepened the existing staff intake pipeline with derived follow-up review cues, safe
source-label provenance, source-quality counters, and explicit false automation-boundary flags
without automatic matter creation, campaigns, SMS delivery, bulk delivery, ad-spend ingestion,
automatic client contact, live reminder delivery, raw source/interview URLs, request bodies, answer
text, token hashes, appointment titles, or private follow-up reasons. OP-T148 then deepened the
existing staff reporting workspace with derived schedule-readiness, report-builder, and export-job
posture metadata plus Reports dashboard rendering while leaving scheduler tables, scheduled
execution, scheduled email delivery, custom SQL, BI embeds, mutable report-builder execution, raw
report-body storage, broad report execution, and payment/accounting certification out of scope.
OP-T149 then deepened the hosted payment-request shell with authenticated staff-side normalized
settlement-event review posture, bounded audit/evidence metadata, and Billing dashboard review copy
while leaving raw webhook bodies, signing material, public provider webhooks, replay recovery,
manual-payment creation, invoice-balance mutation, reconciliation creation, refund/chargeback
handling, card vaulting, trust posting, and production Stripe claims out of scope. OP-T150 then
deepened the trust controls workspace with metadata-only statement import batch exposure, derived
bank-feed reconciliation review posture, and Funds dashboard rendering while leaving live bank feeds,
provider credentials/payloads, statement rows or evidence storage, automatic matching, automatic
ledger posting, automatic reconciliation, trust disbursement automation, operating account taxonomy
changes, and certified accounting claims out of scope. OP-T151 then deepened the legal research
workspace with a reserved matter-scoped `legal_research_provider_review` job boundary, redacted job
summaries, and citation-review controls while leaving prompts, source text, provider evidence,
scraped authority storage, citation-verification claims, legal-advice automation, client/public
research access, and downstream source-record mutation out of scope. OP-T152 then deepened the
integration developer boundary with explicit app enforcement posture, `webhook.deliver` scope
checks, and app-scoped confirmed replay over existing connector outbox rows while leaving public
developer auth, marketplace behavior, broad external API coverage, live payment-link API exposure,
custom-action execution, raw webhook replay, inbound webhook recovery, and provider-specific
recovery tooling out of scope.

Payments/accounting and legal-work provider rows should stay behind explicit review gates. They
touch high-risk financial or legal-advice-adjacent workflows, so their first slices should add
metadata, review posture, and validation proof before any automatic mutation is considered.

## Validation

Initial validation command selection:

```sh
pnpm verify:select -- --files docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md docs/validation/README.md docs/improvement-opportunities.md docs/planning.md docs/planning-and-progress.md
```

Final validation results for this docs-only slice:

- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `git diff --check`

Formatting note: the first `pnpm format:check` identified Markdown formatting drift in this audit,
`docs/planning-and-progress.md`, and `docs/validation/README.md`; `pnpm exec prettier --write` was
run on the five touched docs files only, then the final checks above passed.
