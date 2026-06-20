# Open Practice Dead-Code And Bloat Prune Proof - 2026-06-19

Branch: `prune/dead-code-bloat`

Worktree: `/Users/bryan/projects/open-practice-dead-code-bloat`

## Scope

This branch implements the first PR-sized dead-code and bloat prune slices from the approved plan.
It keeps public HTTP routes, response shapes, authorization behavior, redaction posture,
payment/trust behavior, provider runtime boundaries, migration snapshots, ProseMirror dependencies,
`PUBLIC_ROUTE_SAMPLES`, public-token compatibility routes, and synthetic-data boundaries unchanged.

Implemented:

- Removed or narrowed stale/test-only API exports for response envelopes, fresh-auth constants,
  validation issue formatting, public-token rate-limit options, and document-processing queue/review
  internals.
- Removed same-file-only or stale web exports and arguments for public-token route builders,
  external upload and guest-session runner paths, share-link helpers, server-resource helpers,
  connector-coupled server API status typing, setup CSS selectors, and the broad web `allowJs`
  compiler flag. The one remaining `next.config.mjs` test import now has a narrow `.d.mts`
  declaration.
- Reused shared worker metadata helpers for OCR and inbound-email processors while preserving the
  existing reserved/deferred `ai_triage`, transcription, and media worker status wording.
- Removed stale `minimumReleaseAgeExclude` package specs that are no longer present in the lockfile.
- Removed tracked generated Playwright screenshots/JSON under `output/playwright/**` and converted
  durable proof references to local-evidence summaries instead of tracked generated artifacts.
- Added explicit provider subpaths, moved the fake draft-assist/AI proposal provider to
  `@open-practice/providers/testing`, shrank the production provider root barrel, and removed unused
  `ManualSignatureProvider` and `DisabledPaymentProcessorProvider` exports.
- Added explicit domain authorization-fixture and database runtime/repository/schema/seed/config
  subpaths, moved authorization fixture consumers to the fixture subpath, narrowed the database root
  to repository exports, and removed the unused `PostgresOpenPracticeRepository` alias.

Deferred by design:

- The larger `contacts.ts`, `dashboard-client.tsx`, central web type barrel, and E2E selector
  structural splits remain later slices because they are broader behavior-adjacent refactors.
- Legacy `/?section=` aliases and E2E support routes were not deleted.

## Boundaries Preserved

- No new dependencies, vendored assets, copied source, copied excerpts, or reference-derived code.
- No schema, migration, payment settlement, automatic allocation, trust posting, provider side
  effect, authorization, redaction, or public API contract changes.
- All examples and proof data remain synthetic; no client, matter, credential, payment, or private
  deployment details were added.
- Generated Playwright evidence was removed only from tracked source control. Durable proof notes now
  point to local evidence summaries rather than relying on tracked PNG/JSON artifacts.

## Final Changed Paths

