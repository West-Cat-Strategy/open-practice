# Private-Pilot External S3 Restore Drill Proof

Date: 2026-06-24, refreshed 2026-06-26
Branch: `private-pilot/external-s3-env-bootstrap-20260626`
Worktree: `/Users/bryan/projects/open-practice-external-s3-env-bootstrap-20260626`
Base: `main` / `origin/main` at `e21cd343`
Status: Operator env bootstrap and preflight path added; bundled MinIO restore-drill behavior,
private-pilot release defaults, and residual-watch semantics remain unchanged.

## Scope

This proof covers the external HTTPS S3 restore-drill lane and its 2026-06-26 handoff follow-up.
The follow-up adds a safe local-only path around the ignored `.env.selfhost.local` file so real
external S3 evidence can be produced later without committing secrets or reusing the dev `.env`.

- `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`
  still follows the bundled MinIO path: disposable self-host Compose project, synthetic PostgreSQL
  and MinIO markers, `pg_dump`, MinIO data archive, fresh-volume restore, marker checksum
  verification, API `/health`, and web `/api/setup/status`.
- `pnpm selfhost:restore-drill -- --bootstrap-env-file .env.selfhost.local` creates an ignored
  external-S3 operator template only when the target path is ignored and absent. It writes local
  `0600` permissions and placeholder values only.
- `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local --preflight-only` validates an
  ignored operator env, requires external HTTPS S3-compatible storage, rejects placeholders and
  live/provider flags, redacts output, and exits before Docker or S3 actions.
- `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local` remains the real external HTTPS
  S3 evidence command. It should run only after preflight passes; placeholder template preflight is
  not external S3 proof.

No runtime API, database schema, Docker Compose contract, MinIO image pin, package dependency,
residual-watch exit behavior, default `pnpm release:local -- --private-pilot` behavior, live
settlement, trust posting, production email delivery, provider activation, or private-data handling
changed.

## Final Path Set

Selector and validation use this final changed-path set:

```text
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md
docs/validation/README.md
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
```

## Selector Output

`pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
```

## Validation

| Command                                                                                                                                   | Status  | Notes                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test scripts/selfhost-restore-drill.test.mjs`                                                                                     | Pass    | Targeted script tests passed with 15 tests, including bootstrap, ignored-path enforcement, placeholder rejection, inherited live-flag rejection, external HTTPS requirement, and preflight-before-Docker/S3 coverage. |
| `pnpm selfhost:restore-drill -- --bootstrap-env-file .env.selfhost.local`                                                                 | Pass    | Created the ignored external-S3 operator template with placeholder values only; no tracked file was produced.                                                                                                         |
| `git check-ignore -v .env.selfhost.local`                                                                                                 | Pass    | `.gitignore:11` ignores `.env.*`, so the operator env remains untracked.                                                                                                                                              |
| `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local --preflight-only`                                                          | Blocked | Reason: the bootstrapped operator env still has `change-me` placeholder values, so preflight exited before Docker or S3 actions and real external evidence was not run.                                               |
| `pnpm verify:select -- --files <final path set>`                                                                                          | Pass    | Selector chose the bundled-MinIO restore drill, format, docs, policy, and full test checks recorded above.                                                                                                            |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                         | Pass    | Selector-chosen bundled-MinIO restore drill passed with behavior preserved. Redacted local evidence: `.tmp/open-practice-selfhost-restore-drill/2026-06-26T21-47-12Z`.                                                |
| `pnpm format:check`                                                                                                                       | Pass    | First run reported wrapping/style drift in this proof note, `docs/validation/README.md`, and `scripts/selfhost-restore-drill.test.mjs`; targeted Prettier normalization fixed them.                                   |
| `pnpm docs:check`                                                                                                                         | Pass    | Selector-chosen docs link check passed.                                                                                                                                                                               |
| `pnpm policy:check`                                                                                                                       | Pass    | Selector-chosen policy check passed, including secrets, package manifests, supply chain, toolchain, env surface, architecture, dead-code, migrations, docs, proof index, and boundaries.                              |
| `pnpm test`                                                                                                                               | Pass    | Selector-chosen full test command passed: 9 Turbo package tasks plus 173 Node script tests.                                                                                                                           |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md --files <final path set>` | Pass    | Final proof reconciliation passed for all seven changed paths.                                                                                                                                                        |
| `git diff --check`                                                                                                                        | Pass    | Final whitespace check passed.                                                                                                                                                                                        |

## Boundaries

- All checked-in examples and proof wording are synthetic only.
- `.env.selfhost.local` is intentionally ignored. It must not be committed, and the bootstrap
  command must not overwrite an existing operator file.
- Restore-drill evidence redacts env values, endpoints, buckets, credentials, private deployment
  details, client data, matter data, payment data, trust postings, provider payloads, and raw audit
  exports.
- External S3 marker proof uses only synthetic marker bodies, deliberately overwrites the marker
  after backup, restores the original from the backup artifact, and requires no list or delete
  permissions.
- Placeholder `.env.selfhost.local` values are not external S3 proof. Successful external HTTPS S3
  restore-drill evidence, once supplied with real operator values, does not change bundled MinIO
  residual-watch/readiness-blocker semantics.
