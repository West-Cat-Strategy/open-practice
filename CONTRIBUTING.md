# Contributing

Open Practice is built for Canadian legal professionals and their clients. Contributions should preserve confidentiality, auditability, and matter-level authorization as core design constraints.

## Development

1. Install dependencies with `pnpm install`.
2. Start local services with `docker compose up -d`.
3. Run the app with `pnpm dev`.
4. Verify the full local CI lane with `pnpm verify`.

Use [docs/README.md](docs/README.md) for the documentation map,
[docs/development/getting-started.md](docs/development/getting-started.md) for runtime setup, and
[docs/development/repo-guide.md](docs/development/repo-guide.md) for workspace ownership. Use
[docs/testing/TESTING.md](docs/testing/TESTING.md) for choosing narrower checks and
[docs/development/maintenance.md](docs/development/maintenance.md) for docs, policy, migration, and release upkeep.

## License Hygiene

Do not copy implementation code from `.references/oss/` into core packages. If a reference project informs a design, cite the idea in docs or an issue rather than copying source.
