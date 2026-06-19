# Dependency Refresh Proof

Date: 2026-06-19
Branch: `chore/dependency-refresh-20260619`
Worktree: `/Users/bryan/projects/open-practice-deps-20260619`

## Scope

This maintenance slice refreshes the current security plus patch/minor dependency candidates from a
fresh sibling worktree. It preserves public API contracts, provider behavior, database schema, Docker
image pins, runtime container contracts, and synthetic-data posture.

- Updated direct package ranges for the current AWS S3, BullMQ, TipTap, ProseMirror model, Lucide,
  Playwright, Knip, TypeScript ESLint, Vitest, IMAP, mailparser, and Nodemailer candidates.
- Added a `pnpm-workspace.yaml` override for `nodemailer@9.0.1` so transitive IMAP and mailparser
  paths cannot retain vulnerable `9.0.0` or 8.x copies.
- Kept `@cyclonedx/cyclonedx-npm@4.2.1` held because the available `5.0.0` update is a separate
  major release-tooling compatibility review.
- Left Stripe, Dockerfiles, Compose files, provider source, runtime behavior, and public docs
  unchanged.

## Changed Path Set

Final changed-path selector input:

```text
apps/api/package.json
apps/web/package.json
apps/worker/package.json
docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md
docs/validation/README.md
package.json
packages/database/package.json
packages/domain/package.json
packages/providers/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Dependency Review

Pre-refresh evidence:

```bash
git status --short --branch
node -v && pnpm -v && pnpm outdated -r --format json
pnpm deps:audit
pnpm deps:licenses
pnpm why nodemailer --recursive
```

Results:

- Worktree started clean on `chore/dependency-refresh-20260619...origin/main`.
- Runtime was Node `v26.3.0` and pnpm `11.5.3`.
- `pnpm deps:audit` failed on high advisory
  `GHSA-p6gq-j5cr-w38f`: vulnerable Nodemailer versions `<=9.0.0`, patched in `>=9.0.1`.
- `pnpm why nodemailer --recursive` showed two vulnerable installed versions:
  `8.0.10` through `imapflow@1.4.0` and `mailparser@3.9.9`, plus direct `8.0.11`.
- `pnpm deps:licenses` passed with 562 packages / 589 versions and the existing review-required
  license groups.

Updated package ranges:

```text
@aws-sdk/client-s3 ^3.1068.0 -> ^3.1071.0
@aws-sdk/s3-request-presigner ^3.1068.0 -> ^3.1071.0
@playwright/test 1.60.0 -> 1.61.0
@tiptap/* 3.26.1 -> 3.27.0
bullmq ^5.78.0 -> ^5.78.1
imapflow ^1.3.7 -> ^1.4.1
knip 6.16.1 -> 6.17.1
lucide-react 1.18.0 -> 1.20.0
mailparser ^3.9.9 -> ^3.9.10
nodemailer ^8.0.11 -> 9.0.1
prosemirror-model 1.25.8 -> 1.25.9
typescript-eslint 8.61.0 -> 8.61.1
vitest 4.1.8 -> 4.1.9
```

Post-refresh evidence:

```bash
pnpm install
pnpm why nodemailer --recursive
pnpm outdated -r --format json
pnpm deps:audit
pnpm deps:licenses
```

Results:

- `pnpm why nodemailer --recursive` reports a single `nodemailer@9.0.1` version shared by the direct
  provider dependency, `imapflow@1.4.1`, and `mailparser@3.9.10`.
- `pnpm outdated -r --format json` reports only the intentionally held
  `@cyclonedx/cyclonedx-npm 4.2.1 -> 5.0.0` major candidate.
- `pnpm deps:audit` passed for production and development dependencies with no known
  vulnerabilities.
- `pnpm deps:licenses` passed with 562 packages / 589 versions and the existing review-required
  license groups.

## Validation

Fresh worktree hydration:

```bash
pnpm --filter @open-practice/domain build
```

Result: passed. An initial parallel database build and provider focused run started before the domain
build output existed and failed with missing `@open-practice/domain`; rerunning after the domain
build cleared that fresh-worktree hydration issue.

Focused provider compatibility:

```bash
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/providers typecheck
pnpm --filter @open-practice/providers build
```

Result: passed. Provider tests passed 9 files / 20 tests under Vitest `4.1.9`.

Closeout validation:

```bash
pnpm verify:select -- --files apps/api/package.json apps/web/package.json apps/worker/package.json docs/validation/OP_DEPENDENCY_REFRESH_PROOF_2026-06-19.md docs/validation/README.md package.json packages/database/package.json packages/domain/package.json packages/providers/package.json pnpm-lock.yaml pnpm-workspace.yaml
pnpm ci:local
git diff --check
```

Selector result: passed. It recommended `pnpm ci:local`, `pnpm deps:audit`, `pnpm deps:licenses`,
format/docs/policy checks, the affected package tests/typechecks/builds, database schema/migration
checks, and `pnpm build`.

Dependency gates:

```bash
pnpm deps:audit
pnpm deps:licenses
```

Result: passed. `pnpm deps:audit` reported no known production or development vulnerabilities.
`pnpm deps:licenses` passed with 562 packages / 589 versions and the existing review-required
license groups.

Full local gate:

```bash
pnpm ci:local
```

Result: passed. The run covered formatting, Turbo lint/typecheck/test, script tests, database schema
check, policy checks, production build, and the built-in `git diff --check`. Package test summaries
included domain 31 files / 222 tests, database 23 files / 136 tests, providers 9 files / 20 tests,
web 37 files / 202 tests, worker 5 files / 46 tests, API 42 files / 560 tests, and script tests 63
tests.

Whitespace follow-up:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
git diff --check
```

Result: passed after recording the final proof text and validation index entry.
