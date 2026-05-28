# OP-T127 Matter Setup Projection Proof

Date: 2026-05-27 PDT

## Scope

Adds a migration-free, read-only matter setup projection over existing authorized matter summary data:

- Added a pure domain setup-profile builder for lifecycle stage definitions, responsible-user posture,
  matter field definitions, reusable setup checklist cues, and financial snapshot cues.
- Composed `setupProfile` in the in-memory and Drizzle matter summary builders from existing matter,
  party, document, activity, time, expense, trust ledger, and user records only.
- Extended `GET /api/matters` and the web `MatterSummary` contract to include `setupProfile`; the
  `POST /api/matters` request shape, routes, dependencies, and migrations are unchanged.
- Rendered a read-only Matter setup block in the existing matter overview with stage, responsible
  posture, custom-field definitions, checklist rows, trust balance, unbilled-work cues, and cautious
  financial-context copy.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/routes/matters.test.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/matter-overview-section.tsx apps/web/app/styles/20-dashboard-panels.css apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T127_MATTER_SETUP_PROJECTION_PROOF_2026-05-27.md packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/repository.test.ts packages/domain/src/index.ts packages/domain/src/matter-setup.ts packages/domain/src/matter-setup.test.ts
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
pnpm exec prettier --write apps/api/src/routes/matters.test.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/matter-overview-section.tsx apps/web/app/styles/20-dashboard-panels.css apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T127_MATTER_SETUP_PROJECTION_PROOF_2026-05-27.md packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/repository.test.ts packages/domain/src/index.ts packages/domain/src/matter-setup.ts packages/domain/src/matter-setup.test.ts
pnpm format:check
pnpm docs:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm policy:check
pnpm build
git diff --check
```

Results:

- Domain tests passed: 19 files, 134 tests, including status-to-stage mapping, responsible-user
  assigned/missing/mismatch posture, field definitions, checklist cues, and financial snapshot cues.
- Database tests passed: 15 files, 76 tests, including assignment-scoped setup profile projection.
- API tests passed: 35 files, 389 tests, including `GET /api/matters` setup profile visibility and
  redaction coverage for authorized matter summaries.
- Provider tests passed: 5 files, 15 tests.
- Worker tests passed: 3 files, 22 tests.
- Web tests passed: 12 files, 115 tests, including matter overview rendering for setup cues.
- Domain, database, API, and web typechecks passed.
- Formatting, documentation links, Drizzle schema check, and migration parity checks passed.
- Tracked-secret scan, package-manifest policy, OSS reuse policy, Open Practice boundary policy,
  production build, and whitespace checks passed.

## Browser Proof

Started the synthetic local runtime with memory repository seed data:

```sh
API_PORT=34127 WEB_PORT=33127 API_BASE_URL=http://localhost:34127 NEXT_PUBLIC_API_BASE_URL=http://localhost:34127 PUBLIC_WEB_BASE_URL=http://localhost:33127 WEBAUTHN_ORIGIN=http://localhost:33127 AUTH_JWT_SECRET=e2e-local-secret-at-least-32-characters DEV_AUTH_FIRM_ID=firm-west-legal DEV_AUTH_USER_ID=user-admin DATABASE_URL= REDIS_URL= S3_ENDPOINT= S3_ACCESS_KEY= S3_SECRET_KEY= OPEN_PRACTICE_USE_MEMORY_REPO=true OPEN_PRACTICE_DEV_SEED=true pnpm --filter @open-practice/api dev
API_PORT=34127 WEB_PORT=33127 API_BASE_URL=http://localhost:34127 NEXT_PUBLIC_API_BASE_URL=http://localhost:34127 PUBLIC_WEB_BASE_URL=http://localhost:33127 WEBAUTHN_ORIGIN=http://localhost:33127 AUTH_JWT_SECRET=e2e-local-secret-at-least-32-characters DEV_AUTH_FIRM_ID=firm-west-legal DEV_AUTH_USER_ID=user-admin DATABASE_URL= REDIS_URL= S3_ENDPOINT= S3_ACCESS_KEY= S3_SECRET_KEY= OPEN_PRACTICE_USE_MEMORY_REPO=true OPEN_PRACTICE_DEV_SEED=true pnpm --filter @open-practice/web dev
```

Captured Playwright CLI screenshots against `http://localhost:33127/?section=matters`:

```sh
.tmp/visual-proof/op-t127/matter-setup-desktop-1440x1100.png
.tmp/visual-proof/op-t127/matter-setup-mobile-390x844.png
```

Browser assertions:

- Desktop 1440x1100: Matter setup, Trust Balance, Unbilled Work, and the read-only financial caution
  rendered; whole-page horizontal overflow count was 0.
- Mobile 390x844: Matter setup, Trust Balance, and Unbilled Work rendered; the matter setup area had
  0 overflowing elements and the page body did not contain synthetic email fixture strings such as
  `client@example`, `licensee@example`, or `reviewer@example`.
- The broad mobile page overflow probe still reports the pre-existing horizontal primary navigation
  strip; the OP-T127 matter setup block itself did not overflow or overlap.
- Screenshot dimensions were verified with `sips`: desktop 1440x4508 and mobile 390x11755.

## Notes

- All examples, tests, API/browser proof, and screenshots use synthetic data only.
- Clio review material stayed clean-room planning input only; no Clio prose, screenshots, schemas,
  assets, examples, or dependencies were copied.
- No migrations, new dependencies, external sync, jurisdiction-rule automation, automatic
  transitions, or mutation routes were added.
