# OP Setup Hydration CSP Hotfix Proof

Date: 2026-06-09 PDT

## Scope

Restored production setup-wizard hydration by allowing Next.js inline bootstrap scripts in the
enforced production Content Security Policy while continuing to block `unsafe-eval` and loopback API
connect sources.

No setup API, database schema, migration, dependency, secret, first-admin, or runtime credential
behavior changed. The stricter nonce-compatible script policy remains represented by report-only CSP
until nonce plumbing is implemented.

## Changed Paths

- `apps/web/next.config.mjs`
- `apps/web/app/security-headers.test.ts`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/validation/OP_SETUP_HYDRATION_CSP_HOTFIX_PROOF_2026-06-09.md`
- `docs/validation/README.md`

## Selector

```sh
pnpm verify:select -- --files apps/web/next.config.mjs apps/web/app/security-headers.test.ts docs/deployment-hardening.md docs/api-and-state-machines.md
```

Recommended validation:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Final dirty-tree selector after adding this proof note returned the same command set.

## Validation Results

- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm --filter @open-practice/web test` passed (`34` files, `172` tests).
- `pnpm --filter @open-practice/web typecheck` passed.
- `pnpm policy:check` passed.
- `pnpm build` passed.
- Production CSP helper probe passed with `script-src 'self' 'unsafe-inline'`, `connect-src 'self'`,
  `upgrade-insecure-requests`, no `unsafe-eval`, and no loopback connect sources.
- `git diff --check` passed.

## Deployment Notes

The pushed hotfix commit must be deployed as the exact release source for
`https://op.crockettparalegal.ca`. Remote setup keys and generated secrets remain outside the
repository and must not be printed during deploy verification.
