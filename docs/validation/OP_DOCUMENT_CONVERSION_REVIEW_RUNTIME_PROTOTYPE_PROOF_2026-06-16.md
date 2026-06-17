# Document Conversion Review Runtime Prototype Proof - 2026-06-16

## Scope

- Branch: `audit/clio-parity-gap-closure-2026-06-16`
- Worktree: `/Users/bryan/projects/open-practice`
- Base: existing dirty Clio parity workflow-depth lane

This follow-up records the smallest local-only runtime prototype after the earlier
[private document conversion and annotation boundary proof](OP_PRIVATE_DOCUMENT_CONVERSION_ANNOTATION_BOUNDARY_PROOF_2026-06-16.md).
Open Practice now queues a metadata-only `document_conversion_review` job after verified upload,
safe scan posture, and completed OCR extraction. The route uses matter-scoped
`document_processing:create` authorization, reuses the existing OCR queue, and returns only compact
job status plus conversion-review posture.

The worker may read completed OCR text transiently to derive counts. Durable records are limited to
IDs, extraction status/engine, counts, lengths, OP-authored `summaryPosture:
op_authored_metadata_only`, metadata-only/review-only flags, policy flags, and review state in
redacted job lifecycle metadata and `document_analysis_status` artifacts. Documents and Research
surface posture and counts only.

## Boundary

- No provider-backed conversion, annotation body storage, chunk storage, embeddings, semantic-review
  provider, retained converted Markdown, object-storage write, dependency, package manifest change,
  database migration, or new queue was added.
- Raw client text, raw OCR text, raw converted Markdown, raw annotations, prompts, sensitive chunks,
  embeddings, storage keys, object bodies, provider payloads, private excerpts, and free-form
  generated summaries stay out of job metadata, audit metadata, API posture, artifacts, dashboard
  copy, and proof notes.
- Reference projects remain clean-room inputs only; no reference source, schema, migration, test,
  UI, style, asset, sample document, or distinctive prose was copied.

## Owned Runtime Path Set

- `apps/api/src/routes/document-processing/queue.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/document-processing/workbench.ts`
- `apps/api/src/routes/document-processing.test.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/processors/ocr.ts`
- `apps/worker/src/processors.test.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/document-processing-dashboard.ts`
- `apps/web/app/dashboard/documents-section.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/permissions.test.ts`
- `scripts/route-authorization-manifest.mjs`

## Focused Validation

```text
PASS pnpm --dir packages/domain exec vitest run src/permissions.test.ts
PASS pnpm --dir apps/api exec vitest run src/routes/document-processing.test.ts
PASS pnpm --filter @open-practice/domain build
PASS pnpm --dir apps/worker exec vitest run src/processors.test.ts
PASS pnpm --dir apps/web exec vitest run app/dashboard/documents-section.test.tsx
```

`@open-practice/domain` was rebuilt before the worker test because worker tests import the package
through its built `dist` export.

## Selector-Driven Validation

Selector command over the actual dirty changed-path set:

```bash
paths=($(git diff --name-only --diff-filter=ACMRT) $(git ls-files --others --exclude-standard))
pnpm verify:select -- --files "${paths[@]}"
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
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
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

Final validation:

```text
PASS pnpm format:check
PASS pnpm docs:check
PASS pnpm policy:check
PASS pnpm test
PASS pnpm --filter @open-practice/domain test
PASS pnpm --filter @open-practice/domain typecheck
PASS pnpm --filter @open-practice/database test
PASS pnpm --filter @open-practice/database db:check
PASS pnpm migrations:check
PASS pnpm --filter @open-practice/database typecheck
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/api test
PASS pnpm --filter @open-practice/api typecheck
PASS pnpm --filter @open-practice/providers test
PASS pnpm --filter @open-practice/worker test
PASS pnpm --filter @open-practice/worker typecheck
PASS pnpm --filter @open-practice/worker build
PASS pnpm --filter @open-practice/web test
PASS pnpm --filter @open-practice/web typecheck
PASS pnpm build
PASS git diff --check
```
