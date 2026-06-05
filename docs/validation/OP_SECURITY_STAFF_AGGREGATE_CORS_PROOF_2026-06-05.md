# Staff Aggregate And CORS Carve-Out Proof - 2026-06-05

## Scope

- Branch: `security/staff-aggregate-cors-2026-06-05`
- Base: `main` / `origin/main` at `696df7c3181afe77c3f5e048143a7d146ca6d357`
- Source lane preserved: `security/full-scan-remediation-2026-06-05`
- Data posture: synthetic users, matters, billing records, and origins only. No client, matter,
  credential, payment, private deployment, raw MIME, signing, storage-key, or private note material
  was added to proof or tests.

This note records the smallest coherent carve-out from the 2026-06-05 full-scan remediation branch:
staff aggregate authorization, authenticated production CORS narrowing, one directly coupled web
billing-denied fallback, and the matching API/workboard/proof updates.

## Fixed Boundary

- `requireStaffAccess(...)` denies `client_external` users before staff aggregate/list routes load
  broad matter, queue, task, operational-view, intake, signature, or billing data.
- Matter-scoped billing, intake, and signature reads keep their existing matter authorization
  behavior; the new guard is applied only to broad staff aggregates without `matterId`.
- Production credentialed authenticated CORS now accepts only normalized configured web origins from
  `PUBLIC_WEB_BASE_URL` and `WEBAUTHN_ORIGIN`; arbitrary localhost browser origins remain limited to
  development and e2e support.
- Public consultation intake CORS remains scoped to `POST /api/public/consultation-intakes`.
- The web billing access-denied fallback now returns an empty `canView: false` billing response
  instead of preserving matter-derived fallback rows.

## Out Of Scope

The wider full-scan branch also contains Docker/image, worker, database, audit sequencing,
inbound-email redaction, document-processing/OCR, calendar guest-token logging, provider-status,
and formal scan-report evidence. Those changes are intentionally excluded from this carve-out.

## Changed Paths

```text
apps/api/src/http/auth-guards.ts
apps/api/src/routes/billing.ts
apps/api/src/routes/billing.test.ts
apps/api/src/routes/intake.ts
apps/api/src/routes/intake.test.ts
apps/api/src/routes/matters.ts
apps/api/src/routes/matters.test.ts
apps/api/src/routes/operational-views.ts
apps/api/src/routes/operational-views.test.ts
apps/api/src/routes/queues.ts
apps/api/src/routes/queues.test.ts
apps/api/src/routes/signatures.ts
apps/api/src/routes/signatures.test.ts
apps/api/src/routes/tasks.ts
apps/api/src/routes/tasks.test.ts
apps/api/src/server.ts
apps/api/src/server.test.ts
apps/web/app/page.tsx
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/README.md
docs/validation/OP_SECURITY_STAFF_AGGREGATE_CORS_PROOF_2026-06-05.md
```

## Validation

Selector and final gates:

```bash
pnpm verify:select -- --files apps/api/src/http/auth-guards.ts apps/api/src/routes/billing.ts apps/api/src/routes/billing.test.ts apps/api/src/routes/intake.ts apps/api/src/routes/intake.test.ts apps/api/src/routes/matters.ts apps/api/src/routes/matters.test.ts apps/api/src/routes/operational-views.ts apps/api/src/routes/operational-views.test.ts apps/api/src/routes/queues.ts apps/api/src/routes/queues.test.ts apps/api/src/routes/signatures.ts apps/api/src/routes/signatures.test.ts apps/api/src/routes/tasks.ts apps/api/src/routes/tasks.test.ts apps/api/src/server.ts apps/api/src/server.test.ts apps/web/app/page.tsx docs/api-and-state-machines.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_SECURITY_STAFF_AGGREGATE_CORS_PROOF_2026-06-05.md
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Results:

- `pnpm verify:select -- --files ...`: passed; selected `pnpm format:check`,
  `pnpm docs:check`, `pnpm policy:check`, API test/typecheck, web test/typecheck, and `pnpm build`.
- `pnpm format:check`: initial run found only `docs/validation/README.md` table alignment; fixed
  with `pnpm exec prettier --write docs/validation/README.md`, then reran successfully.
- `pnpm docs:check`: passed.
- `pnpm policy:check`: passed, including tracked-secret scan, package-manifest policy, migration
  parity, OSS reuse validation, docs links, and boundary policy.
- `pnpm --filter @open-practice/api test`: passed, 41 files and 490 tests.
- `pnpm --filter @open-practice/api typecheck`: passed.
- `pnpm --filter @open-practice/web test`: passed, 20 files and 140 tests.
- `pnpm --filter @open-practice/web typecheck`: passed.
- `pnpm build`: passed, 6 packages built successfully.
- Final post-proof reruns of `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and
  `git diff --check`: passed.
- Skipped checks: none.
