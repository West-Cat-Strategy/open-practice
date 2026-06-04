# Open Practice Security Remediation Proof - 2026-06-03

## Scope

Implements the reportable remediation set from the 2026-06-03 security review in the isolated worktree `/Users/bryan/projects/open-practice-security-remediation-2026-06-03`.

Branch stack:

- Stage 1: `codex/security-remediation-2026-06-03-stage1` at `ca962f2` for the medium findings plus same-file low findings in auth/bootstrap, signatures/evidence, inbound email, portal/report/billing, and guest attribution.
- Stage 2: `codex/security-remediation-2026-06-03-stage2` for public consultation token posture, draft links, upload quotas/intents, OCR, authenticated document upload method safety, docs, and final proof.

## Implemented

- Fresh-auth session timestamp, step-up password/passkey endpoints, and fresh-session enforcement for sensitive auth, MFA, recovery-code, password-token, and CalDAV credential mutations.
- Mailgun raw MIME storage key alignment plus initial S3 server-side encryption propagation.
- Trusted evidence nesting for embedded/public signature flows and provider-sourced signature status sync.
- Matter/contact-visible portal/report/billing projections and public guest check-in without staff misattribution.
- Public consultation submission bearer token hash posture with one-time staff rotation.
- POST-only authenticated document upload intents, public upload quota completion accounting, public intake active-intent guard, draft export hyperlink allowlist, and OCR language allowlist.

## Validation

Passed:

- Stage 1 selector: `pnpm verify:select -- --files <stage 1 changed paths>`
- Stage 2 selector: `pnpm verify:select -- --files <stage 2 changed paths>`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database db:check`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/providers typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm --filter @open-practice/api test` - 41 files / 469 tests
- `pnpm --filter @open-practice/api typecheck`
- `pnpm build`
- `pnpm ci:local`
- `pnpm security:scan`
- `pnpm deps:audit`
- `pnpm deps:licenses`
- `pnpm migrations:check`
- `docker compose config --images`

`docker compose config --images` reported:

- `redis:8-alpine@sha256:ad0a6eff0a40304ab1ab4f50f0dc192d82b071e1094eac961bcb6106092f8a4e`
- `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`
- `open-practice-mailpit:v1.30.1-go1.26.3`
- `open-practice-dev-api`
- `open-practice-dev-web`
- `open-practice-dev-worker`
- `open-practice-postgres:18-alpine-su-exec`

Skipped:

- `docker compose up -d postgres` was attempted after final gates but blocked before Postgres startup because the Docker daemon was unavailable: `Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock. Is the docker daemon running?`
- `pnpm migrations:replay` was not run because the required local PostgreSQL service could not be started without the Docker daemon.
- `pnpm e2e:docker` and Docker Scout image CVE checks were not run for the same Docker daemon blocker.
- Host/browser e2e was not run in this pass; `verify:select` did not select browser-tier validation for this changed path set, and no local app server was started.
- Live provider/network checks were not run; all validation used synthetic data and local mocked provider seams only.
