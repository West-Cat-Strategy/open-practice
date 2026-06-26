# Reliable Local PDF OCR Proof - 2026-06-24

## Scope

- Branch: `codex/reliable-local-pdf-ocr-20260624`
- Worktree: `/Users/bryan/projects/open-practice-ocr-cli-20260624`
- Base: `main` at `79e35ece`

This branch implements the approved reliable local OCR slice for PDFs and supported images:

- `OCR_PROVIDER=local_cli` now selects a local CLI-backed provider that writes S3 bytes to a temp
  file, sniffs PDF/JPEG/PNG/TIFF by magic bytes, invokes OCRmyPDF through argument arrays, and
  reads OCRmyPDF sidecar text into `document_text_extractions.extracted_text`.
- OCRmyPDF is invoked with `--skip-text --output-type none --sidecar <txt> --language eng --jobs 1`
  and the configured `--tesseract-timeout`; no confidence is fabricated when OCRmyPDF does not
  expose one.
- Existing Tesseract.js confidence is normalized to `0..1` before domain/UI-facing code sees it.
- Queue eligibility now includes `unsupported_file_type`; API/web copy may infer support from title
  or storage key, while the worker rechecks bytes and fails closed before provider invocation.
- Job, audit, workbench, evidence-packet, and artifact metadata retain only status/count/provider
  posture. Raw OCR text remains server-side only in `document_text_extractions.extracted_text` for
  authorized review/assist flows and is not returned or stored in public metadata surfaces.
- Self-hosted deployments get a dedicated optional `worker-ocr` profile with `WORKER_QUEUES=ocr`.
  The default worker queues exclude OCR, and the OCR worker fails fast when OCRmyPDF, Tesseract, or
  `eng` language data is unavailable.

Cloud OCR, vision/LLM OCR, searchable-PDF artifact storage, layout/table/form extraction, and
staff-visible raw OCR text remain deferred.

## Changed Paths

- `.env.example`
- `Dockerfile`
- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/document-processing/queue.ts`
- `apps/api/src/routes/document-processing/shared.ts`
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/api/src/routes/providers-status.test.ts`
- `apps/web/app/_features/document-processing/models.ts`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/document-processing-dashboard.ts`
- `apps/worker/src/processors.test.ts`
- `apps/worker/src/processors/ocr.ts`
- `apps/worker/src/worker.test.ts`
- `apps/worker/src/worker.ts`
- `docker-compose.selfhost.yml`
- `docker/selfhost.example.env`
- `docs/api-and-state-machines.md`
- `docs/development/getting-started.md`
- `docs/development/self-hosting.md`
- `docs/planning-and-progress.md`
- `docs/tech-stack.md`
- `docs/validation/README.md`
- `docs/validation/OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md`
- `packages/domain/src/permissions.ts`
- `packages/providers/package.json`
- `packages/providers/src/document-conversion.ts`
- `packages/providers/src/index.ts`
- `packages/providers/src/ocr/local-cli.test.ts`
- `packages/providers/src/ocr/local-cli.ts`
- `packages/providers/src/ocr/tesseract.ts`
- `packages/providers/test/providers.test.ts`
- `scripts/reconcile-validation-proof.mjs`
- `scripts/reconcile-validation-proof.test.mjs`
- `scripts/run-e2e.mjs`
- `scripts/selfhost-check.mjs`
- `scripts/selfhost-check.test.mjs`

## Validation

Selector command:

```bash
pnpm verify:select -- --files apps/worker/src/worker.test.ts docs/validation/OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md packages/providers/src/ocr/local-cli.test.ts packages/providers/src/ocr/local-cli.ts .env.example Dockerfile apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/queue.ts apps/api/src/routes/document-processing/shared.ts apps/api/src/routes/inbound-email.test.ts apps/api/src/routes/providers-status.test.ts apps/web/app/_features/document-processing/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard/documents-section.test.tsx apps/web/app/document-processing-dashboard.ts apps/worker/src/processors.test.ts apps/worker/src/processors/ocr.ts apps/worker/src/worker.ts docker-compose.selfhost.yml docker/selfhost.example.env docs/api-and-state-machines.md docs/development/getting-started.md docs/development/self-hosting.md docs/planning-and-progress.md docs/tech-stack.md docs/validation/README.md packages/domain/src/permissions.ts packages/providers/package.json packages/providers/src/document-conversion.ts packages/providers/src/index.ts packages/providers/src/ocr/tesseract.ts packages/providers/test/providers.test.ts scripts/reconcile-validation-proof.mjs scripts/reconcile-validation-proof.test.mjs scripts/run-e2e.mjs scripts/selfhost-check.mjs scripts/selfhost-check.test.mjs
```

Selector output:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm docker:lint
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm docker:scan
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm e2e:a11y
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Selected validation:

```text
PASS pnpm verify:select -- --files <37 final changed paths>
PASS pnpm --filter @open-practice/domain build
PASS pnpm --filter @open-practice/database build
PASS pnpm --filter @open-practice/providers build
PASS pnpm --filter @open-practice/providers exec vitest run src/ocr/local-cli.test.ts test/providers.test.ts
  - 2 test files passed; 12 tests passed.
