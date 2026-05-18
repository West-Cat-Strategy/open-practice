# OP-T97 Audit Projection Dashboard Summaries Proof

Date: 2026-05-17

## Scope

Added the first read-only audit projection summary to the dashboard Audit lane. The web projection
uses the existing `/api/audit` taxonomy summary, hash-chain validity flag, and event identifiers,
then drops audit metadata values before storing recent-event rows in client state. Stored audit
events, audit metadata, hash-chain append behavior, and database schema were not changed.

## Validation

- `pnpm verify:select -- --files docs/planning-and-progress.md apps/api/src/routes/audit.test.ts apps/web/app/audit-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/page.tsx apps/web/app/types.ts`
- `pnpm --filter @open-practice/api exec vitest run src/routes/audit.test.ts`
- `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`
- `pnpm docs:check`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
- `pnpm format:check`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/web test`
- `pnpm build`
- `pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T97_AUDIT_PROJECTION_DASHBOARD_SUMMARIES_PROOF_2026-05-17.md apps/api/src/routes/audit.test.ts apps/web/app/audit-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/page.tsx apps/web/app/types.ts`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

## Notes

- The first focused API/web test attempt in a fresh worktree failed because package dist exports
  had not been built yet. After building `@open-practice/domain`, `@open-practice/database`, and
  `@open-practice/providers`, the same focused tests and the recommended selector gates passed.
- No browser screenshot was captured because this slice reused existing dashboard layout primitives
  and the focused proof stayed at the API/web contract, projection, typecheck, and build seam.
