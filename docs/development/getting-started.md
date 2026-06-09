# Getting Started

Use this guide for local runtime setup. Use [Repository Guide](repo-guide.md) for workspace ownership, [../testing/TESTING.md](../testing/TESTING.md) when choosing validation commands, and [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for contributor workflow.

## Toolchain

- Node.js 24 or newer for local validation. The Docker app images currently build on the pinned
  Node.js 26 Alpine base recorded in [GitHub Maintenance](github-maintenance.md).
- pnpm 11, as declared in the root `package.json`.
- Docker for all services (API, Web, Worker, and Infrastructure) through `docker-compose.yml`.
- Postal, Ollama, Tesseract, Whisper, and FFmpeg are planned optional worker/provider tools; they are
  not required for the default local startup.

## Orientation

- Use [Repository Guide](repo-guide.md) before choosing an owning workspace.
- Use [Maintenance](maintenance.md) for policy, migration, docs, and release upkeep.
- Use [Agent Workflows](agent-workflows.md) for Codex-assisted development practices and the `$develop-open-practice` skill entry point.

## First Run

```bash
pnpm install
docker compose up -d
```

Access the application at `http://localhost:33000`. The stack is fully containerized and coordinates automatically.
The default Compose ports bind to loopback only.

To validate the built API, Web, and Worker images before leaving the local dev stack running:

```bash
pnpm docker:app-smoke
pnpm docker:app-smoke -- --refresh
pnpm docker:app-smoke -- --keep-up
```

The smoke command builds the wrapped local service images plus the app images, starts Postgres,
Redis, MinIO, Mailpit, API, Web, and Worker, runs migrations, checks API health, and confirms the web
app serves on loopback. By default it uses an isolated Compose project and disposable volumes. Add
`-- --refresh` when you need pinned Redis pulls and `--pull` image rebuilds. Use `-- --keep-up` to
validate and leave the default Compose dev stack running.

If you prefer to run services locally for development:

```bash
docker compose up -d postgres redis minio mailpit
pnpm dev
```

The root dev command runs workspace dev tasks through Turbo. Use package-scoped commands when you only need one surface:

```bash
pnpm --filter @open-practice/api dev
pnpm --filter @open-practice/web dev
```

## Runtime Modes

- API defaults to `API_PORT=34000` for host-local development; the Compose API container still listens on `4000`.
- Web defaults to `WEB_PORT=33000` for host-local development; the Compose web container still listens on `3000`.
- PostgreSQL is selected when `DATABASE_URL` is set.
- In-memory persistence is available through `OPEN_PRACTICE_USE_MEMORY_REPO=true` or when no database URL is provided.
- Development seed data is enabled with `OPEN_PRACTICE_DEV_SEED=true`.
- Empty local firm/user state exposes first-run setup. Production first-run setup also requires
  `OPEN_PRACTICE_SETUP_KEY` and the matching `x-open-practice-setup-key` header.
- Background workers are scaffolded through `@open-practice/worker`. The local `pnpm dev` lane can run
  the worker against Redis, but provider processors return skipped/not-configured results until setup
  enables SMTP, inbound email, AI, OCR, transcription, or media processing. OCR uses the local
  Tesseract provider; owner/admin users can enable or disable that provider from the Queues provider
  posture panel, and OCR queue buttons stay disabled until both the provider and Redis-backed OCR
  queue are ready.
- Production rejects memory persistence, dev seed data, development auth helpers, deprecated external-provider env, and unsafe local S3 endpoints.

## Local Services

`docker-compose.yml` provides all services required to run the application:

- **api**: Fastify-based backend.
- **web**: Next.js-based frontend.
- **worker**: BullMQ background processor.
- **postgres**: PostgreSQL for legal records and embedded sessions.
- **minio**: MinIO for S3-compatible document-object storage.
- **mailpit**: Local email capture for mail workflows.
- **redis**: Redis for BullMQ execution state.

Default local host ports are intentionally uncommon to avoid collisions with other developer tools:
web `33000`, API `34000`, PostgreSQL `35432`, Redis `36379`, MinIO `39000`, MinIO console
`39001`, Mailpit SMTP `31025`, and Mailpit UI `38025`.
Compose exposes them through scoped bind variables that default to `127.0.0.1`:
`OPEN_PRACTICE_DOCKER_WEB_HOST_BIND`, `OPEN_PRACTICE_DOCKER_API_HOST_BIND`, and
`OPEN_PRACTICE_DOCKER_INFRA_HOST_BIND`, plus per-service host-port variables for isolated smoke
runs. Keep `OPEN_PRACTICE_DOCKER_API_HOST_BIND` loopback-bound; the Compose API refuses non-loopback
binds because the local stack carries dev-only auth and setup flags. Do not reuse the local Docker
stack as a production profile.

Local proof, package-manager credential, shell credential, cloud credential, and generated output
paths stay excluded from the Docker build context through `.dockerignore` and `pnpm policy:check`.

Redis should stay private to API and worker containers in production and should hold job metadata only.
PostgreSQL remains the source of truth for legal and audit-relevant job lifecycle state.

Run database schema checks with:

```bash
pnpm --filter @open-practice/database db:check
```

## Verification

Use the local gate before handing off broad changes:

```bash
pnpm ci:local
```

For smaller changes, use [../testing/TESTING.md](../testing/TESTING.md) to choose the narrowest safe command set.
