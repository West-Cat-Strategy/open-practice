# Public Consultation Tenant-Safe Defaults Proof

Date: 2026-05-27

## Scope

Replaced tenant-specific public consultation defaults with disabled, empty defaults for sender
address, recipient emails, and allowed origins. Public consultation intake now requires explicit
firm-owned notification/origin settings before enabling, rejects missing or unconfigured request
origins, and records neutral public-consultation source metadata.

The dashboard settings fallback now renders the same disabled empty defaults, summarizes missing
configuration as not configured, and allows saving disabled empty settings while requiring sender,
recipients, and origins before enabling.

Added neutral `.env.example` keys for explicitly bootstrapping the firm-owned public consultation
setting. No dependencies, vendored assets, copied reference code, migrations, or setup-wizard changes
were added.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files .env.example apps/api/src/routes/public-consultation-intakes.ts apps/api/src/routes/public-consultation-intakes.test.ts apps/api/src/server.ts apps/api/src/server.test.ts apps/web/app/public-consultation-intakes-dashboard.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts docs/api-and-state-machines.md docs/validation/README.md docs/validation/OP_PUBLIC_CONSULTATION_TENANT_SAFE_DEFAULTS_PROOF_2026-05-27.md
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Results:

- API tests passed: 35 files, 388 tests, including disabled empty defaults, enabled-settings
  validation, explicit tenant origin submission, missing/disallowed origin rejection, neutral source
  metadata, and no baked-in public consultation sender/recipient/origin fallback.
- Web tests passed: 12 files, 107 tests, including disabled empty fallback settings, clean
  not-configured summary text, disabled empty save payloads, and enabled required-field validation.
- API and web typechecks passed.
- Formatting, docs links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, route-boundary policy, and production build passed.
- Follow-up `pnpm refs:clone -- --check`, `pnpm --filter @open-practice/web lint`, and
  `git diff --check` also passed in the mixed branch-local checkout.

Skipped checks: none.
