# Application Strengthening Plan

This plan turns the current candidate backlog into an ordered development wave for Open Practice.
It is a clean-room planning artifact: reference projects may inform vocabulary, workflows, state
machines, audit fields, and operator visibility, but product code, schemas, tests, UI, assets, and
distinctive prose must remain original unless a separate reuse decision passes
[License Policy](../license-policy.md) and [Reuse Decision Policy](../reuse-decision-policy.md).

## Development Sequence

| Order | Row    | Strengthening Theme                               | First Slice                                                                                                                 | Reference Inputs                                                                                              |
| ----- | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | OP-T90 | Worker-owned async report/export requests         | Queue audit export requests, expose poll/download semantics, keep report bodies out of job metadata, and bound job listing. | `temporalio__temporal`, `automatisch__automatisch`, `blnkfinance__blnk`, `opencollective__opencollective-api` |
| 2     | OP-T91 | Dashboard lane freshness and error-state controls | Add shared stale/failed/retry cues for sensitive dashboard lanes without widening API payloads.                             | `temporalio__temporal`, `automatisch__automatisch`, `activepieces__activepieces`                              |
| 3     | OP-T92 | Intake/form authoring diagnostics                 | Add staff-side diagnostics for duplicate keys, broken conditions, and missing mapping targets before publish.               | `jhpyle__docassemble`, `formio__formio.js`, `rjsf-team__react-jsonschema-form`, `surveyjs__survey-library`    |
| 4     | OP-T93 | Connector secret masking and redaction hardening  | Define masked-secret reads, unchanged-secret writes, allowlisted connector events, and redacted retry/export paths.         | `activepieces__activepieces`, `automatisch__automatisch`                                                      |
| 5     | OP-T94 | Route and validation boundary ratchets            | Tighten selector strictness and route-family ownership checks for runtime-sensitive changes.                                | `openfga__openfga` plus Open Practice's local validation policy                                               |
| 6     | OP-T95 | Local release proof and SBOM handoff              | Produce a local release proof artifact with audit, license, validation, and SBOM evidence.                                  | Open Practice release docs, central reference validation discipline                                           |

## Reference Map

| Area                      | Repositories                                                                                                                                                           | Reuse Posture                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Workflow/jobs             | `temporalio__temporal`, `automatisch__automatisch`, `activepieces__activepieces`                                                                                       | Use for job history, retries, connector execution, secret-handling, and operator status patterns only.                    |
| Forms/intake              | `jhpyle__docassemble`, `formio__formio.js`, `rjsf-team__react-jsonschema-form`, `surveyjs__survey-library`, `surveyjs__survey-creator`                                 | Use for schema, conditional-logic, builder, and respondent-flow concepts; do not copy builders or specs.                  |
| Documents/sharing/signing | `papermerge__papermerge-core`, `paperless-ngx__paperless-ngx`, `open-source-legal__opencontracts`, `nextcloud__server`, `docusealco__docuseal`, `documenso__documenso` | Use for document lifecycle, review, share-link, activity, and evidence vocabulary; no GPL/AGPL implementation reuse.      |
| Authorization/audit       | `openfga__openfga`, `arkcase__arkcase`, `jlawyerorg__j-lawyer-org`                                                                                                     | Use for relationship and case-workflow modeling only; preserve Open Practice RBAC and audit model.                        |
| Trust/billing/accounting  | `blnkfinance__blnk`, `apache__fineract`, `ledgersmb__ledgersmb`, `kimai__kimai`, `opencollective__opencollective-api`                                                  | Use for idempotency, maker-checker, reconciliation, reporting, and billing vocabulary; no automatic trust ledger posting. |
| Communications/meetings   | `zulip__zulip`, `jitsi__jitsi-meet`, `calcom__cal.diy`                                                                                                                 | Use for topic, retention, lobby, and scheduling concepts; keep realtime chat and native media out of first slices.        |

## Validation Rules

- Start each slice with `pnpm verify:select -- --files <changed paths...>`.
- Record local proof in the validation index or archive before marking rows Done.
- Use synthetic data only in examples, tests, screenshots, and generated reports.
- Keep report bodies, raw audit metadata, secrets, document text, email bodies, and client payloads
  out of job lifecycle metadata.
