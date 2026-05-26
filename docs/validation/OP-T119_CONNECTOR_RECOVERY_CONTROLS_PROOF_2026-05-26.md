# OP-T119 Connector Recovery Controls Proof

Date: 2026-05-26

## Scope

Implemented the first owner-only connector outbox recovery control slice:

- Added `POST /api/connectors/outbox/:outboxId/retry` for confirmed manual retries of `failed` and
  `dead_letter` rows.
- Added `POST /api/connectors/outbox/:outboxId/dead-letter` for confirmed manual dead-lettering of
  `pending`, `failed`, and expired `leased` rows.
- Required `connector:update` access for both recovery actions.
- Added retry guards for current-status confirmation, missing/wrong-firm rows, active leases,
  delivered/cancelled/pending rows, disabled or paused connectors, and missing connector queue
  configuration.
- Reset retry rows to `pending`, cleared lease/dead-letter/error fields, set `nextAttemptAt` to now,
  and bumped exhausted `maxAttempts` only enough to allow one reviewed manual retry.
- Added one `deliver_connectors` job per accepted retry with manual-retry idempotency metadata.
- Added dead-letter guards for active leases, delivered/cancelled rows, and already dead-lettered
  rows, then stamped `deadLetteredAt` with a fixed redacted operator summary.
- Added redacted audit actions `connector_outbox.manual_retry` and
  `connector_outbox.manual_dead_letter`.
- Added owner-only dashboard retry/dead-letter icon actions with inline confirmation and refresh.

Provider-specific recovery, inbound webhook work, raw webhook replay, payload-body inspection, new
dependencies, and migrations stayed out of scope.

Existing dirty-tree context: this checkout also contains separate conversation-export and
document-retention review edits. This proof records only the connector recovery controls requested
for OP-T119.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/api/src/routes/connectors.test.ts apps/web/app/connector-outbox-dashboard.ts apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts apps/web/app/styles/20-dashboard-panels.css apps/web/app/types.ts packages/database/src/repository/contracts.ts packages/database/src/repository/memory.ts packages/database/src/repository/drizzle.ts packages/database/test/repository.connectors.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/audit-taxonomy.test.ts scripts/route-authorization-manifest.mjs docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T119_CONNECTOR_RECOVERY_CONTROLS_PROOF_2026-05-26.md
```

Focused checks:

```bash
pnpm --filter @open-practice/api exec vitest run src/routes/connectors.test.ts
pnpm --filter @open-practice/database exec vitest run test/repository.connectors.test.ts
pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts
pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts
```

Selected and release-adjacent checks:

```bash
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm docs:check
pnpm policy:check
pnpm format:check
pnpm build
git diff --check
```

## Results

Passed:

- `pnpm --filter @open-practice/api exec vitest run src/routes/connectors.test.ts`
- `pnpm --filter @open-practice/database exec vitest run test/repository.connectors.test.ts`
- `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts`
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm docs:check`
- `pnpm format:check`
- `pnpm build`
- `git diff --check`
- `node scripts/validate-open-practice-boundaries.mjs`

Attempted with a blocker outside this connector slice:

- `pnpm policy:check` passed tracked-secret scan, package manifest validation, and migration parity,
  then failed in `node scripts/validate-oss-reuse.mjs` because existing OSS reference lock commits
  do not match the central reference index for `activepieces__activepieces`, `apache__fineract`,
  `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`, `kimai__kimai`,
  `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `microsoft__markitdown`, `nextcloud__server`,
  `open-source-legal__opencontracts`, `opencollective__opencollective-api`,
  `opencollective__opencollective-frontend`, `temporalio__temporal`,
  `unstructured-io__unstructured`, and `zulip__zulip`.

## Privacy And Boundaries

- Synthetic test data only.
- Audit metadata records status transitions, attempt/max-attempt counts, connector/outbox IDs,
  event/resource type and ID, idempotency-key presence, and queue/job presence.
- Audit metadata and responses do not include raw idempotency keys, lease IDs, secret references,
  webhook URLs, signatures, payload bodies, raw webhook bodies, or free-form private operator
  details.
