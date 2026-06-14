# OP-T156 Client Portal Permissioned Workspace V2 Proof

Date: 2026-06-13 PDT

## Scope

OP-T156 shipped the client portal permissioned workspace V2 follow-up to the completed OP-T144
action workspace and OP-T145 billing workspace rows. The slice keeps the logged-in
`client_external` workspace operational and matter-scoped while adding safe matter details,
explicit per-file document visibility, and embedded signer actions.

This proof also records the OP-T156 second pass: client portal desktop/mobile browser review,
independent viewed/signed/declined signature proof, staff document grant/revoke coverage, and
friendlier staff-facing document-access failure copy.

Runtime changes:

- `PortalGrant` now supports optional `accountUserId`; client portal account setup and E2E setup
  bind newly created grants to the client account while preserving legacy email-matched grants.
- `PortalDocumentAccess` and the `portal_document_access` table record staff-granted,
  per-file `view_document` visibility for an active portal grant.
- Staff can list, grant, and revoke per-file portal document visibility through
  `/api/client-portal/document-access` routes.
- Staff per-file grants for confidential client parties now require an account-bound active
  `view_documents` grant; legacy email-matched grants remain compatible for existing reads but are
  not enough for new confidential-client file grants.
- `GET /api/client-portal/workspace` now returns safe `matterDetails`, client-visible document
  metadata, and signer-matched signature summaries alongside the existing action and billing
  workspace payloads.
- Logged-in clients can read one shared document metadata row through
  `GET /api/client-portal/documents/:id` and can record signer-matched viewed/completed/declined
  events through `/api/client-portal/signatures/:id` routes.
- The web client portal renders matter details, shared files, signatures, empty states, and
  embedded signature action buttons; the staff dashboard document workbench adds grant/revoke
  controls for the selected matter contact.
- The staff dashboard maps known portal document access failures to actionable copy for missing
  account-bound grants, non-shareable documents, and ineligible contacts while keeping unknown-error
  fallback behavior.
- The E2E-only client portal setup route now idempotently seeds a synthetic account-bound grant, a
  client-visible shared document, a separate staff-grantable safe document, portal-document-access
  rows, and three signer-matched embedded signature requests so viewed, signed, and declined browser
  actions can be proven independently without production fixture changes.

## Boundaries

This slice did not add raw document downloads, document previews, signing URLs, provider evidence
exposure, raw consent evidence exposure, live chat, SMS, checkout/payment actions, public-token
rewrites, object-storage behavior, new runtime dependencies, copied reference implementation code,
or staff-entered freeform portal notes.

Document visibility still uses the existing portal document safety gate: legal hold, superseded,
privileged/work-product by default, unverified, failed scan/checksum, and unaccepted
external-upload documents are not client-shareable. Confidential-party document grants require
account-bound grants and keep adverse/missing contacts blocked. Signature routes require an active
visible portal grant with `sign`, signer email matching, terminal-status preservation, and
audit-safe summary responses.

The API and web tests seed only synthetic records and assert that client workspace/document/signature
responses do not expose storage keys, token hashes, signing URLs, provider evidence, consent
evidence, message bodies, checkout URLs, or private audit metadata. Browser UI proof uses only the
E2E support route's deterministic synthetic document/signature records.

## Changed Paths

