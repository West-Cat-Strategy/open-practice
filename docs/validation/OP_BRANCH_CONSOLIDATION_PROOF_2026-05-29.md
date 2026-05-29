# Open Practice Branch Consolidation Proof 2026-05-29

## Scope

Merged all local Open Practice feature branches into `main` and prepared the feature branches for
pruning:

- `codex/op-t128-clean-slice-2026-05-28`
- `codex/op-t128-client-portal-workspace`
- `codex/op-t129-intake-pipeline`
- `codex/op-t137-staff-reporting`
- `codex/op-t140-integration-developer-boundary`

The clean OP-T128 slice is the canonical client portal implementation. The broader OP-T128 account
workspace branch was merged with the `ours` strategy because it was an alternate, superseded mixed
tree; its unique route/UI shape was not selected over the validated clean extraction.

Synthetic data only. No client, matter, credential, payment, private deployment, or privileged
document details were used.

## Merge Notes

- OP-T128, OP-T129, OP-T137, and OP-T140 workboard/proof-index conflicts were resolved by keeping
  all completed row-local proof links and updating the active workboard counts.
- OP-T140 route-authorization manifest conflicts were resolved by preserving the already merged
  client portal route entries and the OP-T140 connector route entries.
- OP-T140 migration parity now includes `0040_integration_developer_boundary.sql`.

## Validation

Selector:

```sh
npm exec --yes --package=pnpm@11.4.0 -- pnpm verify:select -- --base origin/main
```

Recommended the broad cross-package lane: format, docs, policy, tests, package typechecks, database
checks, migration checks, worker build, web typecheck, and build.

Passed:

```sh
npm exec --yes --package=pnpm@11.4.0 -- pnpm ci:local
```

The first `pnpm ci:local` run stopped at `docs/planning-and-progress.md` formatting after conflict
resolution. `pnpm exec prettier --write docs/planning-and-progress.md` fixed the mechanical table
wrapping, and the rerun passed.

Final passing `pnpm ci:local` covered:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm policy:check`
- `pnpm build`
- `git diff --check`

Observed test totals included domain 21 files / 138 tests, database 15 files / 81 tests, providers
5 files / 15 tests, web 14 files / 119 tests, worker 3 files / 23 tests, API 38 files / 404 tests,
and 36 script tests.
