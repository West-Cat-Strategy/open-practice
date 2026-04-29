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