- `apps/api/src/routes/client-portal.test.ts`
- `apps/api/src/routes/client-portal.ts`
- `apps/api/src/routes/client-portal/accounts.ts`
- `apps/api/src/routes/client-portal/documents.ts`
- `apps/api/src/routes/client-portal/shared.ts`
- `apps/api/src/routes/client-portal/signatures.ts`
- `apps/api/src/routes/client-portal/workspace.ts`
- `apps/api/src/routes/e2e-support.test.ts`
- `apps/api/src/routes/e2e-support.ts`
- `apps/web/app/client-portal-workspace-utils.test.ts`
- `apps/web/app/client-portal-workspace-utils.ts`
- `apps/web/app/client-portal-workspace.test.tsx`
- `apps/web/app/client-portal-workspace.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard/documents-section.test.tsx`
- `apps/web/app/dashboard/documents-section.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/styles/30-feature-surfaces.css`
- `apps/web/app/styles/90-responsive-motion.css`
- `apps/web/app/types.ts`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/planning.md`
- `docs/validation/README.md`
- `docs/validation/OP-T156_CLIENT_PORTAL_PERMISSIONED_WORKSPACE_V2_PROOF_2026-06-13.md`
- `e2e/helpers/e2e-fixtures.ts`
- `e2e/helpers/ui-ux-assertions.ts`
- `e2e/host.spec.ts`
- `e2e/ui-ux.spec.ts`
- `packages/database/migrations/0054_portal_document_access.sql`
- `packages/database/migrations/meta/_journal.json`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/matter-workspace/memory.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/repository/portal-access-contracts.ts`
- `packages/database/src/repository/portal-access/drizzle.ts`
- `packages/database/src/repository/portal-access/memory.ts`
- `packages/database/src/repository/signatures/drizzle.ts`
- `packages/database/src/repository/signatures/memory.ts`
- `packages/database/src/schema/portal-links.ts`
- `packages/database/test/repository.portal-links.test.ts`
- `packages/domain/src/models.ts`
- `packages/domain/src/permissions.test.ts`
- `packages/domain/src/permissions.ts`
- `scripts/route-authorization-manifest.mjs`

## Validation

Initial targeted implementation checks:

```sh
pnpm --filter @open-practice/domain test -- permissions
pnpm --filter @open-practice/database test -- repository.portal-links
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/api exec vitest run src/routes/client-portal.test.ts src/routes/e2e-support.test.ts
pnpm --filter @open-practice/web test -- client-portal-workspace client-portal-workspace-utils dashboard/documents-section
pnpm e2e:client-portal
```

Results:

