# Open Practice Full Security Review Proof - 2026-06-02

## Scope

- Worktree: `/Users/bryan/projects/open-practice-security-review-2026-06-02`
- Branch: `codex/op-security-review-2026-06-02`
- Replayed consolidation base: `origin/main` at
  `877dd1b60314247ee6c6b1c6596c5fad57f46b93`
- Original source base omitted during replay: `54f84b038646ffd3aca3099f77bb51d07ff1d027`
  (`codex/op-t143-provider-config-encryption`)
- Data posture: synthetic local fixtures only; no client, matter, credential, payment, deployment
  secret, or private tenant data added.

This remediation follows the four read-only subagent findings from the 2026-06-02 full security
review baseline and keeps the patch scoped to auth, public-token, CORS/header, connector URL, and
validation-proof surfaces.

## Remediated Findings

- Password setup token creation now requires `owner_admin` in addition to existing
  `auth_credential:create` access.
- Passkey deletion is scoped by `firmId`, current `userId`, and credential row id in both the route
  and repository contract.
- Email-verification share links now store a separate verifier hash/expiry, require configured
  email delivery, send a one-time verification code, and require `{ verificationCode }` on public
  completion.
- Public intake form submit and idempotent replay responses return sanitized
  `{ status, link, submission, proposalCount }` metadata only; raw answer snapshots and proposals
  remain available only on authenticated staff review routes.
- Configured public-consultation website origins are accepted only for `POST`/preflight CORS on
  `/api/public/consultation-intakes`, not for credentialed authenticated routes.
- Connector redirect/origin/endpoint URL normalization rejects embedded username/password
  credentials instead of silently dropping them.
- The web app keeps the existing enforced CSP baseline and adds stricter
  `Content-Security-Policy-Report-Only` directives for default, script, connect, image, style, font,
  and form-action policy review.

This replay also preserves the earlier June 2026 remediation baseline already on `main`: public CORS
origin scoping, same-firm assignment checks, public intake/upload redaction, generic unexpected-error
responses, upload byte-size verification, and enforced CSP hardening.

## Public Interface Changes

- `POST /api/portal/shares/:token/email-verification` now requires JSON body
  `{ "verificationCode": string }`.
- Public intake submit/replay responses no longer include raw `snapshot` or `proposals`.
- `deleteWebAuthnCredential` now requires `(firmId, userId, id)`.
- Public-consultation configured origins no longer receive credentialed CORS on authenticated API
  routes.

## Validation Evidence

- `pnpm verify:select -- --files $(git diff --name-only --diff-filter=ACM) $(git ls-files --others --exclude-standard)` passed and recommended format/docs/policy plus domain, database, API, providers, worker, web, and build checks.
- Focused API tests passed:
  `pnpm --filter @open-practice/api exec vitest run src/server.test.ts src/routes/webauthn.test.ts src/routes/shares.test.ts src/routes/intake-forms.test.ts src/routes/connectors.test.ts`
  (5 files, 103 tests).
- Focused database tests passed:
  `pnpm --filter @open-practice/database exec vitest run test/repository.portal-links.test.ts test/repository.auth.test.ts test/schema.test.ts`
  (3 files, 37 tests).
- Focused web tests passed:
  `pnpm --filter @open-practice/web exec vitest run app/security-headers.test.ts app/share-link-portal.test.ts app/dashboard-client.test.ts`
  (3 files, 72 tests).
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm --filter @open-practice/domain test` passed (24 files, 166 tests).
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database test` passed (18 files, 100 tests).
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm migrations:check` passed (50 SQL files match 50 journal entries).
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm --filter @open-practice/api test` passed (41 files, 445 tests).
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/providers test` passed (7 files, 18 tests).
- `pnpm --filter @open-practice/worker test` passed (3 files, 32 tests).
- `pnpm --filter @open-practice/web test` passed (18 files, 132 tests).
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm build` passed (6 workspace packages).
- `pnpm security:scan` passed with no high-confidence tracked secrets found.
- `pnpm deps:audit` passed with no known production or development vulnerabilities.
- `pnpm deps:licenses` passed and reported the existing review-required license groups:
  `(MIT OR EUPL-1.1+)`, `(MIT OR GPL-3.0-or-later)`, `BlueOak-1.0.0`, `CC-BY-3.0`, `CC-BY-4.0`,
  `LGPL-3.0-or-later`, and `Unlicense`.
- `pnpm policy:check` passed, including secret scan, package manifest policy, migration parity, OSS
  reuse policy, docs link validation, and Open Practice boundary policy.
- GitHub settings read-only checks were available through local `gh` auth:
  - `gh api repos/West-Cat-Strategy/open-practice/branches/main/protection`: HTTP 404, branch not
    protected.
  - `gh api repos/West-Cat-Strategy/open-practice/actions/permissions`: `{"enabled":false}`.
  - `gh api repos/West-Cat-Strategy/open-practice/code-scanning/default-setup`:
    `{"state":"not-configured"}`.
  - `gh api repos/West-Cat-Strategy/open-practice/vulnerability-alerts`: HTTP 404, vulnerability
    alerts disabled.

## Final Gate

- `pnpm ci:local` passed after the final proof/index update.
- `docker compose up -d postgres` started the local PostgreSQL service, and
  `open-practice-dev-postgres-1` reported healthy on `127.0.0.1:35432`.
- `pnpm migrations:replay` passed before the release retry: 50 migrations applied to disposable
  database `open_practice_migration_replay_99131_20260602121142`; admin client `psql`; database
  cleaned up.
- `pnpm release:local` passed and wrote
  `artifacts/release-local/2026-06-02T12-11-48Z/`. The release proof status is `passed`, with
  successful dependency audit, license evidence, CycloneDX SBOM generation, `pnpm ci:local`,
  migration replay, and artifact secret scan steps.
