# OP-T132 Communications Channel History And Client Updates Proof

Date: 2026-05-30

## Scope

Implemented the first read-only OP-T132 slice across the existing communications, conversation, and
client portal seams:

- `GET /api/communications/inbox?matterId=` now returns a normalized redacted `channelHistory`
  timeline across inbound email, outbound email, conversation topics, phone/text note placeholders,
  and draft-only client-update requests.
- Client-update draft requests are derived from existing conversation message records and expose
  only IDs, status, timestamps, body length, and redaction flags.
- Client portal workspace actions now include read-only `client_update` status rows from existing
  addressed outbound `client.update` email records.
- Matter overview renders history and draft counts/rows without adding a composer, realtime chat,
  live SMS/text delivery, automatic sends, new providers, new persistence, or route-catalog changes.

## Redaction And Boundary Proof

- Communications inbox tests assert message bodies, parsed email text, subjects, addresses, storage
  keys, provider IDs/tokens, private staff notes, conversation message bodies, and client-update
  draft metadata values are absent from the aggregate payload.
- Client portal tests assert update email subject, sender address, HTML body, text body, token
  hashes, and private portal-adjacent metadata are absent from the workspace response.
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
| `pnpm --filter @open-practice/api exec vitest run src/routes/communications.test.ts src/routes/client-portal.test.ts`     | Passed after package builds: 2 files, 6 tests.                                                                                                      |
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

## Revalidation - 2026-05-31

After confirming the live OP-T132 changed-path set, reran:

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  - Passed; selected `format:check`, `docs:check`, `policy:check`, API test/typecheck, web
    test/typecheck, and `pnpm build`.
- `pnpm --filter @open-practice/domain build`
  - Passed.
- `pnpm --filter @open-practice/database build`
  - Passed.
- `pnpm --filter @open-practice/providers build`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 39 files, 407 tests.
- `pnpm --filter @open-practice/web test`
  - Passed: 14 files, 121 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm format:check`
  - Passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm build`
  - Passed: 6 packages built from cache.
- `git diff --check`
  - Passed.

Skipped checks: none.

## Consolidation Stabilization - 2026-05-31

Revalidated OP-T132 as part of the combined
`codex/op-clio-parity-consolidation-2026-05-31` branch with OP-T134, OP-T141, and OP-T142.

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  passed and selected host E2E, Docker E2E, format, docs, policy, domain/API/providers/worker/web
  tests, domain/API/web typechecks, and `pnpm build` for the real consolidation changed-path set.
- `pnpm --filter @open-practice/domain build`, `pnpm --filter @open-practice/database build`, and
  `pnpm --filter @open-practice/providers build` passed.
- `pnpm --filter @open-practice/domain test` passed: 22 files, 145 tests.
- `pnpm --filter @open-practice/api test` passed: 39 files, 409 tests.
- `pnpm --filter @open-practice/providers test` passed: 5 files, 15 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 23 tests.
- `pnpm --filter @open-practice/web test` passed: 15 files, 125 tests.
- Domain, API, and web typechecks passed.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `pnpm build` passed.
- `pnpm e2e:host` passed: 33 passed, 3 skipped.

Skipped check:

- `pnpm e2e:docker` could not start because the Docker daemon was unavailable at
  `unix:///Users/bryan/.docker/run/docker.sock` while resolving
  `open-practice-mailpit:v1.30.1-go1.26.3`; cleanup reported the same daemon connection blocker.
