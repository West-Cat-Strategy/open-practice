# Docker Image CVE Follow-Up Proof 2026-06-04

## Scope

- Branch: `codex/minio-docker-hardening-2026-06-04`
- Base: local `main` and `origin/main` at `16a9452a74dea18dd2a8250cf183480d1299d20a`
- Worktree: `/Users/bryan/projects/open-practice-minio-hardening-2026-06-04`
- Original dirty checkout preserved untouched at `/Users/bryan/projects/open-practice`.

This pass takes the open MinIO residual from the earlier Docker image CVE follow-up and attempts the
smallest same-contract reduction. It uses synthetic local validation evidence only and makes no API,
schema, route, auth, database, application, credential, S3 endpoint, bucket, port, or volume-contract
change.

## Decision

Landed a same-contract MinIO image hardening slice. The local Docker stack now builds
`open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3` from the upstream MinIO source tag
`RELEASE.2025-10-15T17-29-55Z`, verifies commit
`9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a` during the Docker build, and keeps the service as a
separate wrapped AGPL container with upstream `LICENSE` and `CREDITS` copied inside the image.

The app-facing Compose contract is unchanged:

- Compose service name remains `minio`.
- Command remains `server /data --console-address ":9001"`.
- Published ports remain `39000:9000` and `39001:9001`.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`
  wiring remains unchanged.
- The `/data` volume remains `minio-data`.

Current Docker Scout evidence has drifted since the earlier proof. The prior note recorded
`12C/33H` for the pinned upstream MinIO image; the current Scout database reports `21C/39H` on both
arm64 and amd64 for the same pinned manifest. The accepted local wrapped image reports `11C/17H` on
arm64 and passes Docker-backed object-storage/browser validation.

Postgres and Mailpit were not changed in this slice. Their previous residual posture remains
documented here as background.

## Image Review

### MinIO Baseline

- `docker compose config --images` initially resolved MinIO to
  `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`.
- `docker buildx imagetools inspect minio/minio:latest` and
  `docker buildx imagetools inspect quay.io/minio/minio:latest` both resolved to the same manifest
  list digest, `sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`.
- The arm64 manifest remained
  `sha256:9966a92a734f9411e32f4f41d7d9d826fcdc0f68c4e20b70295bd4e7c11f8a2f`; the amd64 manifest
  remained `sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2`.
- `docker buildx imagetools inspect minio/minio:RELEASE.2025-10-15T17-29-55Z` and the Quay
  equivalent both returned `not found`, so no official same-product image pin was available.
- `docker scout recommendations` for the pinned image reported no tag recommendations.

### MinIO Candidate

- `docker/minio/Dockerfile` clones the upstream MinIO tag during build, verifies commit
  `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`, compiles a static MinIO binary with the existing
  `golang:1.26.3-alpine3.23` builder pattern, and uses an Alpine runtime so
  `docker compose exec -T minio sh -c 'mkdir -p /data/...` remains available to the existing
  Docker E2E harness.
- `docker run --rm --entrypoint /usr/local/bin/minio open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3 --version`
  reported `minio version RELEASE.2025-10-15T17-29-55Z`, commit
  `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`, runtime `go1.26.3 linux/arm64`, and license
  `GNU AGPLv3`.
- `docker image inspect open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3` reported image
  id `sha256:41bf3912027030e33d5d9e203d6a9a39540d179313608526a1b3766401c081a0`,
  architecture `arm64`, and OS `linux`.
- `docker scout recommendations local://open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3`
  suggested an Alpine base-tag alternative with the same critical/high posture, so no further
  same-contract base-image reduction was accepted.

### Postgres And Mailpit Residuals

- Postgres remains `open-practice-postgres:18-alpine-su-exec`; the earlier proof showed it still
  has two high `curl/libcurl 8.19.0-r0` findings with no fixed Alpine package and no Scout
  recommendation.
- Mailpit remains `open-practice-mailpit:v1.30.1-go1.26.3`; the earlier proof showed it still has
  one high `github.com/gomarkdown/markdown` finding and no newer upstream Mailpit release tag.

## Validation

