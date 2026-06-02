# OP-T143 Provider Config Encryption Proof

Date: 2026-06-02 PDT

## Scope

Implemented the first provider/config-only encryption slice:

- Added server-only provider config crypto helpers in the database package using Node `crypto`
  AES-256-GCM and versioned `opencfg:v1:` envelopes with `alg`, `kid`, `nonce`, `tag`, and
  ciphertext fields.
- Bound encryption with AAD for `firmId`, `provider_settings`, `encrypted_config`, provider
  `kind`, and provider setting `key`. Row IDs are intentionally excluded so the existing upsert
  contract stays stable.
- Enforced `OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY` for PostgreSQL-backed API and worker repository
  startup, plus production API readiness, while keeping synthetic memory-mode test behavior
  key-optional.
- Added synthetic non-production config keys to Docker Compose and Docker-backed e2e runtime envs so
  PostgreSQL-backed local proof continues to start under the new gate.
- Replaced `z.coerce.boolean()` for relevant API/worker env booleans so real `"false"` string env
  values stay false before encryption-key readiness checks run.
- Updated Drizzle and in-memory provider-setting repository paths so configured ciphers store
  envelopes and callers still receive plaintext through `OpenPracticeRepository`.
- Kept legacy plaintext `encryptedConfig` rows readable; normal writes encrypt them once a cipher is
  configured.
- Documented the runtime key format and deployment-hardening posture without adding dependencies or
  database migrations.

Out of scope: broader PII field encryption, document/object encryption, email/intake encryption,
billing/trust encryption, TOTP/recovery-code encryption, S3 object encryption, production key
rotation workflow, and proactive migration of existing plaintext rows.

## Changed Paths

- `.env.example`
- `apps/api/src/server.test.ts`
- `apps/api/src/server.ts`
- `apps/worker/src/queues.test.ts`
- `apps/worker/src/worker.ts`
- `apps/web/app/dashboard-client.tsx`
- `docker-compose.yml`
- `docs/deployment-hardening.md`
- `docs/planning-and-progress.md`
- `docs/tech-stack.md`
- `docs/validation/OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md`
- `docs/validation/README.md`
- `packages/database/src/config-encryption.ts`
- `packages/database/src/index.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/test/config-encryption.test.ts`
- `packages/database/test/repository.providers-jobs-email.test.ts`
- `scripts/run-e2e.mjs`

`apps/web/app/dashboard-client.tsx` changed only to remove a stale unused type import that blocked
the required `pnpm ci:local` lint gate; it is not part of the encryption behavior.

## Main Replay Reconciliation

- Current local `main` at `877dd1b` already contains the landed OP-T143 implementation commit
  `8a497fb`, with OP-T143 marked `Done` in `docs/planning-and-progress.md` and indexed in
  `docs/validation/README.md`.
- Comparing the amended source branch `codex/op-t143-provider-config-encryption` (`54f84b0`) with
  the landed OP-T143 commit (`8a497fb`) leaves only this proof note as the surviving delta.
- The clean replay branch `codex/op-t143-provider-config-encryption-main-replay` was created from
  `main` without cherry-picking the full source commit, so the final branch diff is limited to
  `docs/validation/OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md`.
- `docs/planning-and-progress.md` and `docs/validation/README.md` remain unchanged on the replay
  branch because current `main` already reflects the shipped row status and proof-index entry.

## Validation

- `pnpm verify:select -- --files <changed paths>` passed and selected format, docs, policy, root
  test/build, database test/db/typecheck, API test/typecheck, worker test/typecheck/build, and web
  test/typecheck checks.
- Main replay on 2026-06-02: `pnpm verify:select -- --files docs/validation/OP-T143_PROVIDER_CONFIG_ENCRYPTION_PROOF_2026-06-02.md`
  selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check` for the one-path
  proof-only diff.
- Main replay on 2026-06-02: `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`,
  `git diff --check`, `git diff --name-only main...HEAD`, and
  `git diff --exit-code main...HEAD -- docs/planning-and-progress.md docs/validation/README.md`
  passed.
- `pnpm --filter @open-practice/database test -- config-encryption.test.ts repository.providers-jobs-email.test.ts`
  passed: 17 files, 99 tests.
- `pnpm --filter @open-practice/database build` passed.
- `pnpm --filter @open-practice/database typecheck` passed.
- `pnpm --filter @open-practice/api test -- server.test.ts` passed after rebuilding the database
  package artifact for the new export: 41 files, 441 tests.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/worker test -- queues.test.ts` passed: 3 files, 32 tests.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- `pnpm --filter @open-practice/database test` passed: 17 files, 99 tests.
- `pnpm --filter @open-practice/database db:check` passed.
- `pnpm migrations:check` passed: 48 SQL files match 48 journal entries.
- `pnpm --filter @open-practice/api test` passed: 41 files, 441 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 32 tests.
- `pnpm --filter @open-practice/worker build` passed.
- `pnpm --filter @open-practice/web test` passed: 18 files, 132 tests.
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm test` passed: domain 24 files/166 tests, providers 7 files/18 tests, database 17
  files/99 tests, API 41 files/441 tests, worker 3 files/32 tests, web 18 files/132 tests, and
  38 script contract tests.
- `pnpm build` passed.
- `git diff --check` passed.
- `pnpm ci:local` passed after the stale web type-import lint unblock above.

No validation checks were skipped.
