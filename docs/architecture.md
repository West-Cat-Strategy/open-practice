# Architecture

Open Practice is a TypeScript monorepo with a matter-centered legal domain core.

## Workspaces

- `apps/web`: Next.js API-backed operational UI for firm members.
- `apps/api`: Fastify API exposing session, capability, overview, matter, conflict, document, ledger, audit, signature, intake, billing, and generated-document endpoints.
- `packages/domain`: Pure TypeScript domain logic for permissions, conflict checks, audit hash chains, signature-provider boundaries, and trust/funds ledger validation.
- `packages/database`: Drizzle schema, migrations, runtime setup, seed support, and in-memory/PostgreSQL repository implementations for the system of record.
- `packages/providers`: Embedded signature and document-automation adapters that avoid SaaS or provider-specific runtime dependencies.

## Core Decisions

- PostgreSQL is the source of truth for legal records.
- S3-compatible object storage holds document binaries; the database stores metadata, checksums, versions, scan state, legal hold, and access grants.
- Redis and BullMQ are accepted for optional background job delivery, retries, and worker concurrency only. Queue state must not become the legal source of truth.
- Matter-scoped RBAC is implemented in core first, with a boundary that can later move to OpenFGA.
- Audit events are append-only and hash chained to detect tampering.
- Trust/funds entries are balanced double-entry transactions with idempotency and no matter-level overdrafts.
- E-signing and document automation are embedded local workflows. Open Practice owns signature events, consent evidence, intake answers, and generated-document metadata.
- Concrete provider adapters live outside `packages/domain`; the domain package exports provider-neutral contracts and legal rules only.
- OCR, transcription, AI assistance, and outbound email are optional provider surfaces. They must be disabled by default until their deployment profile, authorization checks, and review states are implemented. Passkeys and rich-text drafting/template editing are embedded app surfaces; they still require explicit RP/origin, session, setup, authorization, retention, and rendering controls before production exposure.
- Production authentication uses embedded Postgres-backed sessions. Development may still use local header/JWT helpers.
- Planning lives in `docs/planning.md`, and live tracked work lives in `docs/planning-and-progress.md`.
- API route ownership is moving toward module-owned Fastify registrars under `apps/api/src/routes`; `apps/api/src/server.ts` remains responsible for bootstrap, authentication hooks, environment setup, and central error handling.

## Runtime Topology

The default runtime is browser to Next.js web, then Fastify API, then repository/domain code backed by
PostgreSQL and private S3-compatible object storage. PostgreSQL stores legal records, session state,
audit chains, document metadata, billing records, and trust/funds records.

The worker profile adds Redis/BullMQ beside the API. API routes enqueue small job commands with record
IDs, actor IDs, matter IDs, and idempotency keys. Workers load the current record from PostgreSQL,
read/write private object storage after service authorization, call provider adapters, and persist
results back to PostgreSQL. Redis can be rebuilt from durable records and must not contain raw document,
intake, audio, transcript, billing, trust, or privileged text.

Planned worker groups:

- Document workers: Tesseract OCR and scan-derived metadata.
- Media workers: FFmpeg normalization and Whisper transcription.
- Assistive workers: Ollama-backed summarization/classification/drafting aids with review state.
- Mail workers: Mailpit in development and Postal only behind an approved production profile.
- Auth/content surfaces: SimpleWebAuthn passkey challenges and TipTap draft/template processing run
  as embedded app features, not third-party SaaS or worker-only planned routes.

## Reference-Informed Boundaries

- **Legal practice workflows** stay native. j-lawyer.org and ArkCase may inform vocabulary and workflow comparison, but their code remains reference-only.
- **Signature workflows** are embedded. Open Practice owns signature request records, access checks, audit events, provider events, consent evidence, and final document metadata. Legacy `docuseal` provider values are historical only.
- **Guided intake and document automation** are embedded. Open Practice owns matter records, session metadata, answer snapshots, generated-document metadata, and final document records. Legacy `docassemble` provider values are rejected for new work.
- **Document OCR/search** stays replaceable. paperless-ngx may inform scan/OCR/tagging concepts, but any OCR service must be optional and external.
- **Trust/funds hardening** is native. Blnk and Apache Fineract may inform idempotency, balances, maker-checker approvals, and reconciliation; LedgerSMB is reporting/reference only.
- **Nonprofit/fiscal-host concepts** are deferred. Open Collective and CiviCRM should not shape v1 legal-practice APIs or schema.

## Local Services

`docker-compose.yml` provides PostgreSQL, S3-compatible storage via MinIO, Mailpit, and Redis. Signature,
intake, and auth workflows run in the app/database instead of optional provider containers. Redis backs
the scaffolded BullMQ worker runtime, while PostgreSQL remains the durable job/audit record. Postal,
Ollama, Tesseract, Whisper, and FFmpeg are documented provider choices, but their processors stay
disabled until setup and deployment profiles configure them.

## Security Posture

The app assumes server-side authorization for every matter, document, portal message, signature request, trust entry, and audit event. The UI may hide controls, but the API and domain layer remain the enforcement boundary.

Self-hosting is the privacy default. Optional providers run in local/private networks, receive the
minimum record IDs and content required for the job, and write provenance back to PostgreSQL. SaaS
substitutions require a deployment profile, privacy review, and docs update before use.
