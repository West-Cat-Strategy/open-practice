# OP-T115 Document Ingest Metadata Search Proof

**Date:** 2026-05-22

## Scope

Implemented the first review-only document ingest metadata search posture:

- Added optional matter-scoped workbench filters for search text, classification, review status,
  scan status, OCR status, reviewer cue group, and computed metadata tag.
- Added computed tag-like cues for OP-authored document states, legal hold, OCR status/language,
  OCR confidence bucket, and reviewer suggestion groups.
- Added a redacted `metadataSearch` posture with applied filters, total/matched counts, aggregate
  tag cues, OCR posture, and result summaries.
- Kept the slice non-mutating: no persisted tags, migrations, queue side effects, search audit
  events, full-text OCR search, semantic search, annotation, or document metadata writes.

## Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing.test.ts apps/web/app/document-processing-dashboard.ts apps/web/app/types.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard-client.test.ts packages/domain/src/document-suggestions.ts packages/domain/src/document-suggestions.test.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/improvement-opportunities.md
```

Focused checks:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/domain exec vitest run src/document-suggestions.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts
pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm build
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

All listed checks passed after formatting the touched files. The domain package build was required
before API tests because the API imports `@open-practice/domain` through package build output.

## Privacy And Boundaries

- Synthetic test data only.
- Search posture matches document title plus OP-authored metadata/status/tag/cue labels only.
- Raw OCR text, text storage keys, document storage keys, checksums, provider payloads, tokens, and
  arbitrary private OCR metadata are neither searched nor returned.
- Result summaries remain matter-scoped and redacted to document IDs/titles, existing status fields,
  tag keys, matched field labels, cue counts, and OCR posture.
