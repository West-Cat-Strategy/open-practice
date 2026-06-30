# Provider Document Conversion Semantic-Review Checkpoints Proof - 2026-06-29

Date: 2026-06-29
Branch: `feat/document-conversion-semantic-review-checkpoints-20260629`
Base: clean local `main`/`origin/main` `17fa4098`
Status: Implemented with focused domain/database/API/web proof passing. Selector-selected
validation is recorded below, with unrelated policy/reference drift called out explicitly.

## Scope

This slice adds an explicit staff command that creates or replays a durable, metadata-only semantic
review checkpoint for an existing document conversion-review artifact:

- `POST /api/document-processing/documents/:documentId/conversion-review/semantic-review/checkpoints`
  requires matter-scoped `document_processing:read` and `legal_research:create`.
- The body is a strict empty object.
- The response is `{ status: "created" | "existing", task:
"document_conversion_semantic_review_checkpoint", documentId, checkpoint, conversionReview }`.
- The command only works for the latest same-matter `document_analysis_status`
  conversion-review artifact when it is `ready_for_review` or `reviewed`.
- The command is idempotent for the same conversion-review artifact by returning the existing
  same-matter semantic checkpoint instead of creating a duplicate.
- `conversionReview.semanticReviewReadiness` now includes bounded `checkpointCount` and optional
  `latestCheckpoint` cue data, and Documents shows an explicit Create checkpoint action only when
  readiness is ready and no checkpoint exists.

## Boundary

- Checkpoints use existing `LegalResearchArtifactRecord` rows with `kind: "review_checkpoint"`,
  `status: "ready_for_review"`, fixed title, no note, no source references, document and
  conversion-review artifact context links without private labels, and requester-owned
  `createdByUserId` plus `checkpoint.assignedUserId`.
- Checkpoint metadata is limited to IDs, counts/lengths, statuses, timestamps, reviewer metadata,
  and fixed ready/review-only/metadata-only/no-provider/no-raw-text/no-downstream flags.
- The route does not execute providers, enqueue jobs, read object bodies, read document text
  extractions, store raw text, store Markdown, store annotations, store chunks, store embeddings,
  store prompts, store provider payloads, store storage keys, store generated summaries, or mutate
  downstream source records.
- No schema migration, dependency, provider integration, worker processor, automatic checkpoint
  creation, copied source, vendored asset, or reference-derived code was added.
- Synthetic data only. No client, matter, credential, payment, private deployment, privileged
  document, provider payload, object body, storage key, prompt, chunk, embedding, Markdown,
  annotation, private excerpt, or generated summary was added to durable proof metadata.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/review.ts
apps/api/src/routes/document-processing/semantic-checkpoints.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/document-processing/workbench.ts
apps/api/src/routes/legal-research.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/dashboard/documents-section.tsx
apps/web/app/document-processing-dashboard.ts
apps/web/app/types.ts
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_CHECKPOINTS_PROOF_2026-06-29.md
docs/validation/README.md
packages/database/test/repository.drafts.test.ts
packages/domain/src/legal-research.test.ts
packages/domain/src/legal-research.ts
scripts/route-authorization-manifest.mjs
```

## Focused Development Proof

```text
PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/providers build
PASS pnpm --filter @open-practice/domain exec vitest run src/legal-research.test.ts --reporter=verbose
  - Vitest reported 1 file and 6 tests passed.
PASS pnpm --filter @open-practice/database exec vitest run test/repository.drafts.test.ts --reporter=verbose
  - Vitest reported 1 file and 4 tests passed.
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "semantic review checkpoint|conversion review" --reporter=verbose
  - Final filtered run reported 17 selected tests passed and 19 cases outside the filter because the filter selected conversion-review/checkpoint cases only.
  - The checkpoint creation test overrides getDocumentTextExtractions to throw, proving the route does not read extraction text.
PASS pnpm --filter @open-practice/web exec vitest run app/dashboard/documents-section.test.tsx app/dashboard-client.test.ts --reporter=verbose
  - Final focused web run reported 2 files and 82 tests passed.
