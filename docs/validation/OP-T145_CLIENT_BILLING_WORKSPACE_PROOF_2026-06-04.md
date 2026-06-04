# OP-T145 Client Billing Workspace Proof

Date: 2026-06-04 PDT

## Scope

OP-T145 shipped the first client-visible bills and payment request workspace slice from the
core-suite Clio parity backlog. The slice keeps the logged-in `client_external` workspace read-only
and builds only on existing active, contact-matched portal grants, existing invoice records, and
existing hosted payment-request shell records.

Runtime changes:

- `GET /api/client-portal/workspace` adds a read-only `billing` projection alongside the existing
  matter/action workspace payload.
- The API includes only granted visible matters, invoices tied to the logged-in portal contact, and
  invoice statuses already safe for client visibility: issued, partially paid, and paid.
- The billing projection returns workspace-level bill/balance/payment-request counts and grouped
  matter bill summaries with safe invoice number, status, date, amount, paid, balance, and
  payment-request status/delivery/reminder/plan posture fields.
- The web client portal renders a Billing section with read-only matter bill cards, currency labels,
  balance cues, and payment-request status details.

## Boundaries

This slice did not add database migrations, new dependencies, route-manifest changes, new public
routes, checkout actions, processor webhooks, settlement imports, refunds, chargebacks, card
storage, trust posting, payment-plan enforcement, invoice-balance mutation, or client-side bill
payment actions.

The API and web tests seed only synthetic records and assert that the workspace response does not
expose draft, approved, void, or other-contact invoices; invoice memos; invoice line narratives;
hosted paths; checkout URLs; external session IDs; processor objects; storage keys; token hashes;
raw message bodies; payment evidence metadata; or private provider/session identifiers. The API test
also asserts that reading the workspace leaves invoice, hosted payment-request, audit-event, and
ledger records unchanged.

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
- `docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md`
- `docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md`

## Validation

Initial targeted implementation checks:

```sh
pnpm --filter @open-practice/api test -- client-portal.test.ts
pnpm --filter @open-practice/web test -- client-portal-workspace-utils.test.ts client-portal-workspace.test.tsx
```

Results:

- Pass: API test command completed with 41 files and 469 tests passing.
- Pass: Web test command completed with 19 files and 137 tests passing.

Final validation command selection:

```sh
pnpm verify:select -- --files apps/api/src/routes/client-portal.test.ts apps/api/src/routes/client-portal.ts apps/web/app/client-portal-workspace-utils.test.ts apps/web/app/client-portal-workspace-utils.ts apps/web/app/client-portal-workspace.tsx apps/web/app/client-portal-workspace.test.tsx apps/web/app/styles/30-feature-surfaces.css apps/web/app/styles/90-responsive-motion.css apps/web/app/types.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/planning.md docs/validation/README.md docs/validation/OP-T144_CLIENT_PORTAL_ACTION_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP-T145_CLIENT_BILLING_WORKSPACE_PROOF_2026-06-04.md docs/validation/OP_CLIO_CORE_PARITY_GAP_AUDIT_2026-06-04.md
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

Additional rendered-browser check:

- `pnpm e2e:host`

Final validation results:

- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm --filter @open-practice/api test` (41 files, 469 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/web test` (19 files, 137 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build` (6 successful packages)
- Pass: `pnpm e2e:host` (33 Playwright checks passed, 3 skipped)
- Pass: `git diff --check`
