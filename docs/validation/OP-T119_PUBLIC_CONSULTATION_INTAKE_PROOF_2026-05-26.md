# OP-T119 Public Consultation Intake Proof

Date: 2026-05-26

## Scope

Added a review-first public consultation intake path for the Crockett Paralegal website.

The public route accepts the front-page consultation form into a pending public-intake record only.
It collects client name, telephone number, optional email, opposing-party names, a brief matter
description, disclosure acceptance, source URL, and timestamps. It does not automatically create a
matter.

Staff can configure notification sender/recipient/origin settings, review pending submissions,
dismiss submissions, run a prefilled conflict-check workflow, or convert accepted submissions into
intake-status matters. Conversion creates the prospective-client contact/party, opposing-party
contacts/parties, current-user assignment, and a link back to the source public consultation
submission.

Notification delivery reuses the existing SMTP-gated outbound email helper. Email bodies may
contain the submitted details for staff review, but job and audit metadata stay redacted to IDs,
template/source fields, recipient counts, and provider/job references.

## Validation

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/http/auth-helpers.ts apps/api/src/routes/operational-views.ts apps/api/src/routes/outbound-email.ts apps/api/src/routes/public-consultation-intakes.ts apps/api/src/routes/public-consultation-intakes.test.ts apps/api/src/server.ts apps/web/app/dashboard-client.tsx apps/web/app/page.tsx apps/web/app/public-consultation-intakes-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md packages/database/migrations/0038_public_consultation_intakes.sql packages/database/migrations/meta/_journal.json packages/database/src/repository/contracts.ts packages/database/src/repository/drizzle-mappers.ts packages/database/src/repository/drizzle.ts packages/database/src/repository/memory.ts packages/database/src/schema.ts packages/domain/src/operations.ts packages/domain/src/permissions.ts
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
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm format:check
pnpm docs:check
pnpm test
node scripts/scan-tracked-secrets.mjs
node scripts/validate-package-manifests.mjs
pnpm migrations:check
node scripts/validate-open-practice-boundaries.mjs
node --test scripts/validate-open-practice-boundaries.test.mjs
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database db:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm build
git diff --check
```

Results:

- Domain tests passed: 16 files, 125 tests.
- Database tests passed: 15 files, 73 tests.
- API tests passed: 35 files, 364 tests, including public consultation submit, validation,
  honeypot absorption, origin rejection, settings save/load, dismiss, convert, and redacted
  notification job metadata coverage.
- Web tests passed: 11 files, 100 tests.
- Providers tests passed: 5 files, 15 tests.
- Worker tests passed: 3 files, 21 tests.
- Root `pnpm test` passed: 9 Turbo tasks plus 9 script-test suites, 36 script tests.
- Domain, database, API, and web typechecks passed.
- Database schema check, migration parity, docs links, route-boundary policy, route-boundary unit
  tests, formatting, full build, secret scan, package-manifest policy, and diff whitespace checks
  passed.

Blocked check:

```sh
pnpm policy:check
node scripts/validate-oss-reuse.mjs
```

`pnpm policy:check` is blocked by the existing OSS reuse lock/index mismatch reported by
`node scripts/validate-oss-reuse.mjs`; the failing reference locks are `activepieces__activepieces`,
`apache__fineract`, `civicrm__civicrm-core`, `documenso__documenso`, `docusealco__docuseal`,
`kimai__kimai`, `ledgersmb__ledgersmb`, `lerianstudio__midaz`, `microsoft__markitdown`,
`nextcloud__server`, `open-source-legal__opencontracts`, `opencollective__opencollective-api`,
`opencollective__opencollective-frontend`, `temporalio__temporal`, `unstructured-io__unstructured`,
and `zulip__zulip`. The other policy subchecks passed separately.

Skipped checks: none beyond the blocked OSS reuse policy subcheck noted above.
