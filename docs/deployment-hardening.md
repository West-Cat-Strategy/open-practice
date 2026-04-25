# Deployment Hardening

- Require TLS for all browser, API, portal, and object-storage traffic.
- Configure OIDC with MFA for firm users and strong invitation flows for portal users.
- Keep S3 buckets private; serve files only through expiring signed URLs after server-side authorization.
- Verify upload-completion callbacks against expected storage keys, checksums, size policy, and scan state before documents can be shared.
- Run malware scanning before a document can be shared through the portal.
- Back up PostgreSQL and object storage together, test restores, and include migration rollback/roll-forward drills in release readiness.
- Store secrets outside git and outside container images.
- Configure production auth/OIDC explicitly; dev header auth and weak JWT secrets must not be accepted in production.
- Verify provider webhooks with provider-specific signatures or shared secrets, reject replayed events, and keep webhook-attempt logs for audit.
- Keep optional services such as DocuSeal and future docassemble/OCR profiles separate from core startup unless an explicit deployment profile enables them.
- Keep audit exports in immutable or write-once storage where available.
- Separate production trust/funds operations from test data and demo data.
- Keep billing, invoice, manual-payment, and trust-transfer workflows behind role-scoped operational controls; do not describe them as jurisdiction-certified accounting, tax, or trust-compliance advice.
- Do not enable live payment processing by default. Any future processor must have explicit secrets, webhook verification, replay protection, settlement reconciliation, refund/chargeback handling, and a manual fallback before production use.
- Do not let invoice payment application or trust-transfer approval automatically post trust ledger entries. Trust ledger posting must remain an explicit balanced transaction with its own evidence, idempotency key, approval controls, and reconciliation path.
- Enable dependency, container, and license scanning in CI before deployment.

## Implementation Plan Notes

Environment variables must be treated as deployment inputs, not application defaults:

- `NODE_ENV=production` must be set for production API containers so unauthenticated requests are
  rejected.
- `DATABASE_URL` must point at PostgreSQL for production. `OPEN_PRACTICE_USE_MEMORY_REPO=true` and
  `OPEN_PRACTICE_DEV_SEED=true` are development-only switches and should fail deployment policy
  checks when used outside test or local environments.
- `AUTH_JWT_SECRET` must be supplied until OIDC token verification is wired through
  `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`. Rotate it through the secret manager,
  not through images or checked-in env files.
- `API_BASE_URL`, `WEB_PORT`, and `API_PORT` should be explicit per environment, with TLS termination
  and allowed origins configured at the edge.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` must reference a
  private bucket or compatible object store. Upload completion must verify the expected key, checksum,
  size policy, and malware-scan state before portal sharing.
- `DOCUSEAL_BASE_URL` and `DOCUSEAL_API_KEY` enable the DocuSeal provider. Production rollout also
  needs `DOCUSEAL_WEBHOOK_SECRET_HEADER`, `DOCUSEAL_WEBHOOK_SECRET_VALUE`, replay protection,
  reconciliation jobs, and failure alerting before DocuSeal events can be trusted without manual
  review. DocuSeal currently sends a configured secret key/value header rather than a documented HMAC
  signature.
- `DOCASSEMBLE_BASE_URL`, `DOCASSEMBLE_API_KEY`, and `DOCASSEMBLE_RETURN_URL` enable optional
  docassemble-backed intake sessions. Optional service profiles such as local DocuSeal, docassemble
  automation, and OCR workers should remain separate containers or managed services with documented
  API/webhook boundaries.
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
storage, `pnpm policy:check`, and a smoke test for S3 presign/upload-complete, signature provider
fallback, authenticated API access, billing dashboard reads, manual payment allocation, and
trust-transfer-request evidence creation.
