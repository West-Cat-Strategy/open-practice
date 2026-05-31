# OP-T132 Communications Channel History And Client Updates Proof

Date: 2026-05-30

## Scope

Implemented the first read-only OP-T132 slice across the existing communications, conversation, and
client portal seams:

- `GET /api/communications/inbox?matterId=` now returns a normalized redacted `channelHistory`
  timeline across inbound email, outbound email, conversation topics, phone/text note placeholders,
  and draft-only client-update requests.
- Client-update draft requests are derived from explicitly marked existing conversation message
  records and expose only IDs, status, timestamps, body length, and redaction flags.
- Client portal workspace actions now include read-only `client_update` status rows from existing
  addressed outbound `client.update` email records.
- Matter overview renders history and draft counts/rows without adding a composer, realtime chat,
  live SMS/text delivery, automatic sends, new providers, new persistence, or route-catalog changes.

## Recovered Changed Paths

Recovered the slice from the 2026-05-29 rollout memory into the sibling branch
`codex/op-t132-communications-2026-05-30`. The branch-local OP-T132 diff is limited to:

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/communications.test.ts`
- `apps/api/src/routes/communications.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/communications-inbox-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/matter-overview-section.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T132_COMMUNICATIONS_CHANNEL_HISTORY_CLIENT_UPDATES_PROOF_2026-05-30.md`

No OP-T130, OP-T131, OP-T133, OP-T141, database, migration, route-manifest, dependency, or style
files are part of this recovered slice.

## Redaction And Boundary Proof

- Communications inbox tests assert message bodies, parsed email text, subjects, addresses, storage
  keys, provider IDs/tokens, private staff notes, conversation message bodies, and client-update
  draft metadata values are absent from the aggregate payload.
- Ordinary client conversation messages are not promoted into client-update draft requests unless
  the existing message metadata explicitly marks them as draft requests.
- Client portal tests assert update email subject, sender address, HTML body, text body, token
  hashes, other-client update rows, and private portal-adjacent metadata are absent from the
  workspace response.
- Client-update summaries explicitly return `automaticSendEnabled: false` and
  `portalComposerEnabled: false`.
- SMS/text appears only as a staff-triage follow-up placeholder derived from safe channel and consent
  metadata; no live SMS sender, public composer, realtime chat, or automatic send path was added.

## Validation

| Command                                                                                                                   | Result                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`                       | Passed; selected `format:check`, `docs:check`, `policy:check`, API test/typecheck, web test/typecheck, and `pnpm build` for the real changed paths. |
| `pnpm --filter @open-practice/domain build`                                                                               | Passed; restored package exports in the fresh worktree before downstream API/web checks.                                                            |
| `pnpm --filter @open-practice/database build`                                                                             | Passed after the domain build completed.                                                                                                            |
| `pnpm --filter @open-practice/providers build`                                                                            | Passed after the domain build completed.                                                                                                            |
| `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts src/routes/client-portal.test.ts`     | Passed after package builds: 2 files, 7 tests.                                                                                                      |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/client-portal-workspace-utils.test.ts` | Passed after package builds: 2 files, 69 tests.                                                                                                     |
| `pnpm format:check`                                                                                                       | Passed.                                                                                                                                             |
| `pnpm docs:check`                                                                                                         | Passed.                                                                                                                                             |
| `pnpm policy:check`                                                                                                       | Passed; included secret scan, package manifest policy, migration parity, OSS reuse validation, doc links, and boundary policy.                      |
| `pnpm --filter @open-practice/api test`                                                                                   | Passed: 39 files, 407 tests.                                                                                                                        |
| `pnpm --filter @open-practice/web test`                                                                                   | Passed: 14 files, 121 tests.                                                                                                                        |
| `pnpm --filter @open-practice/api typecheck`                                                                              | Passed.                                                                                                                                             |
| `pnpm --filter @open-practice/web typecheck`                                                                              | Passed.                                                                                                                                             |
| `pnpm build`                                                                                                              | Passed: 6 packages built, with domain/database/providers/worker cache hits and fresh API/web builds.                                                |
| `git diff --check`                                                                                                        | Passed.                                                                                                                                             |

Skipped checks: none.

Note: the first focused API/web test attempts failed in the fresh sibling worktree because
`@open-practice/domain` and `@open-practice/database` package exports had not been built yet. After
building domain, database, and providers, the same focused checks passed.

## Recovery Revalidation - 2026-05-30

After confirming the live OP-T132 changed-path set, reran:

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  - Passed; selected `format:check`, `docs:check`, `policy:check`, API test/typecheck, web
    test/typecheck, and `pnpm build`.
- `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts src/routes/client-portal.test.ts`
  - Passed: 2 files, 7 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/client-portal-workspace-utils.test.ts`
  - Passed: 2 files, 69 tests.
- `pnpm format:check`
  - Passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 39 files, 408 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 14 files, 121 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 packages built successfully.
- `git diff --check`
  - Passed.

Skipped checks: none.