PASS pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts src/worker.test.ts
  - 2 test files passed; 30 tests passed.
PASS pnpm --filter @open-practice/api exec vitest run src/routes/document-processing.test.ts src/routes/providers-status.test.ts src/routes/inbound-email.test.ts
  - 3 test files passed; 75 tests passed.
PASS pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts app/dashboard/documents-section.test.tsx
  - 2 test files passed; 79 tests passed.
PASS pnpm --filter @open-practice/domain exec vitest run src/permissions.test.ts
  - 1 test file passed; 25 tests passed.
PASS pnpm exec node --test scripts/selfhost-check.test.mjs scripts/run-e2e.test.mjs scripts/reconcile-validation-proof.test.mjs
  - 15 tests passed.
PASS pnpm --filter @open-practice/domain typecheck
PASS pnpm --filter @open-practice/providers typecheck
PASS pnpm --filter @open-practice/api typecheck
PASS pnpm --filter @open-practice/web typecheck
PASS pnpm --filter @open-practice/worker typecheck
PASS pnpm --filter @open-practice/worker build
PASS pnpm format:check
PASS pnpm docs:check
PASS pnpm policy:check
PASS pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
PASS git diff --check
PASS pnpm proof:reconcile -- --files <37 final changed paths> --proof docs/validation/OP_RELIABLE_LOCAL_PDF_OCR_PROOF_2026-06-24.md
  - Paths: 37; result passed.
PASS pnpm docker:lint
  - Evidence directory: `.tmp/docker/lint/2026-06-26T04-45-45Z`.
PASS docker build --target worker-ocr --build-arg APP_NAME=@open-practice/worker -t open-practice-worker-ocr:test .
PASS docker run --rm open-practice-worker-ocr:test ocrmypdf --version
  - Reported `16.11.1`.
PASS docker run --rm open-practice-worker-ocr:test tesseract --list-langs
  - Reported `eng`.
PASS pnpm docker:app-smoke
  - PostgreSQL-backed API health, web root, and API setup status passed.
PASS pnpm api:contract
  - Wrote `.tmp/api-contract/openapi.json` with 310 paths.
PASS pnpm build
  - Turbo build completed 6 successful workspace tasks.
PASS pnpm e2e:docker
  - 3 Playwright Docker tests passed in 40.7 seconds.
```

Selection note:

- The selector recommended the broad repo ladder. This branch used focused OCR-owned package tests,
  package typechecks/builds, API contract generation, the full workspace build, self-host checks,
  Docker lint/smoke/E2E, OCR worker image validation, docs/format/policy gates, proof
  reconciliation, and script tests for the touched validation helper. The remaining broad repo
  commands were not rerun because the selected checks exercise the changed provider, worker, API,
  web, self-host, Docker, and proof surfaces directly.

Fresh closeout note:

- The 2026-06-26 closeout rerun started by hydrating `@open-practice/domain`,
  `@open-practice/database`, and `@open-practice/providers` before downstream API, worker, and web
  validation. Docker Desktop was started locally before Docker lint/smoke/E2E and worker-image
  checks; all recorded Docker checks passed.

## Privacy, Reuse, And Boundary Notes

- Synthetic data only; no client, matter, credential, payment, private deployment, privileged
  document body, provider payload, storage key, object body, or raw OCR text was added to proof
  artifacts.
- OCRmyPDF, Tesseract, Ghostscript, and Poppler are recorded as optional wrapped runtime tooling in
  `docs/tech-stack.md`; the non-OCR app/runtime can still start without the OCR toolchain unless
  the OCR worker queue is explicitly enabled.
- OCR remains limited to `eng` for this slice. Future cloud OCR, LLM/vision OCR, searchable-PDF
  artifact retention, layout extraction, and staff-visible raw OCR text require separate privacy,
  provider, and reuse review.
