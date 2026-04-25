# Contributing

Open Practice is built for Canadian legal professionals and their clients. Contributions should preserve confidentiality, auditability, and matter-level authorization as core design constraints.

## Development

1. Install dependencies with `pnpm install`.
2. Start local services with `docker compose up -d`.
3. Run the app with `pnpm dev`.
4. Verify with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## License Hygiene

Do not copy implementation code from `.references/oss/` into core packages. If a reference project informs a design, cite the idea in docs or an issue rather than copying source.
