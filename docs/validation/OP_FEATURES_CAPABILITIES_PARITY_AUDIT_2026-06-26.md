# Open Practice Features And Capabilities Parity Audit - 2026-06-26

Date: 2026-06-26
Branch: `audit/features-capabilities-parity-20260626`
Base: `main` at `e21cd343`
Status: Final; validation and proof reconciliation passed.

## Scope

This branch records a repo-tracked competitive parity audit for the current Open Practice codebase.
It is documentation/proof only. It does not change runtime behavior, public APIs, route contracts,
TypeScript types, schemas, migrations, package manifests, providers, workers, Docker configuration,
or dependencies.

The audit compares Open Practice's implemented capabilities with current repo evidence, official
public Clio product anchors, and the curated Open Practice reference-repo corpus. The comparison is
clean-room and behavior-level only: no Clio prose, screenshots, UI structure, examples, schemas,
assets, private tenant observations, or source code were copied. No third-party reference source,
schema, migration, UI, test, style, asset, or distinctive expression was copied into Open Practice.

Synthetic data only. No client, matter, credential, payment, private deployment, privileged
document, provider payload, private audit detail, or private source material was added.

## Executive Summary

Open Practice is now broad-category competitive across the core legal-practice suite categories:
matter-centered work management, contacts/CRM, intake, documents, signatures, communications,
client portal actions, billing, trust/accounting review controls, reporting, AI/legal-work review
surfaces, integrations, worker operations, admin readiness, local security, and self-hosting proof.
The current gap shape is not missing category coverage. It is the intentionally bounded nature of
high-risk workflows: live settlement, live bank feeds, provider-backed legal AI/document analysis,
campaign/SMS automation, public booking/native media, certified accounting/compliance claims,
e-filing, native mobile, and enterprise docket/operate-style surfaces remain deferred or
provider-disabled by design.

No new high-confidence candidate row is created by this audit. The existing backlog and planning
docs already classify the remaining meaningful differences as shipped first slices, review-only
depth, provider-disabled boundaries, or explicit watch items.

## Evidence Reviewed

- `git status --short --branch` and `git worktree list --porcelain`: started from a clean single
  root worktree, then branched to `audit/features-capabilities-parity-20260626`.
- `docs/README.md`, `docs/development/repo-guide.md`, `docs/testing/TESTING.md`,
  `docs/planning.md`, `docs/planning-and-progress.md`, `docs/improvement-opportunities.md`, and
  `docs/validation/README.md`.
- `apps/web/routes/routeCatalog.ts`: 18 staff-facing routed sections across workspace, finance,
  operations, and review areas.
- `pnpm api:contract`: generated ignored local evidence with 310 OpenAPI path objects and 364
  operations.
- `scripts/route-authorization-manifest.mjs`: 371 route authorization entries, including 313
  authenticated, 34 token-scoped, 13 basic CalDAV, and 11 public entries.
- Package surfaces in `apps/api/src/routes`, `apps/web/app`, `apps/worker/src/processors`,
  `packages/domain/src`, `packages/database/src/repository`, and `packages/providers/src`.
- Prior parity and completeness proofs, especially
  [OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md](OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md),
  [OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md](OP_CLIO_PARITY_GAP_CLOSURE_PROOF_2026-06-16.md),
  and
  [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md).