Preflight and inventory:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse main
git rev-parse origin/main
git status --short --branch # in /Users/bryan/projects/open-practice
docker version --format '{{.Client.Version}} {{.Server.Version}}'
docker scout version
docker compose config --images
```

Baseline MinIO evidence:

```bash
docker buildx imagetools inspect minio/minio:latest
docker buildx imagetools inspect quay.io/minio/minio:latest
docker buildx imagetools inspect minio/minio:RELEASE.2025-10-15T17-29-55Z
docker buildx imagetools inspect quay.io/minio/minio:RELEASE.2025-10-15T17-29-55Z
docker scout recommendations registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
docker scout cves --only-severity critical,high --format packages registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
docker scout cves --platform linux/amd64 --only-severity critical,high --format packages registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
```

Candidate and Docker behavior proof:

```bash
docker compose build minio
docker run --rm --entrypoint /usr/local/bin/minio open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3 --version
docker image inspect open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3 --format '{{.Id}} {{.Architecture}} {{.Os}}'
docker scout recommendations local://open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3
docker scout cves --only-severity critical,high --format packages local://open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3
docker compose up -d postgres redis minio mailpit
docker compose ps
curl -fsS http://localhost:39000/minio/health/ready
docker compose exec -T minio sh -c 'mkdir -p /data/open-practice-documents && test -d /data/open-practice-documents'
docker compose down --remove-orphans
docker compose -p open-practice-e2e down -v --remove-orphans
pnpm e2e:docker
```

Selector-guided final gates:

```bash
pnpm verify:select -- --files docker-compose.yml docker/minio/Dockerfile docs/development/github-maintenance.md docs/validation/README.md docs/validation/DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm build
git diff --check
```

Results:

- `docker version --format '{{.Client.Version}} {{.Server.Version}}'` reported `29.5.2 29.5.2`.
- `docker scout version` reported `v1.21.0`.
- Baseline official pinned MinIO Scout result: `21C/39H` on arm64 and `21C/39H` on amd64.
- Accepted local wrapped MinIO Scout result: `11C/17H` on arm64, reducing the current arm64
  critical/high posture by `10C/22H`.
- `docker compose build minio` passed after verifying the upstream tag commit.
- Final `docker compose config --images` resolved MinIO to
  `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3`.
- Final `docker scout cves --only-severity critical,high
local://open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3` analyzed local digest
  `41bf39120270` on `linux/arm64` and reported `11C/17H`.
- `docker compose up -d postgres redis minio mailpit` recreated `open-practice-dev-minio-1` with
  `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3`.
- `curl -fsS http://localhost:39000/minio/health/ready` passed.
- `docker compose exec -T minio sh -c 'mkdir -p /data/open-practice-documents && test -d /data/open-practice-documents'`
  passed, preserving the existing Docker E2E bucket setup behavior.
- Before `pnpm e2e:docker`, the local `open-practice-dev` stack was stopped to free the fixed
  infrastructure ports. `docker compose -p open-practice-e2e down -v --remove-orphans` found no
  stale E2E resources.
- `pnpm e2e:docker` passed with 5 Playwright Docker checks, including the Docker-backed external
  upload receipt flow, and cleaned up the disposable E2E stack.
- After E2E cleanup, both `docker compose ps -a` and `docker compose -p open-practice-e2e ps -a`
  showed no running containers for those projects.
- `pnpm verify:select -- --files ...` recommended `pnpm format:check`, `pnpm docs:check`,
  `pnpm policy:check`, and `pnpm build`.
- `pnpm format:check` initially reported Markdown wrapping issues in this proof and
  `docs/validation/README.md`; after formatting the touched Markdown files, the rerun passed.
- `pnpm docs:check`, `pnpm policy:check`, `pnpm build`, and `git diff --check` passed.

Final MinIO critical/high counts:

| Image                                                                                                                         | Platform      | Scout critical/high result | Outcome                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------: | --------------------------------------------------------- |
| `registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e` | `linux/arm64` |                  `21C/39H` | Baseline pinned image; no Scout tag recommendation.       |
| `registry://minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e` | `linux/amd64` |                  `21C/39H` | Baseline pinned image; no official newer image tag found. |
| `local://open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3`                                                           | `linux/arm64` |                  `11C/17H` | Accepted local wrapped-service image; Docker E2E passed.  |

## Residuals

- MinIO still has `11C/17H` in the accepted arm64 Scout scan. The largest remaining groups are
  `golang.org/x/crypto`, MinIO's own upstream module advisories marked not fixed, and Go dependency
  findings that require future upstream dependency movement or a newer Go/base rebuild.
- Docker Hub and Quay `latest` still resolve to the old pinned manifest digest, and the newer
  upstream source tag is not published as an official Docker Hub or Quay image.
- The accepted image is a wrapped AGPL service container. Do not copy MinIO source into Open
  Practice core code, and keep future production use subject to the repository reuse/license policy.
