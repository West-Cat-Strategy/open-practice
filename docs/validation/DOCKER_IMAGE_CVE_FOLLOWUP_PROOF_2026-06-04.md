# Docker Image CVE Follow-Up Proof 2026-06-04

## Scope

- Branch: `codex/security-image-cve-followup-2026-06-04`
- Base: local `main` at `e61df5b26ad0a3f1a56ca0e179095e789665c660`
- Worktree: `/Users/bryan/projects/open-practice-security-remediation-2026-06-03`
- Original checkout preserved untouched at `/Users/bryan/projects/open-practice`.

This pass rechecked the Docker image CVE posture after the security remediation merge handoff. It
uses synthetic local validation evidence only and makes no API, schema, route, auth, database, app,
or runtime behavior changes.

## Decision

No Docker image pins or Dockerfiles changed in this lane. Current registry and Scout evidence did
not show a same-contract image update that lowers critical/high findings for Postgres, Mailpit, or
MinIO.

- App images and Redis remained clean at `0C/0H`.
- The custom Postgres image remained better than upstream `postgres:18-alpine`: local
  `open-practice-postgres:18-alpine-su-exec` reports `0C/2H`, while upstream
  `postgres:18-alpine` reports `1C/18H`.
- Mailpit has no newer upstream tag than `v1.30.1`, and upstream `axllent/mailpit:latest` still
  reports the same `0C/1H` `github.com/gomarkdown/markdown` finding.
- Docker Hub and Quay MinIO `latest` resolve to the same manifest digest already pinned by Compose.
  The final SARIF-based Scout pass reports `12C/33H` for the pinned image, with no same-product tag
  recommendation.

## Image Review

### Postgres

- `docker buildx imagetools inspect postgres:18-alpine` resolved the tag to index digest
  `sha256:96d56f7f57c6aacd1fcb908bc83b345ec5f83231ee486dd66a1baadce274db88`; the arm64 manifest is
  `sha256:563d9a314daa3a9f8e3249e217514210a747970c36d50d83ae5e9dc6749fe354`.
- `apk list -a libcurl curl` inside `postgres:18-alpine` showed `curl-8.19.0-r0` and
  `libcurl-8.19.0-r0`; no newer fixed Alpine package was available.
- The local image contains `/sbin/su-exec`, no `gosu` binary, and no `gosu` references in the
  Postgres entrypoint scripts. `libcurl-8.19.0-r0` is required by the generated
  `.postgresql-rundeps-20260514.190037` package, so removal is not a safe same-contract fix.
- `docker scout recommendations` reported no recommendation for the local custom image or upstream
  `postgres:18-alpine`.

### Mailpit

- Upstream tag discovery with `git ls-remote --tags --refs https://github.com/axllent/mailpit.git`
  showed `v1.30.1` as the newest release tag.
- The local image reports `/mailpit v1.30.1 compiled with go1.26.3 on linux/arm64`.
- `docker scout cves --only-severity critical,high registry://axllent/mailpit:latest` reported the
  same `0C/1H` gomarkdown finding as the local build.
- `docker scout recommendations local://open-practice-mailpit:v1.30.1-go1.26.3` reported the base
  image as current; its suggested Alpine tag alternative did not reduce the Go dependency finding.

### MinIO

- `docker buildx imagetools inspect minio/minio:latest` and
  `docker buildx imagetools inspect quay.io/minio/minio:latest` both resolved to manifest-list
  digest `sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`; the arm64
  manifest is `sha256:9966a92a734f9411e32f4f41d7d9d826fcdc0f68c4e20b70295bd4e7c11f8a2f`.
- `docker scout cves --only-severity critical,high registry://quay.io/minio/minio:latest` matched
  the pinned Docker Hub image digest and did not identify a cleaner same-product image.
- `docker scout recommendations` reported no MinIO tag recommendation.
- Per lane scope, no custom MinIO build or S3-compatible service swap was attempted.

## Validation

Preflight:

```bash
git status --short --branch
git rev-parse HEAD
git status --short --branch # in /Users/bryan/projects/open-practice
docker version --format '{{.Client.Version}} {{.Server.Version}}'
docker scout version
```

Baseline and candidate evidence:

```bash
docker compose config --images
docker compose build
docker scout cves --only-severity critical,high local://open-practice-dev-api:latest
docker scout cves --only-severity critical,high local://open-practice-dev-web:latest
docker scout cves --only-severity critical,high local://open-practice-dev-worker:latest
docker scout cves --only-severity critical,high local://open-practice-postgres:18-alpine-su-exec
docker scout cves --only-severity critical,high local://open-practice-mailpit:v1.30.1-go1.26.3
docker scout cves --only-severity critical,high registry://redis:8-alpine@sha256:ad0a6eff0a40304ab1ab4f50f0dc192d82b071e1094eac961bcb6106092f8a4e
docker scout cves --only-severity critical,high registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
docker scout recommendations local://open-practice-postgres:18-alpine-su-exec
docker scout recommendations local://open-practice-mailpit:v1.30.1-go1.26.3
docker scout recommendations registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
docker scout cves --only-severity critical,high registry://axllent/mailpit:latest
docker scout cves --only-severity critical,high registry://quay.io/minio/minio:latest
```

