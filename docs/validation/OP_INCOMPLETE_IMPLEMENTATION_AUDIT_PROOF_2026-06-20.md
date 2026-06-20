# Exhaustive Incomplete-Implementation Inventory - 2026-06-20

## Branch And Scope

- Branch: `audit/incomplete-implementation-inventory-20260620`
- Base commit: `2873e38f`
- Scope: read-only audit of stubs, placeholders, TODOs, unsupported/deferred branches, dead code,
  route/API drift, web route catalog coverage, and docs that could describe unshipped behavior.
- Mutations in this branch are documentation-only: this proof, the validation index, the live
  workboard handoff note, and the candidate backlog entry for API documentation inventory
  completeness.

This audit does not remediate runtime code. It records follow-up candidates only when the review
found a gap that is not already tracked as a shipped boundary or intentional future work.

## Baseline Reviewed

- `git status --short --branch` showed a clean `main...origin/main` checkout before branching.
- `docs/README.md`, `docs/planning-and-progress.md`, `docs/validation/README.md`,
  `docs/development/repo-guide.md`, and `docs/improvement-opportunities.md` were reviewed for the
  current workboard, validation index, owning workspaces, and candidate backlog.
- The previous incomplete-implementation audit was reviewed:
  [OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-05-31.md](OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-05-31.md).
  Its confirmed fixes remain covered on current `main`: worker startup mode validation, OCR storage
  readiness, public upload capacity claiming, route manifest drift, secure-share copy, dashboard
  disabled states, and docs/backlog/API reconciliation.

## Inventory Results

| Category                      | Result                                                                                                                                                                                                     | Classification                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Explicit TODO/stub markers    | No production `TODO`, `FIXME`, `XXX`, `HACK`, `STUB`, `not implemented`, `unimplemented`, `coming soon`, or `TBD` implementation marker was found. `VTODO` appears only as an iCalendar component literal. | No confirmed incomplete implementation.                                                            |
| Production marker files       | 21 files matched broader terms such as `fake`, `placeholder`, or UI `placeholder`.                                                                                                                         | Intentional synthetic provider data, UI input placeholders, CSS placeholders, or review-only rows. |
| Test marker files             | 25 test/spec files matched fake/noop/placeholder terms.                                                                                                                                                    | Fixture-only synthetic data and no-op test callbacks.                                              |
| Docs marker files             | 12 docs/proof files matched marker terms.                                                                                                                                                                  | Existing shipped-boundary notes, backlog text, and historical proof.                               |
| Suspicious empty returns      | No empty return with a TODO/stub/placeholder comment was found in production source.                                                                                                                       | No finding.                                                                                        |
| Worker guarded terminal paths | Queue processors return guarded lifecycle metadata because job names are unrecognized, metadata is missing, OCR state is unsafe, providers are unconfigured, or provider jobs are reserved.                | Intentional redacted lifecycle behavior, not a stub.                                               |
| Dead-code gate                | `pnpm deadcode:check` passed.                                                                                                                                                                              | No Knip-reported unused files, dependencies, unresolved imports, or binary issues.                 |
| Architecture gate             | `pnpm architecture:check` passed with 436 workspace import edges reviewed.                                                                                                                                 | No workspace-boundary drift found.                                                                 |
| API contract inventory        | `pnpm api:contract` generated `.tmp/api-contract/openapi.json` with 308 OpenAPI path objects from the route authorization manifest.                                                                        | Manifest export works; ignored local evidence only.                                                |
| Policy/boundary gate          | `pnpm policy:check` passed, including route ownership, route authorization, docs links, proof index, migration, OSS reuse, env, supply-chain, and local-evidence checks.                                   | No policy-blocking completeness issue found.                                                       |

## Confirmed Findings

No P0/P1 runtime blockers and no confirmed production stub implementation were found.

One low-severity documentation completeness gap was found:

- `docs/api-and-state-machines.md` does not individually enumerate every route authorization
  manifest entry. The manual comparison found no docs-only route claims, but a strict exact-route
  comparison reported 40 manifest-only entries. Most are compact notation false positives, such as
  `POST/PATCH/DELETE /api/contacts/:contactId/contact-methods[...]`, legacy path-token variants, or
  public-header variants. The remaining omissions are documentation-inventory detail gaps around
  CalDAV method variants, e2e-support-only helpers, passkey/password step-up routes, and public mail
  receipt path naming. Runtime coverage is not missing: `pnpm policy:check`,
  `node --test scripts/validate-open-practice-boundaries.test.mjs`, and the generated API contract
  all passed. Follow-up: add an API docs inventory reconciliation slice that either enumerates these
  routes explicitly or documents the compact notation contract beside the generated local API
  inventory.

## Intentional Boundaries Confirmed

- `packages/providers/src/draft-assist.ts` and `packages/domain/src/sample-data.ts` use
  `fake-local-ai` and synthetic proposal text intentionally for disabled-by-default, review-only AI
  assist/proposal behavior. Existing docs describe this as provider-neutral synthetic support, not a
  live AI provider claim.
