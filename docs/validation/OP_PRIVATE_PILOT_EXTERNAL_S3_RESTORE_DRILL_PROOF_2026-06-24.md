# Private-Pilot External S3 Restore Drill Proof

Date: 2026-06-24
Branch: `private-pilot/external-s3-restore-drill-20260624`
Worktree: `/Users/bryan/projects/open-practice`
Base: `main` / `origin/main` at `79e35ece`
Status: Local code-path proof recorded; private-pilot bundled MinIO residual-watch semantics remain
unchanged, and real external HTTPS S3 operator proof remains pending until the ignored local
operator template is replaced with non-placeholder values.

## Scope

This branch extends the self-host restore drill so an ignored operator env that points at an
external HTTPS S3-compatible endpoint can produce the same synthetic restore evidence shape as the
checked-in bundled MinIO profile.

- `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`
  still follows the bundled MinIO path: disposable self-host Compose project, synthetic PostgreSQL
  and MinIO markers, `pg_dump`, MinIO data archive, fresh-volume restore, marker checksum
  verification, API `/health`, and web `/api/setup/status`.
- `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local` now supports external HTTPS
  S3-compatible object storage from an ignored operator env. It uses the same PostgreSQL restore
  drill plus synthetic S3 `PutObject`/`GetObject` marker backup, deliberate overwrite, restore, and
  checksum verification with `S3_SERVER_SIDE_ENCRYPTION=AES256`, `forcePathStyle: true`, and no
  list/delete permission requirement.
- The local `.env.selfhost.local` file is ignored and currently contains only placeholder operator
  values, so it resolves the missing-file preflight while intentionally blocking real external S3
  proof until replaced with actual operator values.
- Admin Readiness and self-host/readiness docs now distinguish successful external HTTPS S3
  restore-drill evidence as manual handoff evidence for an external object-storage path from the
  bundled MinIO residual-watch blocker that still prevents automated green private-pilot release
  proof.

No runtime API, database schema, Docker Compose contract, MinIO image pin, package dependency,
residual-watch exit behavior, default `pnpm release:local -- --private-pilot` behavior, live
settlement, trust posting, production email delivery, provider activation, or private-data handling
changed.

## Final Path Set

Selector and validation use this final changed-path set:

```text
apps/web/app/dashboard/admin-readiness-section.test.tsx
apps/web/app/dashboard/admin-readiness-section.tsx
docs/development/github-maintenance.md
docs/development/self-hosting.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md
docs/validation/README.md
scripts/selfhost-restore-drill.mjs
scripts/selfhost-restore-drill.test.mjs
```

## Selector Output

`pnpm verify:select -- --files <final path set>` returned:

```text
Recommended validation commands:
pnpm architecture:check
pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

| Command                                                                                                                                   | Status  | Notes                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test -f .env.selfhost.local`                                                                                                             | Pass    | Ignored local operator template is present.                                                                                                                                                                                                       |
| `git check-ignore -v .env.selfhost.local`                                                                                                 | Pass    | `.gitignore:11` ignores `.env.*`, so the placeholder operator template stays out of the repo-tracked path set.                                                                                                                                    |
| `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local`                                                                           | Blocked | Reason: `.env.selfhost.local` exists only as an ignored placeholder template with `change-me` values; no real external HTTPS S3 operator values were provided, so external proof was not run.                                                     |
| `pnpm verify:select -- --files <final path set>`                                                                                          | Pass    | Selector chose architecture, default bundled-MinIO restore drill, format, docs, policy, full test, web test, web typecheck, and build checks.                                                                                                     |
| `pnpm architecture:check`                                                                                                                 | Pass    | Selector-chosen architecture check passed with 445 workspace import edges reviewed.                                                                                                                                                               |
| `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`                                         | Pass    | Selector-chosen bundled-MinIO restore drill passed with behavior preserved. Redacted local evidence: `.tmp/open-practice-selfhost-restore-drill/2026-06-26T04-47-50Z`.                                                                            |
| `pnpm format:check`                                                                                                                       | Fixed   | First rerun reported Markdown wrapping in this proof note and `docs/validation/README.md`; `pnpm exec prettier --write docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md docs/validation/README.md` normalized them. |
| `pnpm format:check`                                                                                                                       | Pass    | Selector-chosen formatting check passed after Prettier normalized the docs.                                                                                                                                                                       |
| `pnpm docs:check`                                                                                                                         | Pass    | Selector-chosen docs link check passed.                                                                                                                                                                                                           |
| `pnpm policy:check`                                                                                                                       | Pass    | Selector-chosen policy check passed, including secret scan, package manifest policy, lockfile supply-chain, toolchain, env surface, architecture, dead-code, migration, docs, proof-index, local-evidence, and boundary checks.                   |
| `pnpm test`                                                                                                                               | Pass    | Selector-chosen full test command passed: 9 Turbo package tasks and 161 Node script tests.                                                                                                                                                        |
| `pnpm --filter @open-practice/web test`                                                                                                   | Pass    | Selector-chosen web test passed with 44 files and 230 tests.                                                                                                                                                                                      |
| `pnpm --filter @open-practice/web typecheck`                                                                                              | Pass    | Selector-chosen web typecheck passed.                                                                                                                                                                                                             |
| `pnpm build`                                                                                                                              | Pass    | Selector-chosen build passed across 6 packages.                                                                                                                                                                                                   |
| `pnpm proof:reconcile -- --proof docs/validation/OP_PRIVATE_PILOT_EXTERNAL_S3_RESTORE_DRILL_PROOF_2026-06-24.md --files <final path set>` | Pass    | Final proof reconciliation passed for all 10 changed paths.                                                                                                                                                                                       |
| `git diff --check`                                                                                                                        | Pass    | Final whitespace check passed.                                                                                                                                                                                                                    |

## Boundaries

- All checked-in examples and proof wording are synthetic only.
- Restore-drill evidence redacts env values, endpoints, buckets, credentials, private deployment
  details, client data, matter data, payment data, trust postings, provider payloads, and raw audit
  exports.
- External S3 marker proof uses only synthetic marker bodies, deliberately overwrites the marker
  after backup, restores the original from the backup artifact, and requires no list or delete
  permissions.
- Placeholder `.env.selfhost.local` values are not external S3 proof. Successful external HTTPS S3
  restore-drill evidence, once supplied with real operator values, does not change bundled MinIO
  residual-watch/readiness-blocker semantics.