Final handoff gates:

```bash
pnpm verify:select -- --files docs/development/github-maintenance.md docs/validation/README.md docs/validation/DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md
pnpm deps:audit
pnpm deps:licenses
pnpm policy:check
pnpm ci:local
pnpm migrations:check
docker compose config --images
docker compose build
docker compose up -d postgres redis minio mailpit
docker compose ps
pnpm migrations:replay
pnpm e2e:docker
git diff --check
```

Results:

- `pnpm verify:select -- --files ...` recommended `pnpm format:check`, `pnpm docs:check`, and
  `pnpm policy:check`.
- Final closeout reruns of `pnpm format:check` and `pnpm docs:check` passed.
- `pnpm deps:audit` passed with no known vulnerabilities in pnpm-managed dependencies.
- `pnpm deps:licenses` passed with the existing review-required license groups unchanged.
- `pnpm policy:check`, `pnpm migrations:check`, `docker compose config --images`, and
  `git diff --check` passed.
- `pnpm ci:local` initially failed because the new proof/docs needed Prettier formatting; after
  `pnpm exec prettier --write docs/development/github-maintenance.md docs/validation/README.md docs/validation/DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md`, `pnpm ci:local` passed. The final
  closeout rerun of `pnpm ci:local` also passed.
- `docker compose build` passed and rebuilt the app, Postgres, and Mailpit images.
- `docker compose up -d postgres redis minio mailpit` passed. Health checks passed with Postgres
  accepting connections, Redis returning `PONG`, MinIO live health returning success, and Mailpit
  `readyz` returning success.
- `pnpm migrations:replay` passed with 51 migrations applied to a disposable database and cleaned up.
- `pnpm e2e:docker` passed with 5 Playwright Docker checks and cleaned up the disposable E2E stack.
  During final closeout rerun, the first attempt hit a local port conflict because the dev Compose
  stack from `docker compose up -d postgres redis minio mailpit` still held Mailpit port
  `127.0.0.1:31025`; after `docker compose down --remove-orphans` and
  `docker compose -p open-practice-e2e down -v --remove-orphans`, the rerun passed.

Final Docker Scout proof was rerun after `docker compose build` because local app image manifest
digests can change when the build reruns. SARIF and recommendation artifacts are stored under
`/tmp/codex-security-scans/open-practice/image-cve-followup-2026-06-04/scout/`.

Final critical/high counts:

| Image                                                                                                                         | Final Scout critical/high result | Recommendation outcome                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------: | ------------------------------------------------------------------------------------------ |
| `local://open-practice-dev-api:latest`                                                                                        |                          `0C/0H` | Medium-only Node base suggestions; no critical/high reduction needed.                      |
| `local://open-practice-dev-web:latest`                                                                                        |                          `0C/0H` | Medium-only Node base suggestions; no critical/high reduction needed.                      |
| `local://open-practice-dev-worker:latest`                                                                                     |                          `0C/0H` | Medium-only Node base suggestions; no critical/high reduction needed.                      |
| `local://open-practice-postgres:18-alpine-su-exec`                                                                            |                          `0C/2H` | No recommendations.                                                                        |
| `local://open-practice-mailpit:v1.30.1-go1.26.3`                                                                              |                          `0C/1H` | Alpine-base suggestion keeps the same critical/high count; upstream tag remains `v1.30.1`. |
| `registry://redis:8-alpine@sha256:ad0a6eff0a40304ab1ab4f50f0dc192d82b071e1094eac961bcb6106092f8a4e`                           |                          `0C/0H` | No recommendations.                                                                        |
| `registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e` |                        `12C/33H` | No tag recommendations.                                                                    |

## Residuals

- Postgres: `curl/libcurl 8.19.0-r0` has two high findings (`CVE-2026-6276` and `CVE-2026-5773`)
  with no fixed Alpine package and no Scout recommendation.
- Mailpit: `github.com/gomarkdown/markdown` has one high finding (`CVE-2023-42821`) with no fixed
  version surfaced by Scout.
- MinIO: the current pinned MinIO image reports `12C/33H` in the final SARIF pass. The largest
  residual groups are Go stdlib, `golang.org/x/crypto`, and MinIO's own upstream module. Docker Hub
  and Quay latest resolve to the same digest and Scout reports no tag recommendation.
