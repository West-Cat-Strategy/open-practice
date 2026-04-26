# Copilot Instructions

Open Practice is a privacy-first legal-practice system. Keep changes matter-scoped, auditable, and conservative.

- Use synthetic data only in examples, tests, fixtures, issues, and docs.
- Do not include client, matter, credential, payment, or private deployment data.
- Preserve clean-room boundaries. Treat restricted, source-available, copyleft, and unknown-license code as review-required.
- Keep provider-specific, HTTP, database, and SaaS runtime logic out of shared domain code.
- Prefer small changes with explicit validation evidence.
- Use `pnpm verify:select -- --files <changed paths...>` to choose focused validation.
- Open draft PRs for agent work; do not push directly to protected `main`.
- Do not edit unrelated files or revert work from other contributors.