- Pass: `pnpm --filter @open-practice/domain test -- permissions` (27 files, 168 tests)
- Pass: `pnpm --filter @open-practice/database test -- repository.portal-links` (18 files, 114 tests)
- Pass: `pnpm --filter @open-practice/database typecheck`
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm --filter @open-practice/api exec vitest run src/routes/client-portal.test.ts` (1 file, 4 tests)
- Pass: `pnpm --filter @open-practice/web test -- client-portal-workspace client-portal-workspace-utils dashboard/documents-section` (35 files, 180 tests)
- Pass: `pnpm --filter @open-practice/api exec vitest run src/routes/client-portal.test.ts src/routes/e2e-support.test.ts` (2 files, 10 tests)
- Pass: `pnpm --filter @open-practice/web test -- client-portal-workspace dashboard/documents-section` (35 files, 181 tests)
- Pass after selector scoping fixes: `pnpm e2e:client-portal` (2 Playwright checks covering client click-through and desktop/mobile UI screenshots)

Second-pass focused checks:

```sh
pnpm --filter @open-practice/api exec vitest run src/routes/e2e-support.test.ts
pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts
pnpm e2e:client-portal
pnpm e2e:host -- -g "grants and revokes staff portal document visibility"
```

Results:

- Pass: `pnpm --filter @open-practice/api exec vitest run src/routes/e2e-support.test.ts` (4 tests)
- Pass: `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts` (70 tests)
- Pass: `pnpm e2e:client-portal` (2 Playwright checks; client workspace action proof plus desktop/mobile screenshot QA)
- Pass: `pnpm e2e:host -- -g "grants and revokes staff portal document visibility"` (1 Playwright check)

Second-pass browser evidence:

- Client portal desktop/mobile review asserted matter details, shared files, all three explicit
  signature action labels, billing, matter actions, empty states, redaction, no unexpected
  horizontal overflow, and no visible UI collisions.
- `Mark viewed` updates the visible signature state to `Viewed` and leaves appropriate follow-up
  signing actions available.
- `Decline signing` updates the visible signature state to `Declined` and removes inappropriate
  follow-up signing actions.
- `Confirm signed` updates the visible signature state to `Completed`.
- Staff document visibility browser coverage sets up the account-bound synthetic portal grant,
  grants `Client portal E2E staff grant.pdf`, asserts actionable success/status copy plus the
  `Revoke portal` button, revokes access, and confirms the UI returns to the grantable state.

Whole-app review UI follow-up:

- OP-T156 comparison against the 2026-06-11 whole-app review kept the remaining unrelated security,
  code-review, live-region, and public-intake findings unchanged, then closed the overlapping
  `UIUX-01` dashboard fallback gap. Unknown, disabled, and non-sidebar dashboard deep links now keep
  the existing enabled-section fallback while surfacing a compact status notice that names the
  unavailable request and the displayed fallback section.

Final validation command selection:

```sh
pnpm verify:select -- --files <47 changed paths listed above>
```

Selector recommended:

- `pnpm e2e:host`
- `pnpm e2e:docker`
- `node scripts/run-e2e.mjs first-run`
- `pnpm e2e:matterless`
- `pnpm e2e:client-portal`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Final validation results:

- Pass: `pnpm verify:select -- --files <47 changed paths listed above>`
- Blocked on closeout rerun: broad `pnpm e2e:host` did not complete cleanly in this local
  environment. Default-port attempts collided with existing sibling-worktree listeners; the
  isolated-port rerun reached the host Playwright suite, then the Next dev server became
  unreachable mid-suite.
- Blocked on closeout rerun: `pnpm e2e:docker` started Docker services and passed the external
  upload check, then the Docker web app became unreachable during the UI/UX dashboard sweep after
  default Docker E2E port collisions.
- Blocked on closeout rerun: `node scripts/run-e2e.mjs first-run` started API/web runtime, then
  failed readiness with `web app was not ready at http://localhost:33130: fetch failed`.
- Pass: `E2E_MATTERLESS_API_PORT=34171 E2E_MATTERLESS_WEB_PORT=33171 pnpm e2e:matterless` (1
  Playwright check)