- Official public Clio anchors reviewed as current product-category references:
  [Clio Features](https://www.clio.com/features/),
  [Clio Manage](https://www.clio.com/manage/),
  [Clio Grow](https://www.clio.com/grow/),
  [Clio Draft](https://www.clio.com/draft/),
  [Clio Accounting](https://www.clio.com/features/legal-accounting-software/),
  [Clio Work](https://www.clio.com/work/),
  [Manage AI](https://www.clio.com/features/legal-ai-software/),
  [Clio Integrations](https://www.clio.com/features/integrations/), and
  [Clio Developer Documentation](https://docs.developers.clio.com/).
- Central reference metadata from `/Users/bryan/projects/reference-repos/docs/index.json`, selected
  profile files, and Open Practice's [OSS Reuse Decision Matrix](../oss-references.md).

The reference corpus metadata validation command passed when run from the reference repo root:

```text
node scripts/validate-reference-index.mjs --mode=metadata
```

Result: passed with 28 repos checked, 28 profile files found, 28 local clone caches found, 18
source-navigation indexes found, 0 errors, and 9 warnings limited to nonprofit-manager compatibility
aliases.

The same command failed when run from the Open Practice repo root because the validator is
cwd-sensitive and looked for `docs/index.json` in `/Users/bryan/projects/open-practice`; the
successful reference-root invocation above is the recorded audit evidence.

## Capability Matrix

| Capability area                      | Current classification           | Open Practice evidence                                                                                                                                                                                                   | Competitive parity read                                                                                                                                 | Preserved boundary                                                                                                                                                                                |
| ------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matters and cases                    | Shipped                          | Matter setup, lifecycle review/commands, matter timelines, route catalog `matters`, matter-scoped authorization resources, lifecycle proof notes.                                                                        | Core matter-centered practice management is present and used as the container for documents, contacts, tasks, billing, trust, reports, and permissions. | Lifecycle commands are review-gated and status-focused; no automatic cleanup, retention, billing, trust, assignment, or portal side effects beyond explicitly shipped slices.                     |
| Contacts and CRM                     | Shipped                          | Contact dossier/list APIs, relationship and matter-party models, portal grants, duplicate-review cues, contact-history export proof, Full CRM Contacts proof.                                                            | Broad CRM/contact relationship depth is present, including organization/person records and conflict-relevant associations.                              | Duplicate review and exports remain authorized projections; no automatic merge, retained export body, or private note leakage.                                                                    |
| Intake and growth                    | Review-only                      | Intake packages, public form draft/submit/upload/signature routes, source attribution, follow-up cues, staff QA scenarios, immutable publish-version proof.                                                              | Intake capture, package review, source cues, and follow-up posture are covered as safe first slices.                                                    | No automatic matter creation, campaigns, SMS, bulk delivery, ad-spend ingestion, or automatic client contact.                                                                                     |
| Calendar, tasks, and meetings        | Shipped / review-only            | Calendar, CalDAV/iCalendar, reminders, task/deadline review, scheduling request review, guest-session lobby routes, video meeting control-plane proof.                                                                   | Staff scheduling, deadlines, reminders, task review, and guest-session controls are present.                                                            | No public booking rooms, native media, signaling, chat, recordings, automatic event creation, provider sync, or court-rule automation.                                                            |
| Documents, OCR, drafting, and e-sign | Shipped / review-only            | Document APIs, secure shares, external uploads, local PDF/image OCR, document assembly, TipTap drafting, draft exports, embedded signatures, retention/hold review.                                                      | Document storage, exchange, generation, OCR, review metadata, and embedded signing are broad enough for core-suite parity.                              | Provider-backed conversion/annotation/chunking/semantic review stays metadata-only or deferred; no raw OCR/provider payload retention in audit/job/API/proof metadata.                            |
| Communications and client portal     | Shipped / review-only            | Communications inbox, inbound email, outbound email, receipt tokens, client portal workspace, portal accounts, public-token routes, secure share/upload/intake/guest-session flows.                                      | Secure matter-linked communications and client actions are present.                                                                                     | Realtime chat, broad SMS, campaign automation, public document browsing, raw MIME/provider detail exposure, and live delivery from template management remain out of scope.                       |
| Billing, payments, and time          | Review-only                      | Time/expense entries, invoices, payment-request shells, settlement-event review posture, deposit-match review records, manual payment review, billing dashboard.                                                         | Operational billing workflow and client-visible summaries are present as review-first surfaces.                                                         | No live settlement, card vaulting, invoice-balance mutation from provider events, refunds/chargebacks, payment plans, or trust posting automation.                                                |
| Trust, funds, and accounting         | Review-only / shipped controls   | Balanced trust ledger rules, approval/reconciliation controls, statement preview/import metadata, match-rule profiles, financial command journal, trust/report dimensions.                                               | Trust/funds and accounting controls are strong for review-first local operations.                                                                       | No live bank feeds, automatic matching, automatic reconciliation, certified accounting/tax claims, automatic disbursement, or jurisdiction-certified trust-accounting claim.                      |
| Reporting                            | Shipped / review-only            | Reports APIs, saved definitions, export requests, report builder posture, scheduled-readiness metadata, report regeneration worker.                                                                                      | Operational and financial reporting surfaces are present with export/posture controls.                                                                  | No scheduled execution, scheduled email delivery, custom SQL/BI embeds, broad report execution, or raw report body storage.                                                                       |
| AI and legal work                    | Provider-disabled / review-only  | AI operational proposals, draft assist, legal research workspace shell, citation-review job boundary, document analysis status artifacts.                                                                                | AI/legal-work categories are represented as assistive review surfaces rather than provider-backed automation.                                           | No live legal-advice automation, prompt/source storage, provider evidence retention, scraped authority storage, embeddings provider, or downstream source-record mutation without human approval. |
| Integrations and APIs                | Review-only / shipped boundaries | Connector registry/outbox, scoped webhook subscription/replay, outbound webhook guardrails, route authorization manifest, generated API contract, egress provider gates.                                                 | Developer/integration posture exists with scoped app and webhook controls.                                                                              | No public developer OAuth marketplace, broad external API coverage, custom-action execution, raw webhook replay, or provider-specific recovery tools.                                             |
| Worker and provider operations       | Shipped                          | Worker processors for OCR, document assembly, email, inbound polling/parsing, reports, connectors, metadata, and reserved AI triage; provider adapters for SMTP/IMAP/parser/OCR/signatures/draft exports/payments shell. | Operational workers and provider boundaries support the app's current safe automation depth.                                                            | Queue state is not source of truth; unsupported/unconfigured jobs fail closed with redacted metadata.                                                                                             |
| Admin, security, and self-hosting    | Shipped / readiness-gated        | Embedded auth, WebAuthn/MFA/recovery, admin readiness, security review tooling, local-only gates, self-host profile, restore drill, MinIO hardening proof, CSP/CORS hardening.                                           | Stronger than a simple prototype: admin, security, local release, and self-host readiness are visible product/ops surfaces.                             | No SaaS-required production profile, no remote-required gates, no production development-header/JWT auth, and no compliance guarantees beyond proved local posture.                               |
| Validation and release posture       | Shipped                          | `verify:select`, `proof:reconcile`, `ci:local`, security review packets, dependency/license/supply-chain checks, Docker/browser/self-host gates, validation proof index.                                                 | Validation/proof discipline is a product capability for legal-practice trust and maintainability.                                                       | Green claims require actual command evidence; unavailable Docker/browser/scanner lanes must be recorded honestly.                                                                                 |

## Competitive Gap Conclusions

No new backlog row is created. The current competitive differences are already captured as
intentional boundaries or explicit watch items:

- **Native mobile apps:** watch item outside the current core-suite pass.
- **E-filing and court/practice-specific integrations:** watch item; no provider or jurisdiction
  integration is implied.
- **Enterprise Operate/Docket-style surfaces:** watch item outside the core-suite scope.
- **Live payments, bank feeds, SMS/campaigns, public booking, native media, legal research
  providers, embeddings, and provider-backed document semantic review:** intentionally deferred
  until separate implementation scopes prove authorization, redaction, retention, review, and local
  deployment boundaries.
- **Certified accounting, tax, trust-accounting, legal-records, e-signature, retention, law-society,
  or AI/legal-advice claims:** intentionally not made.

The audit does not re-propose OP-T144 through OP-T152. Those first-slice parity rows are already
shipped and indexed in the validation proof set.

## Reference-Reuse Posture

The central reference profiles and Open Practice reuse matrix keep most benchmark systems out of
implementation source:

- Legal practice/case references such as j-lawyer.org and ArkCase are reference-only because of
  AGPL/LGPL risk.
- E-signature references DocuSeal and Documenso are reference-only because of AGPL/additional-term
  posture.
- Document/OCR references paperless-ngx and OpenContracts are reference-only; Papermerge is
  adopt-selectively but still requires a separate reuse decision before any direct reuse.
- Finance references Blnk and Apache Fineract are low-risk adopt-selectively references for
  concepts; LedgerSMB and Kimai remain reference-only.
- OpenFGA, Jitsi, Zulip, Temporal, Cal.diy, and Activepieces can inform architecture or
  adopt-selectively where their profiles allow it, but this audit adds no dependency or copied
  source.

## Final Path Set

Final selector and proof reconciliation use this docs-only changed-path set:

```text
docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md
docs/validation/README.md
```

## Selector Output

```text
$ pnpm verify:select -- --files docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md docs/validation/README.md
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

The requested full local, dependency, Docker, self-host, browser, and proof gates were run in
addition to the selector recommendations.

Final proof reconciliation output:

```text
$ pnpm proof:reconcile -- --proof docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md --files docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md docs/validation/README.md
Validation proof reconciliation:
Paths: 2
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
Result: passed
```

## Validation

| Command                                                                                                                        | Status | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm api:contract`                                                                                                            | Pass   | Generated ignored local evidence with 310 OpenAPI path objects and 364 operations.                                                                           |
| `node scripts/validate-reference-index.mjs --mode=metadata` from `/Users/bryan/projects/reference-repos`                       | Pass   | Checked 28 repos, found 28 profile files, found 28 local clone caches, found 18 source-navigation indexes, 0 errors, and 9 nonprofit-manager alias warnings. |
| `pnpm verify:select -- --files <final path set>`                                                                               | Pass   | Recommended `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.                                                                                 |
| `pnpm ci:local`                                                                                                                | Pass   | First run failed because the new Markdown was not yet formatted; after `pnpm exec prettier --write` on the two docs, rerun passed.                           |
| `pnpm security:review -- --files <final path set>`                                                                             | Pass   | Security review packet written to `.tmp/open-practice-security-review/2026-06-26T21-20-09Z`.                                                                 |
| `pnpm deps:audit`                                                                                                              | Pass   | No known production or development dependency vulnerabilities reported.                                                                                      |
| `pnpm deps:licenses`                                                                                                           | Pass   | Reviewed 557 packages and 584 package versions; no dependency changes in this branch.                                                                        |
| `pnpm deps:supply-chain`                                                                                                       | Pass   | Lockfile policy passed with the existing 5 native-build approval entries.                                                                                    |
| `pnpm migrations:replay`                                                                                                       | Pass   | Initial run failed because local Postgres on `localhost:35432` was not running; rerun passed after starting the repo Postgres service.                       |
| `pnpm docker:lint`                                                                                                             | Pass   | Artifact written to `.tmp/docker/lint/2026-06-26T21-26-40Z`.                                                                                                 |
| `pnpm docker:residual-watch`                                                                                                   | Pass   | Artifact written to `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-26T21-26-49Z`; accepted residual count was 3.                     |
| `pnpm docker:app-smoke`                                                                                                        | Pass   | Docker app smoke verified API health, web root, and web-origin setup status against the disposable stack.                                                    |
| `pnpm docker:scan`                                                                                                             | Pass   | Trivy artifact written to `.tmp/docker/trivy/2026-06-26T21-32-08Z`.                                                                                          |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                      | Pass   | Self-host Compose check passed using the synthetic example env.                                                                                              |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                              | Pass   | Restore drill evidence written to `.tmp/open-practice-selfhost-restore-drill/2026-06-26T21-33-49Z`.                                                          |
| `pnpm e2e:host`                                                                                                                | Pass   | Host browser matrix passed: 36 Playwright checks across Chromium, mobile Chromium, Firefox, and WebKit.                                                      |
| `pnpm e2e:docker`                                                                                                              | Pass   | Docker Chromium suite passed: 3 Playwright checks against disposable Postgres, Redis, MinIO, and Mailpit services.                                           |
| `pnpm e2e:matterless`                                                                                                          | Pass   | Matterless Chromium suite passed: 2 Playwright checks.                                                                                                       |
| `pnpm e2e:client-portal`                                                                                                       | Pass   | Client portal Chromium suite passed: 2 Playwright checks.                                                                                                    |
| `pnpm e2e:a11y`                                                                                                                | Pass   | Accessibility Chromium suite passed: 2 Playwright checks.                                                                                                    |
| `git diff --check`                                                                                                             | Pass   | Whitespace check passed.                                                                                                                                     |
| `pnpm proof:reconcile -- --proof docs/validation/OP_FEATURES_CAPABILITIES_PARITY_AUDIT_2026-06-26.md --files <final path set>` | Pass   | Reconciled the two final paths with the selector recommendations.                                                                                            |

## Checks Not Completed

None. All requested local, dependency, Docker, scanner, self-host, browser, diff, and proof checks
completed on 2026-06-26.

## Boundaries

- No runtime, API, route contract, schema, migration, provider, worker, Docker, dependency, or
  package-manifest change.
- No new candidate backlog row because this audit found no high-confidence gap not already shipped,
  documented as review-only/provider-disabled, or explicitly deferred.
- Clean-room reference posture preserved: source repos remain reference material, and no third-party
  source or distinctive expression entered tracked Open Practice files.
