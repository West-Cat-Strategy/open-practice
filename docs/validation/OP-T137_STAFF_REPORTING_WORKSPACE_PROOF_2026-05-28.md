# OP-T137 Staff Reporting Workspace Proof

Date: 2026-05-28

## Scope

Implemented the first staff reporting workspace slice:

- Added OP-authored saved report definitions for invoice aging, reconciliation freshness,
  productivity, and operational follow-up.
- Added structured filter, grouping, and export-profile metadata with manual summary JSON and
  review CSV export profiles.
- Added a staff-only Reports dashboard section and route catalog entry that renders saved
  definitions, first projections, export profiles, and export history.
- Reused the existing reports job lifecycle for `staff_report_export` requests, status polling,
  worker completion, and gated downloads.
- Regenerated downloads from authorized repository reads and kept report rows/raw bodies out of
  durable job and audit metadata.
- Kept custom SQL, BI embeds, scheduled email delivery, payment processing, accounting
  certification, new dependencies, and migrations out of scope.

## Selector

Ran:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Results

Passed:

- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/providers build`
- `pnpm --filter @open-practice/domain test -- reports.test.ts`
- `pnpm --filter @open-practice/api test -- reports.test.ts`
- `pnpm --filter @open-practice/worker test -- processors.test.ts`
- `pnpm --filter @open-practice/web test -- routeCatalog.test.ts dashboard-client.test.ts dashboard-shell.test.tsx`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm format:check`
- `pnpm docs:check`
- `node scripts/validate-open-practice-boundaries.mjs`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/providers test`
- `git diff --check`
- `pnpm policy:check`
- `pnpm build`
- `pnpm test`
- Playwright CLI smoke against local dev servers:
  - API: `API_PORT=4100 pnpm --filter @open-practice/api dev`
  - Web: `API_BASE_URL=http://localhost:4100 NEXT_PUBLIC_API_BASE_URL=http://localhost:4100 WEB_PORT=3100 pnpm --filter @open-practice/web dev`
  - Opened `http://localhost:3100/?section=reports`
  - Snapshot confirmed the Reports navigation item, saved report definitions, invoice aging,
    reconciliation freshness, productivity, operational follow-up, report rows, and export history.
  - Captured a full-page screenshot during validation, then removed transient Playwright artifacts
    from the worktree.

Fresh-worktree setup note: the first API, worker, and web test attempts failed before local package
build outputs for workspace dependencies existed. After building the domain, database, and providers
packages, the same focused test commands passed.

Browser smoke note: the Playwright console log only recorded React dev/HMR info and a missing
`/favicon.ico` 404.
