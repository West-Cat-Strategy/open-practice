# OP-T123 Operational Action-State Descriptors Proof

Date: 2026-05-26

## Scope

- Added the first shared domain helper for operational action availability descriptors in
  `packages/domain/src/operational-actions.ts`.
- Adopted it in existing dashboard action-state seams for connector outbox recovery and
  document-processing OCR queueing.
- Added an `@open-practice/domain/operational-actions` package subpath so web runtime imports use
  only the pure helper module and do not pull server-only domain exports into the client bundle.
- No new dependencies, providers, queue types, API routes, persistence, audit events, or mutation
  paths were added.

## Validation

Selector:

```bash
pnpm verify:select -- --files packages/domain/src/operational-actions.ts packages/domain/src/operational-actions.test.ts packages/domain/src/index.ts packages/domain/package.json apps/web/app/connector-outbox-dashboard.ts apps/web/app/dashboard/queues-section.tsx apps/web/app/document-processing-dashboard.ts apps/web/app/dashboard-client.test.ts docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T123_OPERATIONAL_ACTION_STATE_DESCRIPTORS_PROOF_2026-05-26.md
```

Recommended: `pnpm deps:audit`, `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`,
`pnpm policy:check`, `pnpm --filter @open-practice/domain test`,
`pnpm --filter @open-practice/domain typecheck`, `pnpm --filter @open-practice/api test`,
`pnpm --filter @open-practice/providers test`, `pnpm --filter @open-practice/worker test`,
`pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`, and
`pnpm build`.

| Command                                         | Result                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm deps:audit`                               | Passed: no known production or development vulnerabilities found.    |
| `pnpm deps:licenses`                            | Completed dependency license report for 549 packages / 578 versions. |
| `pnpm format:check`                             | Passed after formatting the touched web files.                       |
| `pnpm --filter @open-practice/domain test`      | Passed: 18 files, 131 tests.                                         |
| `pnpm --filter @open-practice/domain typecheck` | Passed.                                                              |
| `pnpm --filter @open-practice/domain build`     | Passed; refreshed ignored local `dist` for package-boundary checks.  |
| `pnpm --filter @open-practice/web test`         | Passed after the domain build/subpath fix: 11 files, 100 tests.      |
| `pnpm --filter @open-practice/web typecheck`    | Passed.                                                              |
| `pnpm --filter @open-practice/api test`         | Passed: 34 files, 375 tests.                                         |
| `pnpm --filter @open-practice/providers test`   | Passed: 5 files, 15 tests.                                           |
| `pnpm --filter @open-practice/worker test`      | Passed: 3 files, 22 tests.                                           |
| `pnpm docs:check`                               | Passed.                                                              |
| `node scripts/validate-package-manifests.mjs`   | Passed.                                                              |
| `pnpm build`                                    | Passed after switching web runtime imports to the domain subpath.    |
| `pnpm policy:check`                             | Blocked by pre-existing OSS reference lock commit mismatches.        |

`pnpm policy:check` completed secret scanning, package-manifest validation, and migration parity
before `validate-oss-reuse.mjs` reported central-reference-index commit mismatches for the pinned
reference locks: `activepieces__activepieces`, `apache__fineract`, `civicrm__civicrm-core`,
`documenso__documenso`, `docusealco__docuseal`, `kimai__kimai`, `ledgersmb__ledgersmb`,
`lerianstudio__midaz`, `microsoft__markitdown`, `nextcloud__server`,
`open-source-legal__opencontracts`, `opencollective__opencollective-api`,
`opencollective__opencollective-frontend`, `temporalio__temporal`,
`unstructured-io__unstructured`, and `zulip__zulip`.

## Build Note

The first `pnpm build` attempt failed because a runtime import from the domain root pulled
server-only `audit.js`/`node:crypto` into the web client bundle. The slice now imports the runtime
helper through `@open-practice/domain/operational-actions`; the final build passed.
