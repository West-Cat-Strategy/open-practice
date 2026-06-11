# Email Settings SMTP/IMAP Proof - 2026-06-10

## Scope

- Branch/worktree: `codex/email-settings-smtp-imap-2026-06-10` in
  `/Users/bryan/projects/open-practice-email-settings`.
- Scope is limited to SMTP/IMAP provider settings and inbound IMAP polling:
  first-run optional provider-setting capture, owner-admin Admin settings forms,
  redacted API read/update routes, DB-backed SMTP delivery resolution, and IMAP
  raw-MIME polling through the existing `inbound_email` queue.
- Mailgun raw-MIME webhook ingestion remains a parallel inbound provider.
- Synthetic examples only. No client, matter, deployment, payment, or private credential details
  were added.

## Actual Changed Paths

Selector validation and this proof are reconciled against this 52-path source/docs/config set:

```text
.env.example
apps/api/src/routes/email.test.ts
apps/api/src/routes/email.ts
apps/api/src/routes/email/settings.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email.ts
apps/api/src/routes/inbound-email/imap-polling.ts
apps/api/src/routes/inbound-email/imap-settings.ts
apps/api/src/routes/outbound-email.ts
apps/api/src/routes/setup.ts
apps/api/src/server.test.ts
apps/api/src/server.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
apps/web/app/page.tsx
apps/web/app/setup-wizard-utils.test.ts
apps/web/app/setup-wizard-utils.ts
apps/web/app/setup-wizard.tsx
apps/web/app/types.ts
apps/worker/src/processors.ts
apps/worker/src/processors/inbound-email-poll.test.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/provider-mail-sender.test.ts
apps/worker/src/provider-mail-sender.ts
apps/worker/src/queues.test.ts
apps/worker/src/worker.ts
docker-compose.yml
docs/api-and-state-machines.md
docs/development/getting-started.md
docs/planning-and-progress.md
docs/tech-stack.md
docs/validation/OP_EMAIL_SETTINGS_SMTP_IMAP_PROOF_2026-06-10.md
docs/validation/README.md
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/repository/setup-contracts.ts
packages/database/src/repository/setup/drizzle.ts
packages/database/src/repository/setup/memory.ts
packages/database/test/repository.first-run.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/email-provider-settings.test.ts
packages/domain/src/email-provider-settings.ts
packages/domain/src/index.ts
packages/domain/src/permissions.ts
packages/providers/package.json
packages/providers/src/email/imap.test.ts
packages/providers/src/email/imap.ts
packages/providers/src/index.ts
pnpm-lock.yaml
scripts/route-authorization-manifest.mjs
scripts/run-e2e.mjs
```

Generated Playwright screenshots from earlier exploratory proof were removed from the working tree
before this reconciliation so they are not part of the review diff.

## Implementation Notes

- SMTP provider config is stored under existing encrypted provider settings as `smtp/default`.
- IMAP provider config is stored under existing encrypted provider settings as `inbound_email/imap`.
- Redacted API/UI responses expose host, port, TLS, username/sender/mailbox, enabled state,
  config validity, missing fields, password-configured state, and IMAP poll watermarks/timestamps;
  they do not return passwords or raw provider config.
- First-run setup can create initial SMTP and IMAP provider settings, encrypting them through the
  existing provider-settings store. If IMAP is enabled and a queue is configured, setup queues the
  first poll without failing setup when the queue is absent.
- Owner-admin Admin settings can update SMTP and IMAP settings through the existing
  `provider_setting` permission; read-only permitted roles receive redacted settings only.
- Worker SMTP delivery resolves enabled SMTP settings by firm from the repository rather than
  process-wide `SMTP_*` environment variables.
- IMAP polling uses ImapFlow, stores raw MIME under
  `inbound-email/<firmId>/raw/provider-polls/imap/...`, queues existing `parse_inbound_email` jobs,
  and records UIDVALIDITY, UID watermark, last-poll timestamps, and next-poll state in provider
  config.

## Validation

