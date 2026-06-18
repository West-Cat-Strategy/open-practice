# Open Practice Documentation

The root [README](../README.md) is the GitHub-facing overview. Use this index as the canonical
internal documentation map for repo orientation. Open Practice is a legal-practice system, so matter
authorization, confidentiality, auditability, trust/funds caution, and clean-room reuse discipline
stay central across docs and code.

## Start Here

1. [Architecture](architecture.md) explains the monorepo shape, source-of-truth boundaries, and local-first provider decisions.
2. [Tech Stack](tech-stack.md) records accepted, deferred, and rejected stack choices with upstream source links.
3. [Planning](planning.md) is the durable roadmap; [Planning and Progress](planning-and-progress.md)
   is the live workboard.
4. [Getting Started](development/getting-started.md) covers local runtime choices, services, and environment defaults.
5. [Repository Guide](development/repo-guide.md) maps workspace ownership, boundaries, and common edit paths.
6. [GitHub Maintenance](development/github-maintenance.md) covers local-only repository gates,
   GitHub settings posture, dependency audits, branch cleanup, and release handoff.
7. [Application Strengthening Plan](development/application-strengthening-plan.md) records the
   ordered hardening wave and clean-room reference map.
8. [Testing](testing/TESTING.md) maps change types to validation commands.
9. [Validation Proof Index](validation/README.md) indexes validation notes and skipped-check context;
   live ownership and row status stay in [Planning and Progress](planning-and-progress.md).
10. [API and State Machines](api-and-state-machines.md) records the current API and lifecycle contracts.

## Governance

- [Improvement Opportunities](improvement-opportunities.md) tracks the next useful implementation directions.
- [Documentation Archive](archive/README.md) preserves historical planning snapshots and completed
  workboard proof that is no longer active status.
- [Threat Model](threat-model.md), [Deployment Hardening](deployment-hardening.md),
  [Trust/Funds Caveats](trust-funds-caveats.md),
  [Payment Import And Deposit Matching Boundary Packet](payment-import-deposit-matching-boundary-packet.md),
  [Contact-History Export, Retention, And Privacy Decision Packet](contact-history-export-retention-privacy-decision-packet.md),
  and [Document Retention And Hold Workflow Design](document-retention-hold-workflow-design.md)
  define security, compliance, retention, and privacy posture.
- [OSS References](oss-references.md), [Reference Repos](reference-repos.md), [Reference Review 2026-05-12](reference-review-2026-05-12.md), [Clio Product Specification Review 2026-05-26](reference-review-clio-2026-05-26.md), [Reuse Decision Policy](reuse-decision-policy.md), [License Policy](license-policy.md), and [OSS reference lockfile](oss-references.lock.json) define clean-room reference and reuse rules.
- [Maintenance](development/maintenance.md) and [Agent Workflows](development/agent-workflows.md)
  define ongoing upkeep and AI-assisted development practices.

## Maintenance Rules

- Keep live status in [Planning and Progress](planning-and-progress.md), not scattered across feature docs.
- Keep API examples aligned with implemented routes before publishing them as current behavior.
- Use `pnpm verify:select -- --files <changed docs...>` first, then run the selected docs checks.
