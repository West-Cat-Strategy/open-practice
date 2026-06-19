# Open Practice Security Scan Remediation Proof

**Date:** 2026-06-19
**Branch:** `security/e680c230-remediation-20260619`
**Worktree:** `/Users/bryan/projects/open-practice-security-e680c230-remediation`
**Source scan:** `/tmp/codex-security-scans/open-practice/e680c230_20260619T050725Z/report.md`

## Scope

This proof records the remediation of all ten findings from the `e680c230` Codex Security scan in a
fresh sibling worktree. The root checkout's pre-existing dirty web files were left untouched:

- `apps/web/app/api-base-urls.ts`
- `apps/web/app/login-client-utils.test.ts`
- `apps/web/app/security-headers.test.ts`
- `apps/web/next.config.mjs`

All fixtures and examples used for the remediation are synthetic. The changes preserve
matter-scoped access, no-live-settlement behavior, no automatic trust posting, no provider/payment
side effects, and no direct `main` push.

## Finding Closure

| Finding                                       | Closure                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMAIL-001`                                   | Unscoped inbound-email matter assignment now requires firm-wide unscoped `inbound_email:update` before the existing target-matter update check runs. Regression coverage denies a matter-scoped licensee that knows an unscoped message id and preserves owner/admin reviewed routing.                                                               |
| `FILE-001`                                    | External-upload capacity now counts every link-scoped `intent_created` document until completion, rejection, or explicit cleanup. The capacity check no longer drops aged signed-url intents.                                                                                                                                                        |
| `PORTAL-001`                                  | Client portal workspace action aggregation now derives a portal principal filter and only emits proven current-principal actions. Ambiguous matter-wide secure-share and external-upload summaries are hidden until durable recipient/contact evidence exists. Guest-session and conversation summaries require current contact/email/user evidence. |
| `SSRF-CONNECTORS-001`                         | IPv6 parsing is centralized in `packages/domain/src/outbound-webhooks.ts`. The guard now denies `fec0::/10`, NAT64 `64:ff9b::/96` private mappings, and `64:ff9b:1::/48` private mappings across domain, API DNS, developer webhook, worker preflight, and worker socket-lookup coverage.                                                            |
| `TRUST-BILLING-001`                           | Migration `0066_trust_transfer_ledger_transaction_single_use.sql` adds a partial unique index on non-null `billing_trust_transfer_requests.ledger_transaction_id`. The schema and memory repository mirror the invariant without backfill or automatic financial evidence reconciliation.                                                            |
| `DEP-NODEMAILER-001`                          | `@open-practice/providers` now depends on `nodemailer@^9.0.1`, the workspace override pins `nodemailer: 9.0.1`, and the lockfile resolves only `9.0.1`. SMTP coverage proves structured message fields are used without `raw`, with `disableFileAccess` and `disableUrlAccess` enabled.                                                              |
| `OP-WEB-PUBTOKEN-LEGACY-PATH-SHARE`           | The legacy `/share-links/[token]` page was removed. The hash-token entry page remains.                                                                                                                                                                                                                                                               |
| `OP-WEB-PUBTOKEN-LEGACY-PATH-GUEST`           | The legacy `/guest-sessions/[token]` page was removed. The hash-token entry page remains.                                                                                                                                                                                                                                                            |
| `OP-WEB-PUBTOKEN-LEGACY-PATH-EXTERNAL-UPLOAD` | The legacy `/external-uploads/[token]` page was removed. The hash-token entry page remains.                                                                                                                                                                                                                                                          |
| `OP-WEB-PUBTOKEN-LEGACY-PATH-INTAKE`          | The legacy `/intake-forms/[token]` page was removed. The hash-token entry page remains.                                                                                                                                                                                                                                                              |

## Validation

Selector was run against the changed path set before choosing the validation bundle. A final
selector rerun is required after this proof/index update and is recorded in the closeout addendum
below.

Focused remediation checks:

- `pnpm --filter @open-practice/domain test -- outbound-webhooks` - passed.
- `pnpm --filter @open-practice/api test -- inbound-email external-uploads client-portal connectors` - passed.
- `pnpm --filter @open-practice/worker test -- processors` - passed.
- `pnpm --filter @open-practice/database test -- repository.ledger schema` - passed.
- `pnpm --filter @open-practice/providers test -- smtp` - passed after building upstream package outputs.
- `pnpm --filter @open-practice/web test -- public-token-routes` - passed after building upstream package outputs.

Selected package and repository gates:

- `pnpm --filter @open-practice/domain test` - passed.
- `pnpm --filter @open-practice/domain typecheck` - passed.
- `pnpm --filter @open-practice/domain build` - passed.
- `pnpm --filter @open-practice/database test` - passed.
- `pnpm --filter @open-practice/database typecheck` - passed.
- `pnpm --filter @open-practice/database build` - passed.
- `pnpm --filter @open-practice/database db:check` - passed.
- `pnpm migrations:check` - passed.
- `pnpm --filter @open-practice/api test` - passed.
- `pnpm --filter @open-practice/api typecheck` - passed.
- `pnpm --filter @open-practice/providers test` - passed.
- `pnpm --filter @open-practice/providers typecheck` - passed.
- `pnpm --filter @open-practice/providers build` - passed.
- `pnpm --filter @open-practice/worker test` - passed.
- `pnpm --filter @open-practice/worker typecheck` - passed.
- `pnpm --filter @open-practice/worker build` - passed.
- `pnpm --filter @open-practice/web test` - passed.
- `pnpm --filter @open-practice/web typecheck` - passed.
- `pnpm policy:check` - passed.
- `pnpm deps:audit` - passed.
- `pnpm deps:licenses` - passed.
- `pnpm build` - passed.
- `pnpm why nodemailer` - passed and showed `nodemailer@9.0.1` only.
- `git diff --check` - passed.

Environment-blocked replay:

- `pnpm migrations:replay` was attempted but could not connect to local Postgres at
  `localhost:35432`.
- `docker compose ps postgres` could not connect to the Docker daemon at
  `unix:///Users/bryan/.docker/run/docker.sock`.

The migration is covered by `db:check`, `migrations:check`, schema assertions, memory repository
duplicate-link behavior, and the existing API conflict path. A live Postgres replay remains a local
environment follow-up if Docker/Postgres becomes available.

## Closeout Addendum

Final selector and repository closeout after this proof/index update:

- `pnpm verify:select -- --files <34 changed repo paths>` - passed and selected `ci:local`,
  dependency audit/license gates, format/docs/policy gates, package tests/typechecks/builds,
  `db:check`, `migrations:check`, and root `pnpm build`.
- `pnpm format:check` - passed after Prettier reflow of this proof.
- `pnpm docs:check` - passed.
- `git diff --check` - passed.
- `pnpm ci:local` - passed; log captured at
  `/tmp/codex-security-scans/open-practice/e680c230_20260619T050725Z/artifacts/ci-local-remediation.log`.
- `pnpm deps:audit` - passed with no known production or development vulnerabilities.
- `pnpm deps:licenses` - passed; the report still lists the existing review-required license groups.
- `pnpm why nodemailer` - passed and reported one resolved version, `nodemailer@9.0.1`.
