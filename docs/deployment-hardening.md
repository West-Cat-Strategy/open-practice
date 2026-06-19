# Deployment Hardening

- Require TLS for all browser, API, portal, and object-storage traffic.
- Serve the web app with baseline response hardening headers, including no powered-by header,
  `nosniff`, no-referrer policy, restrictive permissions policy, and frame/object/base CSP guards.
  Production enforced CSP permits inline Next.js hydration scripts without `unsafe-eval`; keep the
  stricter `Content-Security-Policy-Report-Only` directives enabled while nonce-compatible
  script/style enforcement is prepared.
- Configure embedded session auth with strong password setup/invitation flows for practice users and portal users.
- Complete production first-run setup only from an operator-local loopback request before the
  deployment is exposed publicly, while the firm and user tables are empty, then rely on embedded
  owner-admin authentication for subsequent access.
- Keep S3 buckets private; serve files only through expiring signed URLs after server-side authorization.
- Verify upload-completion callbacks against expected storage keys, object existence, checksums, size policy, and server-controlled scan state before documents can be shared.
- Run malware scanning before a document can be shared through the portal.
- Back up PostgreSQL and object storage together, test restores, and include migration rollback/roll-forward drills in release readiness.
- Store secrets outside git and outside container images.
- Configure production embedded auth explicitly; dev header auth, bearer JWT auth, and weak secrets must not be accepted in production.
- Configure `OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY` through the secret manager for PostgreSQL-backed
  API and worker runtimes. Provider settings store authenticated AES-256-GCM envelopes in
  `provider_settings.encrypted_config`; legacy plaintext values stay readable until normal updates
  rewrite them under encryption.
- Keep user-facing embedded auth single-tenant: users sign in with email/password, passkey, or
  recovery code only, while the API resolves the sole configured practice internally and blocks
  operator review if multiple firm records exist.
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
- Keep public passkey login options non-enumerating: login challenges must not return user-specific
  credential IDs, and verification should resolve active credentials within the configured practice.
- Validate outbound connector delivery URLs before persistence and again in the worker immediately
  before delivery, including DNS resolution checks that reject private, loopback, link-local, and
  other reserved addresses. Worker delivery should use a guarded HTTPS socket lookup and must not
  automatically follow redirects to unvalidated destinations. Connector redirect, origin, endpoint,
  and webhook URLs must also reject embedded username/password credentials.
- Keep audit exports in immutable or write-once storage where available.
- Separate production trust/funds operations from test data and demo data.
- Keep billing, invoice, manual-payment, and trust-transfer workflows behind role-scoped operational controls; do not describe them as jurisdiction-certified accounting, tax, or trust-compliance advice.
- Do not enable live payment processing by default. Stripe Checkout Session creation is available
  only behind explicit non-production provider configuration in the current runtime; production
  `STRIPE_SECRET_KEY` configuration is rejected until webhook verification, replay protection,
  settlement reconciliation, refund/chargeback handling, and a manual fallback are implemented.
- Treat normalized payment settlement events as staff reconciliation-review evidence only. The
  OP-T149 route does not make production Stripe webhook enablement safe by itself because it does
  not persist raw payloads, verify provider signatures, replay webhook deliveries, apply payments,
  handle refunds or chargebacks, reconcile deposits, or move funds.
- Do not let invoice payment application or trust-transfer approval automatically post trust ledger entries. Trust ledger posting must remain an explicit balanced transaction with its own evidence, idempotency key, approval controls, and reconciliation path.
- Run local dependency, secret, and license checks before deployment: `pnpm deps:audit`,
  `pnpm security:scan`, and `pnpm policy:check`. Container/image scanning remains a
  deployment-profile requirement when production images are published.
- Treat app-image footprint measurements from `docker image inspect` as local validation evidence,
  not production release evidence. A production image publication still needs the deployment profile's
  image scan, SBOM, secret scan, provenance, and rollback/restore proof.

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
- First-run setup proceeds only while both firm and user tables are empty; partial bootstrap state is
  blocked for operator review. Production first-run setup stays keyless but is available only from a
  direct operator-local loopback request with loopback host/origin context and no proxy client
  headers; public or proxy-forwarded production requests see a blocked setup status and cannot
  create setup passkey challenges or owner-admin records. The web setup flow creates editable
  operational defaults, OP-authored starter templates, an optional first matter, and the first
  owner-admin session without relying on development seed data.
- `OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY` must decode to exactly 32 bytes as base64, base64url, or
  hex. PostgreSQL-backed API and worker startup fails without it, while synthetic memory-mode tests
  can omit it. Rotate it through the secret manager; do not bake it into images or checked-in env
  files.
