# OP-T114 OCR Rollout And Permission-Aware Availability Proof

**Date:** 2026-05-22

## Scope

Implemented the OCR rollout and permission-aware availability review:

- Replaced generic disabled navigation copy with section-specific availability reasons and locked
  the sample-role matrix for owner/admin, licensee, and firm member dashboards.
- Added owner/admin `PUT /api/document-processing/ocr-provider` for firm-scoped local Tesseract
  posture without returning provider config or secrets.
- Aligned document-processing status authorization so firm-wide posture is operator-scoped while
  the workbench remains matter-scoped.
- Required an enabled OCR provider plus configured OCR queue before document queueing or inbound
  attachment promotion can create jobs or promoted documents.
- Added the Queues Provider posture OCR enable/disable action and kept non-operators read-only.
- Kept reserved AI triage, transcription, and media queues deferred.

## Validation

Selector:

```bash
pnpm verify:select -- --files $(git diff --name-only) $(git ls-files --others --exclude-standard)
```

Focused checks:

```bash
pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts src/routes/inbound-email.test.ts src/routes/providers-status.test.ts
pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts routes/routeCatalog.test.ts
pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts
pnpm --filter @open-practice/domain exec vitest run src/audit-taxonomy.test.ts
pnpm --filter @open-practice/api exec vitest run src/server.test.ts src/routes/document-processing.test.ts src/routes/inbound-email.test.ts src/routes/providers-status.test.ts
```

Package and repo checks:

```bash
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/worker typecheck
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm build
```

All listed checks passed after the CORS preflight fix for `PUT` dashboard API calls.

## Synthetic Smoke

The local Docker stack was rebuilt for `api`, `web`, and `worker` before smoke testing.

API smoke used a synthetic S3-backed PNG document:

- Queueing before OCR provider enablement returned `503` and created no BullMQ jobs or lifecycle
  rows.
- Owner/admin enabled the local OCR provider through
  `PUT /api/document-processing/ocr-provider`.
- Queueing then returned `queued`.
- The worker completed the OCR job and created one extraction record.
- Status/workbench responses did not expose provider config, S3 credentials, storage keys, tokens,
  or extracted text.

Browser smoke used the Queues Provider posture panel:

- The Local OCR provider row rendered as `Provider configured · OCR queue configured`.
- Clicking `Disable OCR` sent `PUT /api/document-processing/ocr-provider`, returned `200`, and
  updated the row to `Provider disabled · OCR queue configured`.
- Clicking `Enable OCR` sent the same route, returned `200`, and restored the configured posture.
- Residual browser console output was limited to the existing production hydration warning and
  favicon 404; the prior CORS `PUT` preflight failure was gone.

## Privacy And Boundaries

- Synthetic local matter/document data only.
- No provider config, secrets, tokens, storage keys, raw OCR text, or document body content in API
  status, job posture, audit metadata, UI summaries, or this proof note.
- Role model remained intact; disabled sections were not made clickable by widening permissions.