- Pass: `pnpm e2e:client-portal` (2 Playwright checks)
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm build` (6 packages)
- Pass: `pnpm test` (Turbo package tests plus 63 script tests)
- Pass: `pnpm migrations:check` (55 SQL files and 55 journal entries)
- Pass: `pnpm --filter @open-practice/database db:check`
- Pass: `pnpm --filter @open-practice/domain test` (27 files, 168 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm --filter @open-practice/database test` (18 files, 114 tests)
- Pass: `pnpm --filter @open-practice/database typecheck`
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/api test` (41 files, 507 tests)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests)
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 40 tests)
- Pass: `pnpm --filter @open-practice/web test` (35 files, 183 tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `git diff --check`

UIUX-01 dashboard fallback follow-up validation:

- Pass: `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts` (71
  tests, including route-notice formatting)
- Pass: `pnpm e2e:host -- -g "surfaces unavailable dashboard deep links"` (4 host projects; notice
  visible for `/?section=not-a-section` while the Matters fallback workspace renders)
- Pass: `pnpm verify:select -- --files <47 changed paths listed above>`;
  selector still recommends the OP-T156 broad bundle.
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `git diff --check`
- Pass: `pnpm test` (package tests plus 63 script tests)
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/database typecheck`
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm build` (6 packages)
- Pass: `pnpm --filter @open-practice/database db:check`
- Pass: `pnpm migrations:check` (55 SQL files and 55 journal entries)
- Pass: `node scripts/run-e2e.mjs first-run` (1 Playwright check)
- Pass after clearing a stale same-checkout Next dev lock: `pnpm e2e:matterless` (1 Playwright
  check)
- Pass: `pnpm e2e:client-portal` (2 Playwright checks)
- Pass: `pnpm e2e:docker` (3 Playwright checks; Docker services, migrations, and cleanup completed)
- Blocked: broad `pnpm e2e:host` did not complete cleanly in this environment. A contaminated first
  attempt collided with an existing sibling-worktree API listener on `34110`; reruns on isolated
  ports then terminated with Next dev-server `ChunkLoadError` / HMR unhandled rejection after long
  dashboard sweeps. This blocker is recorded as environment/dev-server instability, not accepted as
  a green selected host gate.

During first-pass final validation, `pnpm --filter @open-practice/api typecheck` first caught an
optional synthetic document fixture inference in `apps/api/src/routes/e2e-support.ts`; the route now
fails explicitly if the E2E fixture cannot be materialized, and the API typecheck plus focused
client-portal/E2E support route tests passed afterward. During second-pass validation, an initially
mistyped focused host command treated `e2e/host.spec.ts` as a Playwright project filter; the command
was rerun as `pnpm e2e:host -- -g "grants and revokes staff portal document visibility"` and passed.

Merge-readiness closeout follow-up:

- Pass: proof-vs-diff reconciliation confirmed 47 live changed paths and 47 proof-listed paths with
  no proof-only or diff-only paths before closeout documentation reconciliation.
- Pass: `pnpm verify:select -- --files <47 changed paths listed above>`; selector recommendations
  matched the final validation menu above and used the actual final path set rather than `--dirty`.
- Pass: `pnpm format:check`
- Pass: `pnpm docs:check`
- Pass: `pnpm policy:check`
- Pass: `pnpm test` (Turbo package tests plus 63 script tests)
- Pass: `pnpm --filter @open-practice/domain test` (27 files, 168 tests)
- Pass: `pnpm --filter @open-practice/domain typecheck`
- Pass: `pnpm migrations:check` (55 SQL files and 55 journal entries)
- Pass: `pnpm --filter @open-practice/database test` (18 files, 114 tests)
- Pass: `pnpm --filter @open-practice/database db:check`
- Pass: `pnpm --filter @open-practice/database typecheck`
- Pass: `pnpm --filter @open-practice/database build`
- Pass: `pnpm --filter @open-practice/api test` (41 files, 507 tests)
- Pass: `pnpm --filter @open-practice/api exec vitest run src/routes/e2e-support.test.ts` (focused
  E2E support route coverage)
- Pass: `pnpm --filter @open-practice/api typecheck`
- Pass: `pnpm --filter @open-practice/providers test` (9 files, 20 tests)
- Pass: `pnpm --filter @open-practice/worker test` (5 files, 40 tests)
- Pass: `pnpm --filter @open-practice/web test` (35 files, 183 tests)
- Pass: `pnpm --filter @open-practice/web exec vitest run app/dashboard-client.test.ts`
- Pass: `pnpm --filter @open-practice/web typecheck`
- Pass: `pnpm build` (6 packages)
- Pass: `pnpm e2e:client-portal` (2 Playwright checks)
- Pass: `E2E_HOST_API_PORT=34160 E2E_HOST_WEB_PORT=33160 pnpm e2e:host -- -g "grants and revokes staff portal document visibility"`
  (1 Playwright check)
- Pass: `E2E_MATTERLESS_API_PORT=34171 E2E_MATTERLESS_WEB_PORT=33171 pnpm e2e:matterless` (1
  Playwright check)
- Blocked: broad `pnpm e2e:host` was rerun on default and isolated ports, but the local Next dev
  server became unreachable mid-suite after earlier default-port sibling-worktree collisions.
- Blocked: `node scripts/run-e2e.mjs first-run` failed readiness after the web app became
  unreachable on `33130`.
- Blocked: `pnpm e2e:docker` started services and applied migrations, then failed when the Docker
  web app became unreachable during the UI/UX dashboard sweep after default Docker E2E port
  collisions.