```

## Selector Output

```text
$ pnpm verify:select -- --files apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing/queue.ts apps/api/src/routes/document-processing/review.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/document-processing/workbench.ts apps/api/src/routes/document-processing/semantic-checkpoints.ts apps/api/src/routes/legal-research.ts apps/web/app/_features/document-processing/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/documents-section.test.tsx apps/web/app/dashboard/documents-section.tsx apps/web/app/document-processing-dashboard.ts apps/web/app/types.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_CHECKPOINTS_PROOF_2026-06-29.md packages/database/test/repository.drafts.test.ts packages/domain/src/legal-research.test.ts packages/domain/src/legal-research.ts scripts/route-authorization-manifest.mjs
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                                    | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                                           | Pass    | Selected architecture, API contract, format, docs, policy, full tests, package tests/typechecks/builds, migrations, and full build for the final 23-path set.                                                                                                                                                                                                                     |
| Focused domain/database/API/web commands                                                                                                                   | Pass    | Focused commands passed after formatting: domain legal-research test 1 file/6 tests; database repository drafts test 1 file/4 tests; API conversion-review/checkpoint filter 17 selected tests with 19 cases outside the filter; web documents/dashboard-client test 2 files/82 tests.                                                                                            |
| `pnpm architecture:check`                                                                                                                                  | Pass    | Architecture import policy passed with 466 workspace import edges reviewed.                                                                                                                                                                                                                                                                                                       |
| `pnpm api:contract`                                                                                                                                        | Pass    | API contract inventory wrote `.tmp/api-contract/openapi.json` with 347 paths.                                                                                                                                                                                                                                                                                                     |
| `pnpm format:check`                                                                                                                                        | Pass    | Full Prettier check passed after final proof formatting.                                                                                                                                                                                                                                                                                                                          |
| `pnpm docs:check`                                                                                                                                          | Pass    | Documentation link validation passed after final proof update.                                                                                                                                                                                                                                                                                                                    |
| `pnpm policy:check`                                                                                                                                        | Blocked | Reason: unrelated OSS reference-lock drift. The command passed tracked-secret, package-manifest, lockfile supply-chain, toolchain, env surface, architecture, dead-code, migration parity, and migration lint checks before `node scripts/validate-oss-reuse.mjs` failed because 21 existing `docs/oss-references.lock.json` commits no longer match the central reference index. |
| `pnpm test`                                                                                                                                                | Pass    | Turbo workspace tests and script tests passed. Workspace package tests passed for domain, database, providers, web, worker, and API; script tests reported 35 suites and 182 tests passed.                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain test`                                                                                                                 | Pass    | Exact selected command passed with 33 files and 280 tests.                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                                                                            | Pass    | Domain TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/domain build`                                                                                                                | Pass    | Domain build passed.                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm --filter @open-practice/database test`                                                                                                               | Pass    | Exact selected command passed with 29 files and 167 tests.                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/database db:check`                                                                                                           | Pass    | Drizzle check passed.                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm migrations:check`                                                                                                                                    | Pass    | Migration parity passed with 78 SQL files and 78 journal entries.                                                                                                                                                                                                                                                                                                                 |
| `pnpm migrations:lint`                                                                                                                                     | Pass    | Migration lint passed with 0 changed SQL migration files reviewed.                                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @open-practice/database typecheck`                                                                                                          | Pass    | Database TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm --filter @open-practice/database build`                                                                                                              | Pass    | Database build passed.                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter @open-practice/api test`                                                                                                                    | Pass    | Exact selected command passed with 43 files and 636 tests.                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/api typecheck`                                                                                                               | Pass    | API TypeScript check passed.                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @open-practice/providers test`                                                                                                              | Pass    | Exact selected command passed with 13 files and 37 tests.                                                                                                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/worker test`                                                                                                                 | Pass    | Exact selected command passed with 6 files and 54 tests.                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @open-practice/web test`                                                                                                                    | Pass    | Exact selected command passed with 46 files and 246 tests.                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/web typecheck`                                                                                                               | Pass    | Web TypeScript check initially found a fixture literal-widening issue in `documents-section.test.tsx`; after const-asserting the checkpoint cue fixture, the exact selected command passed.                                                                                                                                                                                       |
| `pnpm build`                                                                                                                                               | Pass    | Turbo build passed with 6 successful package build tasks; 3 were cache hits.                                                                                                                                                                                                                                                                                                      |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_SEMANTIC_REVIEW_CHECKPOINTS_PROOF_2026-06-29.md --files <final path set>` | Pass    | Reconciliation passed with the same selected command set and 23 scoped paths.                                                                                                                                                                                                                                                                                                     |
| `git diff --check`                                                                                                                                         | Pass    | Whitespace/error check passed after proof reconciliation.                                                                                                                                                                                                                                                                                                                         |

## Notes

- Work was done in a clean sibling worktree because the root checkout was already on
  `codex/billing-exception-auth-evidence-matrix` with unrelated billing/domain edits.
- The root checkout was not modified.
