# Improvement Opportunities

Open Practice now has a focused Apache-2.0 core with a TypeScript domain package, Fastify API, Drizzle/PostgreSQL schema and repository boundaries, S3 upload intent handling, dev/JWT authentication hooks, and early trust/funds, conflict, audit, and permission logic.

This document turns the reuse matrix into the next development sequence without copying code from copyleft or source-available references.

## Current State

- `packages/domain` contains provider-neutral legal rules for conflict checks, matter-scoped RBAC, audit hash chains, trust/funds ledger posting, reversals, idempotency, and signature/automation contracts.
- `packages/providers` contains concrete optional-service adapters for DocuSeal and docassemble-style automation; `packages/domain` should stay free of HTTP provider logic.
- `apps/api` handles auth, access checks, repository injection, S3 presigning, and core routes for matters, conflicts, ledger, audit, and documents.
- `packages/database` defines the planned PostgreSQL schema, seed/runtime support, and repository interfaces for persistent and in-memory operation.
- The web app is still an operational demo surface and should increasingly consume API-backed data rather than direct sample fixtures.
- `.references/oss/` remains ignored; docs, manifests, and lockfiles are the only tracked artifacts from OSS research.

## Prioritized Improvements

1. **Finish the provider boundary.**
   Keep DocuSeal/docassemble HTTP adapters in `packages/providers`; expose only provider-neutral DTOs and status transitions from `packages/domain`; wire provider factories in `apps/api` using explicit environment configuration.

2. **Persist signature requests and provider events.**
   Add repository methods and database fields for signature request title, requestor, signers, provider status, signing URL, completed timestamp, and append-only provider webhook events. Create request records before provider submission, then update status from provider responses and webhooks.

3. **Plan guided intake and document automation.**
   Use docassemble as the optional automation service/reference. Store Open Practice automation templates, session metadata, answer snapshots, generated-document metadata, and final document records locally. Do not make docassemble the matter or document system of record.

4. **Harden trust/funds workflows.**
   Use Blnk and Apache Fineract patterns for idempotent transactions, balances, maker-checker approvals, and reconciliation. Use LedgerSMB only as a reporting/reconciliation reference. Keep no-overdraft, balanced-entry, reversal, and audit invariants covered by tests.

5. **Make the document pipeline share-ready.**
   Add scan-state transitions, checksum enforcement, upload completion confirmation, document versioning, legal-hold behavior, and portal-sharing gates. Study paperless-ngx concepts without copying GPL implementation.

6. **Move the web app off sample fixtures.**
   Replace direct imports of `sample*` fixtures with API calls for session, overview, matters, ledger, conflicts, and document upload intent. Keep local sample data only for tests, seeds, and story/demo fixtures.

7. **Automate reuse-policy checks.**
   Add a policy script/test that verifies `.references/oss/` is ignored, every manifest row has license/decision/commit/usage boundary, Midaz remains reference-only unless legal review changes it, and tracked source does not import or copy from `.references/oss/`.

8. **Defer nonprofit/fiscal-host expansion.**
   Keep Open Collective and CiviCRM available as later references for legal clinics and nonprofit workflows, but do not let them alter v1 matter, trust, portal, or document priorities.

## Implementation Guardrails

- Keep Apache-2.0 core code original unless reuse passes the dependency admission and notice rules in `docs/reuse-decision-policy.md`.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Do not fork any researched project in the next phase.
- Optional copyleft services must remain separate containers/processes behind documented APIs.
- Keep compliance language cautious until jurisdiction-specific legal/accounting review covers records, withdrawals, authorizations, reconciliation, reporting, retention, interest handling, and licensee/notary/paralegal rules.
