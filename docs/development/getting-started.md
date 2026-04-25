# Getting Started

Use this guide for local runtime setup. Use [Repository Guide](repo-guide.md) for workspace ownership, [../testing/TESTING.md](../testing/TESTING.md) when choosing validation commands, and [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for contributor workflow.

## Toolchain

- Node.js 24 in CI.
- pnpm 10, as declared in the root `package.json`.
- Docker for PostgreSQL, MinIO, and Mailpit through `docker-compose.yml`.

## Orientation

- Use [Repository Guide](repo-guide.md) before choosing an owning workspace.
- Use [Maintenance](maintenance.md) for policy, migration, docs, and release upkeep.
- Use [Agent Workflows](agent-workflows.md) for Codex-assisted development practices and the `$develop-open-practice` skill entry point.

## First Run

```bash
pnpm install
docker compose up -d
pnpm dev
```

The root dev command runs workspace dev tasks through Turbo. Use package-scoped commands when you only need one surface:

```bash
pnpm --filter @open-practice/api dev
pnpm --filter @open-practice/web dev
```

## Runtime Modes

- API defaults to `API_PORT=4000`.
- Web defaults to `WEB_PORT=3000`.
- PostgreSQL is selected when `DATABASE_URL` is set.
- In-memory persistence is available through `OPEN_PRACTICE_USE_MEMORY_REPO=true` or when no database URL is provided.
- Development seed data is enabled with `OPEN_PRACTICE_DEV_SEED=true`.
- Production rejects memory persistence, dev seed data, development auth helpers, deprecated external-provider env, and unsafe local S3 endpoints.

## Local Services

`docker-compose.yml` provides the supporting services expected by the app:

- PostgreSQL for legal records and embedded sessions.
- MinIO for S3-compatible document-object storage.
- Mailpit for local email capture when mail workflows are introduced.

Run database schema checks with:

```bash
pnpm --filter @open-practice/database db:check
```

## Verification

Use the local CI parity lane before handing off broad changes:

```bash
pnpm verify
```

For smaller changes, use [../testing/TESTING.md](../testing/TESTING.md) to choose the narrowest safe command set.
