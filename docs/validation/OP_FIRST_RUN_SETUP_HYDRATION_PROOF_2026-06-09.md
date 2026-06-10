# OP First-Run Setup Hydration Proof - 2026-06-09

## Scope

This branch removes the first-run setup-key contract and makes an empty Open Practice deployment
usable immediately after first setup. The setup flow now creates an owner account, authenticated
session, audit event, firm settings, selected OP-authored starter presets, and an optional first
matter/contact/party without dev/demo seed data.

Safety remains bounded by the existing first-run guards:

- Setup is allowed only while the repository reports an empty setup state.
- Partial setup remains blocked.
- Repeated setup is rejected after the first owner exists.
- Non-production setup stays loopback-only unless the explicit Docker bridge dev flag is enabled.
- Production setup is available without a setup key and should be completed over the intended TLS
  deployment surface before broad handoff.
- Normal embedded authentication is used after setup completes.

## Changed Paths

- `.env.example`
- `apps/api/src/routes/setup.ts`
- `apps/api/src/server.ts`
- `apps/api/src/server.test.ts`
- `apps/web/app/dashboard/admin-readiness-section.tsx`
- `apps/web/app/dashboard/admin-readiness-section.test.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/setup-wizard.tsx`
- `apps/web/app/setup-wizard-utils.ts`
- `apps/web/app/setup-wizard-utils.test.ts`
- `apps/web/app/styles/95-setup-wizard-extensions.css`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/development/getting-started.md`
- `docs/planning-and-progress.md`
- `docs/tech-stack.md`
- `docs/validation/README.md`
- `docs/validation/OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md`
- `docs/validation/OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md`
- `e2e/first-run.spec.ts`
- `packages/domain/package.json`
- `packages/domain/src/practice-presets.ts`
- `playwright.config.ts`
- `scripts/run-e2e.mjs`

## Validation

- `pnpm verify:select -- --files .env.example apps/api/src/routes/setup.ts apps/api/src/server.test.ts apps/api/src/server.ts apps/web/app/dashboard/admin-readiness-section.test.tsx apps/web/app/dashboard/admin-readiness-section.tsx apps/web/app/page.tsx apps/web/app/setup-wizard-utils.test.ts apps/web/app/setup-wizard-utils.ts apps/web/app/setup-wizard.tsx apps/web/app/styles/95-setup-wizard-extensions.css apps/web/app/types.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/development/getting-started.md docs/planning-and-progress.md docs/tech-stack.md docs/validation/README.md docs/validation/OP_FIRST_RUN_SETUP_HYDRATION_PROOF_2026-06-09.md docs/validation/OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md e2e/first-run.spec.ts packages/domain/package.json packages/domain/src/practice-presets.ts playwright.config.ts scripts/run-e2e.mjs`
  - Selector recommended broad local checks including docs, policy, API/web/domain/provider/worker
    tests and typechecks, dependency audit/license checks, build, host/Docker E2E, Docker app smoke,
    Docker residual watch, and `pnpm ci:local`.
- `pnpm format:check` passed after targeted Prettier formatting for setup utility, first-run E2E,
  E2E runner, workboard, and validation proof files.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm deps:audit` passed with no known vulnerabilities.
- `pnpm deps:licenses` passed and regenerated the license report. Existing review-required license
  groups remain unchanged.
- `pnpm --filter @open-practice/api test` passed: 41 files, 500 tests.
- `pnpm --filter @open-practice/web test` passed: 34 files, 174 tests.
- `pnpm --filter @open-practice/domain test` passed: 24 files, 173 tests.
- `pnpm --filter @open-practice/providers test` passed: 7 files, 18 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 36 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed after exposing a browser-safe `@open-practice/domain/practice-presets`
  subpath for the setup wizard preset catalog.
- `pnpm ci:local` passed, including repository verification and `git diff --check`.
- `node scripts/run-e2e.mjs first-run` passed.
- `pnpm e2e:host` passed: 33 passed, 3 skipped by existing test annotations.
- `pnpm e2e:docker` passed: 5 passed, Compose cleanup completed.
- `pnpm docker:app-smoke` passed on the first closeout run: the API health endpoint was
  PostgreSQL-backed, the web app served, and the isolated app-smoke containers, volumes, and
  network were removed afterward.
- `pnpm docker:residual-watch` passed. Artifact:
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-09T23-12-09Z`.

## Skipped Or Unavailable

None.

## Synthetic Data

First-run browser proof uses synthetic data only: `North Shore Starter Law`, `Avery Owner`,
`avery@example.test`, `Opening consult`, and `Example Cooperative`.
