# OP-T95 Local Release Proof And SBOM Handoff

Date: 2026-05-16

## Scope

OP-T95 replaces the lightweight local release command with an Open Practice-native proof artifact.
`pnpm release:local` writes ignored artifacts under `artifacts/release-local/<timestamp>/`, records
git metadata, command logs, dependency audit status, dependency license evidence, a CycloneDX SBOM,
and the full local gate result. Partial proof is preserved when a required command fails.

Actual handoff paths reconciled on `codex/testing-strategy-strengthening`:

- `.gitignore`
- `docs/development/github-maintenance.md`
- `docs/planning-and-progress.md`
- `docs/testing/TESTING.md`
- `docs/validation/README.md`
- `docs/validation/OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/create-release-proof.mjs`
- `scripts/create-release-proof.test.mjs`

## Validation

Passing checks:

- `pnpm verify:select -- --files package.json pnpm-lock.yaml .gitignore scripts/create-release-proof.mjs scripts/create-release-proof.test.mjs docs/testing/TESTING.md docs/development/github-maintenance.md docs/planning-and-progress.md docs/validation/OP-T95_LOCAL_RELEASE_PROOF_SBOM_2026-05-16.md`
- `node --test scripts/create-release-proof.test.mjs`
- `pnpm deps:licenses`
- `pnpm test`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm build`

Partial release proof:

- `pnpm release:local` wrote
  `artifacts/release-local/2026-05-16T10-06-27Z/` and passed dependency audit, license evidence, and
  CycloneDX SBOM generation.
- The same run failed only at the nested `pnpm ci:local` format gate because unrelated concurrent
  OP-T96 edits included unformatted `docs/validation/OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md`.
  The OP-T91/OP-T92/OP-T94/OP-T95 handoff paths passed scoped Prettier with
  `pnpm exec prettier --check --ignore-unknown <handoff paths>`.

Notes:

- `@cyclonedx/cyclonedx-npm@4.2.1` is pinned as an Apache-2.0 development dependency.
- Release artifacts are local and ignored; they must not include environment values, credentials,
  client data, matter data, private deployment details, raw audit exports, or privileged document
  content.
