# Open Practice Features And Capabilities Parity Remediation Proof - 2026-06-26

Date: 2026-06-26
Branch: `remediation/features-capabilities-parity-20260626`
Base: `audit/features-capabilities-parity-20260626` at `b5bc4956`
Status: Passed; selector-selected package/docs/build gates, `pnpm ci:local`, local security review,
and final proof reconciliation passed on the final path set.

## Scope

This branch implements the metadata-only document conversion review state/readiness packet selected
from the 2026-06-26 features and capabilities parity audit. It deepens the existing
provider-disabled document-analysis review surface without adding a live provider, new route,
schema, migration, dependency, queue, object-storage write, embeddings, chunks, raw text exposure,
or downstream automation.

The change is additive:

- Existing `conversionReview` responses now include a bounded `reviewReadiness` packet.
- Artifact-backed `reviewed` and `rejected` states are visible as top-level
  `conversionReview.posture` values and as `reviewReadiness.status` instead of collapsing into
  generic `ready_for_review`.
- Existing reviewed or rejected `document_analysis_status` artifacts return the completed
  conversion-review summary instead of enqueueing another review job.
- The worker preserves reviewed/rejected artifact lifecycle state while refreshing only bounded
  metadata-only review fields.
- The Documents dashboard renders the reviewed/rejected readiness copy using the existing dense
  operational row pattern.

## Boundary

- No route authorization, public route list, database schema, migration, package manifest, provider
  SDK, provider activation, queue name, object-storage write, or dependency changed.
- `reviewReadiness` carries only `status`, `artifactStatus`, optional `reviewedAt`,
  `staffReviewRequired`, `terminalReview`, `reviewOnly`, `metadataOnly`,
  `downstreamMutation: false`, `providerEvidenceStored: false`, and `rawOcrTextReturned: false`.
- Durable worker/job/artifact/API metadata remains limited to IDs, counts, lengths,
  provider/status posture labels, OP-authored summary posture, policy flags, and reviewer state.
- Raw OCR text, raw Markdown, annotation bodies/spans, prompts, chunks, embeddings/vectors, storage
  keys, object bodies, provider payloads/evidence, private excerpts, generated summaries, and
  private document text are not returned or retained in job/artifact/API/proof metadata.
- Reviewed/rejected status is still review-only. It does not mutate documents, drafts, matters,
  messages, tasks, calendar items, ledger records, portal access, or provider state.
- Synthetic data only. No client, matter, credential, payment, private deployment, privileged
  document, provider payload, or raw OCR evidence was added.

## Final Path Set

```text
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/document-processing/queue.ts
apps/api/src/routes/document-processing/shared.ts
apps/web/app/_features/document-processing/models.ts
apps/web/app/dashboard/documents-section.test.tsx
apps/web/app/document-processing-dashboard.ts
apps/worker/src/processors.test.ts
apps/worker/src/processors/ocr.ts
docs/api-and-state-machines.md
docs/validation/OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md
docs/validation/README.md
```

## Selector Output