| Command                                                                                                                                             | Result | Notes                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <52 changed paths>`                                                                                                  | Pass   | Selector chose broad local, dependency, Docker, package, docs, policy, build, and test gates for the final path set.         |
| `pnpm --filter @open-practice/domain build`                                                                                                         | Pass   | Required before downstream package export resolution.                                                                        |
| `pnpm --filter @open-practice/database build`                                                                                                       | Pass   | Required before API/worker tests import database exports.                                                                    |
| `pnpm --filter @open-practice/providers build`                                                                                                      | Pass   | Required before worker tests import provider exports.                                                                        |
| `pnpm --filter @open-practice/domain exec vitest run src/email-provider-settings.test.ts`                                                           | Pass   | 3 tests.                                                                                                                     |
| `pnpm --filter @open-practice/providers exec vitest run src/email/imap.test.ts`                                                                     | Pass   | 3 tests.                                                                                                                     |
| `pnpm --filter @open-practice/database exec vitest run test/repository.first-run.test.ts test/repository.providers-jobs-email.test.ts`              | Pass   | 17 tests.                                                                                                                    |
| `pnpm --filter @open-practice/api exec vitest run src/server.test.ts src/routes/email.test.ts src/routes/inbound-email.test.ts`                     | Pass   | 119 tests.                                                                                                                   |
| `pnpm --filter @open-practice/worker exec vitest run src/provider-mail-sender.test.ts src/processors/inbound-email-poll.test.ts src/queues.test.ts` | Pass   | 16 tests.                                                                                                                    |
| `pnpm --filter @open-practice/web exec vitest run app/setup-wizard-utils.test.ts app/dashboard/admin-readiness-section.test.tsx`                    | Pass   | 14 tests.                                                                                                                    |
| Package typechecks for domain, database, providers, API, worker, and web                                                                            | Pass   | `tsc -p tsconfig.json --noEmit` for each selected workspace.                                                                 |
| Package tests for domain, database, providers, API, worker, and web                                                                                 | Pass   | Domain 25/176, database 18/111, providers 9/24, API 41/507, worker 5/40, web 34/178.                                         |
| `pnpm --filter @open-practice/database db:check`                                                                                                    | Pass   | Drizzle schema check.                                                                                                        |
| `pnpm migrations:check`                                                                                                                             | Pass   | 52 SQL files match 52 journal entries.                                                                                       |
| `pnpm format:check`                                                                                                                                 | Pass   | Whole-tree Prettier check.                                                                                                   |
| `pnpm docs:check`                                                                                                                                   | Pass   | Documentation link validation.                                                                                               |
| `pnpm policy:check`                                                                                                                                 | Pass   | Includes route authorization manifest, proof index, OSS reuse, local evidence Docker ignore, and boundary checks.            |
| `pnpm deps:audit`                                                                                                                                   | Pass   | Production and dev audit completed with no known vulnerabilities.                                                            |
| `pnpm deps:licenses`                                                                                                                                | Pass   | License report completed; `imapflow` is MIT. Existing review-required license groups remain reported by the repo-level tool. |
| `pnpm build`                                                                                                                                        | Pass   | Full Turbo build.                                                                                                            |
| `pnpm test`                                                                                                                                         | Pass   | Full Turbo package tests plus 63 script tests.                                                                               |
| `pnpm ci:local`                                                                                                                                     | Pass   | Verify chain plus `git diff --check`.                                                                                        |
| `pnpm docker:residual-watch`                                                                                                                        | Pass   | Artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-10T07-17-02Z`.                              |
| `pnpm docker:app-smoke`                                                                                                                             | Pass   | Disposable PostgreSQL-backed API health and web root checks passed.                                                          |
| `pnpm e2e:docker`                                                                                                                                   | Pass   | 5 Playwright Docker tests passed, including dashboard, external upload, public-token, UI/UX, and receipt layout coverage.    |

## Skipped Or Residual

- None. The earlier Docker Desktop storage blocker did not reproduce; Docker app smoke reached
  Compose readiness and `pnpm e2e:docker` passed.
