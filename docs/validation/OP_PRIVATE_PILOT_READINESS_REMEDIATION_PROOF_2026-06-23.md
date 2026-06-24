# Private-Pilot Readiness Remediation Proof

Date: 2026-06-23
Branch: `private-pilot/readiness-remediation-20260623`
Worktree: `/Users/bryan/projects/open-practice`
Base: `main` / `origin/main`
Status: Passed for private self-hosted pilot handoff with one explicit MinIO image-scan watch item.

## Scope

This branch implements the approved private self-hosted pilot remediation program with synthetic
data only.

- P1 backup/restore readiness adds `pnpm selfhost:restore-drill`, redacted ignored restore-drill
  evidence under `.tmp/open-practice-selfhost-restore-drill/<timestamp>/`, and
  `pnpm release:local -- --private-pilot` restore-drill inclusion while leaving default
  `pnpm release:local` unchanged.
- P1 malware-scan and provider readiness expands share/public-read scan gating regressions, makes
  provider disabled reasons visible, and adds read-only provider posture rows to Admin Readiness.
- P1 optional security tooling closure normalizes security review evidence summaries, adds
  `security:review` selector modes, tightens source-license-scan ignores, keeps Cosign
  release-attestation-only, and installs/runs local optional scanners.
- P2 workflow/client/comms/scheduling/billing/trust/document-intelligence depth adds additive
  authenticated review packets and operator posture summaries over existing projections and
  records.
- Follow-up fixes tighten client-portal activity counts after revoked/access-revoked thread
  filtering, add matter-scoped backend regressions, expose explicit web projection types, surface
  retry handoff and empty-evidence copy, bound dense workflow packet summaries, and add selector
  coverage for restore-drill and E2E runner changes.
- Docker/security follow-up fixes the OSV `tar` advisory, updates Docker static/image scan wrappers,
  hardens final app images, adds service healthchecks, and records executed scanner evidence.

No unauthenticated API was added. Public-token semantics, live payments, bank feeds, automatic trust
posting, production email delivery, public booking/media, provider-backed OCR/AI/transcription
activation, provider payload retention, and raw private document-text retention remain intentional
boundaries.

## Final Path Set

Selector and validation use this final changed-path set:

```text
Dockerfile
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/client-portal/workspace.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/status.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/job-status.ts
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/ledger/read.ts
apps/api/src/routes/providers-status.test.ts
apps/api/src/routes/shares.test.ts
apps/api/src/routes/shares/staff.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/_features/email-delivery/models.ts
apps/web/app/calendar-dashboard.test.ts
apps/web/app/calendar-dashboard.ts
apps/web/app/client-portal-workspace-utils.test.ts
apps/web/app/client-portal-workspace-utils.ts
apps/web/app/client-portal-workspace.test.tsx
apps/web/app/client-portal-workspace.tsx
apps/web/app/communications-inbox-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
apps/web/app/dashboard/calendar-section.test.tsx
apps/web/app/dashboard/calendar-section.tsx
apps/web/app/dashboard/communications-section.test.tsx
apps/web/app/dashboard/communications-section.tsx
apps/web/app/dashboard/matter-overview-section.tsx
apps/web/app/dashboard/queues-section.tsx
apps/web/app/dashboard/trust-controls-section.test.tsx
apps/web/app/dashboard/trust-controls-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/email-delivery-dashboard.test.ts
apps/web/app/email-delivery-dashboard.ts
apps/web/app/provider-status-dashboard.ts
apps/web/app/trust-controls-dashboard.ts
apps/web/app/types.ts
apps/web/app/worker-runs-dashboard.ts
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docker/postgres/Dockerfile
docs/deployment-hardening.md
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md
docs/validation/README.md
package.json
packages/domain/src/ledger.test.ts
packages/domain/src/ledger.ts
packages/domain/src/workflow-audit.test.ts
packages/domain/src/workflow-audit.ts
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/create-security-review.mjs
scripts/create-security-review.test.mjs
scripts/lint-docker-config.mjs
scripts/lint-docker-config.test.mjs
scripts/run-e2e.mjs
scripts/run-license-source-scan.mjs
scripts/run-license-source-scan.test.mjs
scripts/run-osv-scanner.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/reconcile-validation-proof.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
turbo.json
```

## Selector Output

