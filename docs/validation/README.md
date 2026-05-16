# Validation Proof Index

Use this index for active validation notes, row-local proof, and skipped-check context. The live
workboard remains [Planning and Progress](../planning-and-progress.md); completed historical proof
lives in [Archive](../archive/README.md).

## Start Here

1. Open [Planning and Progress](../planning-and-progress.md) first for current ownership, status,
   and the next move.
2. Use [Testing](../testing/TESTING.md) and `pnpm verify:select -- --files <changed paths...>` to
   choose validation before running checks.
3. Record skipped checks with the reason, especially when a browser, Docker, database, or provider
   dependency is unavailable.
4. Move closed historical proof to [Archive](../archive/README.md) instead of keeping this index as
   a second workboard.

## Active Proof Notes

| Artifact                                                                                                                 | Type                 | Use                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md](OP-T96_PRIVACY_AUTHORIZATION_HARDENING_PROOF_2026-05-16.md) | Row-local proof note | Review proof for audit metadata redaction, overview scoping, inbound status filtering, job visibility pagination, connector payload minimization, OP-T92, and OP-T95. |
| [OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md](OP-T93_CONNECTOR_SECRET_REDACTION_PROOF_2026-05-15.md)           | Row-local proof note | Review proof for connector secret masking, unchanged-secret sentinels, and repository/API/worker redaction semantics.                                                 |

Recent done proof for OP-T89 and OP-T90 remains linked from the live workboard until archived with
the next completed-proof cleanup.

## Proof Discipline

- Keep validation notes synthetic and operational; do not include client, matter, credential,
  payment, private deployment, or privileged document details.
- Prefer row-local notes for multi-command proof, browser evidence, skipped checks, or environmental
  blockers.
- Keep the workboard concise: summarize the latest proof there and link to the row-local note when
  details matter.
- Treat nonprofit-manager as an internal pattern reference only. Do not copy source, proof text, or
  runtime scripts into Open Practice without the reuse review required by
  [License Policy](../license-policy.md).

## Related Docs

- [Testing](../testing/TESTING.md)
- [Planning and Progress](../planning-and-progress.md)
- [Documentation Archive](../archive/README.md)
- [License Policy](../license-policy.md)
