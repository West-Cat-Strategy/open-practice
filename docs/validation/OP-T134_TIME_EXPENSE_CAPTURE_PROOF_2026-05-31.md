# OP-T134 Time And Expense Capture Proof

Date: 2026-05-31 PDT

## Scope

Implemented the first migration-free OP-T134 billing capture slice over existing time-entry and
expense-entry records:

- `GET /api/billing/dashboard` now exposes draft time rows, draft expense rows, draft-only timer
  policy metadata, and original expense category profile cues alongside approved unbilled invoice
  sources.
- Existing `POST /api/time-entries` and `POST /api/expense-entries` remain the create surfaces; the
  Billing dashboard saves local timer and expense captures as `draft` records for staff review.
- The dashboard separates reviewable draft capture from approved unbilled invoice sources, so draft
  capture does not flow into draft invoice creation until existing submit/approve paths are used.
- Timer saves use the local timer start timestamp, and expense saves include an explicit incurred
  date field so billing period locks evaluate the capture date rather than the click time.
- Approved invoice-source dashboard rows stay limited to billable time and reimbursable expenses;
  draft capture lists remain review-oriented and include all draft time/expense rows.
- Billing period locks continue to block create, update, submit, approve, and invoice approval paths
  for locked time/expense dates.
- No database schema, migrations, dependencies, provider contracts, native mobile capture, external
  time tools, automatic billing, submit/approve UI automation, lock bypasses, payment processing, or
  trust postings were added.

## Validation

Selector:

```sh
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Result: pass. The selector recommended API, web, domain, docs, policy, build, host E2E, and Docker
E2E coverage for the consolidation plus OP-T134 path set. The same selector was rerun after the
post-audit billing safeguards were applied.

Selected checks:

```sh
pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm build
pnpm e2e:host
pnpm e2e:docker
git diff --check
```

Results:

- Domain tests: pass, 22 files / 145 tests.
- API tests: pass, 39 files / 409 tests.
- Web tests: pass, 15 files / 125 tests.
- Provider tests: pass, 5 files / 15 tests.
- Worker tests: pass, 3 files / 23 tests.
- Host E2E: pass, 33 passed / 3 skipped.
- Docker E2E: pass, 5 passed.
- Format, docs, policy, typecheck, build, and diff whitespace checks: pass.

## Privacy And Boundary Notes

- All examples and tests use synthetic data.
- Draft capture audit metadata remains concise and excludes timer narratives and expense
  descriptions.
- Expense category profiles are independently authored Open Practice cues; no Clio prose, assets,
  screenshots, templates, schemas, API examples, or UI structure were copied.

## Consolidation Stabilization - 2026-05-31

Revalidated OP-T134 as part of the combined
`codex/op-clio-parity-consolidation-2026-05-31` branch with OP-T132, OP-T141, and OP-T142.

- `pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)`
  passed and selected host E2E, Docker E2E, format, docs, policy, domain/API/providers/worker/web
  tests, domain/API/web typechecks, and `pnpm build` for the real consolidation changed-path set.
- `pnpm --filter @open-practice/domain build`, `pnpm --filter @open-practice/database build`, and
  `pnpm --filter @open-practice/providers build` passed.
- `pnpm --filter @open-practice/domain test` passed: 22 files, 145 tests.
- `pnpm --filter @open-practice/api test` passed: 39 files, 409 tests.
- `pnpm --filter @open-practice/providers test` passed: 5 files, 15 tests.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 23 tests.
- `pnpm --filter @open-practice/web test` passed: 15 files, 125 tests.
- Domain, API, and web typechecks passed.
- `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `pnpm build` passed.
- `pnpm e2e:host` passed: 33 passed, 3 skipped.

Skipped check:

- `pnpm e2e:docker` could not start because the Docker daemon was unavailable at
  `unix:///Users/bryan/.docker/run/docker.sock` while resolving
  `open-practice-mailpit:v1.30.1-go1.26.3`; cleanup reported the same daemon connection blocker.
