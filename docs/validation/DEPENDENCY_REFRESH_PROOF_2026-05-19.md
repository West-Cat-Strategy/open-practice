# Dependency Refresh Proof - 2026-05-19

Branch: `codex/dependency-major-refresh`

This maintenance lane refreshed package and Docker dependency surfaces from a clean sibling worktree
based on `origin/main`. The active OP-T102 feature checkout was left untouched.

## Change Summary

- Updated direct dependency freshness: AWS S3 SDK packages to `3.1049.0`, `bullmq` to `5.76.10`,
  `prosemirror-model` to `1.25.7`, `tsx` to `4.22.2`, `typescript-eslint` to `8.59.4`, and
  `@types/node` to `25.9.0`.
- Updated pnpm from `10.33.3` to `11.1.3`, moved pnpm overrides into `pnpm-workspace.yaml`, and
  recorded pnpm 11 build-script policy there. Optional CycloneDX `libxmljs2` native builds remain
  disabled because the optional addon does not build against local Node 26 and is not required for
  the current dependency-license or release-evidence tests.
- Updated Docker app base to pinned `node:26.0.0-alpine3.23` and the local Postgres service base to
  pinned `postgres:18-alpine`, preserving the `su-exec` replacement for the public image's bundled
  `gosu`.
- Kept Redis on `8-alpine`, Mailpit on `v1.30.0-go1.26.3`, and MinIO on the current deterministic
  pinned release because no compatible newer MinIO Docker Hub tag was available and Scout had no tag
  replacement recommendation.
- Fixed reference-governance path generation so policy checks remain valid from sibling worktrees.

## Local Validation

- `npm exec --yes pnpm@11.1.3 -- install --frozen-lockfile` passed.
- `npm exec --yes pnpm@11.1.3 -- verify:select -- --files <changed manifests, Docker files, docs,
lockfile, and reference-governance files>` routed the change to the full dependency/local
  validation lane.
- `npm exec --yes pnpm@11.1.3 -- outdated -r --format json` returned `{}`.
- `npm exec --yes pnpm@11.1.3 -- deps:audit` passed with no known production or development
  vulnerabilities.
- `npm exec --yes pnpm@11.1.3 -- deps:licenses` passed: 549 packages / 578 versions, with the
  expected review-required license groups reported for manual awareness.
- `npm exec --yes pnpm@11.1.3 -- policy:check` passed after the sibling-worktree reference-governance
  helper fix.
- `npm exec --yes pnpm@11.1.3 -- ci:local` passed, including formatting, lint, typecheck, package
  tests, script tests, database schema check, policy checks, build, and `git diff --check`.

## Docker Evidence

`docker compose config --images` resolved:

- `open-practice-postgres:18-alpine-su-exec`
- `redis:8-alpine`
- `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`
- `open-practice-mailpit:v1.30.0-go1.26.3`
- `open-practice-dev-api`
- `open-practice-dev-web`
- `open-practice-dev-worker`

Registry/attestation Scout proof:

- `node:26.0.0-alpine3.23`: 0 critical / 1 high (`picomatch` in bundled npm); Scout reported no
  recommendations.
- `postgres:18-alpine`: 1 critical / 18 high against the public base attestation; Scout reported no
  recommendations. The local image still removes `gosu`, but local-image proof requires Docker
  Engine.
- `redis:8-alpine`: 0 critical / 0 high.
- `golang:1.26.3-alpine3.23` Mailpit builder base: 0 critical / 0 high.
- `alpine:3.23.4` Mailpit runtime base: 0 critical / 0 high.
- MinIO pinned release: residual upstream critical/high findings remain; Scout reported no tag
  recommendations, and `minio/minio:RELEASE.2025-10-15T17-29-55Z` was not available on Docker Hub.

## Skipped Checks

- Docker build/up/runtime probes and local rebuilt image scans were skipped because Docker Engine was
  unavailable: `Cannot connect to the Docker daemon at unix:///Users/bryan/.docker/run/docker.sock.
Is the docker daemon running?`
- `pnpm release:local` was skipped because no local `DATABASE_URL` or `MIGRATION_REPLAY_DATABASE_URL`
  was available for migration replay in this worktree.
