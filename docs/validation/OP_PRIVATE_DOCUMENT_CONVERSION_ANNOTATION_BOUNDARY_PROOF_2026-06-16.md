# Private Document Conversion And Annotation Boundary Proof - 2026-06-16

## Scope

- Branch: `codex/private-document-conversion-boundary-2026-06-16`
- Worktree: `/Users/bryan/projects/open-practice-private-doc-boundary-2026-06-16`
- Base: `origin/main` at `a7765463`

This docs-first slice records the private document conversion and annotation boundary for future
local-only prototypes:

- OCR remains the only actionable document-processing queue in the current API.
- Document conversion, annotation, chunking, Markdown extraction, semantic review, and
  provider-backed extraction remain reserved/deferred.
- Future retained state may include only OP-authored redacted summaries, counts, statuses, and
  posture metadata.
- Raw client text, raw converted Markdown, raw annotations, provider payloads, prompts, sensitive
  chunks, embeddings, storage keys, object bodies, and private excerpts must stay out of job
  metadata, audit metadata, API posture, and proof notes.
- MarkItDown, Unstructured, Zerox, OpenContracts, paperless-ngx, and Papermerge remain clean-room
  reference inputs unless a later reuse decision documents source, commit/tag, license, reuse
  class, touched files, upstream files or APIs referenced, notices, reviewer, and date.

No API, database, worker, provider, route, schema, package manifest, dependency, runtime prototype,
or reference-derived source changed in this slice.

## Runtime Follow-Up

This proof remains the historical docs-first boundary record. The later same-day local-only runtime
prototype is recorded in
[Document Conversion Review Runtime Prototype Proof](OP_DOCUMENT_CONVERSION_REVIEW_RUNTIME_PROTOTYPE_PROOF_2026-06-16.md).
That follow-up keeps the same no-raw-client-text/no-raw-Markdown/no-annotation/no-provider-payload
boundary while adding metadata-only `document_conversion_review` posture.

## Changed Paths

- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/license-policy.md`
- `docs/planning-and-progress.md`
- `docs/threat-model.md`
- `docs/validation/README.md`
- `docs/validation/OP_PRIVATE_DOCUMENT_CONVERSION_ANNOTATION_BOUNDARY_PROOF_2026-06-16.md`

## Validation

Selector command:

```bash
pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/license-policy.md docs/planning-and-progress.md docs/threat-model.md docs/validation/README.md docs/validation/OP_PRIVATE_DOCUMENT_CONVERSION_ANNOTATION_BOUNDARY_PROOF_2026-06-16.md
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

## Privacy, Reuse, And Boundary Notes

- Synthetic wording only; no client, matter, credential, payment, private deployment, privileged
  document, raw OCR text, converted Markdown, annotation body, provider payload, prompt, embedding,
  sensitive chunk, storage key, object body, or private excerpt was added.
- Reference profiles and existing Open Practice reuse policy informed the boundary, but no
  reference source, schema, migration, test, UI, style, asset, sample document, or distinctive prose
  was copied.
- The boundary does not make production compliance, records-disposition, extraction-fidelity,
  semantic-search, or model-provider claims.
