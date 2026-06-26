# GitHub Maintenance

Use this guide when changing local repository gates, GitHub settings, dependency maintenance,
branch cleanup, pull request hygiene, or release handoff for Open Practice.

## Repository Posture

- Local validation is authoritative. Use `pnpm verify:select -- --files <changed paths...>` to
  choose focused checks, `pnpm ci:local` for broad handoff, and `pnpm release:local` for dependency
  or release-readiness work.
- GitHub Actions, checked-in Actions workflows, Dependency Review, Dependabot alerts/security
  updates/auto-merge, CodeQL default setup, Copilot automatic review, and Copilot cloud agents are
  intentionally disabled.
- `main` does not use a required GitHub status check or protected-branch merge gate. Keep branch
  discipline local: start from a branch, do not push directly to `main` unless the user explicitly
  asks, and record local validation evidence before merge or release.
- Keep secret scanning, push protection, the security policy, and private vulnerability reporting
  enabled. They are repository safety settings, not CI/CD gates.
- Prefer synthetic examples in issues and pull requests. Do not publish client, matter, credential,
  payment, privileged document, trust/funds, audit-log, or private deployment details.

## Local Security Review Packets

Use the full local security review packet when changing local security tooling, tracked-secret
scanning, dependency/security evidence, or the hot-path rescan helper:

```bash
pnpm security:review
```

The packet writes ignored local evidence under
`.tmp/open-practice-security-review/<timestamp>/`, including selector output, tracked-secret JSON
without matched secret values, dependency audit, license JSON, CycloneDX SBOM, policy output, the
existing hot-path rescan helper, Docker residual watch, and a final secret scan over the generated
artifact. Use `--dirty`, `--files <paths...>`, `--base <ref>`, or `--base-plus-dirty <ref>` to match
the proof selector mode; the default remains dirty-tree review. The packet records a normalized
evidence summary for selector input, tracked-secret counts, dependency license totals, optional
scanner status/skipped reasons, and artifact paths. It also records optional local Gitleaks,
Semgrep, OSV, ScanCode, Hadolint, Checkov, and Trivy wrapper results when those binaries and local
inputs are available; missing optional tooling is reported as skipped local evidence. It keeps
running after failed required commands for diagnosis, then exits nonzero if any required command
failed. It does not run Cosign, enable GitHub Actions, Dependabot, CodeQL default setup, remote
required checks, external SaaS scans, or a formal Codex Security repository-wide scan.

## Hot-Path Security Rescans

Use the local hot-path rescan helper after future edits to inbound email serialization or promotion,
public guest-session token logging, Drizzle audit append code, or document checksum duplicate
locking:

```bash
node scripts/security-hot-path-rescan.mjs
```

The helper is scoped to the narrow follow-up named by the 2026-06-05 Codex Security report:
`apps/api/src/routes/inbound-email.ts`, `apps/api/src/routes/calendar.ts`, and
`packages/database/src/repository/drizzle.ts`. It records ignored local evidence under
`.tmp/security-hot-path-rescan/<timestamp>/`, including command logs, `rescan-proof.json`, and a
Codex Security scoped-rescan prompt that can be reused for a formal scoped-path scan. Use
`--dry-run` to preview the exact command lane and `--artifact-root <path>` when a different ignored
evidence directory is needed.

## Local Dependency Maintenance

- Use `pnpm deps:audit` for production and development dependency audits.
- Use `pnpm deps:supply-chain` for the offline pnpm-lock policy covering non-registry dependency
  refs, registry drift, missing integrity, and native-build approval drift.
- Use `pnpm deps:osv` when `osv-scanner` is installed and a local advisory pass is useful alongside
  `pnpm deps:audit`.
- Use `pnpm deps:review` when a dependency change needs an ignored local review packet containing
  outdated, audit, license, package-manager, and lockfile evidence.
- Use `pnpm license:scan` when ScanCode is installed and copied-source/license-text detection is
  needed beyond dependency license metadata.
- Use `pnpm policy:check` for the combined local policy/integrity gate: tracked-secret scanning,
  package manifest policy, lockfile supply-chain policy, toolchain alignment, env-surface drift,
  architecture import direction, migration parity, migration lint, OSS reuse, docs links,
  validation-proof index, local-evidence `.dockerignore` coverage, and architecture boundary checks.
- For dependency changes, inspect the package path locally with `pnpm list` or `pnpm why`, make the
  smallest manifest or lockfile change, then run `pnpm deps:audit` and `pnpm ci:local`.
- Pnpm workspace policy lives in `pnpm-workspace.yaml`: keep overrides there, keep required native
  build approvals explicit, and leave optional `libxmljs2` builds disabled unless CycloneDX starts
  requiring that native helper for local SBOM generation.