```text
$ pnpm verify:select -- --files <final path set>
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm security:review
pnpm security:secrets-history
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Optional Scanner Closure

Installed user-level scanner/tool CLIs and verified versions:

- Semgrep `1.167.0`
- OSV Scanner `2.4.0`
- ScanCode Toolkit `32.5.0` under Python `3.13.14` with local `libmagic`
- Hadolint `2.14.0`
- Checkov `3.3.0`
- Trivy `0.71.2`
- Docker Scout `v1.22.0`

The final security packet has no optional scanner skipped because all scanner CLIs were installed
and available on the local PATH. `pnpm security:review -- --base-plus-dirty origin/main` passed at
`.tmp/open-practice-security-review/2026-06-24T00-59-10Z/security-review.json`; it recorded
selector mode `base-plus-dirty origin/main`, tracked-secret findings `0`, omitted tracked-secret
files `0`, scanned tracked files `1102`, dependency license groups `20`, packages `557`, package
versions `584`, disallowed license groups `0`, and review-required license groups `8`.

The optional scanner evidence in that packet is:

- Gitleaks history scan: review-required and executed, artifact
  `.tmp/security/gitleaks/2026-06-24T00-59-11Z`.
- Semgrep privacy scan: passed, artifact `.tmp/security/semgrep-privacy/2026-06-24T00-59-14Z`.
  Remaining Semgrep output is warning severity for existing dev-auth/private-payload boundary
  review rules, not a failed privacy scan.
- OSV advisory scan: passed, artifact `.tmp/security/osv/2026-06-24T00-59-19Z`.
- ScanCode source-license scan: passed, artifact `.tmp/license/scancode/2026-06-24T00-59-23Z`.
- Docker static lint: passed, artifact `.tmp/docker/lint/2026-06-24T01-03-12Z`.
- Docker image scan: executed and failed only for the explicit MinIO watch item, artifact
  `.tmp/docker/trivy/2026-06-24T01-03-16Z`.

OSV initially found `tar@7.5.15` through the CycloneDX/node-gyp dependency chain. The branch now
adds `tar: 7.5.16` to `pnpm-workspace.yaml` overrides and updates `pnpm-lock.yaml` so OSV reports
zero lockfile vulnerabilities.

Docker static lint now uses current Checkov framework names (`dockerfile`, `yaml`) and captures
Hadolint warnings without failing below error severity. The Dockerfiles add Postgres/MinIO
healthchecks and documented Checkov rationale where service-specific runtime healthchecks or the
official Postgres entrypoint model are intentional.

Final app images refresh Alpine `libcrypto3`/`libssl3` to `3.5.7-r0` during build and remove
bundled `npm`/`npx` from final app runtime stages. This cleared the Trivy high findings that were
previously present in app, Postgres, and Mailpit images.

## Watch Item

`pnpm docker:scan` executed and is intentionally red for the bundled MinIO image:

- Artifact: `.tmp/docker/trivy/2026-06-24T01-03-16Z/docker-scan.json`.
- Clean images: `open-practice-dev-api`, `open-practice-dev-web`, `open-practice-dev-worker`,
  `open-practice-postgres:18-alpine-su-exec`, and
  `open-practice-mailpit:v1.30.2-go1.26.4` have zero Trivy high/critical findings.
- Watch item: `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4` has `3` critical and
  `27` high findings in `/usr/local/bin/minio` Go binary dependencies, including upstream
  `github.com/minio/minio` CVEs with no Trivy fixed version plus fixed-version dependency targets
  such as `grpc`, `x/crypto`, `x/net`, `prometheus`, `otel/sdk`, `thrift`, `jsonparser`, and
  `go-jose`.
- Reason: upstream MinIO's latest source tag remains `RELEASE.2025-10-15T17-29-55Z`, matching the
  pinned source tag in `docker/minio/Dockerfile`; changing bundled Go modules locally would create a
  forked MinIO binary outside the clean-room/pinned-upstream boundary and needs owner review.
- Owner-visible action: keep MinIO as the explicit image watch item for private pilot, monitor for a
  newer upstream source tag or official image/tag publication, and refresh the pinned source tag
  before broader production use.

## Validation

- `brew update`: passed.
- `brew install pipx osv-scanner hadolint checkov trivy`: passed.
- `pipx install semgrep`: passed.
- `pipx install scancode-toolkit`: installed, then reinstalled under Python `3.13.14` with
  `libmagic` after the local Python `3.14` environment could not load libmagic.
- Docker Scout `v1.22.0`: installed from the official GitHub release asset
  `docker-scout_1.22.0_darwin_arm64.tar.gz` after checksum verification; previous local plugin was
  backed up under `~/.docker/cli-plugins/`.
- `semgrep --version`, `osv-scanner --version`, `scancode --version`, `hadolint --version`,
  `checkov --version`, `trivy --version`, `docker scout version`: passed with versions listed above.
- `pnpm security:privacy-rules`: passed, artifact
  `.tmp/security/semgrep-privacy/2026-06-23T23-52-08Z`.
- `pnpm deps:osv`: passed after the `tar@7.5.16` override, artifact
  `.tmp/security/osv/2026-06-23T23-52-08Z`.
- `pnpm license:scan`: passed, artifact `.tmp/license/scancode/2026-06-23T23-52-08Z`.
- `node --test scripts/lint-docker-config.test.mjs scripts/scan-docker-images.test.mjs`: passed.
- `pnpm docker:lint`: passed, artifact `.tmp/docker/lint/2026-06-24T01-03-12Z`.
- `DOCKER_BUILDKIT=1 docker compose build postgres minio mailpit api web worker`: passed and built
  the expected local image tags.
- `docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker open-practice-postgres:18-alpine-su-exec open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4 open-practice-mailpit:v1.30.2-go1.26.4`: passed.
- `pnpm docker:scan`: executed and failed for the MinIO watch item described above, artifact
  `.tmp/docker/trivy/2026-06-24T01-03-16Z/docker-scan.json`; all other scanned images have zero
  high/critical findings.
- `pnpm docker:residual-watch`: passed after updating Docker Scout, artifact
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T00-48-44Z`.
- `pnpm security:review -- --base-plus-dirty origin/main`: passed, artifact
  `.tmp/open-practice-security-review/2026-06-24T00-59-10Z/security-review.json`.
