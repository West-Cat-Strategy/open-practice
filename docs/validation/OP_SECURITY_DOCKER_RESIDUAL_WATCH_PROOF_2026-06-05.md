# Open Practice Docker Residual Watch Proof - 2026-06-05

## Scope

- Branch: `security/hot-path-rescan-command-2026-06-05`
- Purpose: add a narrow local watch for the 2026-06-05 wrapped Mailpit, MinIO, and Postgres Docker
  residuals.
- Data posture: synthetic local validation only. No client, matter, credential, payment, private
  deployment, raw MIME, signing, storage-key, or private note material was added.

This slice adds a repeatable local command that re-checks whether newer same-contract upstream
source tags, registry manifests, or Docker Scout recommendations now provide a safer path for the
documented service-image residuals. It does not change image pins, Compose service names, ports,
volumes, credentials, runtime APIs, application behavior, package dependencies, provenance policy, or
Docker E2E expectations.

## Result

Added `scripts/watch-docker-residuals.mjs` and the package script:

```bash
pnpm docker:residual-watch
```

The helper reads `docker-compose.yml` and the wrapped service Dockerfiles for:

- `open-practice-postgres:18-alpine-su-exec`
- `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4`
- `open-practice-mailpit:v1.30.1-go1.26.4`

It writes ignored local evidence under
`/tmp/codex-security-scans/open-practice/docker-residual-watch/<timestamp>/`, including command logs,
`docker-residual-watch.json`, and a short README. Exit `0` means the residuals remain current, exit
`2` means a candidate requires a separate review, and exit `1` means Docker, Scout, registry, source
tag, or network checks were blocked.

## Changed Paths

```text
docs/development/github-maintenance.md
docs/planning-and-progress.md
docs/validation/OP_SECURITY_DOCKER_RESIDUAL_WATCH_PROOF_2026-06-05.md
docs/validation/README.md
package.json
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```

## Validation

Selector:

```bash
pnpm verify:select -- --files package.json scripts/watch-docker-residuals.mjs scripts/watch-docker-residuals.test.mjs docs/development/github-maintenance.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_SECURITY_DOCKER_RESIDUAL_WATCH_PROOF_2026-06-05.md
```

Selected checks:

```bash
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

Focused and command proof:

```bash
node --test scripts/watch-docker-residuals.test.mjs
pnpm docker:residual-watch
git diff --check
```

Results:

- `node --test scripts/watch-docker-residuals.test.mjs` passed: 7 tests.
- `pnpm docker:residual-watch` wrote
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-06T05-09-42Z` and exited
  `1` with status `blocked`.
- Docker Scout was installed (`v1.21.0`), and `docker compose config --images` resolved the current
  local service images.
- Registry/source-tag evidence still matched the documented residual posture where checks could run:
  Postgres `18-alpine` still resolved to
  `sha256:96d56f7f57c6aacd1fcb908bc83b345ec5f83231ee486dd66a1baadce274db88`; Docker Hub and Quay
  MinIO `latest` still resolved to
  `sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`; Docker Hub and Quay
  still did not publish `minio/minio:RELEASE.2025-10-15T17-29-55Z`; upstream MinIO's latest source
  tag remained `RELEASE.2025-10-15T17-29-55Z`; upstream Mailpit's latest source tag remained
  `v1.30.1`; Docker Hub published `axllent/mailpit:v1.30.1` and `latest` at the same manifest
  digest, `sha256:3bd7c2f2696deb35a4780d152b404dceec99cb041b942c0877b3b22384714f85`.
- Local image Scout quickview, critical/high CVE, and recommendation checks were blocked because
  Docker Engine was unavailable:
  `Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock. Is the docker daemon running?`
- After recording the artifact result, the selector was rerun and again recommended the same command
  set. `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm deps:audit`,
  `pnpm deps:licenses`, and `pnpm ci:local` passed on the final edited tree. `pnpm ci:local`
  includes `pnpm test` and `git diff --check`; the script test count was 51 tests across 11 suites
  because the working tree also contains an unrelated local hot-path rescan test file.
