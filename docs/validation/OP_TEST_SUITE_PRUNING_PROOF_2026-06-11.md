# OP Test Suite Pruning Proof - 2026-06-11

## Scope

This branch prunes redundant test coverage while preserving the legal-workflow guardrails that are
load-bearing for Open Practice: matter-scoped access, auth/setup, audit redaction, trust/funds
safety, public-token flows, first-run setup, worker queue redaction, and Docker-backed
storage/queue behavior.

No runtime API, schema, dependency, or product behavior changes were introduced. The only runtime
route addition is an E2E-only support endpoint used by browser proof when E2E support is explicitly
enabled.

## Changed Paths

- `apps/api/src/routes/e2e-support.test.ts`
- `apps/api/src/routes/e2e-support.ts`
- `apps/api/src/server.test.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/dashboard-shell.test.tsx`
- `docs/validation/OP_TEST_SUITE_PRUNING_PROOF_2026-06-11.md`
- `docs/validation/README.md`
- `e2e/docker.spec.ts`
- `e2e/helpers/e2e-fixtures.ts`
- `e2e/host.spec.ts`
- `e2e/ui-ux.spec.ts`
- `packages/database/test/repository.audit-matter-setup.test.ts`
- `packages/database/test/repository.test.ts`
- `packages/domain/src/billing.test.ts`
- `packages/domain/src/conflicts.test.ts`
- `packages/domain/src/ledger.test.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/signatures.test.ts`
- `packages/domain/test/domain.test.ts`
- `packages/providers/test/providers.test.ts`
- `scripts/route-authorization-manifest.mjs`
- `scripts/run-e2e.mjs`
- `scripts/validate-open-practice-boundaries.mjs`

## Pruning And Rehoming

- API route-smoke overlap was removed from `apps/api/src/server.test.ts` after preserving first-run
  setup, session/auth, production readiness, CORS, rate-limit, and redacted unexpected-error
  coverage. `registerMatterRoutes` ownership moved to the focused matters route test in the
  boundary validator.
- Provider tests now focus on embedded provider and draft-assist behavior. Signature lifecycle
  helper coverage moved to focused domain tests.
- The old aggregate domain test is now root-export smoke. Unique invariants moved into focused
  billing, ledger, permissions, conflicts, and signature domain tests.
- The database aggregate test was renamed to
  `packages/database/test/repository.audit-matter-setup.test.ts`, preserving audit sequence and
  matter setup projection coverage.
- Dashboard tests dropped duplicated route/nav ordering and duplicate rail markup assertions while
  preserving the mounted placeholder and shell contract.
- Host E2E removed the partial dashboard deep-link loop. Docker E2E keeps external-upload/MinIO
  proof, while dashboard persistence proof moved into the Docker UI sweep.

## Coverage Added

- Added a focused `@client-portal` host browser proof, gated by
  `DEV_AUTH_USER_ID=user-client-external`, that creates a deterministic synthetic client portal
  account and proves the portal renders redacted workspace data without leaking private fields such
  as token hashes, storage keys, checkout URLs, external session IDs, or private checkout paths.
- The E2E-only account helper now seeds one deterministic synthetic open conversation thread so the
  browser proof exercises the client-portal redacted conversation action.
- `scripts/run-e2e.mjs` now strips a leading passthrough `--` before forwarding arguments to
  Playwright, allowing the documented `pnpm e2e:host -- --grep @client-portal` command to run as
  intended.

## Subagent Review

- Backend/domain subagent found one missing route-authorization manifest entry for the new E2E
  support route. The manifest now records `POST /api/e2e/client-portal-account` as
  `auth_credential:create` with derived matter read access and `apps/api/src/routes/e2e-support.test.ts`
  ownership.
- E2E/UI subagent found no additional pruning blockers and confirmed that the host, Docker, and
  fixture surfaces matched the intended scope.

## Validation

- `pnpm --filter @open-practice/domain build` passed.
- `pnpm --filter @open-practice/database build` passed.
- `pnpm --filter @open-practice/providers build` passed.
- `pnpm --filter @open-practice/domain test` passed: 26 files, 163 tests.
- `pnpm --filter @open-practice/providers test` passed: 7 files, 14 tests.
- `pnpm --filter @open-practice/database test` passed: 18 files, 110 tests.
- `pnpm --filter @open-practice/api exec vitest run src/server.test.ts src/routes/matters.test.ts src/routes/e2e-support.test.ts` passed: 3 files, 52 tests.
- `pnpm --filter @open-practice/api exec vitest run src/routes/e2e-support.test.ts` passed after
  adding deterministic client portal conversation setup: 1 file, 4 tests.