- `pnpm verify:select -- --files <final path set>`: passed and selected the commands listed above.
- `pnpm ci:local`: passed.
- `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`:
  passed.
- `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`:
  first closeout attempt failed at `postgres-ready`. Reason: transient local Docker data-service
  startup condition; the data-service stack was inspected and restarted cleanly, then the full drill
  rerun passed with evidence under
  `.tmp/open-practice-selfhost-restore-drill/2026-06-24T01-06-41Z`.
- `pnpm docker:app-smoke`: passed.
- `pnpm e2e:docker`: first closeout attempt failed the external-upload receipt checks after a
  browser upload returned `507 Insufficient Storage`. Reason: local Docker overlay storage
  exhaustion, confirmed by `docker run --rm alpine:3.22 sh -c 'df -h / /tmp'` showing only
  `161.1M` available in Docker's internal filesystem. After a build-cache-only
  `docker builder prune -af`, the same check showed `26.5G` available and `pnpm e2e:docker` reran
  green with `3 passed (40.7s)`.
- `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_READINESS_REMEDIATION_PROOF_2026-06-23.md --files <final path set>`:
  passed with `78` paths and all selected commands represented.
- `git diff --check`: passed.

Earlier remediation validation also passed focused API/web/domain/script tests, `pnpm e2e:client-portal`,
`pnpm e2e:a11y`, targeted staff-page screenshots, `node scripts/run-e2e.mjs first-run`,
`pnpm e2e:matterless`, `pnpm build`, `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`,
`pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`,
`pnpm docker:app-smoke`, and `pnpm e2e:docker`. Final closeout reruns are recorded below as they
complete.

## Boundary Evidence

- The restore drill uses only synthetic markers and redacted ignored local evidence.
- Workflow automation remains preview/review-only: no automatic runner, background mutation, or
  external connector execution.
- Client portal activity/read-state fields are additive to authorized workspace data and do not
  widen portal grants or public-token semantics.
- Email/calendar/scheduling updates improve staff failure handoff while production email, public
  booking, provider sync, and native media stay disabled unless separately configured.
- Billing/trust reconciliation summaries are review-only over existing records. They do not mutate
  invoice balances, initiate live settlement, import bank feeds, or automatically post trust
  transfers.
- Document intelligence surfaces expose provider readiness and metadata-only evidence posture.
  OCR/AI/transcription/provider payload activation and raw private text retention remain disabled
  boundaries.