- `DEV_AUTH_FIRM_ID` and `x-open-practice-firm-id` are development-only helpers for seeded local
  requests. They must not be part of production user-facing sign-in, password setup, passkey login,
  or recovery-code payloads.
- `API_BASE_URL`, `WEB_PORT`, and `API_PORT` should be explicit per environment, with TLS termination
  and allowed origins configured at the edge.
- Self-hosted web images may set `OPEN_PRACTICE_BROWSER_API_MODE=same-origin` so browser requests
  stay on the public web origin while the Next.js server rewrites `/api/*` to the private internal
  `API_BASE_URL`. This is the preferred single-host posture after first-run bootstrap; do not expose
  the API publicly through the reverse proxy.
- Public-consultation website origins configured in the API should be treated as route-specific:
  they are allowed only for public intake `POST`/preflight CORS and must not become credentialed CORS
  origins for authenticated dashboard routes.
- Local Docker Compose host ports are fixed to `127.0.0.1`; only the host port numbers and matching
  `OPEN_PRACTICE_PUBLIC_WEB_ORIGIN` / `OPEN_PRACTICE_PUBLIC_API_ORIGIN` loopback origins are local
  override inputs. Do not reuse the local Docker stack as a LAN or production API profile; the local
  profile also carries development secrets, local object-storage endpoints, Mailpit capture, and the
  local-dev web CSP posture.
- `docker-compose.selfhost.yml` is the focused single-host profile for operator-managed TLS reverse
  proxies. It must render with production API/Web/Worker containers, no Mailpit, no development seed
  data, no memory repository, no Docker bridge setup, no relaxed CSP, loopback-only published
  web/API setup/object-storage ports, and private PostgreSQL/Redis/Worker ports. Validate it with
  `pnpm selfhost:check -- --env-file <ignored env file>` before startup.
- `OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP` is a local Docker Compose-only bootstrap switch for
  first-run setup requests that arrive from the Docker bridge gateway. It must stay disabled in
  production and should not be paired with LAN-exposed setup ports.
- `OPEN_PRACTICE_RELAXED_CSP=true` is a local Docker development escape hatch only and must be paired
  with `OPEN_PRACTICE_DOCKER_LOCAL_DEV=true` and `OPEN_PRACTICE_IMAGE_PROFILE=local-dev`; do not
  promote relaxed-CSP Compose images outside local development. This is separate from the production
  inline-script allowance needed for Next.js hydration, which must not enable `unsafe-eval` or
  loopback API connections.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` must reference a
  private bucket or compatible object store. Endpoint, access key, and secret key must be provided
  together when S3 is enabled. Production S3 deployments must set `S3_SERVER_SIDE_ENCRYPTION=AES256`
  so server-owned draft-export/inbound-email writes and staff/public upload intents request SSE-S3
  encryption at rest; MinIO deployments must configure the matching KMS/KES support before enabling
  the setting. Upload completion must verify the expected key, checksum, size policy, configured
  server-side encryption, and malware-scan state before portal sharing.
- `DOCUSEAL_*`, `DOCASSEMBLE_*`, and `OIDC_*` configuration is deprecated and must not be present in
  production. Signature, intake, and auth are embedded local workflows.
- Worker/provider configuration should be explicit and disabled by default. Reserved defaults are
  recorded in [Tech Stack](tech-stack.md); production must not enable Redis/BullMQ, Postal, OCR,
  transcription, or Ollama without the corresponding runbook, authorization checks, and retention
  controls. Embedded passkey and rich-text publishing surfaces require their own RP/origin, session,
  authorization, rendering, and retention controls before production exposure.
- Billing and invoice settings should ship as operational configuration only: invoice numbering,
  review roles, tax labels, payment terms, write-off reasons, and evidence requirements. They should
  not be represented as accounting or tax certification.
- Manual payment intake should require reviewer workflow, evidence retention, and reconciliation
  reporting. Stripe Checkout Session creation records processor posture only; all payment statuses
  should still be treated as operator-reviewed records rather than live settlement.
- Trust-transfer-request deployment gates should require matter-balance checks, invoice linkage,
  authorization evidence, and segregation between request approval and ledger posting. Approval of a
  transfer request must not automatically create trust ledger transactions.
- Trust ledger migrations should preserve the persisted client-balance guard. Backfills should derive
  client balances from client-liability ledger entries and fail rather than hide negative historical
  balances.

Release hardening should include a migration dry run, backup restore proof for PostgreSQL and object
storage, `pnpm release:local`, and a smoke test for S3 presign/upload-complete, embedded session
login/logout, embedded signature events, billing dashboard reads, manual payment allocation, and
trust-transfer-request evidence creation.
