# Provider-Backed Document Conversion Boundary Proof - 2026-06-17

## Scope

- Branch: `docs/provider-document-conversion-boundary-2026-06-17`
- Worktree: `/Users/bryan/projects/open-practice-provider-doc-conversion-boundary-2026-06-17`
- Base: local `main` at `5f15fc87`

This docs-only slice records the reviewed design boundary for future provider-backed document
conversion, annotation, chunking, embedding, and semantic-review work before runtime expansion. It
does not add or change API routes, worker processors, provider adapters, queues, package manifests,
dependencies, database schema, migrations, object-storage writes, dashboard behavior, or runtime
tests.

The current shipped runtime posture remains unchanged:

- OCR remains the only actionable document-processing queue.
- `POST /api/document-processing/documents/:documentId/conversion-review/jobs` remains the
  local-only metadata-only `document_conversion_review` path after verified upload, safe scan
  posture, and completed OCR extraction.
- Provider-backed conversion, annotation bodies, chunk storage, embeddings, retained converted
  Markdown, semantic-review providers, and object-storage writes remain reserved/deferred.

## Boundary Decisions

- Future provider-backed work must start in a separate reviewed runtime slice with local/private
  processing, matter-scoped authorization, verified upload, safe scan posture, and documented
  license/reuse decisions before any provider or optional service is admitted.
- Provider-specific conversion, annotation, chunking, embedding, and semantic-review execution
  belongs behind worker/provider boundaries; provider details must not leak into domain rules.
- Durable job lifecycle metadata, audit metadata, API posture, legal-research artifacts, and proof
  notes may retain only IDs, counts, length bands, status/posture labels, policy flags, provider
  kind/status, idempotency-key presence, and reviewer state.
- Raw client text, raw OCR text, converted Markdown, annotation bodies or spans, prompts, chunks,
  embedding vectors, storage keys, object bodies, provider payloads, private excerpts, and free-form
  generated summaries must not enter job metadata, audit metadata, API posture, artifacts, or proof
  notes.
- Semantic-review output remains reviewer-only and non-mutating until a later runtime slice proves
  the same boundary; it must not automatically change document classification, drafts, matters,
  messages, tasks, calendar items, ledger records, or portal access.
- MarkItDown, Unstructured, Zerox, OpenContracts, paperless-ngx, and Papermerge remain clean-room
  reference inputs only unless a later reuse decision records source, commit/tag, license, reuse
  class, touched files, upstream files or APIs referenced, notices, reviewer, and decision date.

## Changed Paths

- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/license-policy.md`
- `docs/planning-and-progress.md`
- `docs/threat-model.md`
- `docs/validation/README.md`
- `docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md`

## Validation

Selector command:

```bash
pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/license-policy.md docs/planning-and-progress.md docs/threat-model.md docs/validation/README.md docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Final validation:

```text
PASS pnpm format:check
  - All matched files use Prettier code style.
PASS pnpm docs:check
  - Documentation link validation passed.
PASS pnpm policy:check
  - Tracked-secret scan, package manifest dependency policy, dead-code check, migration parity,
    OSS reuse policy validation, doc links, validation proof index, local-evidence Docker ignore
    validation, and Open Practice boundary policy passed.
PASS git diff --check
```

Skipped checks:

- Runtime package tests, typechecks, builds, database checks, provider checks, worker checks, and
  browser/Docker E2E were not run because the selector saw only documentation/proof paths and this
  slice intentionally changed no API, worker, provider, database, web, package, migration, or
  runtime code.

## Privacy, Reuse, And Boundary Notes

- Synthetic wording only; no client, matter, credential, payment, private deployment, privileged
  document, raw OCR text, converted Markdown, annotation body/span, provider payload, prompt,
  embedding, chunk, storage key, object body, generated summary, or private excerpt was added.
- Existing Open Practice runtime tests and proof notes remain the current-state evidence for the
  metadata-only `document_conversion_review` path; this slice intentionally does not edit runtime
  redaction code or test fixtures.
- The boundary does not make production compliance, records-disposition, extraction-fidelity,
  semantic-search, vector-storage, or model-provider claims.
