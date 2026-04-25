# Improvement Opportunities

Open Practice now has a focused Apache-2.0 core with a TypeScript domain package, Fastify API, Drizzle/PostgreSQL schema and repository boundaries, S3 upload intent and upload-completion handling, dev/JWT authentication hooks, and early trust/funds, conflict, audit, permission, signature, intake, and generated-document logic.

This document turns the reuse matrix into remaining opportunities without copying code from copyleft or source-available references. Use `docs/planning.md` for the durable roadmap and `docs/planning-and-progress.md` for the live workboard.

## Current State

- `packages/domain` contains provider-neutral legal rules for conflict checks, matter-scoped RBAC, audit hash chains, trust/funds ledger posting, reversals, idempotency, and signature/automation contracts.
- `packages/providers` contains concrete optional-service adapters for DocuSeal and docassemble-style automation; `packages/domain` should stay free of HTTP provider logic.
- `apps/api` handles auth, access checks, repository injection, S3 presigning, upload completion, and routes for session, capabilities, overview, matters, conflicts, ledger, audit, documents, signatures, intake sessions, and generated documents.
- `packages/database` defines the PostgreSQL schema, migrations, seed/runtime support, and repository interfaces and implementations for persistent and in-memory operation.
- The web app is an API-backed operational dashboard; sample data remains intentional for tests, seed data, and in-memory development paths.
- Signature request persistence, signer rows, provider events, webhook attempts, intake templates/sessions, generated-document records, upload completion, and reuse-policy validation are now present in the codebase.
- `.references/oss/` remains ignored; docs, manifests, and lockfiles are the only tracked artifacts from OSS research.

## Remaining Opportunities

1. **Harden provider lifecycles.**
   Keep DocuSeal/docassemble HTTP adapters in `packages/providers`; expose only provider-neutral DTOs and status transitions from `packages/domain`; add explicit webhook verification, replay protection, event ordering, provider-error handling, and reconciliation semantics.

2. **Complete guided intake and document automation.**
   Use docassemble as the optional automation service/reference. Store and expose answer snapshots, generated-document metadata, and final document records locally. Do not make docassemble the matter or document system of record.

3. **Harden trust/funds workflows.**
   Use Blnk and Apache Fineract patterns for idempotent transactions, balances, maker-checker approvals, and reconciliation. Use LedgerSMB only as a reporting/reconciliation reference. Keep no-overdraft, balanced-entry, reversal, and audit invariants covered by tests.

4. **Make the document pipeline share-ready.**
   Finish document versioning, storage confirmation, scan integration, checksum mismatch handling, legal-hold behavior, and portal-sharing gates. Study paperless-ngx concepts without copying GPL implementation.

5. **Grow the operational dashboard.**
   Build permission-aware queues for signatures, intake sessions, document review, trust/funds exceptions, audit review, and matter work. Keep local sample data only for tests, seeds, and in-memory development fixtures.

6. **Expand API and data-model documentation.**
   Add endpoint and state-machine docs for document, signature, intake, ledger, audit, provider, and bootstrap flows so future implementation does not drift from the current contracts.

7. **Defer nonprofit/fiscal-host expansion.**
   Keep Open Collective and CiviCRM available as later references for legal clinics and nonprofit workflows, but do not let them alter v1 matter, trust, portal, or document priorities.

## Implementation Guardrails

- Keep Apache-2.0 core code original unless reuse passes the dependency admission and notice rules in `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Do not fork any researched project in the next phase.
- Optional copyleft services must remain separate containers/processes behind documented APIs.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers records, withdrawals, authorizations, reconciliation, reporting, retention, interest handling, and licensee/notary/paralegal rules.
