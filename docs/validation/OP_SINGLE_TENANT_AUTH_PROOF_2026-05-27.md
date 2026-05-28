# Single-Tenant Auth Entry Proof

Date: 2026-05-27

## Scope

This branch removes user-facing firm ID entry from embedded auth entry points while keeping
`firmId` as an internal authorization, audit, matter-scope, and persistence partition key.

Covered entry points:

- `POST /api/auth/login`
- `POST /api/auth/login/options`
- `POST /api/auth/login/verify`
- `POST /api/auth/password-setup`
- `POST /api/auth/recovery-codes/verify`
- `POST /api/auth/register/verify`
- `apps/web/app/login-client.tsx`

## Implementation Notes

- Added `EmbeddedAuthService` as the shared public-auth coordinator for configured-practice
  resolution, session creation, password login, password setup, and recovery-code login.
- Added repository `resolveConfiguredFirm()` support in memory and Drizzle implementations.
- Configured-practice resolution now blocks partial first-run state and multiple firm rows instead
  of asking users to disambiguate firm IDs.
- Public passkey login options accept only email and bind known-user challenges to the resolved
  internal user. A challenge generated for an unknown email cannot be replayed for a known user.
- The login UI now renders only email and password fields and builds a payload without `firmId`.

## Selector

Initial command before choosing validation:

```sh
pnpm verify:select -- --files apps/api/src/routes/auth.ts apps/api/src/routes/mfa.test.ts apps/api/src/routes/recovery.ts apps/api/src/routes/webauthn.test.ts apps/api/src/routes/webauthn.ts apps/api/src/server.test.ts apps/web/app/login-client.tsx docs/api-and-state-machines.md docs/deployment-hardening.md packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/test/repository.first-run.test.ts apps/api/src/services/auth-service.ts apps/web/app/login-client-utils.test.ts apps/web/app/login-client-utils.ts
```

The selector was rerun after adding the proof/workboard docs with the final changed-path set,
including:

- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_SINGLE_TENANT_AUTH_PROOF_2026-05-27.md`

Recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Focused Proof

- `pnpm --filter @open-practice/database test -- test/repository.first-run.test.ts`
  - Passed: 15 files, 78 tests.
- `pnpm --filter @open-practice/api test -- src/routes/webauthn.test.ts src/routes/mfa.test.ts src/server.test.ts`
  - Passed: 35 files, 384 tests.
- `pnpm --filter @open-practice/web test -- app/login-client-utils.test.ts`
  - Passed: 12 files, 102 tests.

## Final Validation

- `pnpm format:check`
  - Passed after formatting `docs/planning-and-progress.md`.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Blocked by the pre-existing OSS reuse lock/index mismatch for the pinned reference entries
    already called out on the workboard.
  - Pre-blocker subchecks passed: tracked-secret scan, package manifest dependency policy, and
    migration parity.
- `pnpm --filter @open-practice/database test`
  - Passed: 15 files, 78 tests.
- `pnpm --filter @open-practice/database db:check`
  - Passed.
- `pnpm migrations:check`
  - Passed: 40 SQL files match 40 journal entries.
- `pnpm --filter @open-practice/database typecheck`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - Passed: 35 files, 384 tests.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/web test`
  - Passed: 12 files, 102 tests.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed: 6 tasks successful.

## Privacy Notes

- Tests and documentation use synthetic practice, user, passkey, and recovery-code data only.
- No client, matter, credential, payment, private deployment, or privileged document details were
  added.
