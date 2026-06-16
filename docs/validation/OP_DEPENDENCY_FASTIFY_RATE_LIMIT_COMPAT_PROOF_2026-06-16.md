# Fastify Rate Limit Compatibility Proof

Date: 2026-06-16
Branch: `chore/review-fastify-rate-limit-11`

## Scope

This isolated dependency-review lane updates only the API rate-limit plugin from
`@fastify/rate-limit@^10.3.0` to `@fastify/rate-limit@^11.0.0`.

The lane preserves public API behavior and does not change route contracts, provider configuration,
payment behavior, database schema, Docker image pins, or synthetic-data posture.

## Changed Path Set

Final changed-path selector input:

```text
apps/api/package.json
docs/validation/OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md
docs/validation/README.md
pnpm-lock.yaml
```

## Dependency Review

Initial lane checks started from the sibling worktree for `origin/main`:

```bash
git status --short --branch
jq '.dependencies["@fastify/rate-limit"]' apps/api/package.json
pnpm outdated -r --format json
sed -n '1,160p' docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-13.md
```

The outdated inventory included the requested `@fastify/rate-limit@11.0.0` candidate plus unrelated
`bullmq` and `nodemailer` updates. The unrelated candidates were not changed.

The dependency update was applied with:

```bash
pnpm add @fastify/rate-limit@^11.0.0 --filter @open-practice/api
pnpm exec prettier --write pnpm-lock.yaml
```

Diff review confirmed the lane changes only `apps/api/package.json`, `pnpm-lock.yaml`, and this
proof/index documentation. No source change was needed. The existing global and route-local rate
limit registration, redacted keying, and `429` response body
`{ error: "RATE_LIMIT_EXCEEDED", message: "Too many requests" }` remain source-identical.

## Focused Validation

Fresh worktree hydration:

```bash
pnpm install
pnpm --filter @open-practice/domain --filter @open-practice/database --filter @open-practice/providers build
```

Result: passed.

Typecheck:

```bash
pnpm --filter @open-practice/api typecheck
```

Result: passed.

Focused API compatibility tests:

```bash
pnpm --dir apps/api exec vitest run src/server.test.ts src/routes/shares.test.ts src/routes/external-uploads.test.ts src/routes/intake-forms.test.ts
```

Result: passed, 4 files / 92 tests.

An earlier package-script attempt used
`pnpm --filter @open-practice/api test -- server.test.ts shares.test.ts external-uploads.test.ts intake-forms.test.ts`.
That command expanded into the broad API suite and, while three sibling worktrees were running broad
API suites concurrently, failed with unrelated 5-second Vitest timeouts. The direct Vitest command
above is the focused candidate signal for this lane.

## Closeout Validation

Selector:

```bash
pnpm verify:select -- --files apps/api/package.json docs/validation/OP_DEPENDENCY_FASTIFY_RATE_LIMIT_COMPAT_PROOF_2026-06-16.md docs/validation/README.md pnpm-lock.yaml
```

Result: passed. The selector recommended `pnpm ci:local`, `pnpm deps:audit`,
`pnpm deps:licenses`, format/docs/policy checks, API tests, and API typecheck.

Selected checks:

```bash
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
pnpm --filter @open-practice/api test
```

Result: held. `pnpm deps:licenses`, `pnpm format:check`, `pnpm docs:check`,
`pnpm policy:check`, `git diff --check`, and the full API package test passed. The full API package
test passed 41 files / 514 tests.

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
was not run. The rate-limit compatibility signal is green, but the candidate remains held until the
repo-level dev audit blocker is resolved or explicitly waived by policy.
