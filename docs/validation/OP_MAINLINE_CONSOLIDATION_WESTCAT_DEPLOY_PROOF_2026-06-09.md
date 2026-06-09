# OP Mainline Consolidation Westcat Deploy Proof

Date: 2026-06-09 PDT

## Scope

Merged the three local Open Practice slices from a fresh `origin/main` base, validated the combined
result, and prepared the pushed-main deployment handoff for a first-run empty public instance at
`https://op.crockettparalegal.ca`.

No dependencies, vendored assets, credentials, client data, matter data, payment data, or generated
deployment secrets were added to the repository. Deployment secrets remain remote-only.

Base before consolidation: `76d950e9f34fac4c58931a74fc8c19e25c337a4f`.

Temporary consolidation branch: `chore/open-practice-mainline-consolidation-2026-06-09`.

## Consolidated Branches

| Branch                                          | Source tip                                 | Merge commit | Result                                                                                        |
| ----------------------------------------------- | ------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------- |
| `codex/op-mod-dashboard-shell-model-2026-06-08` | `997101c4f38d80820bfb3150adabd8cefabd8ac2` | `98c3bf4c`   | Merged the dashboard shell navigation model extraction and focused unit coverage.             |
| `codex/op-mod-dashboard-resources-2026-06-09`   | `dfdf2b5b26f1cba58d542cb3dcd86de85a35af11` | `6a117bde`   | Merged dashboard server resource loaders and trust-resource fallback coverage.                |
| `codex/docker-hardening-efficiency-2026-06-07`  | `11c4213ea97184fb4948f558f8444e4dbab0d1d0` | `28c3ac13`   | Merged local Docker hardening, app-image smoke coverage, and selector/release policy updates. |

## Combined Posture

- Dashboard shell navigation availability, matter action sections, and active-section labels now
  live in `apps/web/app/_features/dashboard/dashboard-shell-model.ts`.
- Dashboard bootstrap/core staff loading and first-matter trust resources now live in
  `apps/web/app/_features/dashboard/server-resources.ts`.
- `apps/web/app/page.tsx` still owns setup/login/client-portal gating, route selection, capability
  fallbacks, search-param parsing, and final `DashboardClient` prop wiring.
- The local Docker stack keeps loopback-scoped binds, non-root app/Mailpit/MinIO runtime posture,
  `no-new-privileges` and capability drops where supported, explicit image commands, app-image
  cache/deploy improvements, local-proof/secret `.dockerignore` coverage, and app-image smoke
  validation.
- Response shapes, dashboard routing, URL/focus behavior, review-rail sessionStorage persistence,
  API request/response handling, and local-development service contracts remain unchanged.

## Conflict Resolution

- `docs/planning-and-progress.md` was reconciled to describe the final merged dashboard and Docker
  state rather than keeping either dashboard follow-up as an active review row.
- `docs/validation/README.md` keeps the OP-MOD-001 dashboard resource note, the OP-MOD-002 shell
  model note, and the Docker hardening proof entry together.

## Selector

Selector command:

```sh
pnpm verify:select -- --base origin/main
```

Selected validation:

```sh
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Branch-level proof passed before each source commit:

- Shell model branch: `pnpm verify:select -- --dirty`, selector-selected format/docs/policy, web
  test/typecheck, `pnpm build`, and `git diff --check`.
- Dashboard resources branch: `pnpm verify:select -- --dirty`, selector-selected
  format/docs/policy, web test/typecheck, `pnpm build`, and `git diff --check`.
- Docker hardening branch: `pnpm verify:select -- --dirty`, `pnpm ci:local`, dependency
  audit/license checks, Docker residual watch, Docker app smoke, Docker E2E, selector-selected
  package tests/typechecks/builds, docs/policy checks, and `git diff --check`.

Consolidation validation passed:

- `pnpm verify:select -- --base origin/main`
- `pnpm ci:local`
- `pnpm release:local`, with release proof artifact at
  `artifacts/release-local/2026-06-09T20-05-02Z`
- `pnpm deps:audit` (`pnpm audit --prod` and `pnpm audit --dev`, no known vulnerabilities)
- `pnpm deps:licenses` (`550` packages, `579` versions, review-class groups reported)
- `pnpm docker:residual-watch`, with artifact at
  `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-09T20-06-06Z`
- `pnpm docker:app-smoke`
- `pnpm e2e:docker` (`5` Playwright Docker checks passed)
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/api test` (`41` files, `499` tests)
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/worker test` (`3` files, `36` tests)
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test` (`34` files, `172` tests)
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`
- `git diff --check`

Notes:

- The first consolidation `pnpm ci:local` found formatting drift in
  `docs/planning-and-progress.md`; Prettier normalized the table and the rerun passed.
- The first consolidation `pnpm release:local` failed because the local replay database was not
  running after the earlier branch work. `docker compose up -d postgres` started the loopback
  Postgres dependency, it became healthy, and `pnpm release:local` passed on rerun.
- The first consolidation `pnpm docker:app-smoke` attempt found the local development Postgres
  container occupying the smoke stack's expected port. `docker compose stop postgres` stopped that
  container without removing its volume, and the rerun passed with the PostgreSQL-backed API health
  check plus web-app serve smoke.

## Deployment Handoff

Deployment must use only the pushed and parity-verified `main` commit. The first public deploy is
an empty setup-gated instance using synthetic/no client data, remote-only generated secrets, and the
media proxy/Tailscale path to `westcat-windows1`.
