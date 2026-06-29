# Provider Document Conversion Review Decision Proof - 2026-06-27

Date: 2026-06-27
Branch: `feat/provider-document-conversion-review-decision-20260627`
Base: local `main` at `9cb1f25e`
Status: Implemented with focused route proof and API typecheck passing. Repository-wide selected
checks are partially blocked by unrelated dirty workspace changes documented below.

## Scope

This branch promotes the next document-conversion runtime slice as an explicit metadata-only review
decision command over existing conversion-review artifacts. It adds:

`PATCH /api/document-processing/documents/:documentId/conversion-review/review`

The route accepts only `{ decision: "reviewed" | "rejected" }`, requires matter-scoped
`document_processing:read` plus `legal_research:approve`, resolves the existing
`document_analysis_status` artifact for the authorized document, and records only the terminal
review decision metadata. It returns only `{ status, task, documentId, conversionReview }` using the
existing safe conversion-review summary builder.

## Boundary

- No provider conversion activation, provider SDK, dependency, schema, migration, new queue, worker
  processor, object-storage write, dashboard action, retained Markdown, annotation storage, chunking,
  embeddings, prompts, provider payload retention, private excerpts, or generated summaries were
  added.
- Successful decisions update only legal-research artifact review metadata and a bounded safe
  metadata bag with IDs, counts, lengths, statuses, provider/status posture, OP-authored summary
  posture, policy flags, and review flags.
- Missing documents return `404`. Missing/not-ready artifacts and queued/active/failed/dead-letter
  latest conversion-review jobs return `409`. Same terminal decisions return the existing safe
  summary without rewriting. Opposite terminal decisions return `409`.
- Responses and audit metadata do not include raw client text, raw OCR text, converted Markdown,
  annotations, chunks, embeddings, prompts, provider evidence/payloads, storage keys, object bodies,
  private excerpts, generated summaries, or raw artifact metadata.
- The command does not create jobs or mutate document, draft, matter, task, calendar, ledger, or
  portal source records.
- Synthetic data only. No client, matter, credential, payment, private deployment, privileged
  document, provider payload, object body, storage key, prompt, chunk, embedding, converted
  Markdown, annotation body/span, private excerpt, or generated summary was added to proof metadata.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/review.ts
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_DECISION_PROOF_2026-06-27.md
docs/validation/README.md
scripts/route-authorization-manifest.mjs
```

## Focused Development Proof

```text
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose
  - Vitest reported 10 conversion-review tests passed and 18 skipped because the filter selected conversion-review cases.
```

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/review.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_DECISION_PROOF_2026-06-27.md docs/validation/README.md scripts/route-authorization-manifest.mjs
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
```

## Validation

| Command                                                                                                                                        | Status  | Notes                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose`            | Pass    | Focused conversion-review route proof passed twice after implementation and after the sanitizer type fix; latest run reported 10 passed and 18 skipped because the filter selected conversion-review cases.                                |
| `pnpm verify:select -- --files <final path set>`                                                                                               | Pass    | Recommended architecture, API contract, format, docs, policy, repo test, API test, and API typecheck commands.                                                                                                                             |
| `pnpm architecture:check`                                                                                                                      | Pass    | Architecture import policy passed with 460 workspace import edges reviewed.                                                                                                                                                                |
| `pnpm api:contract`                                                                                                                            | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 340 paths.                                                                                                                                                              |
| `pnpm format:check`                                                                                                                            | Blocked | Repository-wide Prettier check is blocked by 7 unrelated dirty files: billing payment-import route/schema/test files, matter test, migration snapshot, and payment-import memory repository files. Owned slice paths pass scoped Prettier. |
| `pnpm exec prettier --check <final path set>`                                                                                                  | Pass    | All matched owned slice files use Prettier code style.                                                                                                                                                                                     |
| `pnpm docs:check`                                                                                                                              | Blocked | Latest docs link validation is blocked by unrelated `OP-T162_DEPOSIT_MATCH_REVIEW_COMMAND_BOUNDARY_PROOF_2026-06-27.md` links in planning/index without the corresponding proof file.                                                      |
| `pnpm policy:check`                                                                                                                            | Blocked | Secrets, package, supply-chain, toolchain, env, architecture, dead-code, migration, and migration-lint subchecks passed; OSS reuse failed because central reference-index lock commits are out of sync.                                    |
| `pnpm test`                                                                                                                                    | Blocked | Blocked by one unrelated API billing payment-import review test; domain, providers, web, database, and worker suites passed before that API failure.                                                                                       |
| `pnpm --filter @open-practice/api test`                                                                                                        | Blocked | Blocked by the same unrelated billing failure; the exact API test command reported 42 files and 619 tests passed, 1 billing test failed.                                                                                                   |
| `pnpm --filter @open-practice/api typecheck`                                                                                                   | Pass    | API TypeScript check passed after tightening sanitizer record typing.                                                                                                                                                                      |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_REVIEW_DECISION_PROOF_2026-06-27.md --files <final path set>` | Pass    | Reconciliation passed with the same selector recommendations and 9 scoped paths.                                                                                                                                                           |
| `git diff --check`                                                                                                                             | Pass    | Whitespace check passed after the proof reconciliation update.                                                                                                                                                                             |

## Notes

- The working tree also contained unrelated billing/matter-lifecycle edits outside this slice while
  this proof was prepared. They are not included in the scoped path set above, but some selected
  repository-wide checks are blocked by those unrelated edits and by unrelated OP-T162 proof links
  in shared docs files.
- 2026-06-29 addendum: the earlier OP-T162 proof-link blocker is now stale in the live branch. The
  OP-T162 proof file is present locally and linked from the validation index; branch-level docs and
  proof reconciliation should use the 2026-06-28/2026-06-29 integration proof state instead of this
  row-local historical blocker note.
