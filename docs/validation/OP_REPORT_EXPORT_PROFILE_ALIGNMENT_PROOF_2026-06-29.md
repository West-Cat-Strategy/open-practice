# Report Export Profile Alignment Proof - 2026-06-29

## Summary

Added a read-only staff reporting export-profile alignment view:

- `GET /api/reports/workspace` now includes `exportProfileAlignment` metadata derived from existing
  manual report export profiles and financial export field profiles.
- The Reports dashboard renders the comparison as operational read-only metadata, including
  purpose/scope differences, format differences, field-key behavior, bounded field-key samples, and
  disabled-safeguard flags.
- The view uses synthetic tests only and does not store report bodies, execute exports, or expose
  payment/trust mutation controls.

## Boundaries

- All examples and tests use synthetic data only; no client, matter, credential, payment,
  deployment, or other private data was added or exposed, preserving the privacy boundary.
- No routes, dependencies, schemas, migrations, custom SQL, BI embeds, schedulers, scheduled email,
  raw report-body storage, provider adapters, object-storage artifacts, payment processor exposure,
  payment creation/allocation, invoice mutation, trust posting, settlement processing, or
  certification claims were added.
- Financial field-key samples are bounded metadata samples, not export bodies or redaction rules.
- Staff report exports and financial downloads keep their existing queue/job/audit metadata
  boundaries and regenerate authorized projections for downloads.

## Final Changed Paths

- apps/api/src/routes/reports.test.ts
- apps/web/app/dashboard/reports-section.test.tsx
- apps/web/app/dashboard/reports-section.tsx
- apps/web/app/reporting-dashboard.ts
- docs/api-and-state-machines.md
- docs/improvement-opportunities.md
- docs/planning-and-progress.md
- docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md
- docs/validation/README.md
- packages/domain/src/reports.test.ts
- packages/domain/src/reports.ts

## Selector Evidence

```bash
pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts
```

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm api:contract`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

## Validation Results

- Pass: `pnpm verify:select -- --files apps/api/src/routes/reports.test.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts`
  selected the commands listed above for the exact final path set.
- Pass: `pnpm architecture:check`
  - `Architecture import policy passed: 462 workspace import edges reviewed.`
- Pass: `pnpm api:contract`
  - Wrote `.tmp/api-contract/openapi.json` with 342 paths.
- Pass after targeted Prettier write on touched files: `pnpm format:check`
  - Prettier initially flagged formatting drift in touched files after the implementation patch.
  - Ran `pnpm exec prettier --write apps/web/app/dashboard/reports-section.test.tsx docs/api-and-state-machines.md docs/validation/README.md packages/domain/src/reports.ts`.
  - A final proof-update rerun flagged `apps/api/src/routes/reports.test.ts`; ran
    `pnpm exec prettier --write apps/api/src/routes/reports.test.ts`.
  - Rerun passed with `All matched files use Prettier code style!`.
- Pass: `pnpm docs:check`
  - `Documentation link validation passed.`
- Blocked by unrelated reference-index drift: `pnpm policy:check`
  - Passed preceding policy subchecks: tracked-secret scan, package manifest policy, lockfile
    supply-chain policy, toolchain policy, environment surface, architecture graph, dead-code
    check, migration integrity, and migration lint.
  - Failed at `node scripts/validate-oss-reuse.mjs` because existing reference locks do not match
    the central reference index for `activepieces__activepieces`, `apache__fineract`,
    `calcom__cal.diy`, `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`, `ledgersmb__ledgersmb`,
    `lerianstudio__midaz`, `nextcloud__server`, `open-source-legal__opencontracts`,
    `opencollective__opencollective`, `opencollective__opencollective-api`,
    `opencollective__opencollective-frontend`, `openfga__openfga`, `paperless-ngx__paperless-ngx`,
    `temporalio__temporal`, `unstructured-io__unstructured`, and `zulip__zulip`.
  - The blocker is outside the final changed paths and no dependency, vendored, copied, or
    reference-derived source changes were made in this branch.
- Pass: `pnpm --filter @open-practice/domain test`
  - 33 files and 266 tests passed.
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass: `pnpm --filter @open-practice/api test`
  - Clean rerun passed with 43 files and 623 tests.
- Additional focused proof: `pnpm --filter @open-practice/api exec vitest run src/routes/reports.test.ts`
  - 1 file and 8 tests passed for the changed report routes.
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test`
  - 13 files and 37 tests passed.
- Pass: `pnpm --filter @open-practice/worker test`
  - 6 files and 54 tests passed.
- Pass: `pnpm --filter @open-practice/web test`
  - 46 files and 243 tests passed.
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
  - Turbo reported 6 successful build tasks.

## Closeout Checks

- Pass: `pnpm proof:reconcile -- --proof docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md --files apps/api/src/routes/reports.test.ts apps/web/app/dashboard/reports-section.test.tsx apps/web/app/dashboard/reports-section.tsx apps/web/app/reporting-dashboard.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_PROFILE_ALIGNMENT_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/reports.test.ts packages/domain/src/reports.ts`
  - `Result: passed`
- Pass: `git diff --check`
