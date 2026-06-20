# OP Mainline Merge Push Prune Proof - 2026-06-19

This proof records the 2026-06-19 Open Practice active-lane consolidation from base
`e680c230` (`origin/main`) into integration branch
`merge/open-practice-active-lanes-2026-06-19`.

## Scope

Before integration, each dirty lane was committed on its own branch from its own worktree. Patch
backups for dirty worktrees were captured under ignored `.tmp/mainline-closeout-2026-06-19/`.
Initial stash count was `42`.

| Branch                                              | Commit     | Scope                                     |
| --------------------------------------------------- | ---------- | ----------------------------------------- |
| `chore/gitignore-refactor-20260619`                 | `7d0b68a5` | Local ignore-rule tightening.             |
| `chore/dependency-refresh-20260619`                 | `1e34e2fa` | Dependency and lockfile refresh posture.  |
| `chore/local-tooling-ratchets-20260619`             | `8a103bdc` | Local security/tooling ratchets.          |
| `chore/local-tooling-upgrade-20260619`              | `e5cd6f20` | Local development tooling upgrades.       |
| `chore/self-hosting-optimization-20260619`          | `a1d6fe7b` | Focused self-host profile and checks.     |
| `chore/dev-stack-rebuild-20260619`                  | `d9e4df20` | Docker-dev same-origin browser API route. |
| `security/e680c230-remediation-20260619`            | `fc88d79f` | Public-token/provider/security hardening. |
| `refactor/filtered-audit-repository-reads-20260619` | `7f21cdb4` | Filtered audit repository reads.          |
| `codex/matter-lifecycle-commands-2026-06-19`        | `d431a92c` | Review-gated matter lifecycle commands.   |
| `feat/payment-import-review-records-20260619`       | `92ba20b1` | Payment import review records.            |
| `remediate/ops-efficiency-20260619`                 | `94321cf6` | Operations efficiency remediation.        |
| `fix/review-remediation-20260619`                   | `316bf6e4` | Focused review remediation.               |
| `refactor/staff-ui-ux-page-overhaul-20260619`       | `cfbb641d` | Staff page split and shell navigation.    |
| `refactor/ui-overlap-resilience-20260619`           | `67f8a69f` | UI overlap resilience coverage and CSS.   |

## Merge Reconciliation

- The self-hosting same-origin browser API mode was kept as the superset of the Docker-local web API
  routing changes; the narrower Docker-dev changes now rely on the same `OPEN_PRACTICE_BROWSER_API_MODE=same-origin`
  behavior.
- Filtered audit work was deduplicated into `0067_filtered_audit_read_indexes.sql`, which keeps the
  action/resource sequence indexes and the operations lane's metadata GIN index.
- Migration collisions were resolved into unique consecutive migrations after `0065_hot_path_access_indexes`:
  `0066_trust_transfer_ledger_transaction_single_use`,
  `0067_filtered_audit_read_indexes`,
  `0068_payment_import_review_records`, and
  `0069_inbound_attachment_message_index`. The Drizzle journal now has matching `idx` values `66`
  through `69`.
- The review-remediation billing route authorization extraction was kept, with the already-merged
  payment import review routes added to `scripts/route-authorization/billing.mjs` and the
  matter lifecycle command route kept in the root manifest.
- The staff page split was kept while preserving the operations lane's parallel server-resource
  loading path in `apps/web/app/open-practice-home.tsx`.
- Proof/index/workboard conflicts were resolved by preserving each lane-local proof note and adding
  this mainline closeout note as the integration-level proof.

## Selector Output

The integrated diff currently has 271 paths against `origin/main`, including the integration proof
note and validator-driven follow-up fixes. The final selector command was:

```bash
pnpm verify:select -- --base origin/main
```

It emitted:

