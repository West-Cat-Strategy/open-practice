# Provider Document Conversion Review Cues Proof - 2026-06-29

Date: 2026-06-29
Branch: `feat/deposit-match-review-command-boundary-20260627`
Base: dirty branch rooted at local `main`/`origin/main` `9cb1f25e`
Status: Implemented with focused API/web proof passing. Selector-selected validation is recorded
below.

## Scope

This slice adds read-only latest-decision and bounded history cues for document conversion-review
artifacts. The cues are exposed in:

- Document-processing conversion-review summaries used by workbench, queue replay, and
  review-command responses.
- Documents dashboard conversion-review copy.
- Research dashboard `document_analysis_status` artifact projection copy.

The API shape is additive:

- `conversionReview.latestDecision` when a terminal cue exists.
- `conversionReview.decisionHistory`, newest first, bounded to five entries.

Each cue contains only OP-authored review metadata: artifact ID, `reviewed`/`rejected` decision,
review timestamp, reviewer user ID, artifact status, and fixed review-only/metadata-only/
terminal/no-downstream/no-provider-evidence/no-raw-OCR-returned flags.

## Boundary

- No schema, migration, dependency, provider activation, provider call, new queue, new worker, new
  job, object-storage write, downstream source-record mutation, or generated summary was added.
- The history is derived only from existing terminal `document_analysis_status` artifacts for the
  same document and matter. It is not a new event table, command log, annotation store, or
  persistent projection.
- API, Documents, and Research projections do not return or render raw OCR text, raw Markdown,
  converted Markdown, annotation bodies/spans, chunks, embeddings, prompts, provider payloads,
  provider evidence, storage keys, object bodies, private excerpts, generated summaries, raw
  artifact metadata, or artifact notes for document-analysis status artifacts.
- The Research projection displays only the terminal decision, timestamp, reviewer user ID,
  metadata-only/review-only posture, and no-provider/no-downstream/no-raw-OCR flags.
- Synthetic data only. No client, matter, credential, payment, private deployment, privileged
  document, provider payload, object body, storage key, prompt, chunk, embedding, converted
  Markdown, annotation body/span, private excerpt, or generated summary was added to proof
  metadata.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/review.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/types.ts
apps/web/app/document-processing-dashboard.ts
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/legal-research-dashboard.ts
apps/web/app/legal-research-dashboard.test.ts
apps/web/app/dashboard/research-section.tsx
apps/web/app/dashboard/research-section.test.tsx
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_CUES_PROOF_2026-06-29.md
docs/validation/README.md
```

## Focused Development Proof

```text
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose
  - Vitest reported 11 selected conversion-review tests passed.

PASS pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx app/dashboard/research-section.test.tsx app/legal-research-dashboard.test.ts --reporter=verbose
  - Vitest reported 3 files and 9 tests passing.
```

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/queue.ts apps/api/src/routes/document-processing/review.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/workbench.ts apps/web/app/_features/document-processing/models.ts apps/web/app/types.ts apps/web/app/document-processing-dashboard.ts apps/web/app/dashboard/documents-section.test.tsx apps/web/app/legal-research-dashboard.ts apps/web/app/legal-research-dashboard.test.ts apps/web/app/dashboard/research-section.tsx apps/web/app/dashboard/research-section.test.tsx docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-28.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_CUES_PROOF_2026-06-29.md docs/validation/README.md
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

| Command                                                                                                                                                                                     | Status           | Notes                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose`                                                         | Pass             | Focused API conversion-review tests covered reviewed/rejected latest cues, ordered history, unsafe-fragment exclusions, and no downstream source-record mutation. Latest filtered run reported 11 selected tests passing.  |
| `pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx app/dashboard/research-section.test.tsx app/legal-research-dashboard.test.ts --reporter=verbose` | Pass             | Focused web tests covered Documents copy, Research cue rendering, and non-rendering of unsafe notes/metadata fragments. Latest run reported 3 files and 9 tests passing.                                                   |
| `pnpm verify:select -- --files <final path set>`                                                                                                                                            | Pass             | Selected architecture, API contract, format, docs, policy, API test/typecheck, web test/typecheck, and build for the cue path set.                                                                                         |
| `pnpm architecture:check`                                                                                                                                                                   | Pass             | Architecture import policy passed with 461 workspace import edges reviewed.                                                                                                                                                |
| `pnpm api:contract`                                                                                                                                                                         | Pass             | API contract inventory wrote `.tmp/api-contract/openapi.json` with 340 paths.                                                                                                                                              |
| `pnpm format:check`                                                                                                                                                                         | Pass             | Full Prettier check passed after formatting the owned path set; command reported all matched files use Prettier code style.                                                                                                |
| `pnpm docs:check`                                                                                                                                                                           | Pass             | Documentation link validation passed.                                                                                                                                                                                      |
| `pnpm policy:check`                                                                                                                                                                         | Blocked          | Reason: local toolchain drift. Secrets, package manifest, and lockfile supply-chain checks passed, then `node scripts/check-toolchain.mjs` failed because `pnpm --version` is `11.7.0` but `packageManager` pins `11.5.3`. |
| `pnpm --filter @open-practice/api test`                                                                                                                                                     | Pass after rerun | First concurrent run timed out one unrelated `intake-pipeline` test under package-check load; isolated rerun passed with 43 files and 621 tests.                                                                           |
| `pnpm --filter @open-practice/api typecheck`                                                                                                                                                | Pass             | API TypeScript check passed.                                                                                                                                                                                               |
| `pnpm --filter @open-practice/web test`                                                                                                                                                     | Pass             | Web suite passed with 46 files and 241 tests.                                                                                                                                                                              |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                | Pass             | Web TypeScript check passed.                                                                                                                                                                                               |
| `pnpm build`                                                                                                                                                                                | Pass after retry | First run found an already-running Next build lock; after waiting for the active `next build --webpack` PID to exit, the clean rerun passed with 6 successful package build tasks.                                         |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_CUES_PROOF_2026-06-29.md --files <final path set>`                                                  | Pass             | Reconciliation passed with the same selected command set and 19 scoped paths.                                                                                                                                              |
| `git diff --check`                                                                                                                                                                          | Pass             | Whitespace/error check passed after proof reconciliation.                                                                                                                                                                  |

## Notes

- The working tree already contains unrelated billing, matter-lifecycle, appointment/calendar,
  migration, and integration-proof edits. This proof's path set is limited to the conversion-review
  cue slice and adjacent Documents/Research projections.
- The live aggregate branch-integration draft remains a draft. This proof does not claim final
  `main` publication, push parity, or branch/worktree prune evidence.
