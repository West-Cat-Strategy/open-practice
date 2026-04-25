# Architecture

Open Practice is a TypeScript monorepo with a matter-centered legal domain core.

## Workspaces

- `apps/web`: Next.js operational UI for firm members.
- `apps/api`: Fastify API exposing the first matter, conflict, document, ledger, and audit endpoints.
- `packages/domain`: Pure TypeScript domain logic for permissions, conflict checks, audit hash chains, signature-provider boundaries, and trust/funds ledger validation.
- `packages/database`: Drizzle schema for the planned PostgreSQL system of record.

## Core Decisions

- PostgreSQL is the source of truth for legal records.
- S3-compatible object storage holds document binaries; the database stores metadata, checksums, versions, scan state, legal hold, and access grants.
- Matter-scoped RBAC is implemented in core first, with a boundary that can later move to OpenFGA.
- Audit events are append-only and hash chained to detect tampering.
- Trust/funds entries are balanced double-entry transactions with idempotency and no matter-level overdrafts.
- E-signing and document automation are integrated through provider interfaces so self-hosted DocuSeal and docassemble can remain optional infrastructure.
- Concrete external-service adapters live outside `packages/domain`; the domain package exports provider-neutral contracts and legal rules only.

## Reference-Informed Boundaries

- **Legal practice workflows** stay native. j-lawyer.org and ArkCase may inform vocabulary and workflow comparison, but their code remains reference-only.
- **Signature workflows** use a provider boundary. Open Practice owns signature request records, access checks, audit events, provider events, and final document metadata; DocuSeal is optional infrastructure.
- **Guided intake and document automation** use a provider boundary. docassemble may run interviews and render documents, but Open Practice owns matter records, session metadata, answer snapshots, and generated-document metadata.
- **Document OCR/search** stays replaceable. paperless-ngx may inform scan/OCR/tagging concepts, but any OCR service must be optional and external.
- **Trust/funds hardening** is native. Blnk and Apache Fineract may inform idempotency, balances, maker-checker approvals, and reconciliation; LedgerSMB is reporting/reference only.
- **Nonprofit/fiscal-host concepts** are deferred. Open Collective and CiviCRM should not shape v1 legal-practice APIs or schema.

## Local Services

`docker-compose.yml` provides PostgreSQL, S3-compatible storage via MinIO, Mailpit, and optional DocuSeal under the `esign` profile. A future docassemble profile should be optional in the same style.

## Security Posture

The app assumes server-side authorization for every matter, document, portal message, signature request, trust entry, and audit event. The UI may hide controls, but the API and domain layer remain the enforcement boundary.
