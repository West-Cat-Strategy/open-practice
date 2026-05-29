# OP-T128 Client Portal Account Workspace Proof - 2026-05-28

## Scope

Implemented the smallest logged-in client portal account workspace over existing portal-adjacent
records:

- Staff-controlled client account setup for a matter contact, including an active portal grant and
  one-time password setup token when JWT signing is configured.
- A logged-in `client_external` workspace that summarizes existing secure-share, external-upload,
  intake, guest-session, email receipt, and client-action records by granted matter.
- Redacted account/access posture and client-visible action summaries that avoid raw public tokens,
  token hashes, storage keys, email bodies, IP/user-agent values, private review metadata, and broad
  document browsing payloads.
- A small staff setup control in the existing Shares section and a first client account workspace
  rendered from the authenticated app entry.

Public-token route rewrites, realtime chat, broad document browsing, live payments, and native
mobile behavior stayed out of scope.

No dependencies, copied excerpts, vendored assets, or reference-derived code were added. The license
policy was checked and this slice is original Open Practice code.

## Changed Seams

- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/server.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/types.ts`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/permissions.ts`
- `scripts/validate-open-practice-boundaries.mjs`
- `scripts/route-authorization-manifest.mjs`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T128_CLIENT_PORTAL_WORKSPACE_PROOF_2026-05-28.md`

## Validation

| Command                                                                                                  | Result                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files <OP-T128 changed paths>`                                                  | Passed and recommended formatting, docs, policy, package tests/typechecks, database checks, migrations, providers/worker tests, web/API tests, full test, and build. Focused validation stayed on touched OP-T128 seams. |
| `pnpm exec prettier --check <OP-T128 changed paths>`                                                     | Passed after formatting the two edited docs tables with Prettier.                                                                                                                                                        |
| `pnpm format:check`                                                                                      | Passed.                                                                                                                                                                                                                  |
| `pnpm docs:check`                                                                                        | Passed.                                                                                                                                                                                                                  |
| `pnpm policy:check`                                                                                      | Passed tracked-secret scan, package manifest policy, migration parity, OSS reuse policy, docs links, and Open Practice boundary policy.                                                                                  |
| `pnpm --filter @open-practice/domain --filter @open-practice/database build`                             | Passed. Fresh-worktree prep for workspace package entrypoints.                                                                                                                                                           |
| `pnpm --filter @open-practice/providers build`                                                           | Passed. Fresh-worktree prep for API provider imports.                                                                                                                                                                    |
| `pnpm --filter @open-practice/api exec vitest run src/routes/client-portal.test.ts`                      | Passed: 3 tests.                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web exec vitest run app/client-portal-workspace-utils.test.ts`             | Passed: 2 tests.                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts src/permissions.test.ts` | Passed: 24 tests.                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database exec vitest run test/repository.portal-links.test.ts`             | Passed: 2 tests.                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/domain typecheck`                                                          | Passed.                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/database typecheck`                                                        | Passed.                                                                                                                                                                                                                  |
| `pnpm --filter @open-practice/api typecheck`                                                             | Passed after building the providers workspace package in this fresh worktree.                                                                                                                                            |
| `pnpm --filter @open-practice/web typecheck`                                                             | Passed.                                                                                                                                                                                                                  |
| `pnpm build`                                                                                             | Passed: 6 workspace build tasks.                                                                                                                                                                                         |
| `git diff --check`                                                                                       | Passed.                                                                                                                                                                                                                  |

## Redaction Proof

- Account setup responses expose the one-time setup token only when created and never expose stored
  credential hashes.
- Account setup audit metadata records matter/contact/user/grant posture and setup-token status, not
  the contact email address, raw setup token, token hash, or credential material.
- Workspace route tests seed secure shares, external upload review metadata, intake item action
  evidence, guest-session metadata, email bodies, and email receipt metadata, then assert private
  values do not appear in the client response.
- Client workspace summaries expose action family, title, status, timestamps, and safe matter labels;
  they do not expose public-token URLs, token hashes, document storage keys, private review notes,
  email bodies, IP/user-agent values, or broad document listing payloads.

## Notes

This clean extraction was validated in `/Users/bryan/projects/open-practice-op-t128-clean` on
`codex/op-t128-clean-slice-2026-05-28`. The original dependency-refresh worktree was left
unchanged.

The first focused API test run failed before tests loaded because the fresh sibling worktree did not
yet have built `@open-practice/database` package entrypoints. The first API typecheck similarly
needed the built providers package. After building the required workspace packages, the focused API
test and API typecheck passed.

The selector also recommended broad package/full test, provider, worker, database check, and
migration check coverage. Those were not all rerun as final OP-T128 proof because this slice touched
the client-portal API/web/domain/repository/docs seams without schema migration or provider/worker
runtime behavior; migration parity still ran through `pnpm policy:check`, and `pnpm build` passed
across all workspace packages.

The in-browser API/web smoke from the mixed source tree was not rerun during this clean extraction.
