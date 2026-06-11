# Dependency Refresh Proof

Date: 2026-06-11
Branch: `chore/dependency-refresh-2026-06-11`

## Scope

This maintenance slice refreshes npm/pnpm dependencies conservatively without changing public API
contracts, database schema, route behavior, Docker image pins, or runtime container contracts.

- Updated patch/minor package versions across the workspace manifests and `pnpm-lock.yaml`.
- Updated `packageManager` from `pnpm@11.4.0` to `pnpm@11.5.3`.
- Updated `pnpm-workspace.yaml` minimum-release-age exclusions to the exact resolved package
  versions in the refreshed lockfile.
- Refreshed `docs/oss-references.lock.json` commit metadata to match the central reference index
  after final `pnpm ci:local` policy validation surfaced reference-lock drift.
- Kept `@fastify/rate-limit@10.3.0` and `pdfkit@0.18.0` held because their available updates are
  major-version compatibility reviews.
- Kept Docker posture to inventory/watch evidence only; no Dockerfile, Compose, or image pin
  changes are included.

## Changed Path Set

Final changed-path selector input:

```text
apps/api/package.json
apps/web/package.json
apps/worker/package.json
docs/oss-references.lock.json
docs/planning-and-progress.md
docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md
docs/validation/README.md
package.json
packages/database/package.json
packages/domain/package.json
packages/providers/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Dependency Review

Pre-refresh `pnpm deps:audit` was green for production and development dependencies. The
pre-refresh `pnpm outdated -r --format json` showed patch/minor candidates for AWS SDK, BullMQ,
Next, React, TipTap, ProseMirror, provider email parsing/sending packages, sanitizer, tooling, and
types packages, plus two held major candidates. A newer `@types/node@25.9.3` patch appeared during
final reconciliation and was included in the safe refresh before the final gate rerun.

Post-refresh `pnpm outdated -r --format json` reports only the intentionally held major candidates:

```text
@fastify/rate-limit 10.3.0 -> 11.0.0
pdfkit 0.18.0 -> 0.19.1
```

`docx@9.7.1` remains unchanged.

## Docker Inventory

`docker compose config --images` rendered the current image inventory without requiring image pin
changes:

```text
open-practice-dev-api
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
redis:8.8.0-alpine@sha256:09160599abd229764c0fb44cb6be640294e1d360a54b19985ab4843dcf2d90f1
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-dev-worker
open-practice-dev-web
open-practice-postgres:18-alpine-su-exec
open-practice-mailpit:v1.30.1-go1.26.4
```

MinIO appears twice because the `minio` and `minio-init` services intentionally share the same
wrapped image.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/oss-references.lock.json docs/planning-and-progress.md docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-11.md docs/validation/README.md package.json packages/database/package.json packages/domain/package.json packages/providers/package.json pnpm-lock.yaml pnpm-workspace.yaml
```

Result: passed. The selector recommended the broad dependency lane: `pnpm ci:local`,
`pnpm deps:audit`, `pnpm deps:licenses`, format/docs/policy checks, package tests/typechecks/builds
for domain, database, API, providers, worker, and web, database check, migration integrity, and
`pnpm build`.

Required dependency gates:

```bash
pnpm deps:audit
pnpm deps:licenses
pnpm ci:local
```

Result: `pnpm deps:audit` passed with no known production or development vulnerabilities.
`pnpm deps:licenses` passed with 549 packages / 577 versions and the existing review-required
license groups surfaced for governance review.

Docker posture checks:

```bash
docker compose config --images
pnpm docker:residual-watch
```

Result: image inventory captured. `pnpm docker:residual-watch` passed and wrote local evidence to
`/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-11T22-15-10Z`.

Full local gate:

```bash
pnpm ci:local
```

Result: passed after refreshing `docs/oss-references.lock.json` to match the central reference
index. The final rerun included formatting, lint, typecheck, workspace tests plus script tests,
database schema check, policy checks, production build, and `git diff --check`.
