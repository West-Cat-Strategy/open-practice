# OP-T151 Legal Research Provider Job Boundary Proof

Date: 2026-06-04 PDT

## Scope

OP-T151 shipped the first legal-research provider job boundary and citation-review control slice on
the active core-suite Clio parity branch. The slice extends the existing OP-T139 staff-only legal
research workspace without adding a live legal research provider, legal-advice automation, scraped
authority storage, generated research content, public/client research access, or source-record
mutation.

The runtime change is additive:

- `POST /api/legal-research/provider-jobs` records a reserved matter-scoped
  `legal_research_provider_review` job boundary on `ai_triage`.
- The strict request accepts only matter/artifact IDs, source-type labels, jurisdiction, citation
  reference counts, context-link counts, and an optional client idempotency key.
- Missing queues create a skipped reserved job lifecycle record; configured queues receive only
  redacted metadata and the worker skips the reserved job until a legal research provider is
  explicitly implemented.
- `GET /api/legal-research/workspace` now includes redacted provider-job summaries,
  provider-boundary posture, and citation-review controls.
- The Research dashboard renders provider-job/citation-review posture without adding a generation
  UI or client/public research surface.

## Boundaries Preserved

- No prompts, source text, provider evidence, scraped authority text, private source URLs, storage
  keys, generated legal analysis, or provider payloads are accepted by the provider-job route or
  stored in job/audit metadata.
- The shared job metadata redaction allowlist gained only safe counters, booleans, and posture
  labels for this boundary.
- Citation review remains staff controlled. The slice makes no citation-verification,
  legal-advice, authority-completeness, provider-health, or production-provider claim.
- Legal research artifacts remain review-only records; OP-T151 does not create tasks, documents,
  drafts, messages, calendar entries, billing records, trust records, or source-record mutations.
- Matter-scoped authorization remains enforced through `legal_research:create/read`, and OP-T151
  adds no public, portal-token, or client-facing route.

## OP-T151-Owned Runtime Paths

- `apps/api/src/routes/legal-research.test.ts`
- `apps/api/src/routes/legal-research.ts`
- `apps/web/app/dashboard/research-section.test.tsx`
- `apps/web/app/dashboard/research-section.tsx`
- `apps/web/app/legal-research-dashboard.test.ts`
- `apps/web/app/legal-research-dashboard.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/OP-T151_LEGAL_RESEARCH_PROVIDER_JOB_BOUNDARY_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`
- `docs/validation/README.md`
- `packages/domain/src/legal-research.test.ts`
- `packages/domain/src/legal-research.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation Selection

Run before choosing final validation:

```sh
pnpm verify:select -- --files <current accumulated branch path set>
```

Selector output:

```text
Recommended validation commands:
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
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

Focused implementation checks run before final selector validation:

- `pnpm --filter @open-practice/domain test -- src/legal-research.test.ts src/permissions.test.ts`
  - 24 files / 172 tests passed.
- `pnpm --filter @open-practice/domain build`
  - Passed before downstream API/web checks consumed the new legal research exports.
- `pnpm --filter @open-practice/api test -- src/routes/legal-research.test.ts`
  - First run found the provider-job response omitted the safe `bullJobId` handle; the summary type
    and serializer were updated.
  - Rerun passed: 41 files / 472 tests.
- `pnpm --filter @open-practice/worker test -- src/processors.test.ts`
  - 3 files / 35 tests passed.
- `pnpm --filter @open-practice/web test -- app/legal-research-dashboard.test.ts app/dashboard/research-section.test.tsx`
  - 20 files / 139 tests passed.

Selector-based closeout validation:

- `pnpm verify:select -- --files <current accumulated branch path set>`
  - Passed and selected the format, docs, policy, repo test, package test/typecheck, worker build,
    and full build gates listed above.
- `pnpm format:check`
  - Initially reported formatting drift in `apps/worker/src/processors.ts`,
    `docs/api-and-state-machines.md`, `docs/planning-and-progress.md`, and
    `docs/validation/README.md`; targeted Prettier was run on those files and the rerun passed.
- `pnpm docs:check`
  - Passed.
- `pnpm policy:check`
  - Passed.
- `pnpm test`
  - Passed: domain 24 files / 172 tests, database 18 files / 101 tests, providers 7 files / 18
    tests, web 20 files / 139 tests, worker 3 files / 35 tests, API 41 files / 472 tests, and 38
    script tests.
- `pnpm --filter @open-practice/domain test`
  - 24 files / 172 tests passed.
- `pnpm --filter @open-practice/domain typecheck`
  - Passed.
- `pnpm --filter @open-practice/api test`
  - 41 files / 472 tests passed.
- `pnpm --filter @open-practice/api typecheck`
  - Passed.
- `pnpm --filter @open-practice/providers test`
  - 7 files / 18 tests passed.
- `pnpm --filter @open-practice/worker test`
  - 3 files / 35 tests passed.
- `pnpm --filter @open-practice/worker typecheck`
  - Passed.
- `pnpm --filter @open-practice/worker build`
  - Passed.
- `pnpm --filter @open-practice/web test`
  - 20 files / 139 tests passed.
- `pnpm --filter @open-practice/web typecheck`
  - Passed.
- `pnpm build`
  - Passed across all six packages.
- `git diff --check`
  - Passed.
