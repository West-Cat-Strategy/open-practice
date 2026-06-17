# Docker App Image Footprint And Compose Hardening Proof

Date: 2026-06-16
Branch: `codex/docker-footprint-hardening`
Worktree: `/Users/bryan/projects/open-practice-docker-footprint-hardening`
Status: Final validation recorded; 2026-06-17 follow-up keeps the Postgres pin unchanged because
Docker Engine/Scout proof is blocked.

## Scope

This proof covers the Docker app-image footprint and local Compose hardening lane:

- Docker app images now build through `turbo prune --docker` with `pnpm@11.5.3`, matching the root
  `packageManager`, on the pinned Node 26 Alpine base.
- API and Worker runtime targets deploy production package output, while Web runs the Next
  standalone traced server instead of a full `node_modules/next start` runtime.
- `.dockerignore` excludes docs, E2E, test, build, cache, local evidence, and credential material
  from app-image build contexts.
- Compose stays explicitly local-dev only: all published ports render on `127.0.0.1`, alternate host
  ports require matching public-origin variables, Redis is ephemeral, and local development secrets
  remain local-only.
- Compose now self-initializes local database migrations through `db-migrate` and the MinIO bucket
  through `minio-bucket-init`; API/Web/Worker wait on the relevant successful setup and health
  conditions.
- Wrapped MinIO and Mailpit source builds retain their source-verified posture and add BuildKit Go
  and npm cache mounts for build efficiency.

Out of scope: application HTTP API contracts, domain types, database schema, route contracts, and any
production Compose profile.

## Final Path Set

Selector and validation used this exact changed-path set:

```text
.dockerignore
.env.example
Dockerfile
apps/web/next.config.mjs
docker-compose.yml
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docs/deployment-hardening.md
docs/development/getting-started.md
docs/testing/TESTING.md
docs/validation/README.md
docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md
scripts/docker-app-smoke.mjs
```

## Image Footprint

Baseline app images were captured before implementation with:

```bash
DOCKER_BUILDKIT=1 docker compose build api web worker
docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker --format '{{.RepoTags}} {{.Size}}'
```

Final app images were rebuilt with:

```bash
DOCKER_BUILDKIT=1 docker compose build api web worker db-migrate
docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker open-practice-dev-db-migrate --format '{{.RepoTags}} {{.Size}}'
```

| Image                             | Baseline bytes | Final bytes | Delta bytes  |
| --------------------------------- | -------------- | ----------- | ------------ |
| `open-practice-dev-api:latest`    | 104,035,499    | 103,755,736 | -279,763     |
| `open-practice-dev-web:latest`    | 191,496,807    | 78,654,918  | -112,841,889 |
| `open-practice-dev-worker:latest` | 101,606,832    | 101,499,655 | -107,177     |

The local migration image is a tooling target, not a deployable app image:
`open-practice-dev-db-migrate:latest` measured `191,316,503` bytes.

Build context evidence:

- Baseline app-image build context: `15.01MB`.
- Final default app-image build context: `47.46kB`.

## Compose Hardening Evidence

Read-only Compose rendering:

```bash
docker compose config --images
```

Rendered images:

```text
open-practice-dev-worker
redis:8.8.0-alpine@sha256:09160599abd229764c0fb44cb6be640294e1d360a54b19985ab4843dcf2d90f1
open-practice-mailpit:v1.30.1-go1.26.4
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-dev-db-migrate
open-practice-dev-api
open-practice-postgres:18-alpine-su-exec
open-practice-dev-web
```

MinIO appears twice because `minio` and `minio-bucket-init` intentionally share the same wrapped
local image.

Alternate-port render proof:

```bash
OPEN_PRACTICE_DOCKER_API_HOST_BIND=0.0.0.0 \
OPEN_PRACTICE_DOCKER_WEB_HOST_BIND=0.0.0.0 \
OPEN_PRACTICE_DOCKER_INFRA_HOST_BIND=0.0.0.0 \
OPEN_PRACTICE_DOCKER_API_HOST_PORT=44000 \
OPEN_PRACTICE_DOCKER_WEB_HOST_PORT=43000 \
docker compose config --format json
```

The rendered JSON still published API/Web/Postgres/Redis/MinIO/Mailpit on `host_ip:
"127.0.0.1"`. API `WEBAUTHN_ORIGIN` and `PUBLIC_WEB_BASE_URL` rendered
`http://localhost:43000`; Web `NEXT_PUBLIC_API_BASE_URL` rendered `http://localhost:44000`.

## Selector Output

```bash
pnpm verify:select -- --files .dockerignore .env.example Dockerfile apps/web/next.config.mjs docker-compose.yml docker/mailpit/Dockerfile docker/minio/Dockerfile docs/deployment-hardening.md docs/development/getting-started.md docs/testing/TESTING.md docs/validation/README.md docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md scripts/docker-app-smoke.mjs
```

Output:

```text
Recommended validation commands:
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

Fresh-worktree package hydration:

| Command                                        | Status | Notes                                                      |
| ---------------------------------------------- | ------ | ---------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`    | Pass   | Required before web checks in this fresh sibling worktree. |
| `pnpm --filter @open-practice/database build`  | Pass   | Required before broad package validation.                  |
| `pnpm --filter @open-practice/providers build` | Pass   | Required before broad package validation.                  |

Selected validation:

