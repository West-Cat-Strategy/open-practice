# Inbound Email Matter Draft Proof

Date: 2026-06-16 PDT

## Scope

- Added `POST /api/inbound-email/messages/:id/matter-draft` for owner/admin confirmed, review-only
  matter drafts from unscoped inbound email.
- Stored sanitized draft posture in existing inbound message metadata: safe source cues,
  staff-authored redacted body summary, proposed matter fields, and
  `automaticMatterCreation: false`.
- Added dashboard unscoped inbound review rows that show only safe sender/source posture and prefill
  the existing first-matter form after confirmation.
- Extended communications inbox summaries to include sanitized matter-draft posture when a routed
  message carries one.

Out of scope: automatic matter creation, provider ingestion changes, parser/worker changes, raw
client body storage in job metadata, raw MIME/object-key/provider metadata exposure, migrations,
dependencies, and permission expansion.

Existing inbound-provider proof remains the prior source for provider ingestion posture:
[Mailgun inbound webhook proof](OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md),
[inbound email role posture follow-up](OP_INBOUND_EMAIL_ROLE_POSTURE_FOLLOWUP_PROOF_2026-06-03.md),
and [inbound email replay recovery proof](OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md).

## Focused Validation

| Command                                                                                                                                                    | Result | Notes                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build`                                                                                                                | Passed | Built domain exports for the fresh sibling worktree.                                                                                   |
| `pnpm --filter @open-practice/database build`                                                                                                              | Passed | Built database exports so API tests could resolve repository imports.                                                                  |
| `pnpm --filter @open-practice/providers build`                                                                                                             | Passed | Built provider exports during sibling-worktree bootstrap.                                                                              |
| `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts --pool forks --fileParallelism=false`                                      | Passed | 1 file, 23 tests; matter-draft audit metadata hints stay length/count/posture only.                                                    |
| `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts src/routes/communications.test.ts --pool forks --fileParallelism=false` | Passed | 2 files, 49 tests; matter-draft creation, denials, redaction, communications posture, and no automatic matter creation.                |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts --pool forks --fileParallelism=false`                                       | Passed | 1 file, 73 tests; unscoped inbound row redaction, draft payload building, communications loading, and first-matter payload boundaries. |

Initial focused API/web tests failed before package bootstrap in the fresh sibling worktree because
workspace package entrypoints were not built yet; they passed after the domain/database/providers
builds above.

## Final Selector And Gates

Selector command:

```sh
pnpm verify:select -- --files apps/api/src/routes/inbound-email/matter-drafts.ts docs/validation/OP_INBOUND_EMAIL_MATTER_DRAFT_PROOF_2026-06-16.md apps/api/src/routes/communications.test.ts apps/api/src/routes/communications/inbox.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email/shared.ts apps/web/app/_features/communications/models.ts apps/web/app/_features/communications/server-resources.ts apps/web/app/communications-inbox-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-utils.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts scripts/route-authorization-manifest.mjs
```

Final selector result: passed. It selected format/docs/policy, full package tests, domain/API/web
typechecks, and build coverage for the inbound-email, matter, API, and web path set.

| Command                                                                                                                                                                               | Result | Notes                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files <21 final changed paths>`                                                                                                                              | Passed | Selected `format:check`, `docs:check`, `policy:check`, `test`, package tests, domain/API/web typechecks, and `build`.                                                                |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                                                       | Passed | Domain audit taxonomy types remain valid.                                                                                                                                            |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                          | Passed | Inbound-email route, communications aggregate, and authorization manifest changes typecheck.                                                                                         |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                          | Passed | Dashboard review panel, communications resources, and shared model changes typecheck.                                                                                                |
| `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts src/routes/communications.test.ts src/routes/matters.test.ts --pool forks --fileParallelism=false` | Passed | 3 files, 63 tests; inbound draft API, communications posture, and normal matter creation separation all pass together.                                                               |
| `pnpm build`                                                                                                                                                                          | Passed | Domain/database/providers cache hits plus API, worker, and web production builds passed.                                                                                             |
| `pnpm docs:check`                                                                                                                                                                     | Passed | API/state-machine, planning, improvement, validation README, and proof links passed docs validation.                                                                                 |
| `pnpm policy:check`                                                                                                                                                                   | Passed | No new dependencies, copied excerpts, vendored assets, provider adapters, or license-policy exceptions.                                                                              |
| `pnpm format:check`                                                                                                                                                                   | Passed | Prettier was run on touched files before the check.                                                                                                                                  |
| `git diff --check`                                                                                                                                                                    | Passed | No whitespace errors.                                                                                                                                                                |
| `pnpm test`                                                                                                                                                                           | Failed | Broad run passed domain, providers, web, database, worker, and most API tests; API timed out three unrelated `server.test.ts`/`caldav.test.ts` cases under full-suite parallel load. |
| `pnpm --filter @open-practice/api exec vitest run src/server.test.ts src/routes/caldav.test.ts --pool forks --fileParallelism=false`                                                  | Passed | Retry of the timed-out broad-suite API files passed: 2 files, 47 tests. The timeout was not reproduced serially.                                                                     |

## Boundary Notes

- The matter-draft endpoint requires existing unscoped `inbound_email:read`,
  `inbound_email:update`, and `matter:create`; it does not add roles or widen matter scopes.
- Direct inbound message serialization now whitelists sanitized `staffTriage` and `matterDraft`
  metadata instead of echoing arbitrary provider/private metadata.
- Dashboard unscoped review rows are server-sanitized before reaching the client: no raw body,
  subject text, full sender address, storage key, or provider metadata is passed through.
- Confirming a matter draft pre-fills the existing first-matter form; creating the matter remains a
  separate explicit `POST /api/matters` action.

## Skipped Checks

- Docker-backed browser proof was not run during focused validation.
- Manual browser screenshot proof was not run during focused validation.
