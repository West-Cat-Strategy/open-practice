# PDFKit Compatibility Proof

Date: 2026-06-16
Branch: `chore/review-pdfkit-0-19`

## Scope

This isolated dependency-review lane updates only the provider PDF renderer from `pdfkit@0.18.0`
to `pdfkit@0.19.1`.

The lane preserves public API behavior and does not change draft export shape, content type,
extension, PDF header expectations, server-owned synthetic rendering behavior, route contracts,
database schema, Docker image pins, provider configuration semantics, or payment behavior.

## Changed Path Set

Final changed-path selector input:

```text
docs/validation/OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md
docs/validation/README.md
packages/providers/package.json
pnpm-lock.yaml
```

## Dependency Review

Initial lane checks started from the sibling worktree for `origin/main`:

```bash
git status --short --branch
jq '.dependencies.pdfkit, .devDependencies["@types/pdfkit"]' packages/providers/package.json
pnpm outdated -r --format json
sed -n '1,160p' docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md
```

The outdated inventory included the requested `pdfkit@0.19.1` candidate plus unrelated `bullmq` and
`nodemailer` updates. The unrelated candidates were not changed.

The dependency update was applied with:

```bash
pnpm add pdfkit@0.19.1 --filter @open-practice/providers --save-exact
pnpm exec prettier --write pnpm-lock.yaml
```

Diff review confirmed the lane changes only `packages/providers/package.json`, `pnpm-lock.yaml`,
and this proof/index documentation. No source change was needed, and `@types/pdfkit` did not require
an update.

## Focused Validation

Fresh worktree hydration:

```bash
pnpm install
pnpm --filter @open-practice/domain --filter @open-practice/database --filter @open-practice/providers build
```

Result: passed.

Provider typecheck:

```bash
pnpm --filter @open-practice/providers typecheck
```

Result: passed.

Provider draft export tests:

```bash
pnpm --filter @open-practice/providers test -- draft-exports.test.ts
```

Result: passed, 9 files / 20 tests.

API draft route tests:

```bash
pnpm --dir apps/api exec vitest run src/routes/drafts.test.ts
```

Result: passed, 1 file / 14 tests.

An earlier package-script attempt used `pnpm --filter @open-practice/api test -- drafts.test.ts`.
That command expanded into the broad API suite and, while three sibling worktrees were running broad
API suites concurrently, failed with unrelated 5-second Vitest timeouts. The direct Vitest command
above is the focused API draft-export signal for this lane.

## Closeout Validation

Selector:

```bash
pnpm verify:select -- --files docs/validation/OP_DEPENDENCY_PDFKIT_COMPAT_PROOF_2026-06-16.md docs/validation/README.md packages/providers/package.json pnpm-lock.yaml
```

Result: passed. The selector recommended `pnpm ci:local`, `pnpm deps:audit`,
`pnpm deps:licenses`, format/docs/policy checks, API tests, provider tests/typecheck/build, and
worker tests/typecheck.

Selected checks:

```bash
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
```

Result: held. `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`,
`pnpm policy:check`, `git diff --check`, provider build, worker test/typecheck, and the full API
package test passed. The worker test passed 5 files / 40 tests. The full API package test passed
41 files / 514 tests.

`pnpm deps:audit` failed after production audit passed with no known vulnerabilities. The dev audit
reported shared tooling advisories outside this candidate:

```text
vite >=8.0.0 <=8.0.15 via .>vitest>vite
- GHSA-fx2h-pf6j-xcff, high, patched in >=8.0.16
- GHSA-v6wh-96g9-6wx3, moderate, patched in >=8.0.16

js-yaml <=4.1.1 via .>@cyclonedx/cyclonedx-npm>xmlbuilder2>js-yaml
- GHSA-h67p-54hq-rp68, moderate, patched in >=4.1.2
```

Because the required dependency audit gate is red, this lane is not merge-ready and `pnpm ci:local`
was not run. The PDFKit compatibility signal is green, but the candidate remains held until the
repo-level dev audit blocker is resolved or explicitly waived by policy.
