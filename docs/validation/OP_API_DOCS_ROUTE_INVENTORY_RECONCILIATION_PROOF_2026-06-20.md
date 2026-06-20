# API Docs Route Inventory Reconciliation - 2026-06-20

## Branch And Scope

- Branch: `docs/api-docs-route-inventory-reconciliation-20260620`
- Base commit: `2873e38f`
- Scope: documentation-only remediation for the route/API inventory gap found by the
  2026-06-20 incomplete-implementation audit lane.

This branch does not change product APIs, route registration, route authorization, TypeScript types,
database schemas, migrations, providers, worker behavior, payment behavior, trust behavior, CalDAV
behavior, e2e helper availability, or public-token semantics.

Synthetic data only. No client, matter, credential, payment, private deployment, privileged
document, private audit, provider payload, or private calendar details were added. The privacy and
public-token boundary is documentation-only and unchanged.

## Remediation

- Added an API route inventory coverage note to
  [API and State Machines](../api-and-state-machines.md) explaining the compact notation contract for
  method unions, query placeholders, child-route suffixes, CalDAV wildcard rows, public-token header
  variants, legacy path-token variants, and strict route-inventory coverage anchors.
- Added explicit docs rows for authenticated WebAuthn step-up routes:
  `POST /api/auth/step-up/password`, `POST /api/auth/step-up/passkey/options`, and
  `POST /api/auth/step-up/passkey/verify`.
- Added explicit CalDAV method/path inventory rows for discovery, principal/calendar-home lookup,
  matter calendar collection query/reporting, and event object read/update/delete behavior.
- Added explicit current public mail receipt path rows for
  `GET/POST /api/portal/mail/receipts[/:token]` beside the existing legacy
  `email-receipts` path rows.
- Added explicit local/e2e-support-only helper rows for `/api/e2e/shareable-document`,
  `/api/e2e/share-verification-code`, and `/api/e2e/client-portal-account`, preserving their
  non-production support boundary.
- Added backlog, workboard, and validation-index reconciliation so the docs inventory gap is no
  longer carried as an open candidate.
- Added an addendum to
  [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md)
  confirming that the audit's only new follow-up is closed by this docs-only reconciliation.

## Evidence Reviewed

```bash
git status --short --branch
git fetch origin
git worktree add -b docs/api-docs-route-inventory-reconciliation-20260620 /Users/bryan/projects/open-practice-api-docs-route-inventory-reconciliation-20260620 origin/main
rg -n "caldav|step-up|receipt|e2e|x-open-practice-public-token|public-token|mail/receipts|email-receipts|passkey|password" scripts/route-authorization-manifest.mjs docs/api-and-state-machines.md apps/api/src apps/web/src
```

Route inventory anchors reviewed:

- `scripts/route-authorization-manifest.mjs` WebAuthn step-up entries.
- `scripts/route-authorization-manifest.mjs` CalDAV entries.
- `scripts/route-authorization-manifest.mjs` email receipt legacy and current path entries.
- `scripts/route-authorization-manifest.mjs` e2e-support helper entries.
- `apps/api/src/server.ts` e2e support registration and production `E2E_MODE` rejection.
- `apps/api/src/routes/e2e-support.test.ts` non-registration coverage.

## Validation

### Final Changed Paths

```bash
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md
docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md
docs/validation/README.md
```

### Selector Evidence

```bash
pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md docs/validation/README.md
```

Recommended validation commands:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Validation results:

- `pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md docs/validation/README.md` -
  passed; selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.
- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed.
- `pnpm api:contract` - passed and wrote ignored local evidence with 308 OpenAPI path objects.
- `node --input-type=module <<'NODE' ... NODE` strict route comparison against
  `ROUTE_AUTHORIZATION_MANIFEST` - passed with 369 manifest entries and 0 missing direct route
  strings in `docs/api-and-state-machines.md`.
- `node --test scripts/validate-open-practice-boundaries.test.mjs` - passed, 16 tests.
- `pnpm --filter @open-practice/domain build` - passed as the fresh sibling-worktree prerequisite for
  the web route catalog test.
- `pnpm --filter @open-practice/web test -- routes/routeCatalog.test.ts` - first attempt failed in
  the fresh sibling worktree because `@open-practice/domain` build outputs were missing; rerun after
  the domain build passed with 41 files and 217 tests.
- `git diff --check` - passed.
- `pnpm proof:reconcile -- --proof docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md --base-plus-dirty origin/main` -
  passed.

## Checks Not Run

- Docker, browser E2E, database replay, package typecheck/build gates beyond the focused domain build,
  and release gates were not selected because the final diff is documentation-only and changes no
  runtime source, routes, schemas, providers, workers, public-token behavior, payment behavior, or
  trust behavior.
