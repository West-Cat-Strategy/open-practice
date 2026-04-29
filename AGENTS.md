# Agent Guide

Open Practice handles legal-practice workflows, so privacy, matter-scoped access, auditability, and clean-room reuse discipline are default requirements.

- Start from a branch, never from a direct `main` push. Record local validation proof before merge or release handoff.
- Use synthetic data only. Never add client, matter, credential, payment, or private deployment details.
- Own the smallest path set needed for the task and do not revert unrelated edits.
- Run `pnpm verify:select -- --files <changed paths...>` before choosing validation.
- Follow `docs/license-policy.md` before adding dependencies, copied excerpts, vendored assets, or reference-derived code.
- Keep examples concise and operational. Avoid speculative production claims.
- Run read-only validation when available and report skipped checks clearly.
- Follow `docs/development/github-maintenance.md` for local-only repository gates, GitHub settings cutover, dependency audits, and branch cleanup.
