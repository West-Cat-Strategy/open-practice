# Private-Pilot MinIO Hardening Proof

Date: 2026-06-24
Branch: `private-pilot/minio-hardening-proof-20260624`
Worktree: `/Users/bryan/projects/open-practice-minio-hardening-proof-20260624`
Base: `main` / `origin/main` at `79e35ece`
Status: Closed locally; private-pilot release proof passed with bundled-MinIO residuals accepted by
the separate hardening proof path.

## Scope

This branch closes the bundled-MinIO private-pilot readiness blocker with the smallest local-only
hardening proof path. It keeps MinIO as the checked-in AGPL service container and does not copy
MinIO source into the Apache-2.0 core.

- Local and self-host Compose now run `minio` and `minio-bucket-init` with read-only root
  filesystems plus `/tmp` tmpfs.
- The self-host render checker rejects missing bundled-MinIO hardening while still allowing the
  private `http://minio:9000` Compose endpoint and rejecting insecure external object-storage
  endpoints.
- Docker residual-watch now writes `minioHardening` and `acceptedResiduals`. Archived-source and
  Critical/High Scout findings are accepted only when local/self-host MinIO hardening is present,
  the pinned MinIO source tag is current, official current-source container manifests are absent, no
  same-contract remediation candidate is reported, and Docker/Scout/source probes complete.
- Docker image scan now accepts bundled-MinIO-only Trivy Critical/High findings only when the same
  residual-watch hardening proof is recorded. Non-MinIO and unproved MinIO scan failures remain
  failed artifacts.
- Admin Readiness now shows a proof-gated object-storage posture instead of a static private-pilot
  blocker.

The branch preserves MinIO pins, Docker image tags, `http://minio:9000`, bucket names, env variable
contracts, host ports, volumes, runtime APIs, schemas, dependencies, private-pilot release-proof
command shape, synthetic-only proof, no-live-settlement, no automatic trust posting, provider
activation boundaries, and clean-room posture.

Official-source posture checked for this proof:

- GitHub shows `minio/minio` archived/read-only and the latest release as
  `RELEASE.2025-10-15T17-29-55Z`, with source-build guidance for container users:
  <https://github.com/minio/minio/releases>.
- The GitHub repo overview says the repository is no longer maintained:
  <https://github.com/minio/minio>.
- Docker Hub marks `minio/minio` archived: <https://hub.docker.com/r/minio/minio>.

## Final Path Set

Selector and validation use this final changed-path set:

```text
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
./docker-compose.selfhost.yml
./docker-compose.yml
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_PRIVATE_PILOT_MINIO_HARDENING_PROOF_2026-06-24.md
docs/validation/README.md
scripts/selfhost-check.mjs
scripts/selfhost-check.test.mjs
scripts/scan-docker-images.mjs
scripts/scan-docker-images.test.mjs
scripts/watch-docker-residuals.mjs
scripts/watch-docker-residuals.test.mjs
```

## Selector Output

`pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm security:review
pnpm security:secrets-history
pnpm architecture:check
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
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

| Command                                                                                                                                                      | Status        | Notes                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                                             | Pass          | Selector returned the commands listed above for the final 16-path set, including the local security-review and secrets-history lane added by the Docker scan wrapper change.                                                                                                                                                |
| `pnpm security:secrets-history`                                                                                                                              | Pass / Review | Exited `0` and wrote review-required local Gitleaks history evidence at `.tmp/security/gitleaks/2026-06-24T21-19-14Z`.                                                                                                                                                                                                      |
| `pnpm security:review`                                                                                                                                       | Pass          | Wrote `.tmp/open-practice-security-review/2026-06-24T21-54-11Z`; required checks passed and optional Docker scan evidence used the accepted bundled-MinIO residual path.                                                                                                                                                    |
| `node --test scripts/watch-docker-residuals.test.mjs scripts/selfhost-check.test.mjs scripts/scan-docker-images.test.mjs scripts/select-validation.test.mjs` | Pass          | 50 Node script tests passed after formatting, including bundled-MinIO hardening checks, accepted residuals, same-contract candidate blocking, accepted MinIO-only Trivy scan residuals, self-host MinIO hardening validation, and selector routing.                                                                         |
| `pnpm architecture:check`                                                                                                                                    | Pass          | Architecture import policy passed with 445 workspace import edges reviewed.                                                                                                                                                                                                                                                 |
| `pnpm docker:lint`                                                                                                                                           | Pass          | Wrote `.tmp/docker/lint/2026-06-24T21-29-51Z`.                                                                                                                                                                                                                                                                              |
| `pnpm docker:residual-watch`                                                                                                                                 | Pass          | Direct final artifact `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T21-27-08Z`; release-proof artifact `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T21-42-14Z`; both accepted three bundled-MinIO residuals with no blockers or review candidates.                 |
| `pnpm docker:app-smoke`                                                                                                                                      | Pass          | Disposable app-smoke stack proved PostgreSQL-backed API health, web readiness, and same-origin setup-status JSON, then tore down containers and volumes.                                                                                                                                                                    |
| `pnpm docker:scan`                                                                                                                                           | Pass          | Final artifact `.tmp/docker/trivy/2026-06-24T21-51-21Z` accepted the bundled-MinIO-only Trivy residual (`3` Critical, `27` High) only after residual-watch passed at `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T21-51-21Z`.                                                                  |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                                                    | Pass          | Self-host render check accepted private `http://minio:9000`, rejected insecure external object-storage posture in tests, and required MinIO `read_only` plus `/tmp` tmpfs hardening.                                                                                                                                        |
| `pnpm e2e:docker`                                                                                                                                            | Pass          | Docker Chromium E2E passed 3 tests against the disposable PostgreSQL/Redis/MinIO/Mailpit stack and tore down containers plus volumes.                                                                                                                                                                                       |
| `pnpm format:check`                                                                                                                                          | Pass          | Initial run found Prettier drift in changed docs/scripts; `pnpm exec prettier --write ...` fixed it and the rerun passed.                                                                                                                                                                                                   |
| `pnpm docs:check`                                                                                                                                            | Pass          | Documentation link validation passed.                                                                                                                                                                                                                                                                                       |
| `pnpm policy:check`                                                                                                                                          | Pass          | Policy gate passed, including validation proof index, OSS reuse, local evidence Docker ignore, migration parity/lint, architecture, and boundary policy.                                                                                                                                                                    |
| `pnpm test`                                                                                                                                                  | Pass          | Full workspace tests and `node --test scripts/*.test.mjs` passed.                                                                                                                                                                                                                                                           |
| `pnpm --filter @open-practice/domain build`                                                                                                                  | Pass          | Hydrated fresh-worktree domain outputs before focused web validation.                                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/web test -- app/dashboard/admin-readiness-section.test.tsx`                                                                    | Pass          | Initial attempt exposed missing fresh-worktree domain outputs and one copy assertion mismatch; after domain build and assertion correction, the focused web suite passed.                                                                                                                                                   |
| `pnpm --filter @open-practice/web test`                                                                                                                      | Pass          | 44 web test files and 230 tests passed.                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                 | Pass          | TypeScript no-emit check passed for the web package.                                                                                                                                                                                                                                                                        |
| `pnpm build`                                                                                                                                                 | Pass          | Turbo build passed for all six packages; Next.js production build compiled, typechecked, generated 20 static pages, and collected traces.                                                                                                                                                                                   |
| `pnpm migrations:replay`                                                                                                                                     | Pass          | First release-proof attempt showed local Postgres was not listening on `localhost:35432`; after starting `docker compose up -d postgres`, direct replay passed with 71 migrations applied to a disposable database and cleaned up.                                                                                          |
| `pnpm release:local -- --private-pilot`                                                                                                                      | Pass          | Final artifact `artifacts/release-local/2026-06-24T21-40-35Z` passed all required commands. It includes self-host restore drill evidence `.tmp/open-practice-selfhost-restore-drill/2026-06-24T21-41-25Z` and residual-watch artifact `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T21-42-14Z`. |

## Boundaries

- All proof uses synthetic repo fixtures, Docker/Scout command metadata, public upstream metadata,
  and ignored local artifacts only.
- No client, matter, credential, payment, private deployment, raw audit, object body, or privileged
  document data is added to tracked files.
- Accepted bundled-MinIO residuals are evidence records, not removed findings. If Docker, Scout,
  source, registry, or network probes fail, residual-watch exits `1` with the probe reason. If a
  newer source tag, registry manifest, or Scout remediation recommendation appears, residual-watch
  exits `2` for review-required follow-up.