- Major updates, runtime dependency updates, vulnerable packages, and license-sensitive updates stay
  manual. Follow [License Policy](../license-policy.md) before adding dependencies or copied
  excerpts.
- Include Docker surfaces in dependency refreshes. Run `docker compose config`, `pnpm docker:lint`,
  scan base and service images with Docker Scout or `pnpm docker:scan` when available, prefer
  deterministic service tags over `latest`, run `pnpm docker:app-smoke` when app image behavior
  changes, and document residual upstream CVEs that have no safer same-scope image recommendation.
- Use `pnpm release:attest -- --artifact <path> --key <local-key>` only when a local release
  artifact needs explicit Cosign proof. Keep the default no-transparency-log posture unless a
  release task explicitly widens it.
- For self-host profile changes, run
  `pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example` for the
  synthetic render proof, then repeat with the operator's ignored env file before real startup.
- For private self-hosted pilot release handoff, run
  `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`
  for the checked-in synthetic MinIO profile, then repeat
  `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local` with an ignored operator env when
  external HTTPS S3-compatible storage is the private-pilot path. `pnpm release:local -- --private-pilot`
  still includes the default restore drill alongside the release proof and still requires Docker
  residual-watch; external S3 restore evidence is manual release-handoff evidence for an external
  object-storage path and does not make the automated release proof green while bundled MinIO
  residual-watch blockers remain.
  The drill writes only redacted ignored evidence and uses synthetic markers.

### Docker Dependency Snapshot

2026-06-05 Docker image CVE follow-up evidence, building on the 2026-05-28 dependency refresh and
the 2026-05-12 / 2026-05-16 / 2026-06-04 infra-image follow-ups:

- `node:26.3.0-alpine3.23` is pinned by digest as the app base. The Dockerfile updates npm and pnpm
  only in build stages, installs from manifest-first layers with BuildKit caches, deploys runtime
  images with production dependencies, and uses direct service commands instead of a generic
  `pnpm start` runtime default. Final local app images, not only the upstream base, are the
  validation target. The 2026-06-05 Docker follow-up rebuilt API, Web, and Worker on this base; all
  three local app images report `0C`/`0H` in critical/high Scout scans and `0C`/`0H`/`1M`/`0L` in
  quickview.
- The local Postgres service now builds `open-practice-postgres:18-alpine-su-exec` from the pinned
  `postgres:18-alpine` 18.4 digest and replaces the vulnerable bundled `gosu` helper with Alpine
  `su-exec` while preserving the standard Postgres 18 entrypoint and health-check contract. The
  local Dockerfile also upgrades Alpine `libcurl` to at least `8.19.0-r0`, which clears the fixed
  curl finding while leaving two residual no-fixed-version high findings in the current Scout scan;
  Scout reports no base-image recommendation. The 2026-06-04 recheck found no newer Alpine
  `curl`/`libcurl` package than `8.19.0-r0`; upstream `postgres:18-alpine` still scans worse than
  the custom local image because it retains the Go-based `gosu` surface.
- `redis:8.8.0-alpine` is pinned by digest in the local Docker stack because the Scout result
  remains at no critical/high findings in the current scan while keeping a deterministic
  multi-architecture tag and digest.
- The local MinIO service now builds `open-practice-minio:RELEASE.2025-10-15T17-29-55Z-go1.26.4`
  from the upstream `RELEASE.2025-10-15T17-29-55Z` source tag after verifying commit
  `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`. Docker Hub and Quay `latest` still resolve to the old
  pinned `RELEASE.2025-09-07T16-13-09Z` manifest, and neither registry publishes the newer tag, so
  the local wrapped-service image preserves the same Compose S3 contract while moving to the
  digest-pinned Go `1.26.4` builder. The runtime now starts as a non-root user while preserving the
  `/data` volume contract. The 2026-06-05 local Scout scan reports `11C`/`16H`, with the Alpine base
  current and the remaining findings in MinIO/application Go modules; no same-contract base-image
  recommendation clears those residuals.
- The local Mailpit service now builds `open-practice-mailpit:v1.30.2-go1.26.4` from the checked
  v1.30.2 source archive on a fixed Go toolchain while preserving SMTP port `1025` and web port
  `8025`. The runtime starts as a non-root user. The builder is pinned to
  `golang:1.26.4-alpine3.23` by digest, and the source archive SHA-256 is recorded in
  `docker/mailpit/Dockerfile`. The 2026-06-18 residual-watch closeout verified this newer source tag
  before Docker app smoke and Docker E2E validation.
