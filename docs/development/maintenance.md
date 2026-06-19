# Maintenance Guide

Use this guide when keeping Open Practice healthy across docs, validation, policy, schema, and release
handoff. Use [Repository Guide](repo-guide.md) for workspace ownership,
[GitHub Maintenance](github-maintenance.md) for local-only repository gates and GitHub settings, and
[Testing](../testing/TESTING.md) for command selection.

## Documentation Maintenance

- Keep [docs/README.md](../README.md) as the first-stop index.
- Keep durable direction in [Planning](../planning.md) and live task status in [Planning and Progress](../planning-and-progress.md).
- Keep route and lifecycle behavior in [API and State Machines](../api-and-state-machines.md) aligned with implemented API routes.
- Keep deployment assumptions in [Deployment Hardening](../deployment-hardening.md), especially when env vars, auth, object storage, migrations, billing, or trust/funds behavior changes.
- Use relative links for repo-local docs, run
  `pnpm verify:select -- --files <changed docs...>` first, then run the selected docs checks.

## Validation Control Plane

Open Practice has a small validation control plane that should stay boring and explicit:

- `pnpm verify:select -- --files <paths...>` prints recommended commands for a change set and never runs them.
- `pnpm verify:run -- --files <paths...>` runs selector-selected commands and writes ignored
  command logs under `.tmp/validation-runs/<timestamp>/`.
- `pnpm docs:check` validates local Markdown links.
- `pnpm policy:check` runs the combined local policy/integrity gate: tracked-secret scan, package
  manifest policy, lockfile supply-chain policy, toolchain alignment, env-surface drift,
  architecture import direction, migration parity, migration lint, OSS reuse validation, docs
  links, validation-proof index, local-evidence `.dockerignore` coverage, and Open Practice boundary
  policy.
- `pnpm verify` runs the package verification lane.
- `pnpm ci:local` runs `pnpm verify` and `git diff --check`.
- `pnpm deps:audit` runs local production and development dependency audits.
- `pnpm deps:supply-chain` checks the pnpm lockfile for non-registry refs, registry drift, missing
  integrity, and native-build approval drift.
- `pnpm deps:osv` runs optional local OSV lockfile scanning when `osv-scanner` is installed.
- `pnpm deps:review` writes a non-gating local dependency review packet under
  `.tmp/open-practice-dependency-review/<timestamp>/`.
- `pnpm license:scan` runs optional local ScanCode copied-source/license scanning when installed.
- `pnpm security:review` writes a full local security review packet under
  `.tmp/open-practice-security-review/<timestamp>/`.
- `pnpm security:secrets-history` and `pnpm security:privacy-rules` run optional local Gitleaks and
  Semgrep privacy-rule scans.
- `pnpm architecture:check` validates workspace import direction; `pnpm architecture:graph` writes
  an ignored DOT graph under `.tmp/architecture/`.
- `pnpm api:contract` writes an ignored OpenAPI route/auth inventory under `.tmp/api-contract/`.
- `pnpm migrations:lint` checks changed SQL migrations for destructive or lock-prone patterns.
- `pnpm e2e:a11y` runs the dedicated axe-backed Chromium accessibility lane over synthetic host
  pages.
- `pnpm docker:lint` and `pnpm docker:scan` run optional local Hadolint/Checkov and Trivy wrappers.
- `pnpm release:local` runs dependency audits plus the full local gate.
- `pnpm release:attest` is an optional local Cosign wrapper for explicit artifacts and keys; it does
  not upload to a transparency log by default.

When adding a new package, app, route family, or docs category, update
[Testing](../testing/TESTING.md) and `scripts/select-validation.mjs` together.

## Known Follow-Ups

- The external `/Users/bryan/.codex/skills/maintain-open-practice-docs` skill still points to its
  own `references/docs-workflows.md`. Repo docs remain canonical; refresh external skills only in an
  explicit skill-upkeep task.

## Local Repository Gate

Open Practice uses local command evidence instead of GitHub Actions, Dependabot auto-merge,
dependency review workflows, CodeQL default setup, or Copilot cloud agents. Keep the cutover and
verification commands aligned with [GitHub Maintenance](github-maintenance.md). Secret scanning and
push protection remain repository safety settings, not CI/CD gates.

## Boundary Ratchets

`scripts/validate-open-practice-boundaries.mjs` protects the current architecture direction. It is intentionally small and should fail loudly when new work drifts from the adopted shape.

Current ratchets include:

- direct route count in `apps/api/src/server.ts`;
- inline request parsing in `server.ts`;
- direct API error envelopes in `server.ts`;
- required adoption scaffold files;
- billing route literals staying out of `server.ts`;
- document, signature, intake, ledger, and queue route literals staying out of `server.ts`;
- route catalog coverage for expected dashboard sections.

If the ratchet fails, prefer moving code toward the intended boundary. If the boundary itself changed, update the script, docs, and tests in the same change.

## Database And Migration Care

- Keep schema changes, generated migrations, repository behavior, seed data, and tests synchronized.
- Run `pnpm --filter @open-practice/database db:check` for schema or migration changes.
- Run database and API tests when persistence behavior affects exposed routes.
- Treat disposable local `db:migrate` runs as extra migration confidence, not as a substitute for checked-in migration review.
- Production release notes should mention migration direction, backup expectations, and restore proof when schema changes ship.

## Reuse And License Hygiene

- `.references/oss/` must remain ignored compatibility symlinks to the central reference repo store; neither path may be imported or read by `apps/**` or `packages/**`.
- Do not copy implementation code, schemas, migrations, tests, UI markup, styles, assets, or distinctive expression from reference-only projects.
- New dependencies must pass [Reuse Decision Policy](../reuse-decision-policy.md) and [License Policy](../license-policy.md).
- Cite reference influence in docs or issues when it materially shapes a design.

## Release Handoff

Before broad handoff or release, prefer:

```bash
pnpm release:local
```

For production-facing changes, also confirm the relevant notes in [Deployment Hardening](../deployment-hardening.md), [Threat Model](../threat-model.md), and [Trust/Funds Caveats](../trust-funds-caveats.md). Do not describe billing, reconciliation, or trust-transfer workflows as jurisdiction-certified without specific legal/accounting review.

## Skill Upkeep

The local Codex skill for this repo lives outside the repository at `/Users/bryan/.codex/skills/develop-open-practice`. When these development docs change the way future agents should work, refresh that skill and validate it with:

```bash
python3 /Users/bryan/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/bryan/.codex/skills/develop-open-practice
```
