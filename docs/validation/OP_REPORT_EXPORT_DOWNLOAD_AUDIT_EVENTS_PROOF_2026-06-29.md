# Report Export Download Audit Events Proof - 2026-06-29

## Summary

Added safe `*.downloaded` audit events for completed report export jobs:

- `audit_export.downloaded`
- `billing_export.downloaded`
- `staff_report_export.downloaded`
- `jurisdictional_trust_export.downloaded`

The worker records only job/profile/scope/count metadata plus explicit no-storage flags. The change
also de-duplicates the existing `billing_export.requested` taxonomy entry while preserving the safe
union of request metadata hints.

## Boundaries

- All examples and tests use synthetic data only; no client, matter, credential, payment,
  deployment, private audit payload, or export body data was added or exposed.
- No scheduled delivery, custom SQL, BI embeds, export body storage, private audit payload exposure,
  export serialization changes, profile changes, API routes, schemas, migrations, object-storage
  artifacts, payment processor exposure, payment creation/allocation, invoice mutation, trust
  posting, or certification claims were added.
- Download audit metadata keeps regenerated-download posture explicit with
  `queued_regenerated_download_no_retained_export_body`, `storedBody: false`,
  `retainedExportArtifact: false`, and `exportBodyStoredInJobMetadata: false`.

## Final Changed Paths

- apps/worker/src/processors.test.ts
- apps/worker/src/processors/reports.ts
- docs/improvement-opportunities.md
- docs/planning-and-progress.md
- docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md
- docs/validation/README.md
- packages/domain/src/audit-taxonomy.test.ts
- packages/domain/src/audit-taxonomy.ts

## Selector Evidence

```bash
pnpm verify:select -- --files apps/worker/src/processors.test.ts apps/worker/src/processors/reports.ts docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts
```

Recommended validation commands:

- `pnpm architecture:check`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/domain build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`

## Validation Results

- Pass: `pnpm verify:select -- --files apps/worker/src/processors.test.ts apps/worker/src/processors/reports.ts docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts`
  selected the commands listed above for the exact final path set.
- Pass: `pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts`
  - 1 file and 41 tests passed.
- Initial fresh-worktree hydration miss, then rerun green:
  `pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts`
  - Initial run did not reach tests because the fresh sibling worktree had not built
    `@open-practice/database`.
  - After `pnpm --filter @open-practice/domain build`,
    `pnpm --filter @open-practice/database build`, and
    `pnpm --filter @open-practice/providers build`, the rerun passed with 1 file and 29 tests.
- Pass: `pnpm architecture:check`
  - `Architecture import policy passed: 466 workspace import edges reviewed.`
- Pass after targeted Prettier write on touched docs: `pnpm format:check`
  - Initial run flagged `docs/validation/README.md`; ran
    `pnpm exec prettier --write docs/validation/README.md`.
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
    `jitsi__jitsi-meet`, `jlawyerorg__j-lawyer-org`, `kimai__kimai`,
    `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `nextcloud__server`,
    `open-source-legal__opencontracts`, `opencollective__opencollective`,
    `opencollective__opencollective-api`, `opencollective__opencollective-frontend`,
    `openfga__openfga`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`,
    `unstructured-io__unstructured`, and `zulip__zulip`.
  - The blocker is outside the final changed paths; this branch adds no dependencies, vendored
    assets, copied excerpts, or reference-derived source.
- Pass: `pnpm --filter @open-practice/domain test`
  - 33 files and 281 tests passed.
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/domain build`
- Pass after isolated rerun: `pnpm --filter @open-practice/api test`
  - First run under parallel validation load failed four CalDAV route tests on 5s test timeouts.
  - Isolated rerun passed with 43 files and 631 tests.
- Pass: `pnpm --filter @open-practice/providers test`
  - 13 files and 37 tests passed.
- Pass after final helper type fix: `pnpm --filter @open-practice/worker test`
  - Rerun passed with 6 files and 54 tests.
- Pass: `pnpm --filter @open-practice/worker typecheck`
- Pass: `pnpm --filter @open-practice/worker build`

## Closeout Checks

- Pass: `pnpm proof:reconcile -- --proof docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md --files apps/worker/src/processors.test.ts apps/worker/src/processors/reports.ts docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_REPORT_EXPORT_DOWNLOAD_AUDIT_EVENTS_PROOF_2026-06-29.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts`
  - `Result: passed`
