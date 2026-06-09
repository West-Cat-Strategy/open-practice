# Docker Security And Efficiency Refactor Proof

Date: 2026-06-09
Branch: `codex/docker-hardening-efficiency-2026-06-07`
Base: `HEAD`, `main`, and `origin/main` all resolved to `76d950e9` after `git fetch origin main`.

## Scope

This maintenance slice hardens the local Docker development stack without changing image versions or
promoting a production deployment profile.

- Compose host exposure is split across scoped loopback defaults for infrastructure, API, web, and
  individual host ports.
- The API container refuses to start with non-loopback host binding while local dev auth/setup flags
  are enabled.
- All Compose services use no-new-privileges. API, Web, Worker, Mailpit, and MinIO drop Linux
  capabilities. Postgres and Redis keep conservative upstream-compatible capability handling.
- MinIO volume ownership moved to a bounded one-shot `minio-init` service; the MinIO service process
  now runs as uid `10001` with dropped capabilities instead of doing recursive startup ownership work.
- Mailpit runs as uid `10001`; API, Web, and Worker run as uid `1001`.
- The app Dockerfile installs from manifest-first layers with BuildKit caches, deploys production
  dependencies, keeps pnpm store and metadata caches on cache mounts, disables Turbo/Next telemetry,
  and avoids a generic `pnpm start` runtime default.
- API and Worker keep `tsx` only as a development dependency.
- Docker build context ignores local proof, generated output, package-manager token files, shell
  credentials, cloud credentials, SSH material, and local secret folders.
- Relaxed web CSP requires both `OPEN_PRACTICE_DOCKER_LOCAL_DEV=true` and
  `OPEN_PRACTICE_IMAGE_PROFILE=local-dev`, so the relaxed profile is harder to promote accidentally.
- `pnpm docker:app-smoke` defaults to an isolated disposable Compose project on alternate loopback
  ports, while `--keep-up` intentionally targets the normal dev stack and `--refresh` opts into
  network pulls and `build --pull`.
- `pnpm verify:select` now recommends `pnpm docker:app-smoke` for Dockerfile, Compose, and runtime
  config changes.

## Changed Path Set

Final dirty-path selector input:

```text
.dockerignore
Dockerfile
apps/api/package.json
apps/web/app/security-headers.test.ts
apps/web/next.config.mjs
apps/worker/package.json
docker-compose.yml
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docs/deployment-hardening.md
docs/development/getting-started.md
docs/development/github-maintenance.md
docs/testing/TESTING.md
docs/validation/OP_DOCKER_SECURITY_EFFICIENCY_REFACTOR_PROOF_2026-06-07.md
docs/validation/README.md
package.json
pnpm-lock.yaml
scripts/docker-app-smoke.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/validate-local-evidence-dockerignore.mjs
scripts/validate-local-evidence-dockerignore.test.mjs
turbo.json
```

## Validation

Selector:

```bash
{ git diff --name-only; git ls-files --others --exclude-standard; } | xargs pnpm verify:select -- --files
```

Result: passed. The selector recommended:

```text
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Selector contract:

```bash
node --test scripts/select-validation.test.mjs
```

Result: passed, 12 tests.

Broad and policy checks:

```bash
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Result: passed. `pnpm ci:local` included formatting, lint, typecheck, tests, database check,
`pnpm policy:check`, build, and `git diff --check`. `pnpm deps:audit` reported no known production
or development vulnerabilities. `pnpm deps:licenses` reported 550 packages / 579 versions with the
repo's review-required license groups surfaced for governance review.

Docker checks:

```bash
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm e2e:docker
docker compose config --images
OPEN_PRACTICE_DOCKER_API_HOST_BIND=0.0.0.0 docker compose config
pnpm docker:app-smoke -- --keep-up --refresh
```

Result: passed.

- `pnpm docker:residual-watch` wrote
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-09T17-50-00Z`.
- Default `pnpm docker:app-smoke` built the wrapped service images plus API/Web/Worker images,
  started an isolated disposable stack on alternate loopback ports, migrated PostgreSQL, verified
  PostgreSQL-backed API health at `127.0.0.1:44000`, verified web readiness at `127.0.0.1:43000`,
  and removed the temporary containers, network, and volumes.
- `pnpm e2e:docker` passed 5 Docker-backed Playwright tests and cleaned its temporary stack and
  volumes.
- `docker compose config --images` rendered:

```text
open-practice-mailpit:v1.30.1-go1.26.4
open-practice-dev-worker
redis:8.8.0-alpine@sha256:09160599abd229764c0fb44cb6be640294e1d360a54b19985ab4843dcf2d90f1
open-practice-dev-api
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-postgres:18-alpine-su-exec
open-practice-dev-web
```

MinIO appears twice because `minio` and `minio-init` intentionally use the same wrapped image.

- The non-loopback API bind render included
  `case "0.0.0.0" ... Refusing to start API with non-loopback OPEN_PRACTICE_DOCKER_API_HOST_BIND`,
  proving the guard is present before container startup.
- `pnpm docker:app-smoke -- --keep-up --refresh` pulled Redis, rebuilt the wrapped/app images with
  `--pull`, recreated the normal dev stack, migrated the default Compose database, checked
  PostgreSQL-backed API health, checked web readiness, and left the stack running.

Final live stack checks:

```bash
docker compose ps --format json
curl -fsS http://127.0.0.1:34000/health
curl -fsSI http://127.0.0.1:33000/
docker compose exec -T api id -u
docker compose exec -T web id -u
docker compose exec -T worker id -u
docker compose exec -T mailpit id -u
docker compose exec -T minio ps -o user,args
docker compose ps -a minio-init --format json
```

Result: passed.

- API health returned `{"ok":true,"service":"open-practice-api","persistence":"postgres"}`.
- Web returned `HTTP/1.1 200 OK` with the local Docker CSP profile and HSTS.
- Published ports are loopback-bound: web `127.0.0.1:33000`, API `127.0.0.1:34000`, Postgres
  `127.0.0.1:35432`, Redis `127.0.0.1:36379`, MinIO `127.0.0.1:39000/39001`, and Mailpit
  `127.0.0.1:31025/38025`.
- API, Web, and Worker reported uid `1001`; Mailpit reported uid `10001`.
- MinIO process output showed `minio /usr/local/bin/minio server /data --console-address :9001`.
- `minio-init` exited with status `0`.

## 2026-06-09 Pre-Commit Refresh

The final pre-commit validation reran the selector-selected branch lane. The first Docker E2E
attempt found the prior `--keep-up` dev stack still holding Mailpit port `127.0.0.1:31025`, so the
partial E2E project was removed and the local `open-practice-dev` stack was stopped without
removing volumes. `pnpm e2e:docker` then passed on a fresh E2E stack, and the remaining selected
static/package checks plus `git diff --check` passed before commit. The local dev stack was left
stopped after this refresh so the branch proof reflects the final local container state.
