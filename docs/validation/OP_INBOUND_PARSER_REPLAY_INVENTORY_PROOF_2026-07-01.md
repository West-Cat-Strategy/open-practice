# Inbound Parser Replay Inventory Proof - 2026-07-01

## Scope

Added an owner-admin-only, metadata-only inbound parser replay inventory over existing failed and
dead-letter parser job lifecycle rows. The inventory is read-only and exposes only safe job IDs,
provider-family labels, allowlisted failure stages, age/attempt counts, and fixed no-side-effect
flags.

## Final Changed Paths

- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/inbound-email/parser-jobs.ts`
- `apps/web/app/_features/communications/models.ts`
- `apps/web/app/_features/communications/server-resources.ts`
- `apps/web/app/communications-inbox-dashboard.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/communications-section.test.tsx`
- `apps/web/app/dashboard/communications-section.tsx`
- `apps/web/app/dashboard/inbound-parser-replay-inventory-panel.test.tsx`
- `apps/web/app/dashboard/inbound-parser-replay-inventory-panel.tsx`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/validation/OP_INBOUND_PARSER_REPLAY_INVENTORY_PROOF_2026-07-01.md`
- `docs/validation/README.md`
- `scripts/route-authorization-manifest.mjs`

## Selector

```text
$ pnpm verify:select -- --files apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/inbound-email/parser-jobs.ts apps/web/app/_features/communications/models.ts apps/web/app/_features/communications/server-resources.ts apps/web/app/communications-inbox-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/communications-section.test.tsx apps/web/app/dashboard/communications-section.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.test.tsx apps/web/app/dashboard/inbound-parser-replay-inventory-panel.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/validation/OP_INBOUND_PARSER_REPLAY_INVENTORY_PROOF_2026-07-01.md docs/validation/README.md scripts/route-authorization-manifest.mjs
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

- `pnpm exec prettier --write <changed paths before proof>`: passed.
- `pnpm --filter @open-practice/domain build`: passed.
- `pnpm --filter @open-practice/database build`: passed.
- `pnpm --filter @open-practice/providers build`: passed.
- `pnpm --filter @open-practice/api exec vitest run src/routes/inbound-email.test.ts`: passed,
  1 file and 59 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/dashboard/communications-section.test.tsx app/dashboard/inbound-parser-replay-inventory-panel.test.tsx`:
  passed, 3 files and 81 tests.
- `pnpm --filter @open-practice/api typecheck`: passed.
- `pnpm --filter @open-practice/web typecheck`: passed.
- `pnpm verify:select -- --files <final path set>`: passed; selector recommended the command
  set above for the exact 16-path change set.
- `pnpm api:contract`: passed; generated `.tmp/api-contract/openapi.json` with 347 paths.
- `pnpm docs:check`: passed.
- `pnpm format:check`: passed.
- `pnpm policy:check`: blocked by unrelated central OSS reference-lock drift in
  `node scripts/validate-oss-reuse.mjs` after tracked-secret scanning, package manifest policy,
  lockfile supply-chain policy, toolchain policy, env surface, architecture, dead-code, migration
  parity, and migration lint subchecks passed. Existing mismatches included reference corpus locks
  for `activepieces__activepieces`, `apache__fineract`, `calcom__cal.com`,
  `opencollective__opencollective-api`, `openfga__openfga`, `temporalio__temporal`, and other
  central reference entries.
- Downstream policy subchecks were omitted from the blocked `policy:check` tail because
  `validate-oss-reuse.mjs` stopped the script first; they were run directly:
  `node scripts/validate-validation-proof-index.mjs`, `node scripts/validate-local-evidence-dockerignore.mjs`,
  and `node scripts/validate-open-practice-boundaries.mjs` all passed.

## Boundary Proof

- Uses synthetic parser job IDs, provider labels, failure stages, and timestamps only.
- Does not enqueue replay, retry, or recovery work.
- Does not read, copy, reconstruct, expose, or retain raw MIME, object keys, provider payloads,
  mailbox secrets, token/mailbox hashes, UID values, raw-content hashes, target resource IDs,
  BullMQ IDs, idempotency keys, or parser error details.
- Does not add provider-specific execution, document promotion, matter creation, permissions
  widening, schema changes, migrations, dependencies, workers, provider adapters, or object-storage
  access.
