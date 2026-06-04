# OP-T144 Client Portal Action Workspace Proof

Date: 2026-06-04 PDT

## Scope

OP-T144 shipped the first client portal messaging and action workspace slice from the core-suite
Clio parity backlog. The slice keeps the logged-in `client_external` workspace read-only and builds
only on existing active, contact-matched portal grants and existing portal-adjacent records.

Runtime changes:

- `GET /api/client-portal/workspace` keeps the legacy flat `actions` array and adds grouped
  `matterActions` for visible matters.
- The workspace now surfaces safe cues for secure-share document counts, external upload
  retry/remaining-upload state, redacted matter message-thread counts, calendar guest-session
  status, existing intake/receipt/client-update actions, and contact-bound hosted payment request
  summaries.
- The web client portal renders grouped matter actions and safe detail chips, with a flat-response
  fallback for older payloads.

## Boundaries

This slice did not add database migrations, new dependencies, route-manifest changes, live chat,
SMS, mobile-native behavior, broad document browsing, automatic client-update sending, payment
settlement, refunds, chargebacks, trust posting, invoice-balance mutation, card storage, or payment
plan enforcement.

The API and web tests seed only synthetic records and assert that the workspace response does not
expose raw token hashes, storage keys, email subjects, email bodies, conversation topics,
conversation metadata, meeting room/provider IDs, hosted payment paths, checkout URLs, processor
session IDs, or payment evidence metadata.

## Changed Paths

- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/client-portal.test.ts`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace.test.tsx`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`

## Validation

Initial targeted implementation checks:

```sh
pnpm --filter @open-practice/api test -- client-portal.test.ts
pnpm --filter @open-practice/web test -- client-portal-workspace-utils.test.ts client-portal-workspace.test.tsx
```

Results:

- Pass: API test command completed with 41 files and 469 tests passing.
- Pass: Web test command completed with 19 files and 136 tests passing.

Final validation command selection:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.tsx apps/web/app/client-portal-workspace.test.tsx apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/validation/README.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md
```

Selector recommended:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Final validation results:

- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/api test` (41 files, 469 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/web test` (19 files, 136 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build`
