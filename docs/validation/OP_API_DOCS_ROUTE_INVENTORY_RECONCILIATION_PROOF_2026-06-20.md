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

### Original Branch Path Set

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

## Follow-Up Addendum: Explicit Compact-Family Anchors

The 2026-06-20 follow-up branch
`docs/api-docs-route-inventory-reconciliation-followup-20260620` revalidated the docs-only
reconciliation from current `origin/main` in
`/Users/bryan/projects/open-practice-api-docs-route-inventory-reconciliation-20260620`.

This follow-up keeps the same runtime boundary: no product API, route registration, route
authorization, TypeScript type, database schema, migration, provider, worker, payment, trust, CalDAV,
e2e helper registration, public-token semantic, or generated contract shape changed. It only makes
the route-inventory documentation anchors more explicit for the compact families called out by the
incomplete-implementation audit follow-up.

### Follow-Up Remediation

- Expanded the compact-notation note in
  [API and State Machines](../api-and-state-machines.md) to name the generated local API contract as
  the reconciliation source of truth for exact route inventory checks.
- Made the strict inventory coverage anchors explicit for compact CalDAV variants, including
  `OPTIONS /caldav`, `OPTIONS /caldav/*`, `GET/PROPFIND /.well-known/caldav`,
  `PROPFIND /caldav`, `PROPFIND /caldav/`, principal and calendar-home lookup, matter collection
  `PROPFIND/REPORT`, and event-object `GET/PUT/DELETE`.
- Reconfirmed local/e2e-support-only helper rows for `/api/e2e/shareable-document`,
  `/api/e2e/share-verification-code`, and `/api/e2e/client-portal-account` as non-production helper
  coverage only.
- Reconfirmed WebAuthn step-up route rows for `POST /api/auth/step-up/password`,
  `POST /api/auth/step-up/passkey/options`, and `POST /api/auth/step-up/passkey/verify`.
- Reconfirmed both legacy `/api/portal/email-receipts[/:token]` and current
  `/api/portal/mail/receipts[/:token]` public receipt paths.
- Reconfirmed public-token header preference and legacy path-token compatibility coverage for
  shares, external uploads, intake forms, guest sessions, and receipts without changing token
  transport or log-redaction behavior.

### Follow-Up Evidence

```bash
pnpm api:contract
```

Result: passed and wrote ignored local evidence with 310 OpenAPI path objects.

```bash
node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
import { ROUTE_AUTHORIZATION_MANIFEST } from "./scripts/route-authorization-manifest.mjs";
const doc = readFileSync("docs/api-and-state-machines.md", "utf8");
const exactMissing = [];
for (const route of ROUTE_AUTHORIZATION_MANIFEST) {
  const key = `${route.method} ${route.path}`;
  if (!doc.includes(key)) exactMissing.push(key);
}
console.log(`manifest entries: ${ROUTE_AUTHORIZATION_MANIFEST.length}`);
console.log(`exact missing: ${exactMissing.length}`);
for (const key of exactMissing) console.log(key);
NODE
```

Result: passed with 371 manifest entries and 0 missing exact route strings in
`docs/api-and-state-machines.md`.

### Final Changed Paths

```bash
docs/api-and-state-machines.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md
docs/validation/README.md
```

### Follow-Up Validation

```bash
pnpm verify:select -- --files docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md docs/validation/README.md
```

Result: passed; selected `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.

- `pnpm format:check` - passed.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed.
- `git diff --check` - passed.
- `pnpm proof:reconcile -- --proof docs/validation/OP_API_DOCS_ROUTE_INVENTORY_RECONCILIATION_PROOF_2026-06-20.md --base-plus-dirty origin/main` -
  passed with 5 paths and the same selected validation commands.

## Checks Not Run

- Docker, browser E2E, database replay, package typecheck/build gates beyond the focused domain build,
  and release gates were not selected because the final diff is documentation-only and changes no
  runtime source, routes, schemas, providers, workers, public-token behavior, payment behavior, or
  trust behavior.
