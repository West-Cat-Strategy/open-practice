# Legal Clinic Cadence Task Command Proof - 2026-07-01

## Scope

Branch: `feat/legal-clinic-cadence-task-20260701`

This proof covers one explicit staff-only command that creates a normal internal task from the
latest eligible legal-clinic cadence signal for a requested matter:
`POST /api/tasks/legal-clinic-cadence-follow-up`.

The command preserves the review-first cadence surface:

- It accepts only `{ matterId }`, requires staff access plus matter-scoped `task:create`, and
  preserves matter visibility checks.
- It derives eligible cadence signals from the requested matter's existing clinic profile and the
  firm clinic program list.
- It chooses the earliest due eligible signal with a stable source-ID tiebreak; signals without due
  dates sort last.
- It blocks duplicates by source ID across existing `operational_view` tasks, including completed
  and archived tasks.
- It creates one unassigned normal internal task with fixed redacted title/description copy, the
  signal priority, optional signal due date, `sourceType: "operational_view"`, safe source metadata,
  and safe `task.created` audit provenance.

## Preserved Boundaries

- No automatic task creation on workbench/dashboard load.
- No provider sync, queue job, migration, dependency, or client-visible workflow.
- No legal-clinic cadence, profile, program, referral, eligibility, note, or private metadata
  mutation.
- No free-copy clinic-note, referral-source text, program eligibility summary, or private metadata
  in the task title, description, source response, or audit metadata.
- Synthetic data only; no client, matter, credential, payment, private deployment, provider payload,
  or private clinic evidence was added.

## Final Changed Paths

- `apps/api/src/routes/tasks.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/tasks-section.test.tsx`
- `apps/web/app/dashboard/tasks-section.tsx`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md`
- `docs/validation/README.md`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/authorization-fixtures.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/tasks.test.ts`
- `packages/domain/src/tasks.ts`
- `scripts/route-authorization-manifest.mjs`

## Selector Output

Final selector command:

```sh
pnpm verify:select -- --files apps/api/src/routes/tasks.test.ts apps/api/src/routes/tasks.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/tasks-section.test.tsx apps/web/app/dashboard/tasks-section.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/authorization-fixtures.ts packages/domain/src/permissions.test.ts packages/domain/src/tasks.test.ts packages/domain/src/tasks.ts scripts/route-authorization-manifest.mjs
```

Result: passed. Recommended validation commands:

```text
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

The fresh sibling worktree needed upstream workspace builds before API/web package entrypoints
resolved:

```sh
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
```

Result: passed.

| Command                                                                                                                     | Result  | Notes                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain exec vitest run src/tasks.test.ts src/audit-taxonomy.test.ts src/permissions.test.ts`  | Pass    | 3 files and 74 tests passed. Covers cadence task draft selection, duplicate suppression, fixed copy/audit metadata, taxonomy, and fixtures.                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api exec vitest run src/routes/tasks.test.ts`                                                 | Pass    | Rerun after upstream builds passed with 1 file and 19 tests. Initial fresh-worktree run failed before builds on unresolved database entrypoint.                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/tasks-section.test.tsx app/dashboard-client.test.ts`        | Pass    | Rerun after upstream builds and web typing fix passed with 2 files and 79 tests. Initial fresh-worktree run failed before builds.                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                                             | Pass    | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/api typecheck`                                                                                | Pass    | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/web typecheck`                                                                                | Pass    | `tsc -p tsconfig.json --noEmit`.                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm api:contract`                                                                                                         | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 347 paths.                                                                                                                                                                                                                                                                                                                            |
| `pnpm architecture:check`                                                                                                   | Pass    | Architecture import policy passed with 466 workspace import edges reviewed.                                                                                                                                                                                                                                                                                                                              |
| `pnpm docs:check`                                                                                                           | Pass    | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm format:check`                                                                                                         | Pass    | All matched files use Prettier code style.                                                                                                                                                                                                                                                                                                                                                               |
| `node scripts/validate-validation-proof-index.mjs`                                                                          | Pass    | Validation proof index check passed.                                                                                                                                                                                                                                                                                                                                                                     |
| `node scripts/validate-open-practice-boundaries.mjs`                                                                        | Pass    | Open Practice boundary policy passed.                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check`                                                                                                          | Pass    | No whitespace errors.                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm proof:reconcile -- --proof docs/validation/OP_LEGAL_CLINIC_CADENCE_TASK_PROOF_2026-07-01.md --files <final path set>` | Pass    | Proof reconciliation reported 17 paths and the selector-recommended validation commands.                                                                                                                                                                                                                                                                                                                 |
| `pnpm build`                                                                                                                | Pass    | Turbo built all 6 workspace packages in 33.492s.                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm policy:check`                                                                                                         | Blocked | Reason: unrelated central reference-index lock drift for 21 reference repositories. The gate reached `validate-oss-reuse.mjs`; earlier policy subchecks passed: tracked secrets, package manifests, lockfile supply chain, toolchain, env surface, architecture, deadcode, migrations, and migration lint. This lane added no dependencies, copied excerpts, vendored assets, or reference-derived code. |
