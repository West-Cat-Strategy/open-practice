# Gitleaks History False-Positive Tuning Proof

Date: 2026-06-26 PDT

Branch: `security/gitleaks-history-fixture-tuning-20260626`

Worktree: `/Users/bryan/projects/open-practice-gitleaks-history-fixture-tuning-20260626`

## Scope

Implemented the smallest local-security follow-up for the recurring Gitleaks history findings
recorded in `.tmp/security/gitleaks/2026-06-26T05-25-00Z`.

- Added `.gitleaksignore` with only the 12 reviewed exact fingerprints from the redacted Gitleaks
  report. The entries cover synthetic test/proof fixtures and do not contain matched secret values.
- Updated `pnpm security:secrets-history` to pass `.gitleaksignore` explicitly so each artifact
  records the tuning source in its command arguments.
- Routed `.gitleaksignore` and the Gitleaks wrapper test through the security-review selector lane.
- Documented the boundary that Gitleaks tuning must stay exact-fingerprint-only and must not use
  broad rule, path, regex, or commit allowlists.

No runtime API, schema, dependency, product behavior, external service, GitHub automation, or
clean-room reference boundary changed. The repo-owned `pnpm security:scan` tracked-content scanner
continues to check high-confidence patterns separately without serializing matched secret values.
All examples and proof inputs remain synthetic/local; no client, matter, credential, payment,
private deployment, privileged document, or private audit details were added.

## Preserved Local State

The original checkout at `/Users/bryan/projects/open-practice` was left on
`audit/features-capabilities-parity-20260626` with unrelated dirty validation-doc work preserved.
This branch was created from local `main` at `e21cd343` in the sibling worktree above.

## Final Changed Paths

- `.gitleaksignore`
- `docs/development/github-maintenance.md`
- `docs/testing/TESTING.md`
- `docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md`
- `docs/validation/README.md`
- `scripts/reconcile-validation-proof.mjs`
- `scripts/reconcile-validation-proof.test.mjs`
- `scripts/run-gitleaks-history-scan.mjs`
- `scripts/run-gitleaks-history-scan.test.mjs`
- `scripts/select-validation.mjs`
- `scripts/select-validation.test.mjs`

## Selector Evidence

Final changed-path selection command:

```sh
pnpm verify:select -- --files .gitleaksignore docs/development/github-maintenance.md docs/testing/TESTING.md docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md docs/validation/README.md scripts/reconcile-validation-proof.mjs scripts/reconcile-validation-proof.test.mjs scripts/run-gitleaks-history-scan.mjs scripts/run-gitleaks-history-scan.test.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs
```

Recommended validation commands:

- `pnpm security:review`
- `pnpm security:secrets-history`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`

## Validation

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Result | Notes                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files .gitleaksignore docs/development/github-maintenance.md docs/testing/TESTING.md docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md docs/validation/README.md scripts/reconcile-validation-proof.mjs scripts/reconcile-validation-proof.test.mjs scripts/run-gitleaks-history-scan.mjs scripts/run-gitleaks-history-scan.test.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs`                                                                                         | Passed | Selected the six-command set listed above for the exact final path set.                                                                                                                                                                                           |
| `pnpm security:review -- --files .gitleaksignore docs/development/github-maintenance.md docs/testing/TESTING.md docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md docs/validation/README.md scripts/reconcile-validation-proof.mjs scripts/reconcile-validation-proof.test.mjs scripts/run-gitleaks-history-scan.mjs scripts/run-gitleaks-history-scan.test.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs`                                                                                       | Passed | Artifact `.tmp/open-practice-security-review/2026-06-26T21-42-29Z`; 16 commands, 0 failed required commands, tracked-secret findings `0`, tracked files `1125`, optional scanner statuses all passed.                                                             |
| `pnpm security:secrets-history`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Passed | Artifact `.tmp/security/gitleaks/2026-06-26T21-41-05Z`; status `passed`, report length `0`, and recorded args include `--gitleaks-ignore-path .gitleaksignore`.                                                                                                   |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed | Prettier check passed after wrapping touched Markdown with Prettier.                                                                                                                                                                                              |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Passed | Documentation link validation passed.                                                                                                                                                                                                                             |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed | Policy gate passed, including tracked-secret scan, package manifest policy, lockfile supply-chain, toolchain/env checks, architecture, deadcode, migration parity/lint, OSS reuse, docs, proof index, local-evidence Docker ignore, and Open Practice boundaries. |
| `pnpm test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Passed | Package test graph passed with 9 successful Turbo tasks; `node --test scripts/*.test.mjs` passed 169 script tests, including the focused Gitleaks wrapper, selector, and proof reconciler coverage.                                                               |
| `pnpm proof:reconcile -- --proof docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md --files .gitleaksignore docs/development/github-maintenance.md docs/testing/TESTING.md docs/validation/OP_GITLEAKS_HISTORY_FALSE_POSITIVE_TUNING_PROOF_2026-06-26.md docs/validation/README.md scripts/reconcile-validation-proof.mjs scripts/reconcile-validation-proof.test.mjs scripts/run-gitleaks-history-scan.mjs scripts/run-gitleaks-history-scan.test.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs` | Passed | Proof-vs-selector reconciliation passed for 11 paths and the selected validation command set.                                                                                                                                                                     |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Passed | Whitespace validation passed.                                                                                                                                                                                                                                     |

## Boundary Notes

- `.gitleaksignore` contains exact fingerprints only. It does not contain matched secret values and
  does not add broad Gitleaks rule/path/regex allowlists.
- `pnpm security:scan` remains the tracked-content gate for high-confidence secret patterns.
- GitHub secret scanning, push protection, private vulnerability reporting, and the local-only
  repository posture are unchanged.