```text
apps/api/src/http/fresh-auth.ts
apps/api/src/http/http.test.ts
apps/api/src/http/response.ts
apps/api/src/http/validation.ts
apps/api/src/routes/ai-operational-proposals.test.ts
apps/api/src/routes/client-portal.test.ts
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/document-processing.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/shared.ts
apps/api/src/routes/draft-assist.test.ts
apps/api/src/routes/intake.test.ts
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/matters.test.ts
apps/api/src/routes/operational-views.test.ts
apps/api/src/routes/public-token-rate-limits.ts
apps/api/src/routes/shares.test.ts
apps/api/src/server.ts
apps/web/app/_features/calendar/server-resources.ts
apps/web/app/_features/email-delivery/server-resources.ts
apps/web/app/_shared/server-api.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/external-uploads/ExternalUploadRunner.tsx
apps/web/app/external-uploads/runner-utils.test.ts
apps/web/app/external-uploads/runner-utils.ts
apps/web/app/guest-sessions/GuestSessionRunner.tsx
apps/web/app/guest-sessions/runner-utils.test.ts
apps/web/app/guest-sessions/runner-utils.ts
apps/web/app/publicTokenClient.test.ts
apps/web/app/publicTokenClient.ts
apps/web/app/share-link-portal.ts
apps/web/app/share-links/ShareLinkRunner.tsx
apps/web/app/styles/50-setup-auth.css
apps/web/app/styles/90-responsive-motion.css
apps/web/next.config.d.mts
apps/web/tsconfig.json
apps/worker/src/processors.test.ts
apps/worker/src/processors.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/processors/inbound-email.ts
apps/worker/src/processors/metadata.ts
apps/worker/src/processors/ocr.ts
apps/worker/src/provider-mail-sender.ts
apps/worker/src/worker.ts
docs/archive/planning-completed-archive.md
docs/planning-and-progress.md
docs/validation/OP-T102_NATIVE_GUEST_SESSION_CONTROLS_PROOF_2026-05-18.md
docs/validation/OP-T108_TO_T112_IMPROVEMENT_BATCH_PROOF_2026-05-20.md
docs/validation/OP-T116_ZERO_MATTER_OPERATIONAL_WORKSPACE_PROOF_2026-05-22.md
docs/validation/OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md
docs/validation/OP_DEAD_CODE_BLOAT_PRUNE_PROOF_2026-06-19.md
docs/validation/OP_MATTERLESS_WORKFLOW_PROOF_2026-06-10.md
docs/validation/README.md
output/playwright/matterless-open-practice/calendar-desktop.png
output/playwright/matterless-open-practice/calendar-mobile.png
output/playwright/matterless-open-practice/contacts-desktop.png
output/playwright/matterless-open-practice/contacts-mobile.png
output/playwright/matterless-open-practice/screenshot-results.json
output/playwright/op-t102/dashboard-calendar-desktop.png
output/playwright/op-t102/dashboard-calendar-mobile.png
output/playwright/op-t102/public-admitted-desktop.png
output/playwright/op-t102/public-admitted-mobile.png
output/playwright/op-t102/public-denied-desktop.png
output/playwright/op-t102/public-denied-mobile.png
output/playwright/op-t102/public-ended-desktop.png
output/playwright/op-t102/public-ended-mobile.png
output/playwright/op-t102/public-expired-desktop.png
output/playwright/op-t102/public-expired-mobile.png
output/playwright/op-t102/public-issued-desktop.png
output/playwright/op-t102/public-issued-mobile.png
output/playwright/op-t102/public-locked-desktop.png
output/playwright/op-t102/public-locked-mobile.png
output/playwright/op-t102/public-not-configured-desktop.png
output/playwright/op-t102/public-not-configured-mobile.png
output/playwright/op-t102/public-revoked-desktop.png
output/playwright/op-t102/public-revoked-mobile.png
output/playwright/op-t102/public-waiting-desktop.png
output/playwright/op-t102/public-waiting-mobile.png
output/playwright/op-t108-t112/billing-desktop.png
output/playwright/op-t108-t112/billing-mobile.png
output/playwright/op-t108-t112/contacts-desktop.png
output/playwright/op-t108-t112/contacts-mobile.png
output/playwright/op-t108-t112/receipt-confirmation-desktop.png
output/playwright/op-t108-t112/receipt-confirmation-mobile.png
output/playwright/op-t108-t112/saved-views-desktop.png
output/playwright/op-t108-t112/saved-views-mobile.png
output/playwright/op-t114/desktop-created.png
output/playwright/op-t114/desktop-zero.png
output/playwright/op-t114/mobile-zero.png
output/playwright/op-t84-t86-queues-smoke.png
output/playwright/op-t89/external-upload-desktop.png
output/playwright/op-t89/external-upload-mobile.png
output/playwright/op-t89/intake-desktop.png
output/playwright/op-t89/intake-mobile.png
output/playwright/op-t89/share-desktop.png
output/playwright/op-t89/share-mobile.png
output/playwright/op-t89/share-verified-mobile.png
packages/database/package.json
packages/database/src/index.ts
packages/database/src/repository.ts
packages/database/src/repository/drizzle.ts
packages/domain/package.json
packages/domain/src/index.ts
packages/providers/package.json
packages/providers/src/draft-assist.ts
packages/providers/src/index.ts
packages/providers/src/operations.ts
packages/providers/src/signatures.ts
packages/providers/src/testing.ts
packages/providers/test/providers.test.ts
pnpm-workspace.yaml
scripts/dev-seed.mjs
```

## Selector

Final changed-path selector:

```bash
pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard | sort)
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
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
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

## Validation

Completed focused validation:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
```

All focused commands above passed. `pnpm --filter @open-practice/web typecheck` initially exposed
that `allowJs` was carrying the typed `next.config.mjs` import; the branch fixed that with
`apps/web/next.config.d.mts`, then the typecheck passed.

Final broad validation:

```bash
pnpm verify:select -- --files $(git ls-files -m -o --exclude-standard | sort)
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm format:check
pnpm docs:check
pnpm deadcode:check
pnpm policy:check
pnpm test
pnpm build
pnpm ci:local
git diff --check
```

All final broad validation commands above passed from
`/Users/bryan/projects/open-practice-dead-code-bloat`. `pnpm ci:local` passed with existing lint
warnings in unchanged files but no lint errors. `pnpm deadcode:check` passed both directly and
through `pnpm policy:check`/`pnpm ci:local`. `pnpm deps:licenses` completed with the existing
review-required license groups reported by the local license inventory. `pnpm deps:osv` and
`pnpm license:scan` passed in local wrapper mode and wrote evidence under `.tmp/` because the
optional OSV/ScanCode-style scanner binaries are unavailable in this worktree. `pnpm test` also
printed a synthetic secret-scanner fixture under a temporary directory; the real tracked-secret scan
reported no high-confidence tracked secrets.

Not selected checks:

- Docker app smoke, Docker E2E, host E2E, matterless E2E, client-portal E2E, first-run E2E, and
  accessibility E2E are not selected by the final path selector because this branch does not change
  Docker runtime configuration, Playwright test code, E2E routes, or browser workflow behavior.
