# Document Retention And Hold Workflow Design Proof - 2026-06-17

## Scope

- Branch: `docs/document-retention-hold-design-2026-06-17`
- Worktree: `/Users/bryan/projects/open-practice-document-retention-hold-design`
- Base: local `main` at `5f15fc87`

This docs-first slice records the document retention and hold workflow design for future reviewed
implementation planning. It adds a policy-level retention timeline model, hold-blocking rules,
deletion-review gates, and records-disposition wording while preserving the current shipped posture:
document-processing APIs return non-mutating retention-review hints only.

No API route, database schema, migration, repository, UI, worker, provider, dependency, queue,
runtime deletion workflow, retention-deadline enforcement, legal-hold override command, retained
export body, object-storage deletion, or jurisdiction-certified compliance claim was added.

## Source Docs Reviewed

- [OP-T120 document retention-review hints proof](OP-T120_DOCUMENT_RETENTION_REVIEW_HINTS_PROOF_2026-05-25.md),
  for the read-only document-processing retention-review precedent.
- [Contact-history export retention/privacy proof](OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md),
  for cautious retention/export posture and non-goals.
- [Contact-history export, retention, and privacy decision packet](../contact-history-export-retention-privacy-decision-packet.md),
  for transient/regenerated export body and retention/hold language.
- [API and State Machines](../api-and-state-machines.md), for current document-processing,
  portal-document safety, contact retention-hold, and compliance boundary language.
- [Trust/Funds Caveats](../trust-funds-caveats.md) and
  [Deployment Hardening](../deployment-hardening.md), for cautious compliance, audit, backup,
  storage, and production-claim language.
- [License Policy](../license-policy.md) and [Reuse Decision Policy](../reuse-decision-policy.md),
  for clean-room reference boundaries.

## Changed Paths

- `docs/README.md`
- `docs/api-and-state-machines.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/document-retention-hold-workflow-design.md`
- `docs/validation/OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md`

## Validation

Selector command:

```bash
pnpm verify:select -- --files docs/README.md docs/api-and-state-machines.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/document-retention-hold-workflow-design.md docs/validation/OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md
```

Selector output:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Final validation:

```text
PASS pnpm format:check
  - All matched files use Prettier code style.
PASS pnpm docs:check
  - Documentation link validation passed.
PASS pnpm policy:check
  - Tracked-secret scan, package manifest dependency policy, dead-code check, migration parity,
    OSS reuse policy validation, doc links, validation proof index, local-evidence Docker ignore
    validation, and Open Practice boundary policy passed.
PASS git diff --check
```

## Privacy, Reuse, And Compliance Notes

- Synthetic policy examples only; no client, matter, credential, payment, private deployment,
  privileged-document, raw OCR text, raw converted Markdown, annotation body, provider payload,
  storage key, object body, private excerpt, trust evidence, or private audit data was added.
- ArkCase, Nextcloud, paperless-ngx, and related systems remain clean-room reference inputs only.
  No reference source, schema, migration, test, UI, style, asset, sample document, provider payload
  shape, or distinctive prose was copied.
- The design does not make legal-records, records-disposition, retention, privacy, accounting, tax,
  trust, or law-society compliance claims.
