# OP-T133 Worker-Owned Package Assembly Proof

Date: 2026-06-16

## Scope

Moved embedded intake generated-package assembly from inline API rendering to a
worker-owned `document_assembly` queue over existing answer snapshots and draft export providers.
The API keeps authorization, matter-scoped intake access, docassemble `410`, latest snapshot lookup,
selected-package eligibility, resolved package-document validation, and redacted audit recording.
The worker reloads the exact intake session and answer snapshot by ID before rendering package
documents and persists generated-document rows with the existing provider/package fields.

No raw answers, evidence bodies, generated text, provider output bodies, storage keys, checksums, or
client text are stored in job lifecycle metadata or the worker envelope.

## Implementation Notes

- Added `document_assembly` to the domain queue type, Drizzle `job_queue_name` enum/migration,
  worker queue list/default retry policy, API jobs/provider/health surfaces, and focused tests.
- Changed `POST /api/intake-sessions/:id/generated-packages` to return `202` with a compact
  assembly request summary: job ID/status, poll URL, package ID/title, answer snapshot ID, document
  count, and queue status.
- Added `GET /api/intake-sessions/:id/generated-packages/:jobId` for matter-scoped polling. It
  returns generated document summaries and package runtime replay proof only after completion.
- Added `apps/worker/src/processors/document-assembly.ts`, which reloads session/snapshot state,
  re-checks selected package eligibility, renders through the existing embedded automation provider,
  persists generated documents, and finalizes lifecycle/audit metadata with IDs, counts, and
  provider names only.
- Kept `docassemble` deprecated: the API still rejects docassemble sessions and the worker skips any
  docassemble target instead of adding it as a runtime dependency.

## Validation

| Command                                                                                                                          | Result                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <exact final changed paths>`                                                                      | Passed; selected format, docs, policy, root test, domain, database, API, providers, and worker checks |
| `pnpm format:check`                                                                                                              | Passed after formatting touched API/docs files                                                        |
| `pnpm docs:check`                                                                                                                | Passed                                                                                                |
| `pnpm policy:check`                                                                                                              | Passed after adding the generated-package poll route to `scripts/route-authorization-manifest.mjs`    |
| `pnpm test`                                                                                                                      | Passed; Turbo ran all 6 package test suites, then Node script tests passed 63 tests                   |
| `pnpm --filter @open-practice/domain build`                                                                                      | Passed                                                                                                |
| `pnpm --filter @open-practice/domain test -- src/permissions.test.ts`                                                            | Passed; 27 files and 173 tests                                                                        |
| `pnpm --filter @open-practice/domain typecheck`                                                                                  | Passed                                                                                                |
| `pnpm --filter @open-practice/database test`                                                                                     | Passed; 18 files and 115 tests                                                                        |
| `pnpm --filter @open-practice/database db:check`                                                                                 | Passed                                                                                                |
| `pnpm migrations:check`                                                                                                          | Passed                                                                                                |
| `pnpm --filter @open-practice/database typecheck`                                                                                | Passed                                                                                                |
| `pnpm --filter @open-practice/database build`                                                                                    | Passed                                                                                                |
| `pnpm --filter @open-practice/providers build`                                                                                   | Passed                                                                                                |
| `pnpm --filter @open-practice/providers test`                                                                                    | Passed; 9 files and 20 tests                                                                          |
| `pnpm --filter @open-practice/api typecheck`                                                                                     | Passed                                                                                                |
| `pnpm --filter @open-practice/api test -- src/routes/intake.test.ts src/routes/jobs.test.ts src/routes/providers-status.test.ts` | Passed; API package script expanded to 41 files and 515 tests                                         |
| `pnpm --filter @open-practice/worker exec vitest run src/processors.test.ts src/queues.test.ts`                                  | Passed; 2 files and 34 tests                                                                          |
| `pnpm --filter @open-practice/worker test`                                                                                       | Passed; 5 files and 41 tests                                                                          |
| `pnpm --filter @open-practice/worker typecheck`                                                                                  | Passed                                                                                                |
| `pnpm --filter @open-practice/worker build`                                                                                      | Passed                                                                                                |

## Redaction Evidence

Focused domain and API tests cover `document_assembly` metadata allow-listing and reject/remove raw
answers, evidence, storage keys, checksum values, title/body text, and provider metadata from job
lifecycle records and worker envelopes. Worker tests assert synthetic package assembly completes
from snapshot IDs, creates generated documents, records generated-document IDs/counts/provider
status, and does not invoke docassemble.

## Boundaries

This slice does not introduce new source intake/session mutation, package definition mutation,
docassemble runtime execution, public signing UX changes, generated content in job metadata, or
client-text-bearing queue envelopes.
