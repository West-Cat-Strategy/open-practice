# Deep Security Remediation Proof - 2026-06-24

Date: 2026-06-24
Branch: `security/deep-scan-main-20260624`
Worktree: `/Users/bryan/projects/open-practice-security-deep-main-20260624`
Base: `origin/main` at `79e35ece076bf0e6d2ed37c565fee24304cdc7c5`
Status: Implemented and locally validated. `pnpm security:review` is accepted with the existing
MinIO readiness-blocked result because the only failed required command was the already-documented
Docker residual-watch MinIO private-pilot blocker.

## Scope

This branch remediates the 11 deep-scan findings from the main-branch security scan while preserving
synthetic-only proof, existing matter/contact/workspace access checks, and local-only validation
artifacts.

- Signature authority: unauthenticated public intake signature calls cannot self-declare terminal
  document-signature status, client portal signature events cannot terminally self-advance, and
  server receive time remains authoritative for signature audit chronology.
- Portal authorization: workspace action families now require their granular portal permissions for
  intake, billing, appointment/task, communication, and signature summaries.
- Public-token and webhook side effects: external upload capacity is reserved atomically at intent
  issue time, Mailgun raw MIME idempotency is reserved before object storage writes, receipt
  confirmation forms post to non-token URLs, and guest-session public status hides aggregate lobby
  counts.
- Egress, generated links, and browser hardening: SMTP/IMAP provider hosts are checked at settings
  save and worker connection time with injectable DNS resolution, CalDAV/subscription links use a
  trusted configured public API origin, and production web CSP no longer includes
  `script-src 'unsafe-inline'`.

No runtime dependency, database migration, copied upstream code, client data, matter data, payment
data, credential, provider secret, private deployment detail, or live-provider activation was added.

## Finding Closure

