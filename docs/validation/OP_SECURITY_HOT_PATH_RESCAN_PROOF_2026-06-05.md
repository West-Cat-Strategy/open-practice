# Open Practice Security Hot-Path Rescan Command Proof - 2026-06-05

## Scope

- Branch: `security/hot-path-rescan-command-2026-06-05`
- Source report:
  `/tmp/codex-security-scans/open-practice/696df7c_20260605T215920Z/report.md`
- Purpose: codify the report's narrow follow-up rescan path for future edits to inbound email
  redaction or document promotion, public guest-session token logging, Drizzle audit append
  semantics, or checksum/advisory-lock duplicate handling.
- Data posture: synthetic validation only. No client, matter, credential, payment, private
  deployment, raw MIME, signing material, storage key, or private note content was added.

## Result

Added `scripts/security-hot-path-rescan.mjs` as a repo-local helper that runs:

1. Hot-path `pnpm verify:select -- --files ...`.
2. Scoped `pnpm security:scan -- --path ...` over the three report-named files.
3. Focused API and database Vitest files for inbound email, guest-token logging, audit append, and
   inbound attachment duplicate behavior.
4. The package gates selected by `scripts/select-validation.mjs` for the three hot paths.

The helper writes ignored local evidence under `.tmp/security-hot-path-rescan/<timestamp>/`,
including command logs, `rescan-proof.json`, and `codex-security-scoped-rescan.md` for a future
formal Codex Security scoped-path rerun. It does not replace a full Codex Security scan and does
not change application behavior, route contracts, database schema, package manifests, or the live
workboard.

## Changed Paths

```text
docs/development/github-maintenance.md
docs/validation/OP_SECURITY_HOT_PATH_RESCAN_PROOF_2026-06-05.md
docs/validation/README.md
scripts/security-hot-path-rescan.mjs
scripts/security-hot-path-rescan.test.mjs
```

## Validation

| Command                                                                                                                                                                                                                                         | Result                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/security-hot-path-rescan.mjs --dry-run`                                                                                                                                                                                           | Passed; wrote ignored dry-run evidence under `.tmp/security-hot-path-rescan/2026-06-06T05-01-17Z`.                                                                                   |
| `node --test scripts/security-hot-path-rescan.test.mjs`                                                                                                                                                                                         | Passed: 6 tests.                                                                                                                                                                     |
| `pnpm verify:select -- --files scripts/security-hot-path-rescan.mjs scripts/security-hot-path-rescan.test.mjs docs/development/github-maintenance.md docs/validation/README.md docs/validation/OP_SECURITY_HOT_PATH_RESCAN_PROOF_2026-06-05.md` | Passed; selected `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and `pnpm test`.                                                                                       |
| `pnpm exec prettier --check scripts/security-hot-path-rescan.mjs scripts/security-hot-path-rescan.test.mjs docs/development/github-maintenance.md docs/validation/README.md docs/validation/OP_SECURITY_HOT_PATH_RESCAN_PROOF_2026-06-05.md`    | Passed for this slice's final changed paths.                                                                                                                                         |
| `pnpm format:check`                                                                                                                                                                                                                             | Blocked by unrelated untracked `scripts/watch-docker-residuals.mjs`; this slice's files passed the targeted Prettier check above.                                                    |
| `pnpm docs:check`                                                                                                                                                                                                                               | Passed.                                                                                                                                                                              |
| `pnpm policy:check`                                                                                                                                                                                                                             | Passed after the unrelated Docker residual proof file appeared in the dirty tree; policy includes tracked-secret, package-manifest, migration, OSS reuse, docs, and boundary checks. |
| `pnpm test`                                                                                                                                                                                                                                     | Package test suites and this slice's script test passed, then the root script-test phase was blocked by unrelated untracked `scripts/watch-docker-residuals.test.mjs` failures.      |
| `node scripts/security-hot-path-rescan.mjs`                                                                                                                                                                                                     | Passed; wrote ignored end-to-end helper evidence under `.tmp/security-hot-path-rescan/2026-06-06T05-09-42Z`.                                                                         |

Full-format and full-root-test blockers were preserved rather than edited because the Docker
residual watch files and package-script change are outside this hot-path rescan command scope.
