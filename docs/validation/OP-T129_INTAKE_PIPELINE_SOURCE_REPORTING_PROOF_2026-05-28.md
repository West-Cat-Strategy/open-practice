# OP-T129 Intake Pipeline And Source Reporting Proof

Date: 2026-05-28 PDT

## Scope

Adds the first staff-owned, read-only intake pipeline/source reporting slice over existing public
consultation and intake-session records:

- Added a pure domain projection that promotes public consultation submissions and intake sessions
  into lead records with lead status, source attribution, conflict-review posture, safe
  request/appointment links, and conversion counts.
- Added `GET /api/intake-pipeline` with staff authorization, assigned-matter intake-session scoping
  for matter-scoped users, owner/auditor firm-wide intake-session reads, safe calendar event links,
  and no persistence or mutation side effects.
- Added a dashboard Intake pipeline summary and recent-lead list using the existing dashboard
  surface, including pipeline leads, conversions, conflict-review counts, request-link counts, and
  appointment-link counts.
- Documented the route/state-machine boundary and kept automatic matter creation, SMS outreach,
  ad-spend ingestion, campaign delivery, and marketing automation out of scope.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/routes/intake-pipeline.test.ts apps/api/src/routes/intake-pipeline.ts apps/api/src/server.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/intake-pipeline-dashboard.ts apps/web/app/page.tsx apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T129_INTAKE_PIPELINE_SOURCE_REPORTING_PROOF_2026-05-28.md packages/domain/src/index.ts packages/domain/src/intake-pipeline.test.ts packages/domain/src/intake-pipeline.ts scripts/route-authorization-manifest.mjs scripts/validate-open-practice-boundaries.mjs
```

Recommended commands:

```sh
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
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
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/domain test -- intake-pipeline
pnpm --filter @open-practice/api exec vitest run src/routes/intake-pipeline.test.ts
pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm build
git diff --check
```

Results:

- Focused domain test passed: 20 files, 135 tests, including public-consultation/intake-session
  status projection, conflict-review posture, conversion counts, request/appointment links, and
  redaction checks.
- Focused API route test passed: 1 file, 2 tests for `GET /api/intake-pipeline`, including
  source/status reporting, conversion counts, request links, appointment links, response redaction,
  and client-external denial.
- Focused dashboard-client test passed: 65 tests, including intake pipeline helper labels, empty
  state, path construction, and summary text.
- Full `pnpm test` passed: domain 20 files/135 tests, database 15 files/79 tests, providers 5
  files/15 tests, web 13 files/117 tests, worker 3 files/22 tests, API 36 files/395 tests, and 36
  script tests.
- Domain, API, and web typechecks passed.
- Formatting, docs links, tracked-secret scan, package-manifest policy, migration parity, OSS reuse
  policy, Open Practice boundary policy, production build, and whitespace checks passed.

## Redaction And Scope Proof

- Domain and API tests assert the pipeline output does not include requester email addresses,
  request bodies, raw source/interview URLs, intake token hashes, or appointment titles.
- Appointment links expose event ID, matter ID, start time, and status only.
- Request links expose safe record IDs, status, created/submitted timestamps, and URL presence only.
- Source attribution exposes safe labels, channel, source type, and URL presence only.
- The API route only reads existing public consultation, intake-session, intake-form link/review,
  and calendar event records; it does not create matters, send SMS, ingest ad spend, run campaigns,
  or queue marketing automation.
- Client-external access to `GET /api/intake-pipeline` returns `403`.

## Notes

- All tests and docs use synthetic data only.
- No dependencies, copied reference code, migrations, provider integrations, SMS delivery, campaign
  delivery, ad-spend ingestion, or automatic matter creation were added.