- `pnpm --filter @open-practice/web exec vitest run app/dashboard/dashboard-shell.test.tsx app/dashboard-client.test.ts` passed: 2 files, 76 tests.
- `node --test scripts/validate-open-practice-boundaries.test.mjs` passed: 14 tests.
- `node scripts/validate-open-practice-boundaries.mjs` passed.
- `pnpm verify:select -- --files <pre-proof changed paths>` passed and selected the broad
  API/domain/database/providers/worker/web, build, policy, host E2E, and Docker E2E gates.
- `pnpm policy:check` failed because the existing OSS reference lock no longer matches the mutable
  central reference index. This branch does not modify `docs/oss-references.lock.json`,
  `docs/oss-references.md`, `docs/reuse-decision-policy.md`,
  `scripts/reference-governance.mjs`, or `scripts/validate-oss-reuse.mjs`.
- `pnpm test` passed across all packages and script tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/providers typecheck` passed.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed.
- `pnpm docs:check` passed.
- `node scripts/validate-validation-proof-index.mjs` passed before adding this proof note.
- `node scripts/validate-local-evidence-dockerignore.mjs` passed.
- `pnpm build` passed.
- `pnpm e2e:host` initially timed out in the host dashboard section sweep at the old 60s default
  with no assertion failures. After setting that sweep to 120s, `pnpm e2e:host` passed: 29 passed,
  11 skipped.
- `DEV_AUTH_USER_ID=user-client-external pnpm e2e:host -- --grep @client-portal` initially exposed
  two test issues: the runner forwarded the literal `--` separator to Playwright, and the test used
  an ambiguous matter-title locator. After fixing those and seeding deterministic redacted
  conversation data, the command passed: 4 passed.
- `pnpm e2e:docker` passed: 3 passed, with Compose services, volumes, and the temporary E2E
  database cleaned up.
- `pnpm exec prettier --write apps/api/src/routes/e2e-support.ts apps/api/src/routes/e2e-support.test.ts e2e/host.spec.ts scripts/run-e2e.mjs` passed.
- `pnpm verify:select -- --files <final changed paths>` passed after indexing this note and again
  selected host E2E, Docker E2E, format, docs, policy, broad tests, package typechecks, database
  checks, migrations, and build.
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `node scripts/validate-validation-proof-index.mjs` passed after indexing this note.
- `git diff --check` passed.
- `pnpm test` passed after final code/doc edits: 9 turbo tasks successful, 41 API files / 488 API
  tests, 26 domain files / 163 domain tests, 18 database files / 110 database tests, 34 web files /
  174 web tests, 7 provider files / 14 provider tests, 3 worker files / 36 worker tests, and 63
  script tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/providers typecheck` passed.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed.
- `pnpm --filter @open-practice/database build` passed.
- `pnpm --filter @open-practice/providers build` passed.
- `pnpm build` passed: 6 turbo build tasks successful.
- `pnpm ci:local` failed at `pnpm policy:check` after format, lint, typecheck, test, and database
  check passed. The blocker is the same OSS reference lock drift listed above; the standalone build
  gate was run separately and passed.

## Current OSS Policy Follow-Up

The OSS reference-lock failure above remains accurate for the original pruning branch run. On
2026-06-12, the current project tree was rechecked against the central reference index and no lockfile
edit was required: `pnpm refs:clone -- --check` matched 28 Open Practice index entries and
`node scripts/validate-oss-reuse.mjs` passed. The docs-only follow-up selector
`pnpm verify:select -- --files <current proof/index doc paths>` selected format, docs, and policy
checks; `pnpm policy:check` and `pnpm ci:local` now pass without the old OSS reference-lock blocker.

## Synthetic Data

All new tests and browser proof use synthetic fixture data only, including `Ada Morgan`,
`ada@example.test`, `Morgan tenancy dispute`, and deterministic E2E-only client portal ids.
