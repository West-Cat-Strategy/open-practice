# Self-Hosting Optimization Proof

Date: 2026-06-19
Branch: `chore/self-hosting-optimization-20260619`
Worktree: `/Users/bryan/projects/open-practice-self-hosting-optimization-20260619`
Status: Merge-ready local validation passed.

## Scope

This branch adds a focused self-hosting lane without changing public API route shapes, payment
settlement behavior, trust posting behavior, matter-scoped authorization, audit posture, or provider
side effects.

- Web browser API calls can use explicit same-origin mode through
  `OPEN_PRACTICE_BROWSER_API_MODE=same-origin`; Next.js rewrites `/api/:path*` to private
  `API_BASE_URL`.
- `docker-compose.selfhost.yml` defines a single-host production-mode profile for use behind an
  operator-managed TLS reverse proxy. It keeps Mailpit, development seed data, memory persistence,
  Docker bridge setup, relaxed CSP, public API exposure, live settlement, bank feeds, and trust
  automation out of scope.
- `pnpm selfhost:check` validates self-host env values and rendered Compose posture before startup.
- Worker production readiness now rejects development seed, Docker bridge setup, and E2E mode flags,
  matching the API's production posture more closely.
- Documentation records the self-host profile, first-run setup boundary, backup/restore expectations,
  S3/SSE notes, and validation routing.
- The selected dependency audit exposed the existing Nodemailer advisory for versions before 9.0.1.
  This branch updates the direct providers dependency and workspace override to `nodemailer@9.0.1`
  and records the lockfile change; no new runtime dependency was added.

## Final Path Set

Selector and validation use this final changed-path set:

```text
.dockerignore
Dockerfile
apps/web/app/api-base-urls.ts
apps/web/app/login-client-utils.test.ts
apps/web/app/security-headers.test.ts
apps/web/next.config.mjs
apps/worker/src/queues.test.ts
apps/worker/src/worker.ts
docker-compose.selfhost.yml
docker/selfhost.example.env
docs/README.md
docs/deployment-hardening.md
docs/development/getting-started.md
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/tech-stack.md
docs/testing/TESTING.md
docs/validation/OP_SELF_HOSTING_OPTIMIZATION_PROOF_2026-06-19.md
docs/validation/README.md
package.json
packages/providers/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/selfhost-check.mjs
scripts/selfhost-check.test.mjs
```

## Selector Output

```text
$ pnpm verify:select -- --files .dockerignore Dockerfile apps/web/app/api-base-urls.ts apps/web/app/login-client-utils.test.ts apps/web/app/security-headers.test.ts apps/web/next.config.mjs apps/worker/src/queues.test.ts apps/worker/src/worker.ts docker-compose.selfhost.yml docker/selfhost.example.env docs/README.md docs/deployment-hardening.md docs/development/getting-started.md docs/development/github-maintenance.md docs/development/self-hosting.md docs/planning-and-progress.md docs/tech-stack.md docs/testing/TESTING.md docs/validation/OP_SELF_HOSTING_OPTIMIZATION_PROOF_2026-06-19.md docs/validation/README.md package.json packages/providers/package.json pnpm-lock.yaml pnpm-workspace.yaml scripts/select-validation.mjs scripts/select-validation.test.mjs scripts/selfhost-check.mjs scripts/selfhost-check.test.mjs
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                   | Status | Notes                                                                                             |
| ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                          | Pass   | Selected the full self-host/runtime/docs/dependency/package/Docker validation lane listed above.  |
| `node --test scripts/selfhost-check.test.mjs scripts/select-validation.test.mjs`          | Pass   | 18 tests passed across the self-host check and selector test suites.                              |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example` | Pass   | Rendered `docker-compose.selfhost.yml` with the synthetic env example.                            |
| `pnpm deps:audit`                                                                         | Pass   | No known vulnerabilities after the `nodemailer@9.0.1` remediation.                                |
| `pnpm deps:licenses`                                                                      | Pass   | Reported 562 packages / 588 versions; existing review-required license groups were reported.      |
| `pnpm docker:residual-watch`                                                              | Pass   | Wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-19T08-21-59Z`.       |
| `pnpm docker:app-smoke`                                                                   | Pass   | Built the stack, confirmed PostgreSQL-backed API health and web serving, then cleaned up Compose. |
| `pnpm e2e:docker`                                                                         | Pass   | Docker-backed Playwright lane passed 3 tests; shutdown emitted expected worker SIGTERM noise.     |
| `pnpm format:check`                                                                       | Pass   | Prettier check passed.                                                                            |
| `pnpm docs:check`                                                                         | Pass   | Documentation link validation passed.                                                             |
| `pnpm policy:check`                                                                       | Pass   | Secret scan, package policy, dead-code, migration, OSS reuse, doc, proof, Dockerignore, boundary. |
| `pnpm test`                                                                               | Pass   | Workspace package tests and script tests passed.                                                  |
| `pnpm --filter @open-practice/api test`                                                   | Pass   | API route tests passed.                                                                           |
| `pnpm --filter @open-practice/providers test`                                             | Pass   | Providers tests passed.                                                                           |
| `pnpm --filter @open-practice/providers typecheck`                                        | Pass   | Providers typecheck passed.                                                                       |
| `pnpm --filter @open-practice/providers build`                                            | Pass   | Providers build passed.                                                                           |
| `pnpm --filter @open-practice/worker test`                                                | Pass   | Worker tests passed, including production-readiness failures for dev-only flags.                  |
| `pnpm --filter @open-practice/worker typecheck`                                           | Pass   | Worker typecheck passed.                                                                          |
| `pnpm --filter @open-practice/worker build`                                               | Pass   | Worker build passed.                                                                              |
| `pnpm --filter @open-practice/web test`                                                   | Pass   | Web tests passed, including same-origin API and rewrite/CSP coverage.                             |
| `pnpm --filter @open-practice/web typecheck`                                              | Pass   | Web typecheck passed.                                                                             |
| `pnpm build`                                                                              | Pass   | Turbo build passed, including the Next production build.                                          |
| `pnpm ci:local`                                                                           | Pass   | Full local verify chain plus `git diff --check` passed.                                           |
| `git diff --check`                                                                        | Pass   | Passed through `pnpm ci:local` and direct final rerun after proof edits.                          |

No selected checks were skipped or blocked.

## Boundaries

- The local development Compose stack remains local-only and separate from the self-host profile.
- The self-host profile assumes an operator-managed TLS reverse proxy and does not add Caddy, Nginx,
  public image publication, or release provenance.
- The production first-run setup gate is not weakened. Public or proxied setup remains blocked until
  an owner-admin exists; bootstrap remains operator-local at the API.
- Examples use synthetic values only. No client, matter, credential, payment, privileged document,
  trust/funds, audit-log, or private deployment detail was added.