| Command                                                                                                                                                     | Status                           | Notes                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                                            | Pass                             | Output listed above.                                                                                                                                                                    |
| `DOCKER_BUILDKIT=1 docker compose build api web worker db-migrate`                                                                                          | Pass                             | Final app-image build context was `47.46kB`.                                                                                                                                            |
| `docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker open-practice-dev-db-migrate --format '{{.RepoTags}} {{.Size}}'` | Pass                             | Final image sizes listed above.                                                                                                                                                         |
| `pnpm docker:residual-watch`                                                                                                                                | Needs review, expected           | Exited 2 for `postgres-upstream-18-alpine-manifest` registry-manifest drift only; no blockers.                                                                                          |
| `pnpm docker:app-smoke`                                                                                                                                     | Pass                             | Compose built app images, ran `minio-bucket-init`, ran `db-migrate`, started API/Worker/Web, confirmed PostgreSQL-backed `/health`.                                                     |
| `pnpm e2e:docker`                                                                                                                                           | Pass after local browser install | First attempt reached Playwright but failed before app assertions because the local Chromium cache was missing. After `pnpm exec playwright install chromium`, rerun passed `3 passed`. |
| `pnpm --filter @open-practice/web test`                                                                                                                     | Pass                             | 37 files, 200 tests.                                                                                                                                                                    |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                | Pass                             | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                        |
| `pnpm test`                                                                                                                                                 | Pass                             | Turbo package tests passed; script tests passed 63 tests across 13 suites.                                                                                                              |
| `pnpm build`                                                                                                                                                | Pass                             | Turbo build passed for all six workspaces.                                                                                                                                              |
| `pnpm format:check`                                                                                                                                         | Pass                             | All matched files use Prettier code style.                                                                                                                                              |
| `pnpm docs:check`                                                                                                                                           | Pass                             | Documentation link validation passed.                                                                                                                                                   |
| `pnpm policy:check`                                                                                                                                         | Pass                             | Secret scan, package manifest policy, dead-code, migrations, OSS reuse, docs links, proof index, local-evidence `.dockerignore`, and boundary policy passed.                            |
| `git diff --check`                                                                                                                                          | Pass                             | No whitespace errors.                                                                                                                                                                   |

Residual-watch artifact:

```text
/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-17T02-17-06Z
```

The artifact reports:

- Status: `needs-review`
- Candidate: `postgres-upstream-18-alpine-manifest`
- Kind: `registry-manifest-drift`
- Current digest: `sha256:96d56f7f57c6aacd1fcb908bc83b345ec5f83231ee486dd66a1baadce274db88`
- Observed digest: `sha256:d3e64d36360a9f40c30fbbc5dd2dde799fe35f8537500c8b067551a6497f50f4`
- Blockers: none

## 2026-06-17 Postgres Manifest-Drift Follow-Up

Branch: `codex/docker-residual-postgres-drift-2026-06-17`
Worktree: `/Users/bryan/projects/open-practice-docker-residual-postgres-drift`

The root checkout became occupied by unrelated dirty work during the first residual-watch attempt, so
this follow-up continued in the clean sibling worktree above. No Dockerfile, Compose, dependency, or
runtime image change is made in this branch. Compose remains local-development-only and loopback
bound.

Final path set:

```text
docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md
docs/validation/README.md
```

Branch-local residual-watch command:

```bash
pnpm docker:residual-watch
```

Artifact:

```text
/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-17T22-46-09Z
```

The clean branch-local artifact reports:

- Status: `blocked`
- Postgres candidate: `postgres-upstream-18-alpine-manifest`
- Kind: `registry-manifest-drift`
- Current digest: `sha256:96d56f7f57c6aacd1fcb908bc83b345ec5f83231ee486dd66a1baadce274db88`
- Observed digest: `sha256:d3e64d36360a9f40c30fbbc5dd2dde799fe35f8537500c8b067551a6497f50f4`
- Docker blocker: `docker-version` cannot connect to
  `unix:///Users/bryan/.docker/run/docker.sock`
- Scout blockers: Postgres, MinIO, and Mailpit quickview, critical/high CVE, and recommendation
  checks all failed because Docker Engine is unavailable
- Additional out-of-scope candidate: `mailpit-source-tags` reports `v1.30.2` newer than current
  `v1.30.1`

Decision: no same-contract Postgres pin update is safe in this follow-up. The registry manifest
probe still observes the Postgres 18.4 Alpine manifest drift, but Docker Engine and Scout are needed
to compare the wrapped local image's critical/high posture, recommendations, and runtime proof
before updating the pinned upstream digest. The existing
`open-practice-postgres:18-alpine-su-exec` wrapper, `su-exec` replacement, `libcurl>=8.19.0-r0`,
Postgres 18 contract, health check behavior, and Compose image name remain unchanged.

Follow-up selector:

```bash
pnpm verify:select -- --files docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md docs/validation/README.md
```

Selected validation:

| Command                             | Status  | Notes                                                   |
| ----------------------------------- | ------- | ------------------------------------------------------- |
| `pnpm docker:residual-watch`        | Blocked | Artifact path and blocker details are recorded above.   |
| `pnpm verify:select -- --files ...` | Pass    | Recommended format, docs, and policy checks.            |
| `pnpm format:check`                 | Pass    | Passed after formatting the two touched Markdown files. |
| `pnpm docs:check`                   | Pass    | Documentation link validation passed.                   |
| `pnpm policy:check`                 | Pass    | Policy, proof-index, and boundary gates passed.         |
| `git diff --check`                  | Pass    | No whitespace errors.                                   |

## Production Boundary

The default Compose file remains a local development and validation profile only. It uses
development credentials, local Mailpit capture, local MinIO endpoints, and local relaxed web CSP.
Ports are loopback-only and must not be widened for LAN or production use. Production publication
still requires a deployment-profile image scan, SBOM, secret scan, provenance, restore/rollback
proof, and production credential/origin wiring.