- The 2026-06-05 all-image follow-up artifact is local-only at
  `/tmp/codex-security-scans/open-practice/0484630_20260605T221819Z_docker_followup/summary.md`.
  It records the Compose image inventory, the all-image Scout matrix, and the rationale for closing
  same-contract residuals as fixed where possible and upstream-only where not currently fixable.

### Docker Residual Watch

Use the local residual watch when refreshing the 2026-06-05 Mailpit, MinIO, and Postgres service
image posture without changing Compose contracts:

```bash
pnpm docker:residual-watch
```

The helper reads `docker-compose.yml` plus `docker/postgres/Dockerfile`,
`docker/minio/Dockerfile`, and `docker/mailpit/Dockerfile`, then writes ignored local evidence under
`/tmp/codex-security-scans/open-practice/docker-residual-watch/<timestamp>/`. It reruns the current
Docker Scout quickview, critical/high CVE, and recommendation checks for the three wrapped service
images, probes same-product registry manifests, checks upstream MinIO/Mailpit source tags, and
records MinIO upstream repository archive posture. Exit `0` means the documented residuals still
have no same-contract review candidate, exit `2` means a newer upstream tag, registry manifest,
Scout recommendation, or MinIO private-pilot readiness blocker needs a separate hardening review,
and exit `1` records Docker, Scout, registry, source, or network blockers in the artifact. The
artifact now includes `readinessBlockers` when bundled MinIO reports Critical/High Scout findings or
archived upstream source posture. Keep any actual image pin, base, source-tag, provenance, license,
or Docker E2E change in a separate follow-up proof.

Use the app-image smoke after Dockerfile, Compose command, bind, capability, or runtime dependency
changes:

```bash
pnpm docker:app-smoke
pnpm docker:app-smoke -- --refresh
pnpm docker:app-smoke -- --keep-up
```

The first form validates the app images in a disposable Compose project on alternate loopback ports
and removes disposable volumes afterward. Add `-- --refresh` when the proof needs pinned Redis pulls
and `--pull` image rebuilds. The `--keep-up` form uses the default Compose dev project and leaves the
local dev stack available at web `33000` and API `34000`.

## GitHub Settings Cutover

The repository has no checked-in automation files after the local-only cutover. Repository admins
should keep GitHub-side automation disabled with the UI or `gh api`:

```bash
gh api -X DELETE repos/West-Cat-Strategy/open-practice/branches/main/protection
gh api -X PUT repos/West-Cat-Strategy/open-practice/actions/permissions -F enabled=false
gh api -X PATCH repos/West-Cat-Strategy/open-practice/code-scanning/default-setup -f state=not-configured
gh api -X DELETE repos/West-Cat-Strategy/open-practice/automated-security-fixes
gh api -X DELETE repos/West-Cat-Strategy/open-practice/vulnerability-alerts
```

Copilot automatic review and Copilot cloud-agent access are controlled by GitHub repository or
organization settings/rulesets. Disable them there; no checked-in file is authoritative once
`.github/copilot-instructions.md` and `.github/agents/**` are absent.

Confirm the settings after any cutover:

```bash
gh api repos/West-Cat-Strategy/open-practice/branches/main/protection
gh api repos/West-Cat-Strategy/open-practice/actions/permissions
gh api repos/West-Cat-Strategy/open-practice/code-scanning/default-setup
gh api repos/West-Cat-Strategy/open-practice/vulnerability-alerts
```

Expected results are absent branch protection, disabled Actions permissions, CodeQL default setup not
configured, and disabled or unavailable Dependabot alert/security-update surfaces. Secret scanning,
push protection, the security policy, and private vulnerability reporting should remain enabled.
Keep the exact command output in the PR, issue, or release notes when settings change.

## Branches, Pull Requests, And Releases

- Keep branch work scoped to the requested issue, PR, or release task.
- Avoid force pushes unless explicitly requested and safe for the collaboration model.
- Make commit messages describe the user-facing or maintenance outcome, not just the files touched.
- After a squash merge or manual merge, refresh local `main` from `origin/main` before starting the
  next branch.
- For release maintenance, collect changed scope, the `artifacts/release-local/<timestamp>/`
  artifact from `pnpm release:local`, migration notes, deployment notes, and any known operational
  caveats before drafting notes. The local artifact includes command logs, dependency-license JSON,
  SBOM output, migration replay status, and an artifact-secret scan result. Keep the artifact local
  unless the user explicitly asks to publish it, because command logs are validation evidence rather
  than a public release note.
- `pnpm release:evidence` may also write `.tmp/open-practice-release/release-evidence.json` for a
  compact local inventory when a full release proof is not needed.
