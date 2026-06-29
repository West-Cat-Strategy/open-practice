# Provider Document Conversion Semantic-Review Readiness Proof - 2026-06-29

Date: 2026-06-29
Branch: `feat/document-conversion-semantic-readiness-20260629`
Base: clean local `main`/`origin/main` `0d850772`
Status: Implemented with focused API proof passing. Selector-selected validation is recorded below,
with unrelated policy/reference drift and broad API concurrency timeouts called out explicitly.

## Scope

This slice adds an additive metadata-only semantic-review readiness packet to existing document
conversion-review summaries:

- `conversionReview.semanticReviewReadiness` appears wherever the existing safe conversion-review
  summary is returned: document-processing workbench, conversion-review job replay, and
  review-decision responses.
- The packet is `ready` only for same-matter `ready_for_review` or `reviewed`
  `document_analysis_status` conversion-review artifacts.
- It is `blocked` because no same-matter ready/reviewed artifact is available for rejected, queued,
  active, failed, not-requested, missing, draft, or otherwise not-ready conversion-review states.

## Boundary

- No route, route authorization manifest entry, schema, migration, dependency, provider activation,
  provider call, queue, worker processor, object-storage write, dashboard action, generated summary,
  downstream source-record mutation, or semantic-review execution was added.
- The packet contains only document/artifact/job IDs, existing counts/lengths, conversion-review and
  artifact status labels, and fixed policy flags.
- It explicitly excludes provider names/statuses, schemas, queues, raw artifact metadata, notes, raw
  OCR text, converted Markdown, raw Markdown, annotation bodies/spans, chunks, embeddings, prompts,
  provider payloads/evidence, storage keys, object bodies, private excerpts, generated summaries,
  and downstream mutations.
- Synthetic data only. No client, matter, credential, payment, private deployment, privileged
  document, provider payload, object body, storage key, prompt, chunk, embedding, converted
  Markdown, annotation body/span, private excerpt, or generated summary was added to durable proof
  metadata.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/shared.ts
apps/web/app/_features/document-processing/models.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_READINESS_PROOF_2026-06-29.md
docs/validation/README.md
```

## Focused Development Proof

```text
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose
  - Vitest reported 12 selected conversion-review tests passed and 18 skipped because the filter selected conversion-review cases only.
```

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/shared.ts apps/web/app/_features/document-processing/models.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_READINESS_PROOF_2026-06-29.md docs/validation/README.md
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                                  | Status                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/domain build && pnpm --filter @open-practice/database build && pnpm --filter @open-practice/providers build`               | Pass                         | Fresh sibling worktree package-output prep passed after the first focused API run could not resolve `@open-practice/database` before upstream packages were built.                                                                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose`                      | Pass                         | Focused API conversion-review tests covered ready/reviewed semantic readiness, rejected/not-requested/draft/failed/queued blocked posture because no same-matter ready/reviewed artifact exists, unsafe-field exclusions, and no downstream mutation. Latest filtered run reported 12 selected tests passed and 18 skipped because the filter selected conversion-review cases only.                                                                                                                            |
| `pnpm verify:select -- --files <final path set>`                                                                                                         | Pass                         | Selected architecture, API contract, format, docs, policy, API test/typecheck, web test/typecheck, and build for the final 8-path set.                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm architecture:check`                                                                                                                                | Pass                         | Architecture import policy passed with 462 workspace import edges reviewed.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm api:contract`                                                                                                                                      | Pass                         | API contract inventory wrote `.tmp/api-contract/openapi.json` with 342 paths.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm format:check`                                                                                                                                      | Pass                         | Full Prettier check passed; command reported all matched files use Prettier code style.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm docs:check`                                                                                                                                        | Pass                         | Documentation link validation passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm policy:check`                                                                                                                                      | Blocked                      | Reason: unrelated OSS reference-lock drift. Secrets, package manifest, lockfile supply-chain, toolchain, env, architecture, dead-code, migration parity, and migration lint checks passed before `node scripts/validate-oss-reuse.mjs` failed because 21 existing `docs/oss-references.lock.json` commits no longer match the central reference index, including `activepieces__activepieces`, `apache__fineract`, `paperless-ngx__paperless-ngx`, `temporalio__temporal`, and `unstructured-io__unstructured`. |
| `pnpm --filter @open-practice/api test`                                                                                                                  | Blocked; isolated rerun pass | Reason: broad package run hit unrelated 5s concurrency timeouts in `auth.test.ts`, `document-assembly.test.ts`, `e2e-support.test.ts`, and `mfa.test.ts` after 39 files and 620 tests passed. Isolated rerun of those four files passed with 4 files and 9 tests, confirming the timed-out cases were not semantic-readiness regressions.                                                                                                                                                                       |
| `pnpm --filter @open-practice/api typecheck`                                                                                                             | Pass                         | API TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm --filter @open-practice/web test`                                                                                                                  | Pass                         | Web suite passed with 46 files and 243 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/web typecheck`                                                                                                             | Pass                         | Web TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm build`                                                                                                                                             | Pass                         | Turbo build completed 6 package build tasks successfully; 4 tasks were cache hits.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_READINESS_PROOF_2026-06-29.md --files <final path set>` | Pass                         | Reconciliation passed with the same selected command set and 8 scoped paths.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check`                                                                                                                                       | Pass                         | Whitespace/error check passed after proof reconciliation.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Notes

- Work was done in a clean sibling worktree because the root checkout was already on
  `feat/report-export-profile-alignment-20260629` with unrelated report-domain edits.
- The root checkout was not modified.
