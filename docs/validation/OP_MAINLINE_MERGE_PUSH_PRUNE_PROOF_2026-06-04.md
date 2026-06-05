# OP Mainline Merge Push Prune Proof

Date: 2026-06-04 PDT

## Scope

Merged the remaining local Open Practice branches into `main` from a clean mainline at
`84e4f56c1b832bcfd088f8860fc29b302747d0d9`:

- `codex/op-t143-provider-config-encryption`
- `op-inmail-replay-recovery`
- `codex/minio-docker-hardening-2026-06-04`

The MinIO branch first received commit `652be1f` for the same-contract wrapped local MinIO image
change. The final merge commits are `a5656a3`, `e626298`, and `c003957`.

## Changed Paths

Final path set against `origin/main` before adding this proof:

- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/inbound-email.ts`
- `apps/api/src/routes/jobs.test.ts`
- `docker-compose.yml`
- `docker/minio/Dockerfile`
- `docs/api-and-state-machines.md`
- `docs/development/github-maintenance.md`
- `docs/planning-and-progress.md`
- `docs/validation/DOCKER_IMAGE_CVE_FOLLOWUP_PROOF_2026-06-04.md`
- `docs/validation/OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md`
- `docs/validation/OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md`
- `docs/validation/OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md`
- `docs/validation/README.md`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `scripts/route-authorization-manifest.mjs`

## Merge Notes

- Provider config encryption merged as a proof-only surviving delta after preserving newer mainline
  SSE and Docker-bridge readiness checks.
- Inbound replay recovery added owner-only parser-job retry/dead-letter controls, updated route
  authorization coverage, and kept raw MIME/storage/signing material out of API responses.
- MinIO hardening switched the local Compose service to the wrapped `docker/minio/Dockerfile` image
  while preserving the existing service name, ports, credentials, command, endpoint wiring, and
  volume contract.

## Validation

Selector:

- `pnpm verify:select -- --base origin/main` passed and selected format, docs, policy, root tests,
  domain/API/provider/worker checks, and build.

Final local gates:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm --filter @open-practice/database typecheck
pnpm migrations:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
pnpm ci:local
git diff --check HEAD
docker compose build minio
docker compose up -d postgres redis minio mailpit
docker compose ps
curl -fsS http://localhost:39000/minio/health/ready
docker compose exec -T minio sh -c 'mkdir -p /data/open-practice-documents && test -d /data/open-practice-documents'
docker compose down --remove-orphans
pnpm e2e:docker
```

Results:

- `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` passed after formatting the
  conflict-resolution Markdown.
- `pnpm test` passed: domain 24 files/173 tests, database 18 files/101 tests, providers 7 files/18
  tests, web 20 files/140 tests, worker 3 files/35 tests, API 41 files/482 tests, and 38 script
  contract tests.
- Package checks passed: domain test/typecheck, database test/db:check/typecheck, migration parity,
  API test/typecheck, providers test/typecheck/build, worker test/typecheck/build, and web
  test/typecheck.
- `pnpm build` passed for all six workspaces.
- `pnpm ci:local` passed, including format, lint, typecheck, tests, database check, policy checks,
  build, and `git diff --check`.
- `git diff --check HEAD` passed after Docker e2e.
- `docker compose build minio` passed for
  `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.3`.
- `docker compose up -d postgres redis minio mailpit`, `docker compose ps`, MinIO readiness
  (`curl -fsS http://localhost:39000/minio/health/ready`), and the MinIO bucket-directory smoke
  passed; `docker compose down --remove-orphans` removed the ad hoc stack.
- `pnpm e2e:docker` passed 5 Playwright checks and removed its disposable Docker containers,
  network, and volumes. Follow-up `docker compose ps` and `docker compose -p open-practice-e2e ps`
  showed no running services.

## Push And Prune

Pending push and prune proof.