| Finding         | Closure                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANON-R02-003` | Public intake document signatures ignore caller terminal state and only provider-authenticated signature status sync can write terminal evidence.  |
| `CANON-R02-004` | Client portal signature events accept only non-terminal `viewed`; completed/declined self-advancement is rejected.                                 |
| `CANON-R02-002` | Client-supplied signature timestamps are not authoritative for request/signer terminal chronology.                                                 |
| `CANON-R01-004` | Portal workspace summaries are gated by granular `complete_intake`, `view_invoices`, `view_appointments_tasks`, `message`, and `sign` permissions. |
| `CANON-R02-005` | External upload capacity is claimed before issuing the presigned intent and completion no longer double-increments.                                |
| `CANON-R02-001` | Mailgun raw MIME idempotency reservation happens before raw object storage writes, so changed-body replays do not leave orphaned raw objects.      |
| `CANON-R01-001` | Receipt confirmation forms post to collection URLs and carry the token in POST body or existing header flow.                                       |
| `CANON-R01-003` | Public guest-session status returns caller/session access state without aggregate lobby counts.                                                    |
| `CANON-R02-007` | SMTP and IMAP egress destinations reject loopback, private, link-local, metadata, single-label, and DNS-resolved unsafe addresses.                 |
| `CANON-R02-006` | Calendar feed URLs use the trusted configured public API origin instead of hostile request host/proto headers.                                     |
| `CANON-R01-002` | Production CSP excludes `script-src 'unsafe-inline'`; relaxed script policy remains limited to dev/report-only paths.                              |

## Final Changed Paths

```text
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/calendar/credentials.ts
apps/api/src/routes/calendar/feed.ts
apps/api/src/routes/calendar/guest-sessions.ts
apps/api/src/routes/calendar/shared.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/client-portal/accounts.ts
apps/api/src/routes/client-portal/signatures.ts
apps/api/src/routes/client-portal/workspace.ts
apps/api/src/routes/email.test.ts
apps/api/src/routes/email.ts
apps/api/src/routes/email/receipts.ts
apps/api/src/routes/email/settings.ts
apps/api/src/routes/external-uploads.test.ts
apps/api/src/routes/external-uploads/public.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email.ts
apps/api/src/routes/inbound-email/imap-settings.ts
apps/api/src/routes/inbound-email/mailgun-raw-mime.ts
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms/public.ts
apps/api/src/routes/provider-egress.ts
apps/api/src/routes/signatures.ts
apps/api/src/routes/types.ts
apps/api/src/server.test.ts
apps/api/src/server.ts
apps/web/app/security-headers.test.ts
apps/web/next.config.mjs
apps/worker/src/processors.ts
apps/worker/src/processors/inbound-email-poll.test.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/provider-egress.ts
apps/worker/src/provider-mail-sender.test.ts
apps/worker/src/provider-mail-sender.ts
docs/validation/OP_DEEP_SECURITY_REMEDIATION_PROOF_2026-06-24.md
docs/validation/README.md
packages/domain/src/contacts.test.ts
packages/domain/src/outbound-webhooks.test.ts
packages/domain/src/outbound-webhooks.ts
packages/domain/src/sample-data.ts
```

## Selector Output

The final selector command is:

```bash
pnpm verify:select -- --files <final changed paths>
```

It must include these selected commands for the runtime and proof-doc path set:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm docker:app-smoke
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                                                                                                                                          | Result                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                                                                                                                                      | Pass                                                                   | Hydrated the fresh worktree domain output before downstream focused tests.                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`                                                                                                                                                                    | Pass                                                                   | Hydrated database and provider outputs before API/worker validation.                                                                                                                                                                                                                                                                                                    |
| `pnpm --filter @open-practice/domain test`                                                                                                                                                                                                                       | Pass                                                                   | 31 files and 246 tests passed, including provider egress host/DNS validation coverage.                                                                                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/api exec vitest run src/routes/intake-forms.test.ts src/routes/client-portal.test.ts src/routes/external-uploads.test.ts src/routes/email.test.ts src/routes/inbound-email.test.ts src/routes/calendar.test.ts src/server.test.ts` | Pass                                                                   | 7 files and 213 tests passed across signature authority, portal permissions, upload quotas, receipts, raw MIME idempotency, guest sessions, calendar origin, and production env readiness.                                                                                                                                                                              |
| `pnpm --filter @open-practice/worker exec vitest run src/provider-mail-sender.test.ts src/processors/inbound-email-poll.test.ts`                                                                                                                                 | Pass                                                                   | 2 files and 7 tests passed for SMTP/IMAP worker egress checks.                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web exec vitest run app/security-headers.test.ts`                                                                                                                                                                                  | Pass                                                                   | 1 file and 6 tests passed for production CSP posture.                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                                                                                                  | Pass                                                                   | Domain typecheck passed.                                                                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                                                                                     | Pass                                                                   | API typecheck passed after route narrowing fixes.                                                                                                                                                                                                                                                                                                                       |
| `pnpm --filter @open-practice/worker typecheck`                                                                                                                                                                                                                  | Pass                                                                   | Worker typecheck passed.                                                                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                     | Pass                                                                   | Web typecheck passed.                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm verify:select -- --files <implementation path set>`                                                                                                                                                                                                        | Pass                                                                   | Selected architecture, API contract, Docker app smoke, Docker E2E, policy, package tests/typechecks/builds, and full build.                                                                                                                                                                                                                                             |
| `pnpm verify:run -- --files <implementation path set>`                                                                                                                                                                                                           | Pass                                                                   | Artifact `.tmp/validation-runs/2026-06-24T21-26-51Z` passed all 17 selector-chosen commands, including `pnpm docker:app-smoke` and `pnpm e2e:docker`.                                                                                                                                                                                                                   |
| `pnpm ci:local`                                                                                                                                                                                                                                                  | Pass                                                                   | Full local gate passed: format, lint, typecheck, package tests, script tests, database check, policy checks, build, and `git diff --check`.                                                                                                                                                                                                                             |
| `pnpm security:review`                                                                                                                                                                                                                                           | Accepted expected readiness-blocked because of existing MinIO residual | Artifact `.tmp/open-practice-security-review/2026-06-24T21-36-54Z` failed only `docker-residual-watch` with exit `2`; tracked secret scan, dependency audit, license/SBOM, policy, hot-path rescan, artifact secret scan, source/license/privacy scans, image/static Docker scans, and secrets history all produced evidence. Optional scanner skip reasons were empty. |
| `pnpm docker:residual-watch` nested under `pnpm security:review`                                                                                                                                                                                                 | Accepted expected readiness-blocked because of existing MinIO residual | Artifact `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-24T21-42-22Z` reported MinIO 11 Critical and 16 High Docker Scout findings plus archived upstream source posture, matching the documented private-pilot readiness blocker.                                                                                                              |
| `pnpm format:check`                                                                                                                                                                                                                                              | Pass after formatting proof doc                                        | Final selector-added doc check passed after running Prettier on this proof note.                                                                                                                                                                                                                                                                                        |
| `pnpm docs:check`                                                                                                                                                                                                                                                | Pass                                                                   | Documentation link validation passed after proof/index docs joined the changed path set.                                                                                                                                                                                                                                                                                |

## Boundaries

- Repository source changes are limited to the deep-scan remediation path set and proof/index docs.
- All validation artifacts are local ignored evidence; proof text uses synthetic data only.
- The existing MinIO private-pilot readiness hold remains unchanged because clearing it is outside
  the 11 app finding remediation scope and would require a separate object-storage readiness lane.
