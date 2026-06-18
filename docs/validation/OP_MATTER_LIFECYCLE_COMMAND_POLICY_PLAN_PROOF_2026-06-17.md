# Matter Lifecycle Command Policy/API Plan Proof - 2026-06-17

## Scope

This docs-only slice drafts the future matter lifecycle command policy/API contract while preserving
the shipped lifecycle transition journal as evidence-only.

The plan covers:

- the planned, unshipped `POST /api/matters/:matterId/lifecycle-commands` route;
- command body requirements for `command`, `expectedStatus`, reason, idempotency key, and a linked
  `ready` lifecycle transition record;
- blocked/stale/mismatched readiness gating before any future command can execute;
- pause, close, archive, and reopen consequences across portal visibility, billing, tasks,
  assignments, audit metadata, and cleanup posture;
- redacted future audit metadata limited to safe IDs, status snapshots, command names, readiness
  record IDs, idempotency-key presence, and consequence flags/counts.

## Non-Runtime Boundary

No API route, database schema, migration, repository, route manifest, web UI, worker, provider,
dependency, seed data, runtime fixture, or shipped lifecycle behavior changed.

The current `GET/POST /api/matters/:matterId/lifecycle-transitions` routes remain append-only,
review-only evidence and do not mutate `matters.status`, `closedOn`, assignments, portal access,
tasks, billing records, trust/funds records, retention state, or cleanup behavior.

The planned command policy keeps destructive cleanup, retention deletion, legal-hold overrides, live
settlement, automatic trust posting, portal hard deletes, and automatic task/billing mutation out of
scope. Examples are synthetic policy examples only.

## Changed Paths

- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md`

## Validation

Selector command:

```bash
pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Final validation:

```text
PASS pnpm format:check
PASS pnpm docs:check
PASS pnpm policy:check
PASS git diff --check
```

Notes:

- The fresh sibling worktree hydrated workspace dependencies before the selector ran.
- The first `pnpm format:check` found `docs/validation/README.md` table wrapping; Prettier was run
  on the touched docs, and the final validation pass covered the formatted proof/index state.
