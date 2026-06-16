# Inbound Email Matter Draft Proof

Date: 2026-06-16 PDT

## Scope

- Added `POST /api/inbound-email/messages/:id/matter-draft` for owner/admin confirmed, review-only
  matter drafts from unscoped inbound email.
- Stored sanitized draft posture in existing inbound message metadata: safe source cues,
  staff-authored redacted body summary, proposed matter fields, and
  `automaticMatterCreation: false`.
- Added sanitized reviewer-facing duplicate-contact, existing-visible-matter, and checklist cues
  derived from authorized contact dossiers, visible matter setup profiles, and already safe source
  posture.
- Added dashboard unscoped inbound review rows that show only safe sender/source posture and prefill
  the existing first-matter form after confirmation, including compact review cue counts and labels
  after a draft is prepared.
- Extended communications inbox summaries to include sanitized matter-draft posture and review cues
  when a routed message carries one.

Out of scope: automatic matter creation, provider ingestion changes, parser/worker changes, raw
client body storage in job metadata, raw MIME/object-key/provider metadata exposure, raw matched
value exposure, contact merge automation, task/checklist persistence, migrations, dependencies, and
permission expansion.

Existing inbound-provider proof remains the prior source for provider ingestion posture:
[Mailgun inbound webhook proof](OP_INBOUND_EMAIL_MAILGUN_WEBHOOK_PROOF_2026-06-03.md),
[inbound email role posture follow-up](OP_INBOUND_EMAIL_ROLE_POSTURE_FOLLOWUP_PROOF_2026-06-03.md),
and [inbound email replay recovery proof](OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md).

## Focused Validation

| Command                                                                                                                                                    | Result | Notes                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @open-practice/domain build`                                                                                                                | Passed | Built domain exports for the fresh sibling worktree.                                                                                 |
| `pnpm --filter @open-practice/database build`                                                                                                              | Passed | Passed after the domain build completed; the first parallel bootstrap attempt failed before the domain entrypoint was visible.       |
| `pnpm --filter @open-practice/providers build`                                                                                                             | Passed | Passed after the domain build completed; the first parallel bootstrap attempt failed before the domain entrypoint was visible.       |
| `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts src/routes/communications.test.ts --pool forks --fileParallelism=false` | Passed | 2 files, 49 tests; matter-draft creation, denials, redaction, communications posture, and no automatic matter creation.              |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts --pool forks --fileParallelism=false`                                       | Passed | 1 file, 74 tests; unscoped inbound row redaction, review cue rendering, draft payload building, and first-matter payload boundaries. |
| `pnpm --filter @open-practice/api typecheck`                                                                                                               | Passed | Inbound-email cue builder, serializer, and communications route types pass.                                                          |
| `pnpm --filter @open-practice/web typecheck`                                                                                                               | Passed | Dashboard review cue model/rendering types pass.                                                                                     |

Initial parallel database/provider bootstrap failed before package bootstrap in the fresh sibling
worktree because the domain package entrypoint was not visible yet; sequential domain, database, and
providers builds passed before focused API/web validation.

## Final Selector And Gates

Selector command:

```sh
pnpm verify:select -- --files apps/api/src/routes/communications.test.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email/matter-drafts.ts apps/api/src/routes/inbound-email/shared.ts apps/web/app/_features/communications/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_INBOUND_EMAIL_MATTER_DRAFT_PROOF_2026-06-16.md docs/validation/README.md
```

Final selector result: passed. It selected format/docs/policy, full API and web tests,
API/web typechecks, and the repo build for the inbound-email, communications, dashboard, and docs
path set.

| Command                                                                                                           | Result | Notes                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <12 final changed paths>`                                                          | Passed | Selected `format:check`, `docs:check`, `policy:check`, API/web tests, API/web typechecks, and `build`.                                          |
| `pnpm docs:check`                                                                                                 | Passed | API/state-machine, planning, improvement, validation README, and proof links passed docs validation.                                            |
| `pnpm policy:check`                                                                                               | Passed | No new dependencies, copied excerpts, vendored assets, provider adapters, route authorization changes, or license-policy exceptions.            |
| `pnpm --filter @open-practice/api typecheck`                                                                      | Passed | Inbound-email cue builder, serializer, and communications route types pass.                                                                     |
| `pnpm --filter @open-practice/web typecheck`                                                                      | Passed | Dashboard review cue model/rendering types pass.                                                                                                |
| `pnpm format:check`                                                                                               | Passed | Prettier was run on touched files before the check.                                                                                             |
| `pnpm --filter @open-practice/web test`                                                                           | Passed | 35 files, 194 tests.                                                                                                                            |
| `pnpm --filter @open-practice/api test`                                                                           | Passed | Final selected rerun passed 41 files, 537 tests. First attempt timed out two unrelated CalDAV cases under full-suite parallel load.             |
| `pnpm --filter @open-practice/api exec vitest run src/routes/caldav.test.ts --pool forks --fileParallelism=false` | Passed | 1 file, 8 tests; isolated rerun showed the prior CalDAV timeout was not reproducible.                                                           |
| `pnpm build`                                                                                                      | Passed | All 6 package builds passed; domain/database/providers/worker used cache where available, API and web production builds completed successfully. |

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
