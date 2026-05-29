# OP-T128 Client Portal Account Workspace Proof

Date: 2026-05-28 PDT

## Scope

Adds the first logged-in client portal account workspace slice over existing records:

- `GET /api/client-portal/workspace` requires an authenticated `client_external` session and
  projects active contact-email-matched `portal_grants`.
- Workspace matters summarize existing secure-share, external-upload, intake, guest-session,
  email-receipt, and signature records into redacted client-visible action counts.
- `POST /api/client-portal/accounts` lets authorized staff create or reuse a `client_external` user
  and an exact active `portal_grant` for a matching matter contact email.
- Existing `/api/portal/*` token routes remain the execution path for secure share,
  external-upload, intake, guest-session, and receipt links.
- The slice adds no schema, migration, new account/action tables, new dependencies, or native mobile
  behavior.

## Changed Boundaries

- Workspace access is tied to active existing `portal_grants` whose contact email identifiers match
  the logged-in client email; revoked or expired grants are excluded.
- Staff setup refuses cross-firm or same-firm non-client duplicate emails and requires the requested
  email to match the selected matter contact.
- Client users remain excluded from internal matter assignment lists.
- Workspace reads do not write audit events. New staff-created grants continue to use the existing
  `portal.grant.created` audit action with redacted metadata.
- Responses do not expose raw public tokens, token hashes, setup token hashes, storage keys,
  document titles or content, email bodies, recipient lists, private notes, meeting URLs,
  billing/trust/time data, live payment references, or staff-only matter metadata.
- Realtime chat, broad document browsing, live payments, native mobile behavior, and public-token
  route rewrites remain out of scope.

## Validation Commands

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal-workspace.ts apps/api/src/routes/client-portal.test.ts apps/api/src/server.ts apps/web/app/client-portal-workspace.tsx apps/web/app/client-portal-workspace.test.tsx apps/web/app/page.tsx apps/web/app/password-setup/PasswordSetupClient.tsx apps/web/app/password-setup/page.tsx apps/web/app/password-setup/password-setup-utils.test.tsx apps/web/app/password-setup/password-setup-utils.ts apps/web/app/portal/page.tsx apps/web/app/styles/50-setup-auth.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T128_CLIENT_PORTAL_ACCOUNT_WORKSPACE_PROOF_2026-05-28.md packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

## Results

Pending final rerun after proof/workboard formatting.

## Skipped Checks

Docker-backed e2e and browser/mobile checks are not part of this first slice. OP-T128 is covered by
selector guidance, package tests/typechecks, docs/policy checks, migration checks, build, and
targeted public-token route regression tests.

## Notes

- All examples and proof expectations are synthetic.
- No new dependencies, vendored assets, reference-derived code, client data, credentials, payment
  details, or private deployment details are introduced.