```text
$ pnpm verify:select -- --files docs/validation/OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md docs/api-and-state-machines.md apps/api/src/routes/document-processing.test.ts apps/api/src/routes/document-processing/queue.ts apps/api/src/routes/document-processing/shared.ts apps/web/app/_features/document-processing/models.ts apps/web/app/dashboard/documents-section.test.tsx apps/web/app/document-processing-dashboard.ts apps/worker/src/processors.test.ts apps/worker/src/processors/ocr.ts docs/validation/README.md
Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                    | Status | Notes                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <final path set>`                                                                                           | Pass   | Recommended architecture, API contract, format, docs, policy, API, worker, web, and build gates.                                                   |
| `pnpm architecture:check`                                                                                                                  | Pass   | Architecture import policy passed with 449 workspace import edges reviewed.                                                                        |
| `pnpm api:contract`                                                                                                                        | Pass   | API contract inventory wrote `.tmp/api-contract/openapi.json` with 310 paths.                                                                      |
| `pnpm format:check`                                                                                                                        | Pass   | All matched files use Prettier code style.                                                                                                         |
| `pnpm docs:check`                                                                                                                          | Pass   | Documentation link validation passed.                                                                                                              |
| `pnpm policy:check`                                                                                                                        | Pass   | Tracked-secret scan, package, supply-chain, toolchain, env, architecture, dead-code, migration, OSS, docs, proof-index, and boundary gates passed. |
| `pnpm --filter @open-practice/api test`                                                                                                    | Pass   | Vitest reported 42 API test files and 604 tests passed.                                                                                            |
| `pnpm --filter @open-practice/api typecheck`                                                                                               | Pass   | API TypeScript check passed.                                                                                                                       |
| `pnpm --filter @open-practice/worker test`                                                                                                 | Pass   | Vitest reported 6 worker test files and 54 tests passed.                                                                                           |
| `pnpm --filter @open-practice/worker typecheck`                                                                                            | Pass   | Worker TypeScript check passed.                                                                                                                    |
| `pnpm --filter @open-practice/worker build`                                                                                                | Pass   | Worker build passed.                                                                                                                               |
| `pnpm --filter @open-practice/web test`                                                                                                    | Pass   | Rerun passed with 44 web test files and 231 tests passed after correcting the fixture to use the new terminal `reviewed` posture.                  |
| `pnpm --filter @open-practice/web typecheck`                                                                                               | Pass   | Web TypeScript check passed.                                                                                                                       |
| `pnpm build`                                                                                                                               | Pass   | Turbo build completed 6 packages successfully; 3 packages were cache hits.                                                                         |
| `git diff --check`                                                                                                                         | Pass   | Whitespace check passed after the proof update.                                                                                                    |
| `pnpm ci:local`                                                                                                                            | Pass   | Full local gate exited 0; visible tail included package tests, script tests, `drizzle-kit check`, policy gates, and cached production build.       |
| `pnpm security:review -- --files <final path set>`                                                                                         | Pass   | Security packet passed at `.tmp/open-practice-security-review/2026-06-26T22-48-40Z`; required command ids all exited 0.                            |
| `pnpm proof:reconcile -- --proof docs/validation/OP_FEATURES_CAPABILITIES_PARITY_REMEDIATION_PROOF_2026-06-26.md --files <final path set>` | Pass   | Final reconciliation passed after the proof and index update.                                                                                      |

## Corrected Checks

- The first full web test run failed because the synthetic Documents fixture still had
  `conversionReview.posture: "ready_for_review"` while the integrated API behavior now exposes
  terminal artifact posture as `reviewed` or `rejected`. The fixture was corrected to `reviewed`,
  formatted, and the full web test suite passed on rerun.
- Earlier fresh-worktree focused runs needed upstream workspace package builds before API, worker,
  or web checks could resolve built package outputs. Those were environment-prep issues in the
  sibling worktree, not product regressions.

## Security Review Evidence

- `pnpm security:review -- --files <final path set>` generated
  `.tmp/open-practice-security-review/2026-06-26T22-48-40Z/security-review.json` with
  `status: "passed"` and no failed required command ids.
- Tracked-secret scan reported 0 findings, 0 omitted files, and 1,126 scanned tracked files.
- Dependency license evidence reported 557 packages, 584 package versions, 20 license groups, 0
  disallowed groups, and 8 review-required license groups under the existing license policy
  posture.
- Required packet commands passed: changed-path selector, tracked-secret scan, lockfile
  supply-chain, dependency audit, license evidence, CycloneDX SBOM, policy check, hot-path rescan,
  Docker residual watch, and artifact secret scan.
- Optional packet commands also exited 0: secrets-history scan, privacy-rule scan, OSV advisory
  scan, source-license scan, Docker static lint, and Docker image scan. The secrets-history
  artifact remains review-required per its local evidence posture, with no required-gate failure.

## Checks Outside This Gate

Standalone Docker app smoke, browser E2E, self-host check, self-host restore drill, migration
replay, and release proof were outside this selected remediation gate. They were not run as
standalone branch closeout commands and are not claimed green here. Docker lint, Docker residual
watch, Docker image scan, dependency audit, dependency license evidence, and lockfile supply-chain
evidence were run inside the local security review packet above.
