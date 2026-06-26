# Canadian Template And Sample Enhancements Proof

Date: 2026-06-24
Branch: `codex/canadian-templates-samples-20260624`
Worktree: `/Users/bryan/projects/open-practice-canadian-templates-20260624`
Base: `main` at `79e35ece`
Status: Final validation passed.

## Scope

This branch replaces generic starter drafting and sample/demo document copy with original,
synthetic Canadian operational wording while preserving existing setup and sample-data contracts.

- Basic draft templates now provide Canadian matter correspondence and meeting notes scaffolds with
  firm, matter, client, jurisdiction, review, deadline, and next-step fields.
- Existing first-run preset IDs remain unchanged while their draft templates, descriptions, and
  embedded intake definitions use pan-Canadian wording or BC-specific wording where the preset is
  already BC-specific.
- Seeded residential tenancy sample data keeps existing IDs, matter scope, providers,
  authorization assumptions, and record counts while improving the intake answers, document titles,
  generated-document titles, assembly package metadata, signature consent copy, and sample document
  metadata.

No seeded email-template drafts, delivery behavior, dependency, migration, API route, public schema,
permission, provider, persistence-interface, legal-advice, or certification language changed.

## Final Path Set

Selector and validation use this final changed-path set:

```text
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/document-assembly.test.ts
apps/api/src/routes/document-processing.test.ts
apps/api/src/routes/documents.test.ts
apps/api/src/routes/intake-forms.test.ts
apps/api/src/routes/intake.test.ts
docs/validation/OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md
docs/validation/README.md
packages/domain/src/drafting.test.ts
packages/domain/src/drafting.ts
packages/domain/src/intake.test.ts
packages/domain/src/practice-presets.ts
packages/domain/src/sample-data.ts
```

## Selector Output

Initial selector run before proof/index edits:

```text
pnpm verify:select -- --files packages/domain/src/drafting.ts packages/domain/src/practice-presets.ts packages/domain/src/sample-data.ts packages/domain/src/drafting.test.ts packages/domain/src/intake.test.ts

Recommended validation commands:
pnpm architecture:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

Final selector run after proof/index edits:

```text
pnpm verify:select -- --files docs/validation/OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md apps/api/src/routes/contacts.test.ts apps/api/src/routes/document-assembly.test.ts apps/api/src/routes/document-processing.test.ts apps/api/src/routes/documents.test.ts apps/api/src/routes/intake-forms.test.ts apps/api/src/routes/intake.test.ts docs/validation/README.md packages/domain/src/drafting.test.ts packages/domain/src/drafting.ts packages/domain/src/intake.test.ts packages/domain/src/practice-presets.ts packages/domain/src/sample-data.ts

Recommended validation commands:
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
```

## Validation

| Command                                                                                                                                 | Status | Notes                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --files <initial domain path set>`                                                                               | Pass   | Selector chose architecture, domain test/typecheck/build, API test, providers test, and worker test checks for the initial domain template/sample path set.                                                                                                  |
| `pnpm verify:select -- --files <final path set>`                                                                                        | Pass   | Final selector added API contract, format, docs, policy, and API typecheck after API test/proof/index paths entered the changed-path set.                                                                                                                    |
| `pnpm architecture:check`                                                                                                               | Pass   | Reviewed 445 import edges.                                                                                                                                                                                                                                   |
| `pnpm api:contract`                                                                                                                     | Pass   | Generated `.tmp/api-contract/openapi.json` with 310 paths.                                                                                                                                                                                                   |
| `pnpm --filter @open-practice/domain test`                                                                                              | Pass   | Domain Vitest passed with 31 files and 245 tests after adding Canadian wording, deterministic preset-definition, sample-intake, and no-US-term assertions.                                                                                                   |
| `pnpm --filter @open-practice/domain typecheck`                                                                                         | Pass   | Domain typecheck passed.                                                                                                                                                                                                                                     |
| `pnpm --filter @open-practice/domain build`                                                                                             | Pass   | Domain build passed.                                                                                                                                                                                                                                         |
| `pnpm --filter @open-practice/database build`                                                                                           | Pass   | Fresh-worktree hydration build for downstream API/worker package export resolution.                                                                                                                                                                          |
| `pnpm --filter @open-practice/providers build`                                                                                          | Pass   | Fresh-worktree hydration build for downstream worker package export resolution.                                                                                                                                                                              |
| `pnpm --filter @open-practice/api typecheck`                                                                                            | Pass   | API typecheck passed.                                                                                                                                                                                                                                        |
| `pnpm --filter @open-practice/api test`                                                                                                 | Pass   | Selected API package-script test passed with 42 files and 594 tests after updating stale expectations for the enhanced sample titles and required BC intake answers. Node emitted benign `localStorage` experimental warnings and expected route error logs. |
| `pnpm --filter @open-practice/providers test`                                                                                           | Pass   | Providers Vitest passed with 11 files and 23 tests. Node emitted benign `localStorage` experimental warnings.                                                                                                                                                |
| `pnpm --filter @open-practice/worker test`                                                                                              | Pass   | Worker Vitest passed with 5 files and 46 tests after workspace package hydration. Node emitted benign `localStorage` experimental warnings.                                                                                                                  |
| `pnpm --filter @open-practice/api exec vitest run src/routes/document-assembly.test.ts --reporter=dot`                                  | Pass   | Focused rerun passed with 1 file and 3 tests after one full-suite run crossed Vitest's 5s per-test timeout under worker pressure.                                                                                                                            |
| `pnpm --filter @open-practice/api exec vitest run --reporter=dot`                                                                       | Pass   | Full API Vitest rerun passed with 42 files and 594 tests after updating stale expectations for the enhanced sample titles and required BC intake answers. Node emitted benign `localStorage` experimental warnings and expected route error logs.            |
| `pnpm format:check`                                                                                                                     | Pass   | Prettier check passed after formatting the proof and validation index.                                                                                                                                                                                       |
| `pnpm docs:check`                                                                                                                       | Pass   | Documentation link validation passed.                                                                                                                                                                                                                        |
| `pnpm policy:check`                                                                                                                     | Pass   | Policy gate passed, including tracked-secret scan, package manifest validation, lockfile supply-chain check, toolchain/env checks, architecture, dead-code, migration, OSS reuse, doc-link, proof-index, Docker ignore, and Open Practice boundary checks.   |
| `pnpm proof:reconcile -- --proof docs/validation/OP_CANADIAN_TEMPLATE_SAMPLE_ENHANCEMENTS_PROOF_2026-06-24.md --files <final path set>` | Pass   | Reconciliation passed for 13 paths and the selector-chosen command list after changing the unselected-checks section to avoid a false omission record.                                                                                                       |
| `git diff --check`                                                                                                                      | Pass   | Whitespace check passed.                                                                                                                                                                                                                                     |

## Unselected Checks

Every selector-chosen validation command was run. Docker, browser, migration replay, and E2E checks
were not selected because this branch changes domain template/sample fixtures, API expectations, and
validation docs only; it does not change routes, schemas, migrations, provider behavior, container
configuration, or web UI runtime.

## Boundaries

- All examples remain synthetic and operational.
- Canadian context is pan-Canadian by default and BC-specific only for the existing BC preset/sample
  matters.
- The branch does not add email template drafts, email sending, provider activation, migrations,
  API routes, schemas, dependencies, copied third-party text, client data, private deployment data,
  or legal-advice/certification claims.
