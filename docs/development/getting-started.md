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
pnpm dev:doctor
docker compose up -d
```

Access the application at `http://localhost:33000`. The stack is fully containerized and coordinates
automatically. The default Compose ports bind to loopback only.

`pnpm dev:doctor` is read-only. It checks Node and pnpm versions, Docker daemon access,
`docker compose config`, default loopback port availability, Playwright browser cache presence, and
host-local PostgreSQL encryption-key readiness. If browser checks are needed on a fresh machine, run
`pnpm exec playwright install chromium` before the E2E lane.

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

For single-host self-hosting behind an operator-managed TLS reverse proxy, use
[Self-Hosting](self-hosting.md). That profile lives in `docker-compose.selfhost.yml`, uses
same-origin browser API calls through the web service, and keeps the default development Compose
stack separate.

For Docker footprint reviews, record API, Web, and Worker image sizes in the validation proof after
the build finishes:

```bash
docker image inspect open-practice-dev-api open-practice-dev-web open-practice-dev-worker --format '{{.RepoTags}} {{.Size}}'
```

These images and the default Compose stack are local validation artifacts. Do not publish or reuse the
local Compose profile as a production deployment profile.

If you prefer to run services locally for development:

```bash
pnpm dev:infra
pnpm dev
```

The root dev command runs workspace dev tasks through Turbo. Use package-scoped commands when you only need one surface:

```bash
pnpm --filter @open-practice/api dev
pnpm --filter @open-practice/web dev
```

For the default Compose app stack and local recovery:

```bash
pnpm dev:stack
pnpm dev:ps
pnpm dev:logs -- api
pnpm dev:reset
```

`pnpm dev:reset` stops containers and removes orphans without deleting named volumes. Volume deletion
is intentionally opt-in and requires `pnpm dev:reset -- --volumes --yes`; use it only when the local
PostgreSQL or MinIO state should be discarded. To seed an already migrated local PostgreSQL database
with existing synthetic sample data, run:

```bash
DATABASE_URL=postgres://open_practice:open_practice@127.0.0.1:35432/open_practice pnpm dev:seed
```

## Runtime Modes

- API defaults to `API_PORT=34000` for host-local development; the Compose API container still listens on `4000`.
- Web defaults to `WEB_PORT=33000` for host-local development; the Compose web container still listens on `3000`.
- PostgreSQL is selected when `DATABASE_URL` is set.
- In-memory persistence is available through `OPEN_PRACTICE_USE_MEMORY_REPO=true` or when no database URL is provided.
- Development seed data is enabled with `OPEN_PRACTICE_DEV_SEED=true` during API startup or by
  running `pnpm dev:seed` explicitly against a local PostgreSQL `DATABASE_URL`.
- Empty firm/user state exposes first-run setup. Non-production setup requests are limited to
  loopback or the explicit local Docker bridge allowance; production setup is keyless but should be
  completed from an operator-local loopback request before public exposure.
- Background workers are scaffolded through `@open-practice/worker`. The local `pnpm dev` lane can run
  the worker against Redis, but provider processors return skipped/not-configured results until setup
  or owner-admin settings enable SMTP, IMAP inbound email, Mailgun inbound email, AI, OCR,
  transcription, or media processing. Transactional SMTP and IMAP polling are configured in first-run
  setup or Admin email settings and stored as encrypted provider settings; local SMTP capture should
  point at Mailpit host `localhost` and port `31025`. OCR uses the local CLI provider on a dedicated
  `ocr` worker when OCRmyPDF, Tesseract, and `eng` language data are installed; owner/admin users can
  enable or disable that provider from the Queues provider posture panel, and OCR queue buttons stay
  disabled until the provider, Redis-backed OCR queue, object storage, and supported file type are
  ready.
- Production rejects memory persistence, dev seed data, development auth helpers, deprecated external-provider env, and unsafe local S3 endpoints.
- Self-hosted browser API mode is explicit: `OPEN_PRACTICE_BROWSER_API_MODE=same-origin` makes the
  web app send browser requests to same-origin `/api` paths, and the Next.js server rewrites those
  requests to the configured internal `API_BASE_URL`.

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
Compose publishes every default service on `127.0.0.1` and only exposes per-service host-port
variables for isolated smoke runs. If you change the local web or API host ports, also set
`OPEN_PRACTICE_PUBLIC_WEB_ORIGIN` or `OPEN_PRACTICE_PUBLIC_API_ORIGIN` to the matching loopback
origin so WebAuthn, public web links, and browser API calls line up with the alternate ports. The
local Compose profile uses development secrets, local S3 endpoints, local Mailpit capture, and
relaxed local web CSP, so it must stay loopback-only and must not be reused as a production profile.

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
