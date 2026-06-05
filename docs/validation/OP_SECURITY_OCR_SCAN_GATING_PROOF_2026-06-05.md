# OCR Scan-Gating Security Proof - 2026-06-05

## Scope

- Branch: `security/ocr-scan-gating-2026-06-05`
- Worktree: `/Users/bryan/projects/open-practice-ocr-scan-gating`
- Base: `main` / `origin/main` at `696df7c3181afe77c3f5e048143a7d146ca6d357`
- Source branch inspected: `security/full-scan-remediation-2026-06-05` at
  `2b9988816f8a3cb883c01b1b8e66e567246e3ef0`

This standalone slice ports only the scan-safe OCR gating behavior from the broader full-scan
remediation lane:

- document-processing OCR queueing now requires verified upload state, verified or duplicate
  checksum state, and scan status `passed` or `not_required`;
- the document-processing workbench reports non-passed scan states as `scan_required`;
- worker OCR jobs recheck scan state before reading object storage or invoking the OCR provider;
- inbound-email attachment promotion no longer queues OCR automatically, rejects explicit OCR
  requests before promotion, and returns redacted attachment/document payloads without storage keys.

## Changed Paths

- `apps/api/src/routes/document-processing.ts`
- `apps/api/src/routes/document-processing.test.ts`
- `apps/api/src/routes/inbound-email.ts`
- `apps/api/src/routes/inbound-email.test.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/processors.test.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_SECURITY_OCR_SCAN_GATING_PROOF_2026-06-05.md`

## Validation

Selector command:

```bash
pnpm verify:select -- --files apps/api/src/routes/document-processing.ts apps/api/src/routes/document-processing.test.ts apps/api/src/routes/inbound-email.ts apps/api/src/routes/inbound-email.test.ts apps/worker/src/processors.ts apps/worker/src/processors.test.ts docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_SECURITY_OCR_SCAN_GATING_PROOF_2026-06-05.md
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
```

Final validation:

```text
PASS pnpm format:check
PASS pnpm docs:check
PASS pnpm policy:check
PASS pnpm --filter @open-practice/api test
  - 41 test files passed; 482 tests passed
PASS pnpm --filter @open-practice/api typecheck
PASS pnpm --filter @open-practice/worker test
  - 3 test files passed; 36 tests passed
PASS pnpm --filter @open-practice/worker typecheck
PASS pnpm --filter @open-practice/worker build
PASS git diff --check
```

Fresh-worktree bootstrap note:

- The first `pnpm --filter @open-practice/api test` attempt failed before collecting tests because
  local package build outputs for `@open-practice/domain` and `@open-practice/database` were not
  present in the new worktree. After running `pnpm --filter @open-practice/domain build`,
  `pnpm --filter @open-practice/database build`, and `pnpm --filter @open-practice/providers build`,
  the API test rerun passed as recorded above.

## Residuals And Exclusions

- The broad `security/full-scan-remediation-2026-06-05` branch remains unpruned because it still
  contains out-of-scope full-scan remediation work.
- Docker image/base updates, production CORS/auth hardening, audit sequence migration, broad route
  changes, web changes, Docker maintenance docs, and same-matter duplicate-checksum repository
  changes are excluded from this branch.
- No client, matter, credential, private deployment, raw MIME, OCR text, object-storage body, or
  signing material was added to the proof.
