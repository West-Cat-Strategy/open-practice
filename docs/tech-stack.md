# Tech Stack

This records accepted, deferred, and rejected stack decisions. Official links point at upstream
documentation; dependency admission and service reuse still follow
[Reuse Decision Policy](reuse-decision-policy.md).

## Accepted Core

| Area                 | Choice                                                                                                                   | Decision                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Language and runtime | [TypeScript](https://www.typescriptlang.org/docs/) on Node.js                                                            | Keep one TypeScript codebase across web, API, domain, database, and providers.                                          |
| Package and tasks    | [pnpm](https://pnpm.io/) and [Turborepo](https://turborepo.dev/docs)                                                     | Keep workspace scripts and validation centralized at the repo root.                                                     |
| Web app              | [Next.js](https://nextjs.org/docs)                                                                                       | Keep the dashboard API-backed; no direct runtime seed-data imports.                                                     |
| API                  | [Fastify](https://fastify.dev/docs/latest/)                                                                              | Keep module-owned route registrars under `apps/api/src/routes`; `server.ts` remains bootstrap and shared hooks.         |
| Data                 | [PostgreSQL](https://www.postgresql.org/docs/) with [Drizzle](https://orm.drizzle.team/docs/overview)                    | PostgreSQL is the legal system of record. Drizzle owns schema and migration generation.                                 |
| Object storage       | S3-compatible storage, local [MinIO](https://min.io/docs/minio/linux/reference/s3-api-compatibility.html) in development | Store document binaries outside PostgreSQL; keep metadata, checksums, scan state, legal hold, and grants in PostgreSQL. |

## Accepted Provider And Worker Stack

| Area                  | Choice                                                                                                             | Decision                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queues                | [Redis](https://redis.io/docs/latest/) plus [BullMQ](https://docs.bullmq.io/)                                      | Use for retryable background work only. Queue payloads carry IDs and idempotency keys, not raw client content. PostgreSQL remains source of truth.                                                       |
| Redis license posture | Redis 8+ under [Redis license options](https://redis.io/legal/licenses/)                                           | Treat Redis as an external service. Production operators must pick and document the license path; modified or redistributed Redis services need legal review.                                            |
| Local email           | [Mailpit](https://mailpit.axllent.org/docs/)                                                                       | Development SMTP capture and integration testing only. Never production delivery.                                                                                                                        |
| Production email      | [Postal](https://docs.postalserver.io/)                                                                            | Deferred self-host option for outbound mail. Requires TLS, SPF/DKIM/DMARC, bounce webhooks, abuse monitoring, backups, and a runbook before enablement.                                                  |
| Inbound email polling | [ImapFlow](https://github.com/postalsys/imapflow)                                                                  | MIT-licensed optional IMAP mailbox polling for raw MIME ingestion. Stores raw messages first, then queues the existing parser job path.                                                                  |
| Inbound email parsing | [mailparser](https://nodemailer.com/extras/mailparser/)                                                            | Parse raw messages already stored in object storage. Parsed attachments remain inbound-email records until staff explicitly promote them to document records.                                            |
| OCR                   | [OCRmyPDF](https://ocrmypdf.readthedocs.io/) with [Tesseract](https://tesseract-ocr.github.io/tessdoc/)            | Optional dedicated local OCR worker for PDF/image text extraction. Keep OCR output reviewed, tied to document version/checksum, and internal to authorized server-side flows.                            |
| Transcription         | [FFmpeg](https://www.ffmpeg.org/documentation.html) plus [Whisper](https://github.com/openai/whisper)              | Optional local media worker. FFmpeg normalizes media; Whisper produces draft transcripts that require provenance and review.                                                                             |
| Local LLM             | [Ollama](https://docs.ollama.com/)                                                                                 | Optional local assistive provider for summarization, classification, and drafting aids. Disabled by default; never system of record.                                                                     |
| Passkeys              | [SimpleWebAuthn](https://simplewebauthn.dev/docs/)                                                                 | Live embedded-auth passkey routes for first-run setup, registration, login, credentials, and MFA, bound to configured RP ID and origin.                                                                  |
| Rich text             | [TipTap](https://tiptap.dev/docs) editor core                                                                      | Accepted for local notes, drafts, templates, and portal text. Store structured editor JSON plus rendered snapshots; avoid cloud/pro services unless reviewed.                                            |
| Document export       | [docx](https://github.com/dolanmiu/docx) and [PDFKit](https://pdfkit.org/)                                         | Generate saved draft exports as DOCX/PDF from server-owned TipTap export models. Store binaries in object storage and metadata/checksums in PostgreSQL.                                                  |
| Calendar sync         | [CalDAV](https://datatracker.ietf.org/doc/rfc4791/) and [iCalendar](https://datatracker.ietf.org/doc/html/rfc5545) | Open Practice-hosted matter calendars sync to iOS Calendar through revocable app-password CalDAV accounts. Authenticated `.ics` export remains read-only compatibility.                                  |
| Video meetings        | [WebRTC](https://www.w3.org/TR/webrtc/) with private signaling and STUN/TURN configuration                         | Access V1 stores optional matter-scoped external or configured hosted room links for calendar invitations. Native rooms, signaling, TURN, chat, upload, and room-session audit controls remain deferred. |

## Rejected Or Deferred

- Reject SaaS defaults for AI, OCR, transcription, email, e-signing, and intake. External services need an
  explicit deployment profile and privacy review.
- Reject Redis as a legal-record database, authorization cache, or audit source of truth.
- Reject Mailpit for production email delivery.
- Defer Postal until mail governance, deliverability, incident response, and webhook verification are
  implemented.
- Defer Whisper transcription and live Ollama/LM Studio adapters until their worker, provider, and
  deployment profiles are implemented. The first drafting assist slice is a disabled synchronous
  scaffold with fake-provider tests only.
- Defer cloud OCR, vision/LLM OCR, searchable-PDF artifact storage, table/form/layout extraction,
  and staff-visible raw OCR text until separate privacy, provider, and retention reviews are
  recorded.
- Defer native WebRTC meeting rooms until self-hostable/private signaling, STUN/TURN configuration,
  meeting-scoped access tokens, meeting chat, temporary document upload, and room-session audit
  persistence are implemented. The current calendar slice only stores configured links and
  invitation capability status.
- Defer Google Calendar, Microsoft 365, iCloud, and other external provider sync until a provider-auth,
  conflict-resolution, consent, retention, and privacy plan is approved. Open Practice-hosted CalDAV
  account sync is the OP-T34 first sync target.
- Defer spreadsheet, presentation, real-time collaboration, external office-provider sync, and
  third-party legal-template libraries until separate matter-scoped authorization, retention, and
  reuse-policy decisions are recorded.
- Calendar dashboard deadline radar displays operator-entered event dates only. It is not a
  jurisdiction-certified limitation, filing-deadline, or recurrence calculation engine.
- Keep DocuSeal, docassemble, OIDC providers, live payment processors, paperless-ngx, Kimai, LedgerSMB,
  CiviCRM, and Midaz out of the default runtime as recorded in the planning and reuse docs.

## Configuration Defaults

Current development defaults live in `.env.example`: `NODE_ENV=development`, `WEB_PORT=33000`,
`API_PORT=34000`, `API_BASE_URL=http://localhost:34000`, PostgreSQL `DATABASE_URL`,
`OPEN_PRACTICE_USE_MEMORY_REPO=false`, `OPEN_PRACTICE_DEV_SEED=true`,
`AUTH_JWT_SECRET=dev-only-change-me-at-least-16-chars`, `SESSION_TTL_HOURS=12`,
browser-facing local origin `http://localhost:33000`, and local S3-compatible storage at
`http://localhost:39000`.

Worker/provider defaults:

| Variable                              | Default                                             | Purpose                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`                           | API: empty; worker: `redis://localhost:36379/0`     | Queue broker for BullMQ email enqueueing and workers.                                                                                                                      |
| `WORKER_QUEUES`                       | `email,inbound_email,ai_triage,transcription,media` | Queue allow-list for the non-OCR worker runtime. Run a dedicated OCR worker with `WORKER_QUEUES=ocr` when local OCR CLI tooling is installed.                              |
| `WORKER_CONCURRENCY`                  | `2`                                                 | Per-queue BullMQ worker concurrency.                                                                                                                                       |
| SMTP provider settings                | setup/Admin managed                                 | Optional transactional SMTP settings live in encrypted `provider_settings` under `smtp/default`; local Mailpit capture uses host `localhost`, port `31025`, and no auth.   |
| IMAP provider settings                | setup/Admin managed                                 | Optional inbound polling settings live in encrypted `provider_settings` under `inbound_email/imap`; raw messages enter the existing inbound-email parser queue.            |
| `INBOUND_EMAIL_WEBHOOK_SECRET`        | empty                                               | When set, bootstraps the enabled Mailgun `inbound_email` provider setting as `webhookSigningKey` for signed raw-MIME receiving. Empty keeps inbound webhooks unconfigured. |
| `INBOUND_EMAIL_DOMAIN`                | empty                                               | Optional Mailgun inbound-address domain metadata stored with the bootstrapped provider setting when `INBOUND_EMAIL_WEBHOOK_SECRET` is set.                                 |
| `AI_PROVIDER`                         | `disabled`                                          | Keeps AI triage and draft assist disabled until setup opts in.                                                                                                             |
| `AI_ENDPOINT`                         | `http://localhost:11434/v1`                         | OpenAI-compatible local endpoint for Ollama or LM Studio.                                                                                                                  |
| `AI_MODEL`                            | empty                                               | Empty model keeps assistive AI inactive.                                                                                                                                   |
| `OCR_PROVIDER`                        | `local_cli`                                         | OCR worker provider. `local_cli` wraps OCRmyPDF/Tesseract through CLI binaries; `tesseract_js` remains an explicit fallback only.                                          |
| `OCR_CLI_TIMEOUT_SECONDS`             | `120`                                               | Per-page Tesseract timeout passed to OCRmyPDF for the local CLI provider.                                                                                                  |
| `OCR_TEMP_DIR`                        | empty                                               | Optional scratch directory for local OCR temp files. Empty uses the OS temp directory.                                                                                     |
| `WHISPER_MODEL`                       | empty                                               | Empty model keeps transcription providers inactive.                                                                                                                        |
| `MEDIA_TEMP_DIR`                      | `.tmp/open-practice-media`                          | Local scratch path for future FFmpeg/Whisper processing.                                                                                                                   |
| `S3_SERVER_SIDE_ENCRYPTION`           | empty                                               | Optional locally; required as `AES256` in production when S3 is configured so server-owned writes and staff/public upload intents request SSE-S3 encryption.               |
| `OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY` | empty                                               | Required for PostgreSQL-backed API and worker runtimes before provider configuration secrets are written or read; accepts a 32-byte base64, base64url, or hex key.         |
| `OPEN_PRACTICE_BROWSER_API_MODE`      | `external`                                          | Set to `same-origin` for self-hosted web images that should send browser requests to `/api` on the web origin and let Next.js rewrite to private `API_BASE_URL`.           |

## Privacy Posture

Open Practice defaults to self-hosted infrastructure. Documents, intake answers, audio, transcripts,
signature evidence, billing records, trust/funds records, and audit events stay in PostgreSQL and private
object storage. Server-owned draft-export/inbound-email writes and staff/public upload intents
request SSE-S3 encryption when configured. Workers fetch sensitive content through matter-scoped service authorization; queue messages
must contain only identifiers, small control metadata, and idempotency keys. Optional
AI/OCR/transcription outputs are drafts with provenance, review state, and retention controls.
OCR extracted text is retained internally in `document_text_extractions.extracted_text` for
authorized server-side review/assist flows. Raw OCR text is not returned in workbench/job/audit/API
responses and is not stored in job metadata, audit metadata, conversion-review artifact metadata, or
provider-readiness evidence packets. Draft assist records are non-authoritative suggestions; raw
source text, prompts, instructions, and generated text are excluded from audit/job metadata.
OCR enablement is firm-scoped provider posture, not an environment-only switch: owner/admin users can
enable the local CLI OCR provider through the Queues provider posture panel, while queueing still
requires the Redis-backed OCR queue, S3-backed document content, and supported PDF/JPEG/PNG/TIFF
inputs. The worker rechecks file magic bytes before invoking OCRmyPDF and fails closed on unsupported
content. AI triage, transcription, and media queues remain reserved/deferred until their provider
governance and enqueue surfaces are added.

## Local OCR CLI Wrap Record

- **Source projects:** [OCRmyPDF](https://ocrmypdf.readthedocs.io/) and
  [Tesseract OCR](https://tesseract-ocr.github.io/tessdoc/); the self-host OCR image installs
  Alpine-packaged runtime dependencies such as Ghostscript and Poppler beside them.
- **Reuse class:** Wrap. Open Practice shells out with `execFile`-style argument arrays and does not
  vendor or copy upstream OCR source into `apps/*`, `packages/*`, tests, migrations, or shared
  scripts.
- **License posture:** OCRmyPDF is MPL-2.0, Tesseract is Apache-2.0, and the packaged CLI/runtime
  tools keep their own upstream licenses and operator obligations. They are optional runtime tooling
  in the dedicated OCR worker image/profile, not required for API, web, database, or non-OCR worker
  startup.
- **Touched boundary:** `packages/providers` owns the original CLI adapter, `apps/worker` owns queue
  selection and startup readiness, and `docker-compose.selfhost.yml` exposes the OCR worker through
  an explicit `ocr` profile.
