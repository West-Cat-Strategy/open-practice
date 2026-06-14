# Dependency Refresh Proof

Date: 2026-06-13
Branch: `chore/dependency-refresh-2026-06-13`

## Scope

This maintenance slice refreshes npm/pnpm dependencies conservatively without changing public API
contracts, database schema, route behavior, Docker image pins, or runtime container contracts.

- Updated current patch/minor npm candidates across workspace manifests and `pnpm-lock.yaml`.
- Kept `@fastify/rate-limit@10.3.0` and `pdfkit@0.18.0` held because their available updates are
  major-version compatibility reviews.
- Left `pnpm-workspace.yaml` unchanged because the resolved dependency refresh did not require new
  minimum-release-age exclusions or override changes.
- Kept Docker posture to inventory/watch evidence only; no Dockerfile, Compose, or image pin
  changes are included.

## Changed Path Set

Final changed-path selector input:

```text
apps/api/package.json
apps/web/package.json
apps/worker/package.json
docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md
docs/validation/README.md
package.json
pnpm-lock.yaml
```

## Dependency Review

Pre-refresh `pnpm deps:audit` was green for production and development dependencies. The
pre-refresh `pnpm outdated -r --format json` showed safe patch/minor candidates for TipTap, AWS
SDK S3 packages, Turbo, ESLint, and Lucide React, plus two held major candidates.

Updated package ranges:

```text
@aws-sdk/client-s3 ^3.1066.0 -> ^3.1068.0
@aws-sdk/s3-request-presigner ^3.1066.0 -> ^3.1068.0
@tiptap/* 3.26.0 -> 3.26.1
eslint 10.4.1 -> 10.5.0
lucide-react 1.17.0 -> 1.18.0
turbo 2.9.17 -> 2.9.18
```

Post-refresh `pnpm outdated -r --format json` reports the intentionally held major candidates plus
one late provider/payment patch candidate that appeared during final reconciliation:

```text
@fastify/rate-limit 10.3.0 -> 11.0.0
pdfkit 0.18.0 -> 0.19.1
stripe 22.2.0 -> 22.2.1
```

The late `stripe@22.2.1` patch was tested and reverted from this branch after the default API test
lane hit broad 5-second Vitest timeouts across unrelated first tests under the patch. Keep that
payment-provider patch as a separate manual review instead of widening this green conservative
refresh.

## Docker Inventory

`docker compose config --images` rendered the current image inventory without requiring image pin
changes:

```text
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
open-practice-postgres:18-alpine-su-exec
open-practice-dev-worker
redis:8.8.0-alpine@sha256:09160599abd229764c0fb44cb6be640294e1d360a54b19985ab4843dcf2d90f1
open-practice-dev-web
open-practice-dev-api
open-practice-mailpit:v1.30.1-go1.26.4
open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4
```

MinIO appears twice because the `minio` and `minio-init` services intentionally share the same
wrapped image.

`pnpm docker:residual-watch` wrote blocked local evidence to
`/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-13T23-08-38Z`. The helper
confirmed Docker Scout is installed and rendered Compose image inventory, but Docker Engine was not
reachable:

```text
Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock. Is the docker daemon running?
```

The Scout image checks were therefore blocked for local wrapped images; Scout attempted remote pulls
for local image names and received registry authorization failures. No Dockerfile, Compose, or image
pin change is made in this dependency lane.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md docs/validation/README.md package.json pnpm-lock.yaml
```

Result: passed. The selector recommended the broad dependency lane: `pnpm ci:local`,
`pnpm deps:audit`, `pnpm deps:licenses`, format/docs/policy checks, API/worker/web package tests
and typechecks, worker build, and `pnpm build`.

Required dependency gates:

```bash
pnpm deps:audit
pnpm deps:licenses
pnpm ci:local
```

Result: `pnpm deps:audit` passed with no known production or development vulnerabilities.
`pnpm deps:licenses` passed with 550 packages / 576 versions and the existing review-required
license groups surfaced for governance review.

Full local gate:

```bash
pnpm ci:local
```

Result: the first run stopped at `format:check` because the refreshed `pnpm-lock.yaml` needed
Prettier formatting. After `pnpm exec prettier --write pnpm-lock.yaml`, the no-Stripe dependency
set passed, including formatting, lint, typecheck, workspace tests plus script tests, database schema
check, policy checks, production build, and `git diff --check`.

A later exploratory `stripe@22.2.1` patch produced broad default API test timeouts under the
parallel Vitest lane, so it was reverted. The final package/lockfile state is the same no-Stripe
dependency set covered by the passed full local gate.

Proof/index follow-up:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Result: passed after recording the final proof text and validation index entry.
