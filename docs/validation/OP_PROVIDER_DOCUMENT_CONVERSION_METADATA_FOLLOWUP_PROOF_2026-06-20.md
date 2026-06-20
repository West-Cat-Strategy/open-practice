# Provider Document Conversion Metadata Follow-Up Proof - 2026-06-20

## Scope

- Branch: `codex/provider-document-conversion-metadata-2026-06-20`
- Worktree: `/Users/bryan/projects/open-practice-provider-doc-conversion-metadata-2026-06-20`
- Base: local `main` at `2873e38f`

This runtime follow-up adds the smallest provider-backed posture under the reviewed provider
document conversion boundary. It keeps the existing
`POST /api/document-processing/documents/:documentId/conversion-review/jobs` route, OCR queue reuse,
`jobName: document_conversion_review`, and `document_analysis_status` artifact path.

## Boundary Decisions

- `packages/providers` now includes a dependency-free local document-conversion metadata provider.
  It may receive OCR text transiently inside the worker process, but it returns only OP-authored
  metadata: provider/status posture, counts, lengths, `summaryPosture:
op_authored_metadata_only`, policy flags, and review posture.
- The worker records provider/status posture beside the existing count/status metadata in job
  results and `document_analysis_status` artifacts.
- The API exposes the same compact conversion-review summary with safe provider/status posture.
- Durable metadata and proof notes still exclude raw client text, raw OCR text, converted Markdown,
  annotation bodies/spans, prompts, chunks, embeddings/vectors, storage keys, object bodies,
  provider payloads, private excerpts, and free-form generated summaries.
- This slice adds no external provider SDK, schema, migration, object-storage write, new queue, new
  route, real provider configuration requirement, dashboard behavior, semantic review, chunking, or
  embeddings.

## Changed Paths

- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing/queue.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors/ocr.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/providers/src/document-conversion.ts`
- `packages/providers/src/index.ts`
- `packages/providers/test/providers.test.ts`

## Validation

Selector command:

```bash
pnpm verify:select -- --files docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_METADATA_FOLLOWUP_PROOF_2026-06-20.md packages/providers/src/document-conversion.ts apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/queue.ts apps/api/src/routes/document-processing/shared.ts apps/worker/src/processors.test.ts apps/worker/src/processors/ocr.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md packages/domain/src/permissions.test.ts packages/domain/src/permissions.ts packages/providers/src/index.ts packages/providers/test/providers.test.ts
```

Selector output:

```text
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
```

Final validation:

```text
PASS pnpm architecture:check
  - Architecture import policy passed: 438 workspace import edges reviewed.
PASS pnpm api:contract
  - API contract inventory wrote .tmp/api-contract/openapi.json with 308 paths.
PASS pnpm format:check
  - All matched files use Prettier code style.
PASS pnpm docs:check
  - Documentation link validation passed.
PASS pnpm policy:check
  - Tracked-secret scan, dependency/package policy, toolchain/env surface, architecture,
    dead-code, migration, OSS reuse, doc links, validation proof index, local-evidence Docker
    ignore, and Open Practice boundary checks passed.
PASS pnpm --filter @open-practice/domain test
  - Vitest reported 31 files and 229 tests passed.
PASS pnpm --filter @open-practice/domain typecheck
PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/api test
  - Vitest reported 42 files and 571 tests passed.
PASS pnpm --filter @open-practice/api typecheck
PASS pnpm --filter @open-practice/providers test
  - Vitest reported 11 files and 23 tests passed.
PASS pnpm --filter @open-practice/providers typecheck
PASS pnpm --filter @open-practice/providers build
PASS pnpm --filter @open-practice/worker test
  - Vitest reported 5 files and 46 tests passed.
PASS pnpm --filter @open-practice/worker typecheck
PASS pnpm --filter @open-practice/worker build
PASS git diff --check
```

Additional focused validation while developing:

```text
PASS pnpm --filter @open-practice/domain test -- permissions.test.ts
  - Vitest reported 31 files and 229 tests passed.
PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/providers build
PASS pnpm --filter @open-practice/providers test
  - Vitest reported 11 files and 23 tests passed.
PASS pnpm --filter @open-practice/worker test -- processors.test.ts
  - Vitest reported 5 files and 46 tests passed.
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts -t "conversion review" --reporter=verbose
  - Vitest reported the two conversion-review tests passed and 17 skipped by filter.
```

Skipped or corrected checks:

- The first provider test run failed because the fresh worktree had not built
  `@open-practice/domain`; the documented upstream package build order resolved the workspace export
  issue.
- An early API command form broadened beyond the intended file and was interrupted; the exact
  conversion-review file/filter command above is the focused API evidence for this slice.

## Privacy, Reuse, And Boundary Notes

- Test fixtures use synthetic text only.
- No client, matter, credential, payment, private deployment, privileged document, provider payload,
  object body, storage key, prompt, chunk, embedding, converted Markdown, annotation body/span,
  private excerpt, or generated summary was added to durable metadata or proof text.
- The local provider adapter is original Open Practice code and adds no dependency or copied
  reference implementation.
