# OP-T140 Integration Developer Boundary Proof - 2026-05-28

## Scope

Implemented the first integration developer boundary slice over the existing connector registry and
connector outbox:

- Owner-managed OAuth-style app registration records with generated client IDs, HTTPS
  redirect/origin guardrails, constrained scopes, regional endpoint cues, documented-only
  rate-limit posture, and reserved custom-action placeholders.
- Scoped API credential records with masked worker-resolved secret references and revocation
  posture; no live API-auth acceptance flow was added.
- Webhook subscription posture with allowlisted connector events, HTTPS destination validation,
  destination-host-only responses, masked signing secret references, and redacted audit metadata.
- Redacted integration delivery history derived from existing connector outbox rows and delivery
  attempts.

Public marketplace behavior, third-party app review, broad model coverage, live payment-link API
exposure, provider-specific recovery tooling, raw webhook replay, and provider-specific webhook
recovery remained out of scope.

No dependencies, copied excerpts, vendored assets, or reference-derived code were added. The license
policy was checked and this slice is original Open Practice code.

## Changed Seams

- `apps/api/src/routes/connectors.ts`
- `apps/api/src/routes/connectors.test.ts`
- `packages/domain/src/operations.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/database/src/schema.ts`
- `packages/database/src/repository/contracts.ts`
- `packages/database/src/repository/memory.ts`
- `packages/database/src/repository/drizzle.ts`
- `packages/database/src/repository/drizzle-mappers.ts`
- `packages/database/test/repository.connectors.test.ts`
- `packages/database/test/schema.test.ts`
- `packages/database/migrations/0040_integration_developer_boundary.sql`
- `packages/database/migrations/meta/_journal.json`
- `scripts/route-authorization-manifest.mjs`
- `docs/api-and-state-machines.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP-T140_INTEGRATION_DEVELOPER_BOUNDARY_PROOF_2026-05-28.md`

## Validation

| Command                                                       | Result                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                              | Passed; linked dependencies in the fresh OP-T140 worktree without lockfile changes.                                                                            |
| `pnpm verify:select -- --files <OP-T140 changed paths>`       | Passed and recommended policy, database test/db-check/typecheck, migration, API test, and API typecheck checks for the exact path set listed above.            |
| `pnpm exec prettier --check <OP-T140 TS/JSON/Markdown paths>` | Passed after Prettier normalized Markdown table wrapping in the docs; migration SQL was excluded because this repo Prettier setup does not infer a SQL parser. |
| `pnpm docs:check`                                             | Passed.                                                                                                                                                        |
| `pnpm migrations:check`                                       | Passed: 41 SQL files match 41 journal entries.                                                                                                                 |
| `pnpm policy:check`                                           | Passed tracked-secret scan, package manifest policy, migration parity, OSS reuse policy, docs links, and Open Practice boundary policy.                        |
| `pnpm --filter @open-practice/domain build`                   | Passed.                                                                                                                                                        |
| `pnpm --filter @open-practice/database build`                 | Passed after rebuilding domain first.                                                                                                                          |
| `pnpm --filter @open-practice/providers build`                | Passed after rebuilding domain first.                                                                                                                          |
| `pnpm --filter @open-practice/domain typecheck`               | Passed.                                                                                                                                                        |
| `pnpm --filter @open-practice/database typecheck`             | Passed after workspace package builds supplied local package exports.                                                                                          |
| `pnpm --filter @open-practice/api typecheck`                  | Passed after workspace package builds supplied local package exports.                                                                                          |
| `pnpm --filter @open-practice/domain test -- audit-taxonomy`  | Passed: 19 files, 135 tests.                                                                                                                                   |
| `pnpm --filter @open-practice/database test`                  | Passed: 15 files, 81 tests.                                                                                                                                    |
| `pnpm --filter @open-practice/database db:check`              | Passed.                                                                                                                                                        |
| `pnpm --filter @open-practice/api test`                       | Passed: 35 files, 396 tests.                                                                                                                                   |

## Redaction Proof

- Connector route tests assert scoped API credential secret-reference IDs are masked in responses.
- Webhook subscription responses expose `destinationHost` and `destinationUrlPresent`, not the full
  destination URL or signing secret reference.
- Delivery-history route tests assert raw connector outbox idempotency keys and private attempt
  metadata do not appear in the API response.
- Audit metadata records counts, posture flags, app/connector IDs, and destination host only.

## Isolation Notes

This proof was refreshed on branch `codex/op-t140-integration-developer-boundary` from clean `main`.
The branch excludes dependency-refresh edits to package manifests, lockfiles, Docker images, and
GitHub-maintenance dependency evidence. It also excludes the in-flight OP-T128 client-portal route,
permission, web, and proof files from the mixed dependency-refresh worktree.

The selector also recommended broader package, provider, and worker checks. Final proof stayed
focused on the touched connector/API, domain, database, docs, migration, and policy seams because no
provider or worker runtime code changed and this slice did not add dependencies.

Initial database/API package test and typecheck attempts in the fresh worktree failed before the
workspace packages were built because local package exports for `@open-practice/domain`,
`@open-practice/database`, and `@open-practice/providers` had no generated `dist` output yet. After
the domain, database, and provider builds above, the selected database/API reruns passed without code
changes.
