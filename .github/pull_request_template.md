## Summary

- What changed:
- Why this path is the smallest safe scope:

## Scope

- Owned paths:
- Files intentionally left out of scope:
- Dirty-worktree or parallel-lane notes:
- Synthetic data only:
  - [ ] This PR includes no client, matter, credential, payment, private deployment, or privileged document data.
  - [ ] Examples, fixtures, screenshots, and validation notes use synthetic data only.

## Validation

- Selector output:
  - Command: `pnpm verify:select -- --files <changed paths...>`
  - Recommended checks:
- Local validation proof:
  - [ ] Ran the selected checks and pasted exact command results in this PR.
  - [ ] Ran `pnpm ci:local` for root config, local gate, lockfile, schema, auth/security, or broad changes.
  - [ ] Ran read-only validation when available.
- Skipped checks:
  - [ ] None.
  - [ ] Listed each skipped check with the reason and any follow-up needed.

## Privacy and Policy

- [ ] No client, matter, credential, payment, private deployment, privileged document, or private audit details included.
- [ ] New dependencies, copied excerpts, vendored assets, or reference-derived code follow `docs/license-policy.md`.
- [ ] `pnpm deps:audit` was run, or no dependency/security/release-readiness files changed.
- [ ] Docs or skill references were updated when workflow, API, deployment, validation, or reuse behavior changed.
