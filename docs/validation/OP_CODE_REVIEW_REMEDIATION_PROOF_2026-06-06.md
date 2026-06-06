# OP Code Review Remediation Proof - 2026-06-06

## Scope

Branch: `codex/code-review-remediation-2026-06-06`

Topic commit: `5898110`
Mainline merge commit before proof closeout: `91d0d11`

Implemented the code-review remediation plan with synthetic-only fixtures and no new dependencies. The change keeps legacy public-token path routes for compatibility while adding header-token transport, safe URL scrubbing, stricter validation, persistence correctness, policy gates, and validation proof.

## Changed Paths

```text
.dockerignore
apps/api/src/http/auth-guards.ts
apps/api/src/http/auth-helpers.ts
apps/api/src/http/http.test.ts
apps/api/src/routes/auth.ts
apps/api/src/routes/calendar.test.ts
apps/api/src/routes/calendar.ts
apps/api/src/routes/documents.ts
apps/api/src/routes/drafts.ts
apps/api/src/routes/email.ts
apps/api/src/routes/external-uploads.test.ts
apps/api/src/routes/external-uploads.ts
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake-forms.ts
apps/api/src/routes/intake-pipeline.ts
apps/api/src/routes/matters.ts
apps/api/src/routes/public-consultation-intakes.ts
apps/api/src/routes/recovery.ts
apps/api/src/routes/setup.ts
apps/api/src/routes/shares.test.ts
apps/api/src/routes/shares.ts
apps/api/src/routes/upload-verification.ts
apps/api/src/routes/webauthn.ts
apps/api/src/server.test.ts
apps/api/src/server.ts
apps/web/app/PublicTokenHashEntry.tsx
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/external-uploads-dashboard.ts
apps/web/app/external-uploads/ExternalUploadRunner.tsx
apps/web/app/external-uploads/page.tsx
apps/web/app/external-uploads/runner-utils.test.ts
apps/web/app/external-uploads/runner-utils.ts
apps/web/app/guest-sessions/GuestSessionRunner.tsx
apps/web/app/guest-sessions/page.tsx
apps/web/app/guest-sessions/runner-utils.test.ts
apps/web/app/guest-sessions/runner-utils.ts
apps/web/app/intake-forms-dashboard.ts
apps/web/app/intake-forms/IntakeFormRunner.tsx
apps/web/app/intake-forms/page.tsx
apps/web/app/login-client.tsx
apps/web/app/page.tsx
apps/web/app/publicTokenClient.test.ts
apps/web/app/publicTokenClient.ts
apps/web/app/share-link-portal.ts
apps/web/app/share-links/ShareLinkRunner.tsx
apps/web/app/share-links/page.tsx
apps/web/app/types.ts
docs/api-and-state-machines.md
docs/planning-and-progress.md
docs/validation/OP_CODE_REVIEW_REMEDIATION_PROOF_2026-06-06.md
docs/validation/README.md
e2e/ui-ux.spec.ts
package.json
packages/database/src/repository/contracts.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/test/repository.providers-jobs-email.test.ts
scripts/create-release-proof.mjs
scripts/create-release-proof.test.mjs
scripts/route-authorization-manifest.mjs
scripts/scan-tracked-secrets.mjs
scripts/scan-tracked-secrets.test.mjs
scripts/select-validation.mjs
scripts/select-validation.test.mjs
scripts/validate-local-evidence-dockerignore.mjs
scripts/validate-local-evidence-dockerignore.test.mjs
scripts/validate-validation-proof-index.mjs
scripts/validate-validation-proof-index.test.mjs
```

## Implementation Notes

- Added `.tmp/`, `artifacts/`, and `artifacts/release-local` to `.dockerignore`, plus `validate-local-evidence-dockerignore` inside `policy:check`.
- Updated release artifact secret scanning so explicit artifact scans can scan large files or fail on skipped large-file evidence.
- Added `x-open-practice-public-token` public-token transport for share, external upload, intake form, guest session, and email receipt flows. Legacy path-token routes remain registered, and API request/error logs redact those URLs.
- Added hash-token public pages and client-side URL scrubbing so legacy token paths migrate to `/<flow>#<token>` while API requests use the header-token routes.
- Added `canCreate` and `canManage` to share-link and external-upload status payloads without changing `enabled`; web controls now hide create actions for read-only users.
- Enforced email receipt token matter/email consistency in memory and Drizzle repositories. `recordEmailReceiptToken` now returns `{ token, recordedNow }` and records `receipt_recorded` history only on the first compare-and-set update.
- Sanitized email delivery metadata before storage and activity/job exposure.
- Routed raw public/auth parsing through `parseRequestPart`, replaced unsafe JSON boolean coercion, and centralized upload filename/content-type/key-segment limits.
- Added network failure handling around login, dashboard mutations, and public upload/share/intake/guest flows so busy states clear with safe messages.
- Tightened selector and policy gates for package manifests, Docker runtime changes, local proof directories, and validation proof-index freshness.

## Selector Output

Initial selector command:

```text
pnpm verify:select -- --files $(git ls-files --modified --others --exclude-standard)
```

Initial recommended validation included:

```text
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm docker:residual-watch
pnpm e2e:host
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Final selector command after merging the branch into `main`:

```text
pnpm verify:select -- --base origin/main
```

Final recommended validation:

```text
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm docker:residual-watch
pnpm e2e:host
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Evidence

- `pnpm --filter @open-practice/database build` - passed.
- `pnpm --filter @open-practice/web typecheck` - passed.
- `pnpm --filter @open-practice/database typecheck` - passed.
- `pnpm --filter @open-practice/api typecheck` - passed after rebuilding database declarations.
- `pnpm --filter @open-practice/api test` - passed: 41 files, 498 tests.
- `pnpm --filter @open-practice/web test` - passed: 20 files, 141 tests.
- `pnpm --filter @open-practice/database test` - passed: 18 files, 107 tests.
- `pnpm --filter @open-practice/database db:check` - passed.
- `pnpm migrations:check` - passed: 52 SQL files match 52 journal entries.
- `node --test scripts/*.test.mjs` - passed: 55 tests.
- `pnpm test` - passed: Turbo package tests plus 55 script tests.
- `pnpm docker:residual-watch` - passed and wrote `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-06T06-56-16Z`.
- `pnpm deps:audit` - passed: no known vulnerabilities found for prod or dev audit.
- `pnpm deps:licenses` - passed with existing review-required license groups reported.
- `pnpm e2e:docker` - passed: 5 passed in 18.4s.
- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed after scoping proof-index validation to local proof-note links.
- `pnpm e2e:host` - passed: 33 passed, 3 skipped.
- `pnpm build` - passed: all 6 package builds, including new hash-token public pages in Next route output.
- `pnpm ci:local` - passed after proof/index/workboard updates; this covered `pnpm verify` plus `git diff --check` for the final mainline tree.

## Skips and Residuals

- No Docker skip: Docker E2E and Docker residual watch both ran successfully.
- No dependency additions.
- No validation residual remains for this branch.
