# OP-T98 To OP-T101 Hardening Wave Proof

Date: 2026-05-18

## Scope

Implemented the staged hardening wave on `codex/op-hardening-wave` with subagent lanes for the
migration, connector, route authorization, and reference-governance work. The lead lane integrated
the diffs, kept the workboard/proof index current, and ran final validation.

Covered rows:

- OP-T98: migration SQL/journal parity, missing `0024` through `0033` journal entries, disposable
  replay mode, selector guidance, policy gate, and release-proof wiring.
- OP-T99: connector delivery job scheduling from durable outbox rows, delayed retry jobs, worker
  retry behavior, redacted job/provider status, and audit taxonomy updates.
- OP-T100: route authorization manifest, boundary-policy validation for auth/resource/action,
  matter scope and public-token rules, focused denial tests, and public token route coverage.
- OP-T101: central reference-index governance, `refs:clone` check/dry-run/metadata modes,
  lock/index drift validation, package-level dependency-license JSON, and release artifact secret
  scanning.

## Post-Merge Rescue Sweep

Compared the parked worktrees against the dirty `codex/op-hardening-wave` checkout after the
mainline closeout commit:

- `../open-practice-op-t98-migration`
- `../open-practice-op-t99-connector`
- `../open-practice-op-t101-reference`
- `../open-practice-op-t103-communications-triage-notes`

The OP-T98, OP-T99, and OP-T101 worktrees had no missing behavior beyond formatting/integration
differences already represented in `codex/op-hardening-wave`. The OP-T103 worktree still had one
real row-local delta that the combined checkout had dropped: partial follow-up updates should merge
with existing safe follow-up fields, and the proof should cover the private-note cap plus
triage-metadata taxonomy hints. That delta was rescued in the OP-T103 files and recorded in
[OP-T103 communications triage private notes proof](OP-T103_COMMUNICATIONS_TRIAGE_PRIVATE_NOTES_PROOF_2026-05-18.md).

## Validation

Selector guidance for this proof/workboard update:

```sh
pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T98_TO_T101_HARDENING_WAVE_PROOF_2026-05-18.md
```

Recommended: `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`.

Passed focused lane checks:

```sh
node --test scripts/check-migration-integrity.test.mjs scripts/select-validation.test.mjs scripts/create-release-proof.test.mjs scripts/write-release-evidence.test.mjs
pnpm migrations:check
pnpm --filter @open-practice/database db:check
pnpm --filter @open-practice/api exec vitest run src/routes/connectors.test.ts src/routes/jobs.test.ts src/routes/providers-status.test.ts
pnpm --filter @open-practice/domain exec vitest run src/permissions.test.ts src/audit-taxonomy.test.ts
pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/domain typecheck
node --test scripts/validate-open-practice-boundaries.test.mjs
node scripts/validate-open-practice-boundaries.mjs
pnpm --filter @open-practice/api exec vitest run src/routes/shares.test.ts src/routes/external-uploads.test.ts src/routes/ledger.test.ts src/routes/drafts.test.ts src/http/http.test.ts
node --test scripts/reference-governance.test.mjs scripts/report-dependency-licenses.test.mjs scripts/scan-tracked-secrets.test.mjs scripts/create-release-proof.test.mjs scripts/write-release-evidence.test.mjs scripts/validate-open-practice-boundaries.test.mjs scripts/check-migration-integrity.test.mjs
pnpm refs:clone -- --check
node scripts/validate-oss-reuse.mjs
pnpm security:scan -- --path docs/oss-references.lock.json --path scripts/reference-governance.mjs
```

Passed wave checks:

```sh
pnpm docs:check
pnpm policy:check
pnpm format:check
pnpm deps:licenses
pnpm deps:audit
pnpm ci:local
pnpm migrations:replay
git diff --check
```

Results:

- `pnpm migrations:check`: 34 SQL files matched 34 journal entries.
- `pnpm deps:licenses`: 580 packages, 610 package versions, 0 blocked groups, 7
  review-required groups.
- `pnpm deps:audit`: no known vulnerabilities in production or development dependency groups.
- `pnpm ci:local`: passed format, lint, typecheck, full package and script tests, database
  `db:check`, policy, build, and `git diff --check`.
- `pnpm migrations:replay`: 34 migrations applied to disposable database
  `open_practice_migration_replay_22206_20260518055947`; admin client `psql`; database cleaned up.

Earlier environment blocker, now cleared:

- `pnpm migrations:replay` could not run because no local PostgreSQL server was available on
  `localhost:35432`.
- A closeout retry of `pnpm migrations:replay` failed with `psql` connection refused on both
  `::1:35432` and `127.0.0.1:35432`.
- Docker was also unavailable for replay setup: the local Docker socket
  `/Users/bryan/.docker/run/docker.sock` was absent when checked.
- Docker Desktop was later started, the repo `postgres` Compose service became healthy on
  `localhost:35432`, and replay passed against that local service.

All proof used synthetic local data and metadata only.