- `apps/api/src/routes/communications/inbox.ts` and web communications models use
  `phone_note_placeholder` and `text_note_placeholder` intentionally for OP-T132's redacted
  channel-history projection. Live SMS/text delivery, public portal composition, realtime chat, and
  automatic client-update sends remain out of scope.
- `apps/worker/src/processors/ai-triage.ts` intentionally records reserved legal-research provider
  jobs as citation-review metadata only because a live provider has not been explicitly implemented.
- `apps/worker/src/processors/document-assembly.ts`, `ocr.ts`, `email.ts`, `reports.ts`, and the
  dispatcher return guarded lifecycle metadata for unsupported job names, missing metadata, unsafe
  source state, unconfigured providers, or authorization changes. These are guarded terminal states,
  not empty implementations.
- `apps/api/src/server.ts` rejects deprecated DocuSeal/docassemble/OIDC env and production
  `STRIPE_SECRET_KEY` even though non-production Stripe Checkout Session shell support exists. The
  API/state-machine, deployment-hardening, payment-boundary, and trust/funds docs all describe this
  production gate.
- `scripts/selfhost-check.mjs` rejects placeholder self-hosting secrets unless the checked-in
  synthetic example flag is present. That is a deployment-readiness ratchet.
- Web `placeholder` matches are form input placeholders, TipTap placeholder extension usage, or CSS
  placeholder selectors. They do not indicate missing implementation.

## Evidence Commands

```bash
git status --short --branch
git rev-parse --short HEAD
git switch -c audit/incomplete-implementation-inventory-20260620
rg -n -i "\b(TODO|FIXME|XXX|HACK|STUB|not implemented|unimplemented|coming soon|TBD|dummy|fake|noop|no-op|placeholder)\b" apps packages scripts --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' --glob '!**/build/**' -S
rg -n -i "\b(TODO|FIXME|XXX|HACK|STUB|not implemented|unimplemented|coming soon|TBD|dummy|fake|noop|no-op|placeholder)\b" apps packages scripts --glob '**/*.test.*' --glob '**/*.spec.*' -S
rg -n -i "\b(TODO|FIXME|XXX|HACK|STUB|not implemented|unimplemented|coming soon|TBD|dummy|fake|noop|no-op|placeholder)\b" docs README.md CONTRIBUTING.md AGENTS.md SECURITY.md -S
rg -n "return (null|undefined|\[\]|\{\})\s*;\s*//.*(TODO|FIXME|stub|placeholder|not implemented|unimplemented|later|future)" apps packages scripts --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' --glob '!**/build/**' -i -S
rg -n "TODO|FIXME|XXX|HACK|STUB|not implemented|unimplemented|coming soon|TBD" apps packages scripts docs README.md CONTRIBUTING.md AGENTS.md SECURITY.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/build/**' -S
rg -n "throw new Error\([^\n]*(TODO|FIXME|Not implemented|not implemented|Unimplemented|unimplemented|stub|Stub|TBD|coming soon)|status:\s*\"skipped\"|reason:\s*\"Unsupported|unsupported\"" apps packages scripts --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/dist/**' --glob '!**/build/**' -S
pnpm deadcode:check
pnpm api:contract
pnpm architecture:check
pnpm policy:check
pnpm --filter @open-practice/web test -- routes/routeCatalog.test.ts
node --test scripts/validate-open-practice-boundaries.test.mjs
```

Additional manual comparisons:

- Compared route authorization manifest entries against `docs/api-and-state-machines.md`.
- Reviewed `apps/web/routes/routeCatalog.ts` and `apps/web/routes/routeCatalog.test.ts` for staff
  canonical route coverage and public-token separation.
- Reviewed marker-hit contexts in provider, sample-data, communications, worker, self-hosting, and
  production-readiness code.

## Validation

### Final Changed Paths

```bash
docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md
docs/improvement-opportunities.md
docs/planning-and-progress.md
docs/validation/README.md
```

### Selector Evidence

```bash
pnpm verify:select -- --files docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md
```

Recommended validation commands:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Validation results:

- `pnpm format:check` - passed after applying Prettier to the touched docs.
- `pnpm docs:check` - passed.
- `pnpm policy:check` - passed.
- `git diff --check` - passed.
- `pnpm proof:reconcile -- --proof docs/validation/OP_INCOMPLETE_IMPLEMENTATION_AUDIT_PROOF_2026-06-20.md --base-plus-dirty origin/main` -
  passed.

## Checks Not Run

- Runtime remediation tests beyond the audit evidence above are out of scope because this branch
  does not change product code, schemas, dependencies, migrations, providers, worker behavior, web
  behavior, payment behavior, or trust behavior.
- Docker, browser E2E, database replay, and release gates were not selected because
  `pnpm verify:select -- --files <final paths>` chose only documentation checks for this docs-only
  audit.
