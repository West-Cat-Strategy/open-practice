# Dependency Refresh Proof

Date: 2026-06-23
Branch: `chore/dependency-refresh-20260621`
Worktree: `/Users/bryan/projects/open-practice-dependency-refresh-20260621`

## Scope

This conservative maintenance lane refreshes current patch/minor JavaScript dependency drift only.
It does not change public API behavior, database schema, route contracts, Docker image pins,
runtime container contracts, dependencies beyond the approved set, copied source, vendored assets,
or `pnpm-workspace.yaml` policy.

All examples and validation evidence are synthetic and local-only. This branch does not add or
record client, matter, credential, payment, privileged document, raw provider payload, private
deployment, settlement, trust-posting, or confidential audit details.

Updated direct dependency ranges:

```text
@tiptap/* 3.27.0 -> 3.27.1
@aws-sdk/client-s3 ^3.1071.0 -> ^3.1074.0
@aws-sdk/s3-request-presigner ^3.1071.0 -> ^3.1074.0
bullmq ^5.78.1 -> ^5.79.1
lucide-react 1.20.0 -> 1.21.0
imapflow ^1.4.1 -> ^1.4.2
mailparser ^3.9.10 -> ^3.9.11
stripe 22.2.1 -> 22.2.2
knip 6.17.1 -> 6.18.0
typescript-eslint 8.61.1 -> 8.62.0
```

`@types/node` remains intentionally held at `25.9.3`; the `26.0.0` major candidate is deferred to
a separate compatibility review. `pnpm-workspace.yaml` was reviewed and left unchanged.

## Changed Path Set

Final changed-path selector input after proof and index updates:

```text
apps/api/package.json
apps/web/package.json
apps/worker/package.json
docs/planning-and-progress.md
docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md
docs/validation/README.md
package.json
packages/database/package.json
packages/domain/package.json
packages/providers/package.json
pnpm-lock.yaml
```

## Dependency Review

Baseline evidence before the original manifest changes:

```bash
pnpm outdated -r --format json
pnpm deps:audit
pnpm deps:licenses
```

Result: `pnpm outdated` reported the approved patch/minor candidates plus the held
`@types/node 25.9.3 -> 26.0.0` major. `pnpm deps:audit` passed with no known production or
development vulnerabilities. `pnpm deps:licenses` passed with the existing review-required license
groups.

Fresh 2026-06-23 review before final closeout found additional same-major drift for AWS SDK S3,
BullMQ, Knip, and `typescript-eslint`; those were included in this lane. Final post-refresh
`pnpm outdated -r --format json` reports only:

```text
@types/node 25.9.3 -> 26.0.0
```

`pnpm why nodemailer --recursive` reports a single resolved `nodemailer@9.0.1` version across the
direct providers dependency plus `imapflow@1.4.2` and `mailparser@3.9.11`, preserving the prior
advisory override closure.

The first focused package validation attempt in this fresh sibling worktree failed because built
workspace outputs for `@open-practice/domain`, `@open-practice/database`, and
`@open-practice/providers` were not hydrated yet. After running:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
```

the same package-focused lanes passed. No source changes were needed.

## Validation

Final selector over the dependency/proof path set:

```bash
pnpm verify:select -- --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/planning-and-progress.md docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md docs/validation/README.md package.json packages/database/package.json packages/domain/package.json packages/providers/package.json pnpm-lock.yaml
```

Result: passed. The selector recommended `pnpm ci:local`, dependency audit/license/supply-chain/
optional advisory/source-license scans, architecture/API contract checks, docs/policy checks,
package tests/typechecks/builds, database schema/migration checks, and `pnpm build`.

Selector output:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Dependency and policy-adjacent evidence:

```bash
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm policy:check
```

Result: passed. `pnpm deps:audit` found no known production or development vulnerabilities.
`pnpm deps:licenses` passed with 557 packages / 584 versions and the existing review-required
license groups. `pnpm deps:supply-chain` passed with 5 native-build approval entries reviewed.
`pnpm deps:osv` skipped because `osv-scanner` was unavailable locally and recorded local evidence at
`.tmp/security/osv/2026-06-23T20-08-59Z`. `pnpm license:scan` skipped because ScanCode was
unavailable locally and recorded local evidence at `.tmp/license/scancode/2026-06-23T20-08-59Z`.
`pnpm api:contract` wrote an ignored 310-path OpenAPI inventory under `.tmp`.

Package-focused validation after upstream build hydration:

```bash
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
```

Result: covered by `pnpm ci:local`. API tests passed 42 files / 578 tests; web tests passed 41
files / 216 tests; worker tests passed 5 files / 46 tests; providers tests passed 11 files / 23
tests; domain tests passed 31 files / 235 tests; database tests passed 25 files / 148 tests.

Broad gates:

```bash
pnpm build
pnpm ci:local
```

Result: passed after formatting the regenerated lockfile with
`pnpm exec prettier --write pnpm-lock.yaml`. `pnpm ci:local` passed formatting, lint, typecheck,
workspace tests plus script tests, database schema check, policy checks, all six workspace builds,
and `git diff --check`. The newer `typescript-eslint` version surfaces existing lint warnings, but
the lint gate exits cleanly with zero errors.

Final proof/index reconciliation:

```bash
pnpm verify:select -- --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/planning-and-progress.md docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md docs/validation/README.md package.json packages/database/package.json packages/domain/package.json packages/providers/package.json pnpm-lock.yaml
pnpm proof:reconcile -- --proof docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/planning-and-progress.md docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-21.md docs/validation/README.md package.json packages/database/package.json packages/domain/package.json packages/providers/package.json pnpm-lock.yaml
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Final selector output:

```text
Recommended validation commands:
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm deps:supply-chain
pnpm deps:osv
pnpm license:scan
pnpm architecture:check
pnpm api:contract
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm migrations:lint
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Result: passed after proof/index updates. The final selector matched the 11-path handoff set, proof
reconciliation passed, `pnpm format:check` passed, `pnpm docs:check` passed, `pnpm policy:check`
passed, and `git diff --check` passed as part of `pnpm ci:local`.
