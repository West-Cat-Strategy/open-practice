# GitHub Maintenance

Use this guide when changing GitHub automation, repository settings, branch protection, dependency
updates, or AI-assisted maintenance for Open Practice.

## Repository Posture

- Prefer GitHub-native tooling before adding third-party bots.
- Keep `main` protected: PR-only updates, strict required status check named `verify`, conversation
  resolution, admin enforcement, no force pushes, and no branch deletion.
- Prefer squash merges for a linear, reviewable default branch. After a squash merge, refresh local
  `main` from `origin/main` before starting the next branch.
- Keep GitHub Actions read-only by default. Grant elevated permissions only in the one workflow/job
  that needs them.
- Keep secret scanning, push protection, Dependabot security updates, and the security policy enabled.
- Use CodeQL default setup for code scanning; add a checked-in CodeQL workflow only if default setup is
  insufficient for the repo.
- Fix CodeQL findings first. If a finding is a verified framework-model false positive, keep the
  underlying control in code, add regression evidence, and dismiss only the specific alert with a
  false-positive reason and audit comment. Do not disable CodeQL or remove a query for a single
  documented false positive.

## Dependency Updates

- Dependabot owns npm and GitHub Actions version update PRs.
- Low-risk auto-merge is limited to green Dependabot PRs for patch/minor development dependencies and
  patch/minor GitHub Actions updates.
- Major updates, production/runtime dependency updates, security-alert PRs, vulnerable updates, and
  license-sensitive updates stay manual.
- The auto-merge workflow requires `DEPENDABOT_METADATA_TOKEN` as a Dependabot secret with read access
  to Dependabot alerts. If that token is missing, the workflow fails closed instead of risking a
  security-alert auto-merge.
- Repository administrators own changes to branch protection, auto-merge settings, code scanning
  setup, and Dependabot/GitHub Actions secrets. Record any settings changes in the PR summary.
- Dependency review should fail pull requests that introduce high or critical vulnerabilities or
  licenses outside [License Policy](../license-policy.md).
- If several Dependabot PRs touch the same workflow or lockfile, merge one, let Dependabot rebase the
  rest, then wait for fresh checks before merging.

## Agent And Copilot Policy

- Use Copilot code review as an advisory reviewer on pull requests; human review remains authoritative.
- Assign cloud/custom agents only to issues labeled `agent-ready` and `risk:low`.
- Agent work must start from an issue, use synthetic data only, and open draft PRs.
- Agents must not handle secrets, real client or matter data, privileged documents, trust records,
  deployment credentials, or incident response details.
- Custom agents should stay narrow:
  - planning agents may edit docs/spec/planning files only;
  - test-maintenance agents may edit tests and fixtures, and may touch production code only when the
    issue explicitly says the implementation is faulty.

## Local Branch Hygiene

After a protected-branch squash merge, local branches may contain pre-squash commits. Before starting
new work:

```bash
git fetch origin --prune
git status --short --branch
git branch backup/main-pre-squash-<short-sha> <stale-sha>
git switch main
git reset --hard origin/main
git switch -c codex/<short-task-name>
```

Do not reset a dirty worktree. Preserve unrelated user work and ask before discarding any local-only
changes.

## Validation

For GitHub automation changes, run:

```bash
pnpm verify:select -- --files <changed paths...>
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm verify
git diff --check
```

After pushing a PR, confirm GitHub `verify`, dependency review, CodeQL/default setup status, and
Copilot review status where applicable.