```text
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm security:review
pnpm security:secrets-history
pnpm security:privacy-rules
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
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

| Command                                                                                   | Result               | Notes                                                                                                        |
| ----------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --base origin/main`                                                | Passed               | Emitted the full selector list above.                                                                        |
| `pnpm ci:local`                                                                           | Passed               | Final rerun after UI/privacy fixes passed format, lint, typecheck, tests, DB check, policy, build, and diff. |
| `pnpm deps:audit`                                                                         | Passed               | Passed after upgrading `@cyclonedx/cyclonedx-npm` to `5.0.0` for `GHSA-v75r-vx73-82pj`.                      |
| `pnpm deps:licenses`                                                                      | Passed               | 564 packages / 591 package versions reviewed; review-required groups unchanged.                              |
| `pnpm deps:supply-chain`                                                                  | Passed               | Lockfile supply-chain policy passed with 5 native-build approval entries reviewed.                           |
| `pnpm deps:osv`                                                                           | Skipped              | OSV CLI unavailable; artifact `.tmp/security/osv/2026-06-20T00-10-14Z`.                                      |
| `pnpm license:scan`                                                                       | Skipped              | ScanCode unavailable; artifact `.tmp/license/scancode/2026-06-20T00-12-57Z`.                                 |
| `pnpm security:review`                                                                    | Passed               | Packet artifact `.tmp/open-practice-security-review/2026-06-20T00-13-09Z`.                                   |
| `pnpm security:secrets-history`                                                           | Review-required pass | Gitleaks packet `.tmp/security/gitleaks/2026-06-20T00-12-57Z`; no matched secret values copied into proof.   |
| `pnpm security:privacy-rules`                                                             | Skipped              | Semgrep unavailable; artifact `.tmp/security/semgrep-privacy/2026-06-20T00-12-57Z`.                          |
| `pnpm architecture:check`                                                                 | Passed               | 436 workspace import edges reviewed.                                                                         |
| `pnpm api:contract`                                                                       | Passed               | Wrote `.tmp/api-contract/openapi.json` with 308 paths.                                                       |
| `pnpm docker:lint`                                                                        | Skipped              | Hadolint unavailable; artifact `.tmp/docker/lint/2026-06-20T00-15-31Z`.                                      |
| `pnpm docker:residual-watch`                                                              | Passed               | Artifact `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-20T00-16-11Z`.               |
| `pnpm docker:app-smoke`                                                                   | Passed               | PostgreSQL-backed API health and same-origin web `/api/setup/status` checked; stack torn down.               |
| `pnpm docker:scan`                                                                        | Skipped              | Trivy unavailable; artifact `.tmp/docker/trivy/2026-06-20T00-19-18Z`.                                        |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example` | Passed               | Self-host Compose check passed.                                                                              |
| `pnpm e2e:host`                                                                           | Passed               | First run failed for missing Playwright browsers; after `pnpm exec playwright install`, rerun passed 36/36.  |
| `pnpm e2e:docker`                                                                         | Passed               | Docker Chromium suite passed 3/3 and disposable stack was torn down.                                         |
| `node scripts/run-e2e.mjs first-run`                                                      | Passed               | First-run Chromium test passed 1/1.                                                                          |
| `pnpm e2e:matterless`                                                                     | Passed               | Matterless Chromium tests passed 2/2.                                                                        |
| `pnpm e2e:client-portal`                                                                  | Passed               | First run exposed missing visible redaction cue; rerun passed 2/2 after privacy cue fix.                     |
| `pnpm e2e:a11y`                                                                           | Passed               | First runs exposed contrast regressions; rerun passed 2/2 after shared CSS contrast fixes.                   |
| `pnpm format:check`                                                                       | Passed               | Also covered by final `pnpm ci:local`.                                                                       |
| `pnpm docs:check`                                                                         | Passed               | Also covered by final `pnpm ci:local`/policy lane.                                                           |
| `pnpm policy:check`                                                                       | Passed               | Security, manifests, supply chain, toolchain, env, architecture, deadcode, migrations, OSS, docs, boundary.  |
| `pnpm test`                                                                               | Passed               | Package tests plus 133 script tests passed.                                                                  |
| Package test/typecheck/build commands                                                     | Passed               | All emitted package-level commands passed by exact command.                                                  |
| `pnpm migrations:check`                                                                   | Passed               | 70 SQL files match 70 journal entries.                                                                       |
| `pnpm migrations:lint`                                                                    | Passed               | 0 changed SQL migration files reviewed.                                                                      |
| `pnpm migrations:replay`                                                                  | Passed               | Initial run found no local Postgres; after starting Compose Postgres, 70 migrations replayed and cleaned up. |
| `pnpm build`                                                                              | Passed               | Turbo build passed; web Next build generated 20 static pages.                                                |
| `git diff --check`                                                                        | Passed               | Also covered by final `pnpm ci:local`.                                                                       |

Validation forced these follow-up commits on the integration branch:

- `fix: preserve client portal token boundaries`: removed authenticated client workspace
  `secure_share` and `external_upload` action families after API tests caught public-token link
  leakage in the logged-in client workspace projection.
- `docs: document browser api routing env`: added `OPEN_PRACTICE_BROWSER_API_MODE` to the example
  environment surface after `pnpm ci:local` caught the missing documented variable.
- `chore: update cyclonedx release tooling`: upgraded the CycloneDX npm tool after dependency audit
  found a high-severity advisory in the held major candidate.
- `fix: preserve portal privacy cues and contrast`: restored a visible redaction cue in the client
  portal and tightened light-shell dashboard contrast after the client-portal and a11y E2E gates
  caught regressions.

Other validation-driven repairs before the final green pass: Prettier/lockfile formatting drift,
unused database imports, migration replay requiring a local disposable Postgres, and Playwright
browser installation for host E2E.

## Publish And Prune Plan

After all required validation passes, `main` will be fast-forwarded to the validated integration
branch and pushed to `origin/main`. Post-push parity will compare local `main`, `origin/main`, and
`git ls-remote origin refs/heads/main`.

Only after parity, clean worktrees whose branches are ancestors of `main` will be removed, merged
local branches will be deleted with `git branch -d`, `git worktree prune` and
`git remote prune origin` will run, and all stashes will remain untouched. Final stash count must
remain `42`.
