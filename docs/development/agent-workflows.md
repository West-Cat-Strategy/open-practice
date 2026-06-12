# Agent Workflows

This guide is for Codex and other AI-assisted maintenance in Open Practice. It complements
[Repository Guide](repo-guide.md), [Maintenance](maintenance.md),
[GitHub Maintenance](github-maintenance.md), and [Testing](../testing/TESTING.md).

## Skill Entry Point

Use the local Codex skill `$develop-open-practice` for this repository. The skill lives at `/Users/bryan/.codex/skills/develop-open-practice` and points to compact references for workspace ownership, validation, domain invariants, API/web workflows, docs policy, and deployment concerns.

Because the skill is outside the repo, tracked docs remain the durable source of truth. Refresh both when a workflow changes.

Repository work uses local agent sessions and local validation evidence. GitHub-hosted Copilot
agents, automatic review, and Actions-backed checks are intentionally disabled; keep any future
change to that posture documented in [GitHub Maintenance](github-maintenance.md).

## Start Of Task

1. Check `git status --short --branch`.
2. Read existing diffs before editing files that are already modified.
3. Identify the owning workspace from [Repository Guide](repo-guide.md).
4. Read the smallest relevant source docs and tests.
5. Use `pnpm verify:select -- --files <paths...>` to choose the first validation lane.

Do not revert unrelated dirty work. If existing changes affect the task, work with them and keep the final summary clear about what was touched.

After merges to `main`, refresh local `main` from `origin/main` before starting a new branch. Back
up stale local-only commits first.

## Implementation Habits

- Follow existing package patterns before adding abstractions.
- Keep route behavior, domain invariants, repository behavior, docs, and tests aligned when the public contract changes.
- Prefer module-owned API registrars over expanding `apps/api/src/server.ts`.
- Use shared HTTP validation, response, and auth helpers for new API work.
- Keep provider-specific runtime details out of `packages/domain`.
- Keep UI controls permission-aware without relying on the UI as the enforcement boundary.

## Documentation Habits

- Add new docs to [docs/README.md](../README.md).
- Keep live status in [Planning and Progress](../planning-and-progress.md), not in feature docs.
- Keep long-lived direction in [Planning](../planning.md).
- Keep API and lifecycle contracts in [API and State Machines](../api-and-state-machines.md).
- Keep local links relative. For docs-only edits, run
  `pnpm verify:select -- --files <changed docs...>` first, then run the selected docs checks.

## Validation Habits

Use the narrowest safe command first, then broaden when work crosses package boundaries. Typical final checks:

- Documentation-only: start with `pnpm verify:select -- --files <changed docs...>`, then run the
  selected docs checks, usually `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, and
  `git diff --check`.
- API or auth: API tests, API typecheck, `pnpm policy:check`, and broader verification for cross-cutting behavior.
- Domain rules: domain tests and typecheck, plus API tests when routes expose the rule.
- Database schema or repository: database tests, `db:check`, database typecheck, API tests, and migration confidence when needed.
- Web dashboard or route catalog: web tests, web typecheck, and `pnpm build`.
- Broad handoff: `pnpm ci:local`.
- Dependency or release-readiness work: `pnpm deps:audit` and `pnpm release:local`.
- GitHub settings cutover: use read-only `gh api` checks after any admin-side changes to confirm
  Actions, branch protection, CodeQL default setup, Dependabot, and Copilot automation stay disabled.

## Handoff

Summaries should name the changed surfaces, the validation commands run, and any residual risk. If checks were skipped, say why. For docs and skills work, include both repo validation and skill validation results.
