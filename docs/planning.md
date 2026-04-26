# Open Practice Planning

This is the durable roadmap for Open Practice. Use `docs/planning-and-progress.md` for live task status and immediate next moves.

## Current Baseline

Open Practice is an Apache-2.0 TypeScript monorepo with:

- `packages/domain` for provider-neutral legal rules, permission checks, audit hash chains, signature and automation contracts, trust/funds ledger validation, and provider/job operation contracts.
- `packages/database` for Drizzle schema, migrations, runtime setup, sample seeding, in-memory repositories, PostgreSQL repository support, firm provider settings, and job lifecycle records.
- `apps/api` for Fastify routes covering session, capabilities, overview, matters, conflicts, ledger, audit, document upload intent and completion, signature requests and provider events, intake sessions, and generated documents.
- `apps/web` for an API-backed operational dashboard that no longer imports domain seed data directly at runtime.
- `apps/worker` for Redis/BullMQ worker scaffolding with disabled-by-default processors for email,
  inbound email, AI triage, OCR, transcription, and media queues.
- `packages/providers` for embedded signature, document-automation, and disabled operation-provider adapters.
- A documented local-first stack plan for Redis/BullMQ workers, Mailpit/Postal email, Tesseract OCR,
  Whisper/FFmpeg transcription, Ollama/LM Studio assistance, SimpleWebAuthn passkeys, and TipTap
  rich-text drafting.

The current code already includes signature request persistence, signer rows, provider event and webhook-attempt records, upload-complete handling, intake templates and sessions, generated-document records, and the OSS reuse policy check.

## Development Lanes

1. **Provider lifecycle hardening**
   Strengthen embedded signature event evidence, event ordering, failure semantics, and status reconciliation. Keep provider-specific HTTP logic outside `packages/domain`.

2. **Intake and document automation completion**
   Expose answer snapshots through repository/API surfaces and preserve Open Practice as the system of record for sessions, answers, generated document metadata, and final document records.

3. **Document pipeline and portal-share readiness**
   Finish versioning, storage confirmation, checksum policy, scan integration, legal-hold behavior, and portal-share gates before treating documents as production-shareable.

4. **Trust/funds controls**
   Move from strong domain invariants toward persistent DB guarantees, concurrency safety, approval workflow design, reconciliation records, reports, and jurisdiction-reviewed operating procedures.

5. **Operational dashboard and queues**
   Grow the API-backed dashboard into permission-aware work queues for matters, documents, signatures, intake sessions, trust/funds exceptions, and audit review.

6. **Time, billing, and reporting**
   Rebuild time/rate/invoice concepts natively in TypeScript after the matter, document, portal, signature, and trust/funds foundations are stable.

7. **API and data-model documentation**
   Add endpoint and state-machine docs for documents, signatures, intake, ledger, audit, providers, and deployment bootstrap.

8. **Worker and provider topology**
   Grow the Redis/BullMQ scaffold into provider-backed jobs for document OCR, transcription, mail,
   assistive AI, and draft processing. Keep PostgreSQL as source of truth and queue payloads free of
   raw client content.

9. **Embedded auth and drafting extensions**
   Add SimpleWebAuthn passkeys and TipTap-backed drafts/templates only after RP ID/origin, content
   sanitization, versioning, and audit contracts are designed.

## Reuse Guardrails

- Keep Apache-2.0 core code independently authored unless reuse passes `docs/reuse-decision-policy.md`.
- Treat DocuSeal and docassemble as historical references only for current runtime planning; do not copy their implementations into core code.
- Treat j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz as clean-room references only.
- Use Blnk and Apache Fineract selectively for trust/funds design ideas where compatible; do not import their product model wholesale.
- Keep Midaz reference-only because the pinned clone uses Elastic License 2.0 unless legal review approves another path.
- Keep Open Collective and CiviCRM deferred for possible future legal-clinic or nonprofit workflows; they should not shape v1 legal-practice APIs.

## Validation Defaults

- Run `pnpm policy:check` after changes to reuse, reference, or license docs.
- Run `pnpm format:check` for Markdown and TypeScript formatting drift.
- Run focused package tests when implementation changes touch domain, database, provider, API, or web contracts.
- For stack, schema, worker, API, or lockfile changes, run `pnpm verify` before handoff.
- Keep compliance wording cautious until jurisdiction-specific legal/accounting review covers trust records, withdrawals, authorizations, reconciliation, reporting, retention, and role/province rules.
