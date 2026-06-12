# License Policy

The core project is Apache-2.0.

Detailed reuse classes and admission rules live in `docs/reuse-decision-policy.md`. This file is the short operational policy for day-to-day contribution review.

## Allowed in Core

- Original project code.
- Permissively licensed dependencies compatible with Apache-2.0.
- Small code excerpts from permissively licensed projects only when notices are preserved, the
  reuse record is documented, and any copied source follows the legal-review path in
  [Reuse Decision Policy](reuse-decision-policy.md).

## Not Allowed in Core Without Review

- Copying AGPL, GPL, LGPL, source-available, or unknown-license implementation code.
- Moving files from `.references/oss/` or the central reference repo store into tracked source directories.
- Adding dependencies with unclear commercial or network-use obligations.

## Optional Services

Copyleft services may be studied as references or run beside the core only after an explicit future integration decision. The current runtime keeps e-signing and intake embedded; a future paperless-style OCR/document-processing service would need a documented boundary.

Optional services must remain separate containers/processes and must not be required for core startup unless an explicit deployment profile enables them.

## Reuse Checklist

Before any third-party source excerpt, vendored asset, or new runtime dependency enters the core, record:

- Source project and URL.
- Exact commit/tag, preferably from `docs/oss-references.lock.json`.
- License.
- Reuse class: Adopt, Wrap, Fork, Reference-Only, Avoid, or Defer.
- Files touched in Open Practice.
- Upstream files or APIs referenced.
- Notices added or confirmed unnecessary.
- Reviewer, decision, and decision date.
- Legal review link when required.

## Current High-Risk Boundaries

- DocuSeal is historical/reference-only for current runtime scope.
- docassemble is historical/reference-only for current runtime scope.
- j-lawyer.org, ArkCase, paperless-ngx, Kimai, LedgerSMB, CiviCRM, and Midaz are clean-room references only.
- Midaz must be treated as Elastic License 2.0 in the pinned clone unless legal review confirms a compatible licensing path.
