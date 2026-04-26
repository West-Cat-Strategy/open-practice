# Deployment Hardening

- Require TLS for all browser, API, portal, and object-storage traffic.
- Configure embedded session auth with strong password setup/invitation flows for firm users and portal users.
- Configure a one-time `OPEN_PRACTICE_SETUP_KEY` for production first-run setup and remove or rotate it after the first owner admin is created.
- Keep S3 buckets private; serve files only through expiring signed URLs after server-side authorization.
- Verify upload-completion callbacks against expected storage keys, checksums, size policy, and scan state before documents can be shared.
- Run malware scanning before a document can be shared through the portal.
- Back up PostgreSQL and object storage together, test restores, and include migration rollback/roll-forward drills in release readiness.
- Store secrets outside git and outside container images.
- Configure production embedded auth explicitly; dev header auth, bearer JWT auth, and weak secrets must not be accepted in production.
- Record embedded signature events with signer consent, actor, IP/user-agent, and timestamp evidence.
- Keep future workers separate from core startup unless an explicit deployment profile enables them.
- Keep Redis private to API and worker containers. Do not put raw matter, document, intake, transcript,
  billing, trust, or privileged text in queue payloads.
- Use Mailpit only for local capture. Postal or another SMTP service needs TLS, SPF/DKIM/DMARC, bounce
  handling, webhook verification, abuse monitoring, and backup/restore procedures before production use.
- Run Tesseract, Whisper, FFmpeg, and Ollama in constrained worker containers with explicit retention,
  provenance, and human-review states for generated text.
- Configure passkey RP ID/origin before enabling SimpleWebAuthn routes, and sanitize/render TipTap
  content server-side before portal exposure.
- Keep audit exports in immutable or write-once storage where available.
- Separate production trust/funds operations from test data and demo data.
- Keep billing, invoice, manual-payment, and trust-transfer workflows behind role-scoped operational controls; do not describe them as jurisdiction-certified accounting, tax, or trust-compliance advice.
- Do not enable live payment processing by default. Any future processor must have explicit secrets, webhook verification, replay protection, settlement reconciliation, refund/chargeback handling, and a manual fallback before production use.
- Do not let invoice payment application or trust-transfer approval automatically post trust ledger entries. Trust ledger posting must remain an explicit balanced transaction with its own evidence, idempotency key, approval controls, and reconciliation path.
- Enable dependency, container, and license scanning in CI before deployment.

## Implementation Plan Notes

Environment variables must be treated as deployment inputs, not application defaults:

- `NODE_ENV=production` must be set for production API containers so unauthenticated requests and
  development header authentication are rejected.
- `DATABASE_URL` must point at PostgreSQL for production. `OPEN_PRACTICE_USE_MEMORY_REPO=true` and
  `OPEN_PRACTICE_DEV_SEED=true` are development-only switches and should fail deployment policy
  checks when used outside test or local environments.
- `AUTH_JWT_SECRET` must be supplied for embedded session token hashing. It must be unique, at
  least 32 characters, and not the checked-in development example. Rotate it through the secret
  manager, not through images or checked-in env files.
- `SESSION_TTL_HOURS` controls embedded session expiry and should be set intentionally per
  deployment.
- `OPEN_PRACTICE_SETUP_KEY` is required to complete first-run setup in production. The setup route
  only proceeds while both firm and user tables are empty; any partial bootstrap state is blocked for
  operator review.
- `API_BASE_URL`, `WEB_PORT`, and `API_PORT` should be explicit per environment, with TLS termination
  and allowed origins configured at the edge.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` must reference a
  private bucket or compatible object store. Endpoint, access key, and secret key must be provided
  together when S3 is enabled. Upload completion must verify the expected key, checksum, size policy,
  and malware-scan state before portal sharing.
- `DOCUSEAL_*`, `DOCASSEMBLE_*`, and `OIDC_*` configuration is deprecated and must not be present in
  production. Signature, intake, and auth are embedded local workflows.
- Worker/provider configuration should be explicit and disabled by default. Reserved defaults are
  recorded in [Tech Stack](tech-stack.md); production must not enable Redis/BullMQ, Postal, OCR,
  transcription, Ollama, passkeys, or rich-text publishing without the corresponding runbook,
  authorization checks, and retention controls.
- Billing and invoice settings should ship as operational configuration only: invoice numbering,
  review roles, tax labels, payment terms, write-off reasons, and evidence requirements. They should
  not be represented as accounting or tax certification.
- Manual payment intake should require reviewer workflow, evidence retention, and reconciliation
  reporting. Until a processor integration exists, all payment statuses should be treated as
  operator-reviewed records rather than live settlement.
- Trust-transfer-request deployment gates should require matter-balance checks, invoice linkage,
  authorization evidence, and segregation between request approval and ledger posting. Approval of a
  transfer request must not automatically create trust ledger transactions.

Release hardening should include a migration dry run, backup restore proof for PostgreSQL and object
storage, `pnpm policy:check`, and a smoke test for S3 presign/upload-complete, embedded session
login/logout, embedded signature events, billing dashboard reads, manual payment allocation, and
trust-transfer-request evidence creation.
