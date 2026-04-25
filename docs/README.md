# Open Practice Documentation

Use this index as the first stop for repo orientation. Open Practice is a legal-practice system, so matter authorization, confidentiality, auditability, trust/funds caution, and clean-room reuse discipline stay central across docs and code.

## Start Here

1. [Architecture](architecture.md) explains the monorepo shape, source-of-truth boundaries, and local-first provider decisions.
2. [Planning](planning.md) is the durable roadmap; [Planning and Progress](planning-and-progress.md) is the live workboard.
3. [Getting Started](development/getting-started.md) covers local runtime choices, services, and environment defaults.
4. [Testing](testing/TESTING.md) maps change types to validation commands.
5. [API and State Machines](api-and-state-machines.md) records the current API and lifecycle contracts.

## Governance

- [Improvement Opportunities](improvement-opportunities.md) tracks the next useful implementation directions.
- [Threat Model](threat-model.md), [Deployment Hardening](deployment-hardening.md), and [Trust/Funds Caveats](trust-funds-caveats.md) define security and compliance posture.
- [OSS References](oss-references.md), [Reuse Decision Policy](reuse-decision-policy.md), [License Policy](license-policy.md), and [OSS reference lockfile](oss-references.lock.json) define clean-room reference and reuse rules.

## Maintenance Rules

- Keep live status in [Planning and Progress](planning-and-progress.md), not scattered across feature docs.
- Keep API examples aligned with implemented routes before publishing them as current behavior.
- Use relative links for local docs and run `pnpm docs:check` after documentation edits.
