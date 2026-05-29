# Dependency Refresh Proof 2026-05-28

## Scope

- Refreshed pnpm workspace package manifests and `pnpm-lock.yaml` with `pnpm@11.4.0`.
- Updated root package-manager pin from `pnpm@11.1.3` to `pnpm@11.4.0`.
- Refreshed Docker app-base tooling to `node:26.2.0-alpine3.23`, `npm@11.16.0`, and
  `pnpm@11.4.0`.
- Kept the Postgres 18 local service on the pinned upstream digest while upgrading Alpine `libcurl`
  during the local image build.
- Pinned the Redis service image to the current `redis:8-alpine` digest.
- Updated the local Mailpit image from `v1.30.0` to `v1.30.1` with a pinned source archive hash.
- Updated dependency-maintenance docs with the new Docker snapshot.

Synthetic data only. No client, matter, credential, payment, private deployment, or privileged
document details were used.

## Package Updates

- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`: `3.1049.0` to `3.1055.0`.
- `@simplewebauthn/server`: `13.3.0` to `13.3.1`.
- `bullmq`: `5.76.10` to `5.77.6`.
- Tiptap packages: `3.23.4` to `3.23.6`.
- `docx`: `9.6.1` to `9.7.1`.
- `@types/node`: `25.9.0` to `25.9.1`.
- `@types/react`: `19.2.14` to `19.2.15`.
- `nodemailer`: `8.0.7` to `8.0.9`.
- `tsx`: `4.22.2` to `4.22.3`.
- `turbo`: `2.9.14` to `2.9.15`.
- `vitest`: `4.1.6` to `4.1.7`.
- `typescript-eslint` workspace dev dependency family: `8.59.4` to `8.60.0`.

`docx@9.7.0` was reviewed and intentionally skipped during the first refresh attempt because the
candidate update broke `@open-practice/providers` TypeScript builds: the published type surface did
not expose the named exports used by `packages/providers/src/draft-exports.ts`.

```text
Module '"docx"' has no exported member 'ExternalHyperlink'.
Module '"docx"' has no exported member 'HeadingLevel'.
Module '"docx"' has no exported member 'Packer'.
Module '"docx"' has no exported member 'Paragraph'.
Module '"docx"' has no exported member 'TextRun'.
```

The final dependency set uses `docx@9.7.1`. Its published type surface exposes
`ExternalHyperlink`, `HeadingLevel`, `Packer`, `Paragraph`, and `TextRun` again, and the provider
tests, typecheck, and build passed through `pnpm ci:local`.

## Docker Review

- `docker compose config --images` resolved:
  - `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`
  - `open-practice-mailpit:v1.30.1-go1.26.3`
  - `open-practice-dev-api`
  - `open-practice-dev-web`
  - `open-practice-dev-worker`
  - `open-practice-postgres:18-alpine-su-exec`
  - `redis:8-alpine@sha256:ad0a6eff0a40304ab1ab4f50f0dc192d82b071e1094eac961bcb6106092f8a4e`
- Docker Engine was reachable: `docker version --format '{{.Client.Version}} {{.Server.Version}}'`
  returned `29.5.2 29.5.2`.
- `docker compose build` passed for the final local API, web, worker, Postgres, and Mailpit images.
- Mailpit tag review found upstream `v1.30.1`, so the local image now builds that source archive
  with SHA-256 `bda226e88f828215fc3646258494e71ebfaf82074970ea28a319c91a64c068d2`.
- Docker Scout critical/high checks against the final local images:
  - Local API, web, and worker images: `0C`/`0H` and no vulnerable packages.
  - Redis digest: `0` findings.
  - Local Postgres image: `libcurl/curl@8.19.0-r0` reported `2` residual high findings
    (`CVE-2026-5773`, `CVE-2026-6276`) with no fixed Alpine package yet; Scout reported no base-image
    recommendation. The local image still removes the vulnerable upstream `gosu` helper, and the
    `libcurl` upgrade cleared the earlier `CVE-2026-3805` finding.
  - Local Mailpit `v1.30.1` image: `github.com/gomarkdown/markdown` reported `1` high finding.
    This is a reduction from the `v1.30.0` local scan, which also carried Go crypto/net criticals.
    Scout's base-image refresh was already current; the suggested Alpine tag change did not reduce
    the Go dependency finding.
  - MinIO pinned release: residual upstream findings remain. Scout reported `14` vulnerable packages
    with `45` CVE entries, with the overview counting `21C`/`38H` vulnerable package occurrences
    across duplicated Go modules. The largest clusters are `golang.org/x/crypto`, Go `stdlib`,
    `github.com/minio/minio`, and `golang.org/x/net`; Scout reported no tag recommendation.

Skipped compose `up --wait` health probes in this closeout. Docker Engine was available for final
local image build and Scout proof, and no running-stack behavior changed.

## Validation

Selector:

```bash
npm exec --yes --package=pnpm@11.4.0 -- pnpm verify:select -- --files \
  Dockerfile \
  apps/api/package.json \
  apps/web/package.json \
  apps/worker/package.json \
  docker-compose.yml \
  docker/mailpit/Dockerfile \
  docker/postgres/Dockerfile \
  docs/development/github-maintenance.md \
  docs/validation/README.md \
  docs/validation/DEPENDENCY_REFRESH_PROOF_2026-05-28.md \
  package.json \
  packages/database/package.json \
  packages/domain/package.json \
  packages/providers/package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml
```

Recommended the dependency-maintenance gate family, including `pnpm ci:local`, `pnpm deps:audit`,
`pnpm deps:licenses`, docs/policy checks, package tests/typechecks, database checks, and build.

Passed:

```bash
npm exec --yes --package=pnpm@11.4.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.4.0 -- pnpm deps:audit
npm exec --yes --package=pnpm@11.4.0 -- pnpm deps:licenses
npm exec --yes --package=pnpm@11.4.0 -- pnpm ci:local
npm exec --yes --package=pnpm@11.4.0 -- pnpm outdated -r --format json
docker compose config --images
docker version --format '{{.Client.Version}} {{.Server.Version}}'
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
```

Freshness check:

```bash
npm exec --yes --package=pnpm@11.4.0 -- pnpm outdated -r --format json
```

Final output was `{}`.

Notes:

- `pnpm deps:audit` reported no known vulnerabilities for production or development dependency sets.
- `pnpm deps:licenses` completed successfully and kept the existing review-required license groups
  visible for manual review.
- `pnpm ci:local` passed format, lint, typecheck, tests, database check, policy checks, build, and
  `git diff --check`.
- The first `pnpm ci:local` rerun after lockfile refresh stopped at `pnpm-lock.yaml` formatting.
  `pnpm exec prettier --write pnpm-lock.yaml` fixed the mechanical lockfile formatting, and the
  final `pnpm ci:local` rerun passed.
