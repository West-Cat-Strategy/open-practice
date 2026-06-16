# Stripe Compatibility Proof

Date: 2026-06-16
Branch: `chore/review-stripe-22-2-1`

## Scope

This isolated dependency-review lane re-tests the reverted June 13 provider/payment patch by
updating only `stripe@22.2.0` to `stripe@22.2.1`.

The lane preserves public API behavior and does not change Checkout Session-only behavior,
idempotency key usage, CAD/lowercase currency handling, metadata posture, no-card-storage posture,
settlement/trust posting behavior, route response shapes, database schema, Docker image pins, or
provider configuration semantics.

## Changed Path Set

Final changed-path selector input:

```text
docs/validation/OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md
docs/validation/README.md
packages/providers/package.json
pnpm-lock.yaml
```

## Dependency Review

Initial lane checks started from the sibling worktree for `origin/main`:

```bash
git status --short --branch
jq '.dependencies.stripe' packages/providers/package.json
pnpm outdated -r --format json
sed -n '1,160p' docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md
```

The outdated inventory included the requested `stripe@22.2.1` candidate plus unrelated `bullmq` and
`nodemailer` updates. The unrelated candidates were not changed.

The dependency update was applied with:

```bash
pnpm add stripe@22.2.1 --filter @open-practice/providers --save-exact
pnpm exec prettier --write pnpm-lock.yaml
```

Diff review confirmed the lane changes only `packages/providers/package.json`, `pnpm-lock.yaml`,
and this proof/index documentation. No source change was needed.

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

Provider payment tests:

```bash
pnpm --filter @open-practice/providers test -- payments/stripe.test.ts
```

Result: passed, 9 files / 20 tests.

API billing/payment-request route tests:

```bash
pnpm --dir apps/api exec vitest run src/routes/billing.test.ts
```

Result: passed, 1 file / 28 tests.

An earlier package-script attempt used `pnpm --filter @open-practice/api test -- billing.test.ts`.
That command expanded into the broad API suite and, while three sibling worktrees were running broad
API suites concurrently, failed with unrelated 5-second Vitest timeouts. The direct Vitest command
above isolates the Checkout Session route behavior and did not reproduce the June 13 timeout
pattern.

## Closeout Validation

Selector:

```bash
pnpm verify:select -- --files docs/validation/OP_DEPENDENCY_STRIPE_COMPAT_PROOF_2026-06-16.md docs/validation/README.md packages/providers/package.json pnpm-lock.yaml
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
pnpm --dir apps/api exec vitest run src/routes/caldav.test.ts
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
```

Result: held. `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`,
`pnpm policy:check`, `git diff --check`, provider build, and worker test/typecheck passed. The
worker test passed 5 files / 40 tests.

The full API package test reached 40 files / 513 tests passed, then failed one unrelated CalDAV test
with a 5-second timeout:

```text
src/routes/caldav.test.ts > CalDAV routes > creates, reads, rejects stale writes, and deletes matter events through CalDAV
Error: Test timed out in 5000ms.
```

The CalDAV file passed when rerun directly with
`pnpm --dir apps/api exec vitest run src/routes/caldav.test.ts`, 1 file / 8 tests. The focused
Stripe billing/payment-request route test remained green and did not reproduce the June 13 broad
timeout pattern.

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
was not run. The Stripe compatibility signal is green, but the candidate remains held until the
repo-level dev audit blocker is resolved or explicitly waived by policy.
