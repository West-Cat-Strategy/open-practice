# Reuse Decision Policy

The core repository is Apache-2.0. Keep the core independently authored unless a dependency, source excerpt, or service integration has passed this policy.

## Reuse Classes

### Adopt

Use **Adopt** only for dependencies or source excerpts that are compatible with Apache-2.0.

Allowed by default:

- Apache-2.0
- MIT
- BSD-2-Clause / BSD-3-Clause
- ISC
- BlueOak-1.0.0
- CC0-1.0 for non-code metadata

Rules:

- Prefer package dependencies over copied source.
- Preserve upstream copyright and license notices.
- For copied source, add a provenance note identifying project, URL, commit/tag, license, copied files, and local modifications.
- For Apache-2.0 source, carry required NOTICE content into this repo’s third-party notices if the upstream project has a NOTICE file.

### Wrap

Use **Wrap** for tools or services that the Apache-2.0 core talks to through a documented API, CLI, webhook, container, queue, or protocol boundary.

Rules:

- The wrapped project must not be vendored into tracked core source.
- The core must continue to build, test, and run without the wrapped service unless the feature is explicitly optional.
- Integration code must be original and licensed Apache-2.0.
- Configuration must make the external component and its license visible.
- Network/API compatibility does not remove the wrapped project’s own deployment obligations.

Examples:

- DocuSeal is historical/reference-only for the current embedded e-sign runtime.
- A paperless-style OCR/document service may be optional infrastructure, but GPL implementation must not be copied into core.

### Fork

Use **Fork** only when this project intentionally modifies and redistributes an upstream project under that upstream project’s license.

Rules:

- Forks live outside the Apache-2.0 core unless legal approves a compatible relicensing path.
- Forked AGPL/GPL/LGPL/source-available code must not be mixed into `apps/*`, `packages/*`, migrations, tests, or shared scripts.
- Publish fork source and notices according to the upstream license before distribution or hosted use when required.
- Legal review is required before relying on a fork in production.

No project is approved for forking in the next development phase.

### Reference-Only

Use **Reference-Only** for studying architecture, vocabulary, UX flows, data models, threat models, workflows, and domain concepts.

Rules:

- Do not copy code, schemas, migrations, tests, generated files, UI markup, styles, or distinctive expression.
- Do not translate functions line by line.
- Do not port class/module structure directly.
- Write new implementation from product requirements and local domain tests.
- Cite the reference in docs/issues when it materially influenced a design.

Reference-only projects in the current set:

- j-lawyer.org: AGPL-3.0
- Kimai: AGPL-3.0
- CiviCRM: AGPL-3.0 with licensing exception
- paperless-ngx: GPL-3.0
- LedgerSMB: GPL-2.0
- ArkCase: LGPL-3.0, unless legal approves a narrow LGPL dependency/linking plan
- Midaz pinned clone: Elastic License 2.0

### Avoid

Use **Avoid** for licenses or terms that are unknown, proprietary, source-available with field-of-use/SaaS restrictions, noncommercial, no-derivatives, Commons Clause, SSPL, BUSL, or custom terms.

Rules:

- Do not add as a dependency.
- Do not copy source.
- Do not vendor assets.
- Do not use in production infrastructure without legal review.
- If the project is useful, keep it reference-only or replace it with a permissive alternative.

### Defer

Use **Defer** when a project is potentially useful but outside v1 scope.

Rules:

- Do not shape current architecture around deferred projects.
- Keep notes in the matrix, but avoid adding APIs, schemas, or UI for deferred product areas.
- Revisit only when a product milestone explicitly brings that domain into scope.

## Dependency Admission

A new dependency may enter the Apache-2.0 core only when all are true:

1. It has an SPDX-identifiable license.
2. The license is on the default-allow list or has explicit legal approval.
3. Its transitive dependency tree has been scanned.
4. It does not impose network-use source disclosure, field-of-use limits, attribution UI requirements, noncommercial terms, or managed-service restrictions.
5. It is recorded in the dependency lockfile.
6. Runtime dependencies are reviewed more strictly than dev/test-only tools.
7. Generated code is reviewed under the generator and input schema licenses before commit.

Default deny:

- AGPL
- GPL
- LGPL, unless legal approves the exact linking/distribution model
- MPL/EPL/CDDL, unless legal approves file-level copyleft handling
- Elastic License, SSPL, BUSL, Commons Clause, noncommercial, no-derivatives, proprietary, custom, or unknown licenses

## Reuse Checklist

Any direct reuse proposal must record:

- Source project and URL.
- Exact commit/tag, preferably matching `docs/oss-references.lock.json`.
- License and compatibility decision.
- Reuse class: Adopt, Wrap, Fork, Reference-Only, Avoid, or Defer.
- Files touched in Open Practice.
- Upstream files or APIs referenced.
- Required notices and where they were added.
- Reviewer and decision date.
- Legal-review link if required.

## Notices

For every adopted third-party code excerpt or vendored asset:

- Preserve copyright headers.
- Preserve license text.
- Add required NOTICE text for Apache-2.0 works.
- Record provenance: upstream name, URL, commit/tag, license, files copied, reason for reuse, and modifications.
- Keep notices with distributed artifacts, container images, and generated bundles when applicable.

MIT/BSD/ISC code requires copyright and permission text retention. Apache-2.0 code requires license retention, modification notices where applicable, and NOTICE propagation when upstream provides NOTICE content.

## Optional Copyleft Services

Copyleft services may be run beside the core only as optional external services.

Rules:

- Keep the service in its own container/process/repository.
- Communicate over stable external interfaces.
- Do not copy service internals into the Apache-2.0 core.
- Do not make core startup depend on the service unless the deployment profile explicitly enables it.
- Document source-offer, attribution, and modification obligations for the service operator.
- For AGPL services exposed over a network, assume modified service source must be offered to users of that service.
- If a future DocuSeal integration is reintroduced, retain required interactive UI attribution under its AGPL additional terms.

## Legal Review Required

Legal review is required before:

- Copying any third-party source into tracked core files.
- Adding AGPL/GPL/LGPL/MPL/EPL/CDDL/source-available/custom-license dependencies.
- Shipping optional copyleft services in a hosted production deployment.
- Modifying and redistributing DocuSeal, paperless-ngx, Kimai, CiviCRM, j-lawyer.org, LedgerSMB, ArkCase, or Midaz.
- Depending on a project whose README and LICENSE disagree.
- Importing generated code from OpenAPI/GraphQL/protobuf schemas with unclear licensing.
- Using upstream trademarks, logos, screenshots, sample data, forms, legal templates, or jurisdiction-specific compliance content.
- Making public claims of trust-account, legal-records, retention, e-signature, or law-society compliance.
