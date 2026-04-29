# Contributing

Open Practice is built for Canadian legal professionals and their clients. Contributions should preserve confidentiality, auditability, and matter-level authorization as core design constraints.

## Development

1. Install dependencies with `pnpm install`.
2. Start the full stack with `docker compose up -d`.
3. (Optional) Run individual services locally for development with `pnpm dev`.
4. Access the web UI at `http://localhost:3000` and the API at `http://localhost:4000`.
5. Verify the full local gate with `pnpm ci:local`.

Use [docs/README.md](docs/README.md) for the documentation map,
[docs/development/getting-started.md](docs/development/getting-started.md) for runtime setup, and
[docs/development/repo-guide.md](docs/development/repo-guide.md) for workspace ownership. Use
[docs/testing/TESTING.md](docs/testing/TESTING.md) for choosing narrower checks and
[docs/development/maintenance.md](docs/development/maintenance.md) for docs, policy, migration, and release upkeep.

## Public Repository Safety

Use synthetic data in code, tests, docs, fixtures, screenshots, and issues. Do not commit real client
or matter data, privileged documents, secrets, signature evidence, intake answers, trust/funds
records, audit-log contents, local database snapshots, backups, or service uploads.

Keep local configuration in ignored `.env` files and update `.env.example` only with safe development
placeholders. Run `pnpm security:scan` before publishing changes that touch configuration,
deployment, scripts, docs, or test fixtures.

## License Hygiene

Do not copy implementation code from `.references/oss/` into core packages. If a reference project informs a design, cite the idea in docs or an issue rather than copying source.
The `.references/oss/` directory is ignored and must stay out of commits.
