# Self-Hosting Release-Readiness Drill Proof

Date: 2026-06-20
Branch: `chore/self-hosting-release-readiness-20260620`
Worktree: `/Users/bryan/projects/open-practice-self-hosting-release-readiness-20260620`
Base: `main` / `origin/main` at `2873e38f`
Status: Self-host render and Docker app smoke passed; no runtime drift fix was needed.

## Scope

This drill revalidated the checked-in self-hosting profile and local-only release-readiness posture
from current `main`. The root checkout was already occupied by unrelated audit documentation edits,
so validation ran in the clean sibling worktree above.

No changes were made to `docker-compose.selfhost.yml`, `docker/selfhost.example.env`, app runtime
code, package manifests, the lockfile, or Dockerfiles.

## Final Path Set

Selector and validation use this final changed-path set:

```text
docs/planning-and-progress.md
docs/validation/OP_SELF_HOSTING_RELEASE_READINESS_DRILL_PROOF_2026-06-20.md
docs/validation/README.md
```

## Selector Output

```text
$ pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/OP_SELF_HOSTING_RELEASE_READINESS_DRILL_PROOF_2026-06-20.md docs/validation/README.md
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

## Validation

| Command                                                                                   | Status  | Notes                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example` | Pass    | Rendered `docker-compose.selfhost.yml` successfully with the checked-in synthetic env example.                                                                                                         |
| `pnpm docker:app-smoke`                                                                   | Pass    | Built the app smoke images, started PostgreSQL/Redis/MinIO/Mailpit plus API/Web/Worker, confirmed PostgreSQL-backed API health, served the web app, and proved web-origin `/api/setup/status`.         |
| `pnpm docker:residual-watch`                                                              | Blocked | Reason: `node scripts/watch-docker-residuals.mjs` emitted no output for several minutes after dependency hydration and was interrupted with exit code `130`; no residual-watch artifact path emitted.  |
| `pnpm docker:lint`                                                                        | Skipped | Reason: optional local Docker static lint wrapper skipped and wrote `.tmp/docker/lint/2026-06-20T05-52-47Z/docker-lint.json`.                                                                          |
| `pnpm docker:scan`                                                                        | Skipped | Reason: optional local Trivy image scan wrapper skipped and wrote `.tmp/docker/trivy/2026-06-20T06-10-52Z/docker-scan.json`.                                                                           |
| `pnpm e2e:docker`                                                                         | Failed  | Disposable Docker infrastructure, migrations, API, worker, web, and 2 of 3 Playwright tests ran; the Docker dashboard sweep timed out at 240s on `/review/reports` with `page.goto: net::ERR_ABORTED`. |
| `pnpm verify:select -- --files <final path set>`                                          | Pass    | Selected the docs lane: `pnpm format:check`, `pnpm docs:check`, and `pnpm policy:check`.                                                                                                               |
| `pnpm format:check`                                                                       | Pass    | Prettier check passed after formatting the proof note.                                                                                                                                                 |
| `pnpm docs:check`                                                                         | Pass    | Documentation link validation passed.                                                                                                                                                                  |
| `pnpm policy:check`                                                                       | Pass    | Secret scan, package policy, supply-chain, toolchain, env, architecture, dead-code, migration, OSS reuse, docs, proof index, local evidence, and boundary policy checks passed.                        |
| `git diff --check`                                                                        | Pass    | Whitespace check passed on the final docs diff.                                                                                                                                                        |

## Boundaries

- The drill used only checked-in synthetic example env values.
- Local-only validation remains authoritative; no GitHub Actions, hosted required checks, remote
  enforcement, public image publication, or deployment provenance was added.
- No client, matter, credential, payment, privileged document, private deployment, production claim,
  compliance claim, live settlement, or trust-posting detail was added.
