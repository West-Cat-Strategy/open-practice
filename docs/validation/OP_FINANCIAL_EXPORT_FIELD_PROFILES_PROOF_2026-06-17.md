# Financial Export Field Profiles Proof - 2026-06-17

## Summary

Implemented the smallest metadata-only field-profile slice for financial downloads:

- Added OP-authored reusable field profiles for generated local billing and jurisdictional trust
  JSON downloads.
- Billing and jurisdictional trust export request, queue, audit, and worker metadata now carry only
  profile IDs alongside existing bounded status/count/provenance metadata.
- Completed downloads include the matching `fieldProfile` object while preserving existing billing
  record and jurisdictional trust aggregate serialization.

## Boundaries

- No dependencies, migrations, routes, provider adapters, object-storage artifacts, retained export
  bodies, scheduled delivery, custom SQL, live settlement, payment application, or automatic trust
  posting were added.
- Field profiles describe allowlisted generated local projection keys; they do not redact, filter,
  or reserialize the existing authorized download body.
- Synthetic test strings cover private billing body text and trust statement evidence; those strings
  remain absent from queue, job, audit, and worker metadata.

## Validation

Final changed-path selector:

```bash
pnpm verify:select -- --files docs/validation/OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md packages/domain/src/financial-export-profiles.test.ts packages/domain/src/financial-export-profiles.ts apps/api/src/routes/billing.test.ts apps/api/src/routes/billing/export-requests.ts apps/api/src/routes/ledger.test.ts apps/api/src/routes/ledger/reports.ts apps/worker/src/processors.test.ts apps/worker/src/processors/reports.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/index.ts packages/domain/src/permissions.test.ts packages/domain/src/permissions.ts
```

Selector recommendations:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`

Additional expected package check:

- `pnpm --filter @open-practice/domain build`

Results:

- `pnpm --filter @open-practice/domain test` passed: 31 files, 214 tests.
- `pnpm --filter @open-practice/domain typecheck` passed.
- `pnpm --filter @open-practice/domain build` passed.
- `pnpm --filter @open-practice/api test` passed after fresh-worktree upstream build
  hydration: 42 files, 553 tests.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/providers test` passed: 9 files, 20 tests.
- `pnpm --filter @open-practice/worker test` passed after rebuilding the updated domain
  redaction allowlist: 5 files, 45 tests.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/worker build` passed.
- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed, including tracked secret scan, package manifest policy, dead-code
  check, migration parity, OSS reuse validation, documentation link validation, validation proof
  index check, local evidence Docker ignore validation, and Open Practice boundary policy.
- `git diff --check` passed.

Fresh-worktree hydration commands run before treating failures as product regressions:

- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
