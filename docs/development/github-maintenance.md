# GitHub Maintenance

Use this guide when changing local repository gates, GitHub settings, dependency maintenance,
branch cleanup, pull request hygiene, or release handoff for Open Practice.

## Repository Posture

- Local validation is authoritative. Use `pnpm verify:select -- --files <changed paths...>` to
  choose focused checks, `pnpm ci:local` for broad handoff, and `pnpm release:local` for dependency
  or release-readiness work.
- GitHub Actions, checked-in Actions workflows, Dependency Review, Dependabot auto-merge, CodeQL
  default setup, Copilot automatic review, and Copilot cloud agents are intentionally disabled.
- `main` does not use a required GitHub status check or protected-branch merge gate. Keep branch
  discipline local: start from a branch, do not push directly to `main` unless the user explicitly
  asks, and record local validation evidence before merge or release.
- Keep secret scanning, push protection, the security policy, and private vulnerability reporting
  enabled. They are repository safety settings, not CI/CD gates.
- Prefer synthetic examples in issues and pull requests. Do not publish client, matter, credential,
  payment, privileged document, trust/funds, audit-log, or private deployment details.

## Local Dependency Maintenance

- Use `pnpm deps:audit` for production and development dependency audits.
- Use `pnpm policy:check` for OSS reuse, docs links, tracked-secret scanning, and architecture
  boundary checks.
- For dependency changes, inspect the package path locally with `pnpm list` or `pnpm why`, make the
  smallest manifest or lockfile change, then run `pnpm deps:audit` and `pnpm ci:local`.
- Major updates, runtime dependency updates, vulnerable packages, and license-sensitive updates stay
  manual. Follow [License Policy](../license-policy.md) before adding dependencies or copied
  excerpts.
- Include Docker surfaces in dependency refreshes. Run `docker compose config`, scan base and service
  images with Docker Scout when available, prefer deterministic service tags over `latest`, and
  document residual upstream CVEs that have no safer same-scope image recommendation.

### Docker Dependency Snapshot

2026-05-05 dependency refresh evidence, with the 2026-05-12 infra-image follow-up:

- `node:24.15.0-alpine3.23` is pinned by digest as the app base to avoid a Node major or Debian
  image-family swap. The Dockerfile still updates bundled npm and pnpm explicitly, deploys runtime
  images with production dependencies, and uses Node's built-in `fetch` for API health checks instead
  of installing `curl`. Final local app images, not only the upstream base, are the validation target;
  the upstream Node base still reported the npm `picomatch` high finding in the planning scan.
- The local Postgres service now builds `open-practice-postgres:17-alpine-su-exec` from the pinned
  `postgres:17-alpine` digest and replaces the vulnerable bundled `gosu` helper with Alpine
  `su-exec` while preserving the standard Postgres 17 entrypoint and health-check contract. The
  2026-05-12 local Scout proof reported no critical/high findings for the rebuilt image.
- `redis:8-alpine` replaced `redis:7-alpine` in the local Docker stack because the Scout result
  dropped from critical/high Go runtime findings to no critical/high findings in the current scan.
- `minio/minio:RELEASE.2025-09-07T16-13-09Z` is pinned by digest. Current Docker Hub, Quay, hotfix,
  and common S3-compatible substitute scans still carried critical/high findings or changed the
  service shape, so MinIO stays product-compatible with residual upstream MinIO/Go CVEs documented
  until a cleaner compatible deterministic release is available.
- The local Mailpit service now builds `open-practice-mailpit:v1.29.7-go1.26.3` from the checked
  v1.29.7 source archive on a fixed Go toolchain while preserving SMTP port `1025` and web port
  `8025`. The 2026-05-12 local Scout proof reduced Mailpit to one high finding in the upstream
  `github.com/gomarkdown/markdown` dependency that is still present in v1.29.7, not the older bundled
  Go standard library.

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
configured, and disabled or unavailable Dependabot alert surfaces. Keep the exact command output in
the PR, issue, or release notes when settings change.

## Branches, Pull Requests, And Releases

- Keep branch work scoped to the requested issue, PR, or release task.
- Avoid force pushes unless explicitly requested and safe for the collaboration model.
- Make commit messages describe the user-facing or maintenance outcome, not just the files touched.
- After a squash merge or manual merge, refresh local `main` from `origin/main` before starting the
  next branch.
- For release maintenance, collect changed scope, `pnpm release:local` output, migration notes,
  deployment notes, and any known operational caveats before drafting notes.
