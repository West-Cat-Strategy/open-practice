# OP-T143 Object-Storage Encryption Follow-Up Proof

Date: 2026-06-02 PDT

## Scope

Implemented the smallest post-OP-T143 object-storage encryption follow-up:

- Added optional `S3_SERVER_SIDE_ENCRYPTION=AES256` parsing for API and worker runtimes, with
  production readiness checks requiring it whenever complete S3 configuration is present.
- Threaded the optional SSE-S3 setting through existing API and worker `s3` dependencies without
  changing repository contracts, response shapes, database schema, migrations, or package
  dependencies.
- Updated generated draft export writes so server-owned PDF/DOCX object uploads request
  `ServerSideEncryption: "AES256"` when configured while preserving checksum, storage key,
  generated-document, document-upload, and audit metadata contracts.
- Updated inbound-email worker storage so configured runs re-write the existing raw message object in
  place with same-key `CopyObjectCommand`/`MetadataDirective: "COPY"` and apply the same SSE-S3
  setting to parsed HTML and attachment object writes.
- Updated staff document uploads, public external-upload intents, and public intake-form upload
  intents so configured presigned PUTs require `x-amz-server-side-encryption: AES256`; completion
  verifies the storage-reported encryption alongside checksum and byte size before marking uploads
  verified.
- Documented the runtime setting, production gate, and MinIO KMS/KES requirement.

Out of scope: app-side object envelope encryption, bucket policy management, broader
PII/email/billing/trust encryption, key rotation, and proactive migration of historical objects.

## Changed Paths

- `.env.example`
- `apps/api/src/routes/drafts.test.ts`
- `apps/api/src/routes/drafts.ts`
- `apps/api/src/routes/documents.test.ts`
- `apps/api/src/routes/documents.ts`
- `apps/api/src/routes/external-uploads.test.ts`
- `apps/api/src/routes/external-uploads.ts`
- `apps/api/src/routes/intake-forms.test.ts`
- `apps/api/src/routes/intake-forms.ts`
- `apps/api/src/routes/types.ts`
- `apps/api/src/routes/upload-verification.ts`
- `apps/api/src/server.test.ts`
- `apps/api/src/server.ts`
- `apps/worker/src/processors/inbound-email.test.ts`
- `apps/worker/src/processors/inbound-email.ts`
- `apps/worker/src/processors.ts`
- `apps/worker/src/queues.test.ts`
- `apps/worker/src/worker.ts`
- `docs/api-and-state-machines.md`
- `docs/deployment-hardening.md`
- `docs/planning-and-progress.md`
- `docs/tech-stack.md`
- `docs/validation/OP-T143_OBJECT_STORAGE_ENCRYPTION_FOLLOWUP_PROOF_2026-06-02.md`
- `docs/validation/README.md`

## Validation

Selector run against the final changed-path set:

```sh
pnpm verify:select -- --files .env.example apps/api/src/routes/drafts.test.ts apps/api/src/routes/drafts.ts apps/api/src/routes/documents.test.ts apps/api/src/routes/documents.ts apps/api/src/routes/external-uploads.test.ts apps/api/src/routes/external-uploads.ts apps/api/src/routes/intake-forms.test.ts apps/api/src/routes/intake-forms.ts apps/api/src/routes/types.ts apps/api/src/routes/upload-verification.ts apps/api/src/server.test.ts apps/api/src/server.ts apps/worker/src/processors.ts apps/worker/src/processors/inbound-email.test.ts apps/worker/src/processors/inbound-email.ts apps/worker/src/queues.test.ts apps/worker/src/worker.ts docs/api-and-state-machines.md docs/deployment-hardening.md docs/planning-and-progress.md docs/tech-stack.md docs/validation/OP-T143_OBJECT_STORAGE_ENCRYPTION_FOLLOWUP_PROOF_2026-06-02.md docs/validation/README.md
```

Selector output:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm build`

Final validation results:

- `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed: secret scan, package manifest policy, migration parity, OSS reuse,
  documentation links, and boundary policy.
- `pnpm --filter @open-practice/api test` passed: 41 files, 451 tests.
- `pnpm --filter @open-practice/api typecheck` passed.
- `pnpm --filter @open-practice/worker test` passed: 3 files, 34 tests.
- `pnpm --filter @open-practice/worker typecheck` passed.
- `pnpm --filter @open-practice/worker build` passed.
- `pnpm build` passed: 6 Turbo build tasks successful.
