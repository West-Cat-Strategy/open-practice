# OP Mainline Merge Push Prune Proof - 2026-06-16

This proof records the 16-lane Open Practice mainline consolidation from base
`64527c0e` (`origin/main`) into integration branch
`merge/open-practice-16-lane-2026-06-16`. The merge-only integration result was
`94d4f967`; this proof and the final dependency-audit remediation were added on
top before publication.

## Scope

The consolidation preserved each dirty lane as its own branch commit before
integration:

| Branch                                             | Commit     | Scope                                                           |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `docs/contact-history-policy-packet-2026-06-15`    | `200fee41` | Contact-history export, retention, and privacy decision packet. |
| `chore/review-fastify-rate-limit-11`               | `47f1b1f9` | `@fastify/rate-limit@11.0.0` compatibility review.              |
| `chore/review-pdfkit-0-19`                         | `93d093b2` | `pdfkit@0.19.1` compatibility review.                           |
| `chore/review-stripe-22-2-1`                       | `3bb89acd` | `stripe@22.2.1` compatibility review.                           |
| `feature/staff-visual-branch-rule-authoring`       | `5c6f4f22` | Staff structured branch-rule authoring.                         |
| `feature/staff-submissions-operations`             | `2eca4d9f` | Staff submissions operations projection.                        |
| `feature/review-only-contact-duplicate-assistance` | `4e7f3b28` | Review-only contact duplicate assistance.                       |
| `feature/contact-timeline-task-cues`               | `7022ca3f` | Contact timeline task cues.                                     |
| `feature/rebac-fixture-catalogue`                  | `a03da668` | OP-authored authorization fixture catalogue.                    |
| `codex/reminder-job-reconciliation`                | `42fe5ff3` | Reminder job reconciliation.                                    |
| `feature/workflow-step-history`                    | `36a1dee6` | Workflow-step history projection.                               |
| `feature/signature-envelope-metadata`              | `bcbbeb54` | Signature request envelope metadata.                            |
| `feature/immutable-intake-template-versions`       | `bf21fd75` | Immutable intake template versions.                             |
| `feature/manual-payment-reconciliation-gate`       | `d8baebed` | Manual payment reconciliation gate.                             |
| `feature/op-t133-worker-package-assembly`          | `f848843b` | Worker-owned package assembly.                                  |
| `proof/docker-gaps-2026-06-16`                     | `0fefa65d` | Docker residual-watch proof refresh.                            |

## Merge Reconciliation

- Validation index conflicts in `docs/validation/README.md` were resolved by preserving every
  lane proof row and keeping the Docker residual-watch wording from the Docker proof refresh.
- Workboard conflicts in `docs/planning-and-progress.md` were resolved by preserving all current
  handoff notes while keeping the integrated mainline snapshot broad instead of lane-specific.
- The `docs/api-and-state-machines.md` intake route table keeps the worker-owned async generated
  package endpoints and the immutable-template draft/publish wording.
- Provider dependency conflicts keep both compatibility-review outcomes: `pdfkit@0.19.1` and
  `stripe@22.2.1`.
- Migration collisions were resolved by keeping all four migrations and assigning unique sequence
  numbers after `0055_full_crm_contacts`:
  `0056_signature_request_envelope_metadata`,
  `0057_intake_template_versions`,
  `0058_manual_payment_reconciliation_gate`, and
  `0059_document_assembly_worker_queue`.

## Selector Output

The final integration diff had 145 paths after this mainline proof and the dependency-audit
remediation were included. An earlier selector attempt used a single shell-expanded path blob and
was discarded before validation decisions were made. The corrected selector passed every changed
path as a separate argument:

```bash
pnpm verify:select -- --files <145 integration paths>
```

It recommended:

```bash
pnpm ci:local
pnpm deps:audit
pnpm deps:licenses
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
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

## Validation

| Command                  | Result | Notes                                                                                                                                                                                                      |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm ci:local`          | Passed | Includes format, lint, typecheck, tests, database check, policy checks, build, and `git diff --check`. First run found proof/README formatting drift; rerun passed after Prettier.                         |
| `pnpm deps:audit`        | Passed | Initial run failed on transitive dev advisories for `vite@8.0.10` and `js-yaml@4.1.1`; remediated with workspace overrides to `vite@8.0.16` and `js-yaml@4.2.0`, then reran with no known vulnerabilities. |
| `pnpm deps:licenses`     | Passed | Dependency license report: 562 packages, 589 versions; existing review-required license groups remain review-marked by policy.                                                                             |
| `pnpm migrations:replay` | Passed | 60 migrations applied to disposable database `open_practice_migration_replay_2489_20260616020441`; database cleaned up.                                                                                    |
| `git diff --check`       | Passed | No whitespace errors.                                                                                                                                                                                      |
| `pnpm e2e:host`          | Passed | Playwright host lane: 35 passed in 54.2s.                                                                                                                                                                  |

PostgreSQL replay was available, so no database replay check was skipped. Specialized `docker`,
`matterless`, and `client-portal` E2E lanes were not run because the selector output and conflict
resolution did not identify those narrower lanes as required after the host lane passed.

## Publish And Prune Plan

After validation passes, local `main` will be updated to the validated integration result and pushed
to `origin/main`. Post-push parity will compare local `main`, `origin/main`, and
`git ls-remote origin refs/heads/main`. Only the 15 sibling worktrees plus the merged local lane
branches will be pruned; the primary `/Users/bryan/projects/open-practice` checkout remains the
main worktree, and stashes remain untouched.

## Three-Lane Follow-Up Merge

This section records the 2026-06-16 follow-up integration branch
`codex/open-practice-mainline-merge-2026-06-16`, forked from refreshed `main` at
`d22d0d96`.

| Branch                                            | Commit     | Scope                                                                  |
| ------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `feature/matter-lifecycle-transition-journal`     | `a62b76e5` | Matter lifecycle transition journal API and dashboard summary records. |
| `codex/contact-history-export-runtime-2026-06-16` | `04ce9b6`  | Transient single-contact history export runtime.                       |
| `codex/inbound-email-matter-drafts-2026-06-16`    | `dd729dc`  | Review-only inbound email matter draft preparation.                    |

### Follow-Up Lane Validation

| Lane                                | Selector                        | Result                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matter lifecycle transition journal | `pnpm verify:select -- --dirty` | Passed selected format, docs, policy, root/package tests, domain/API/web typechecks, providers and worker checks, `pnpm build`, plus database `test`, `db:check`, `migrations:check`, typecheck, and build.                                                                             |
| Contact-history export runtime      | `pnpm verify:select -- --dirty` | Passed selected format, docs, policy, root/package tests, domain/API/web typechecks, providers and worker checks, and `pnpm build`.                                                                                                                                                     |
| Inbound email matter drafts         | `pnpm verify:select -- --dirty` | Passed selected format, docs, policy, root/package tests, domain/API/web typechecks, providers and worker checks, and `pnpm build`. The first domain-test attempt stopped on local `ENOSPC`; only ignored `.next` and `.turbo` build caches were removed, then the same command passed. |

### Follow-Up Merge Reconciliation

- `feature/matter-lifecycle-transition-journal` merged cleanly.
- `docs/validation/README.md` conflicted while merging
  `codex/contact-history-export-runtime-2026-06-16`; the resolution preserved both the matter
  lifecycle and contact-history proof handoff notes.
- `docs/planning-and-progress.md` conflicted while merging
  `codex/inbound-email-matter-drafts-2026-06-16`; the resolution preserved both the
  contact-history runtime and inbound-email matter-draft handoff notes.
- Shared API authorization surfaces kept all three additions:
  `GET/POST /api/matters/:matterId/lifecycle-transitions`,
  `POST /api/contacts/:contactId/history-export`, and
  `POST /api/inbound-email/messages/:id/matter-draft`.

### Follow-Up Integrated Validation

| Command                                    | Result  | Notes                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main` | Passed  | Selected format, docs, policy, root/package tests, domain/database/API/provider/worker/web package checks, database `db:check`, `migrations:check`, worker build, web typecheck, and `pnpm build`.                                                                          |
| `pnpm --filter @open-practice/worker test` | Passed  | Focused rerun after the first `pnpm ci:local` attempt exposed an order-sensitive worker assertion for `generatedDocumentIds`. The repair keeps the bounded metadata count and membership assertion without depending on repository list order; 5 files and 42 tests passed. |
| `pnpm ci:local`                            | Passed  | Rerun passed after the worker assertion repair. It includes formatting, lint, typecheck, package/script tests, database check, policy checks, build, and `git diff --check`; migration parity passed at 61 SQL files and 61 journal entries.                                |
| `git diff --check`                         | Passed  | No whitespace errors before browser validation.                                                                                                                                                                                                                             |
| `pnpm e2e:host`                            | Passed  | Host Playwright lane passed: 35 tests in about 1.1 minutes.                                                                                                                                                                                                                 |
| `pnpm e2e:matterless`                      | Passed  | Matterless Playwright lane passed: 1 test in about 3.5 seconds.                                                                                                                                                                                                             |
| `pnpm e2e:client-portal`                   | Passed  | Client portal Playwright lane passed: 2 tests in about 2.4 seconds.                                                                                                                                                                                                         |
| `node scripts/run-e2e.mjs first-run`       | Passed  | First-run setup lane passed: 1 test in about 8.8 seconds.                                                                                                                                                                                                                   |
| `docker info`                              | Blocked | Docker client is installed, but the daemon/server check failed with `ERROR: Error reading remote info: EOF` and `Server: errors pretty printing info`. `pnpm e2e:docker` was not run because Docker was not usable.                                                         |

### Follow-Up Push And Prune

Local `main` was fast-forwarded to the validated integration tip and pushed to `origin/main`.
Post-push parity matched across local `main`, `origin/main`, and `git ls-remote --heads origin` at
`8fb5cc9d9c5cd11d7df57faeb877c35dc0fc43cc`.

Pre-prune inventory showed all four local follow-up branches merged into `main`:
`feature/matter-lifecycle-transition-journal`,
`codex/contact-history-export-runtime-2026-06-16`,
`codex/inbound-email-matter-drafts-2026-06-16`, and
`codex/open-practice-mainline-merge-2026-06-16`. `git branch --no-merged main` returned no
branches. The two sibling worktrees
`/Users/bryan/projects/open-practice-contact-history-runtime` and
`/Users/bryan/projects/open-practice-inbound-email-matter-drafts` were clean before removal.

Prune actions completed:

- Removed the two clean merged sibling worktrees.
- Deleted the three merged lane branches and the merged integration branch.
- Ran `git worktree prune` and `git remote prune origin`.
- Left all stashes untouched; stash count remained 42.

Post-prune inventory showed only the primary `/Users/bryan/projects/open-practice` worktree on
`main`, no unmerged local branches, and only `refs/heads/main` on `origin`.

## Eight-Lane Follow-Up Merge

This section records the 2026-06-16 eight-lane follow-up integration branch
`codex/open-practice-mainline-merge-2026-06-16`, forked from refreshed `origin/main` at
`a7765463`.

| Branch                                                  | Commit    | Scope                                                            |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `codex/staff-intake-rule-simulation-matrix-2026-06-16`  | `2fdf043` | Staff-only saved intake QA scenarios.                            |
| `codex/contact-history-export-queue-2026-06-16`         | `29f00d7` | Queued contact-history export request, poll, and download links. |
| `feature/contact-timeline-activity-filters`             | `f0c1388` | Contact timeline activity filters.                               |
| `codex/email-template-drafts-2026-06-16`                | `1092a11` | OP-T158 email template drafts and preview snapshots.             |
| `codex/financial-command-approval-journal-2026-06-16`   | `f2e3245` | Read-only financial command approval journal.                    |
| `feature/inbound-email-matter-draft-review-cues`        | `90e9161` | Inbound email matter draft review cues.                          |
| `codex/private-document-conversion-boundary-2026-06-16` | `12725e0` | Private document conversion and annotation boundary docs.        |
| `codex/trust-posting-approval-commands-2026-06-16`      | `83e8de5` | Trust posting approval commands.                                 |

### Eight-Lane Merge Reconciliation

- Preserved both contact-history export paths: the synchronous single-contact `staff_review` export
  and the queued request/poll/download link flow. The queued download route regenerates from the
  current authorized full timeline projection and does not inherit dashboard activity filters.
- Preserved both contact timeline follow-ups: existing review-only task/follow-up cues and the
  optional `activity` filter on `GET /api/contacts/:contactId/timeline`.
- Preserved both ledger follow-ups: the read-only financial command journal in trust controls and
  explicit trust posting request prepare/list/approve/reject commands. The integrated UI renders
  both the journal and prepared posting requests.
- Resolved migration collision by keeping `0061_email_template_drafts.sql`, renumbering trust
  posting requests to `0062_trust_posting_requests.sql`, and updating Drizzle journal entries
  `idx: 61` and `idx: 62`.
- Shared docs/proof conflicts were resolved by preserving every dated lane proof, then updating
  `docs/planning-and-progress.md`, `docs/validation/README.md`, and this proof note for the
  integrated batch.

### Eight-Lane Integrated Validation

The final eight-lane integration diff had 101 changed paths. The selector was run against that exact
path set:

```bash
pnpm verify:select -- --files <101 integration paths>
```

It recommended:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/database test
pnpm --filter @open-practice/database db:check
pnpm migrations:check
pnpm --filter @open-practice/database typecheck
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

| Command                                           | Result | Notes                                                                                                      |
| ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <101 paths>`       | Passed | Selected the broad API/database/domain/web/worker/docs/migration validation set above.                     |
| `pnpm format:check`                               | Passed | First run found two Markdown formatting issues after conflict proof edits; Prettier was applied and reran. |
| `pnpm docs:check`                                 | Passed | Documentation link validation passed.                                                                      |
| `pnpm policy:check`                               | Passed | Secrets/package/dead-code/migration/OSS/doc/proof/dockerignore/boundary policy checks passed.              |
| `pnpm test`                                       | Passed | Root script tests passed: 63 tests.                                                                        |
| `pnpm --filter @open-practice/domain test`        | Passed | 30 files and 200 tests passed.                                                                             |
| `pnpm --filter @open-practice/domain typecheck`   | Passed | TypeScript check passed.                                                                                   |
| `pnpm --filter @open-practice/database test`      | Passed | 22 files and 127 tests passed.                                                                             |
| `pnpm --filter @open-practice/database db:check`  | Passed | `drizzle-kit check` passed.                                                                                |
| `pnpm migrations:check`                           | Passed | Migration parity passed: 63 SQL files match 63 journal entries.                                            |
| `pnpm --filter @open-practice/database typecheck` | Passed | TypeScript check passed.                                                                                   |
| `pnpm --filter @open-practice/database build`     | Passed | Database build passed.                                                                                     |
| `pnpm --filter @open-practice/api test`           | Passed | 41 files and 546 tests passed.                                                                             |
| `pnpm --filter @open-practice/api typecheck`      | Passed | TypeScript check passed.                                                                                   |
| `pnpm --filter @open-practice/providers test`     | Passed | 9 files and 20 tests passed.                                                                               |
| `pnpm --filter @open-practice/worker test`        | Passed | 5 files and 44 tests passed.                                                                               |
| `pnpm --filter @open-practice/worker typecheck`   | Passed | TypeScript check passed.                                                                                   |
| `pnpm --filter @open-practice/worker build`       | Passed | Worker build passed.                                                                                       |
| `pnpm --filter @open-practice/web test`           | Passed | 37 files and 200 tests passed.                                                                             |
| `pnpm --filter @open-practice/web typecheck`      | Passed | TypeScript check passed.                                                                                   |
| `pnpm build`                                      | Passed | Turbo build passed across all 6 package/app tasks.                                                         |
| `pnpm ci:local`                                   | Passed | Broad local integration bundle passed after the selected gates.                                            |
| `git diff --check`                                | Passed | No whitespace errors.                                                                                      |
| `pnpm e2e:host`                                   | Passed | Host Playwright lane passed: 35 tests in about 59.5s.                                                      |
| `pnpm e2e:matterless`                             | Passed | Matterless Playwright lane passed: 1 test in about 2.7s.                                                   |
| `pnpm e2e:client-portal`                          | Passed | Client portal Playwright lane passed: 2 tests in about 2.0s.                                               |
| `node scripts/run-e2e.mjs first-run`              | Passed | First-run setup lane passed: 1 test in about 4.3s.                                                         |
| `pnpm e2e:docker`                                 | Passed | Docker lane built pinned support images, ran Docker-backed Playwright, and passed 3 tests in about 33.8s.  |

### Eight-Lane Push And Prune

Local `main` was fast-forwarded to the validated integration tip and pushed to `origin/main`.
Post-push parity matched across local `main`, `origin/main`, and `git ls-remote --heads origin` at
`19832957ea563633710c1d2ec237a418d7ef32a4`.

Pre-prune inventory showed all eight lane branches and the integration branch merged into `main`,
and `git branch --no-merged main` returned no branches. Each lane worktree was clean, and each lane
HEAD was an ancestor of `main`.

Prune actions completed:

- Kept the primary `/Users/bryan/projects/open-practice` checkout and switched it to `main`.
- Removed the eight clean merged sibling worktrees, including the temporary integration worktree.
- Deleted the eight merged lane branches and the merged integration branch with `git branch -d`.
- Ran `git remote prune origin` and `git worktree prune`.
- Left all stashes untouched; current stash count is 42.

Post-prune inventory showed only the primary `/Users/bryan/projects/open-practice` worktree on
`main`, no unmerged local branches, only local branch `main`, and only `refs/heads/main` on
`origin`.

## Parked Worktree Reconciliation - 2026-06-17

Live follow-up audit found two parked dirty worktrees that remained after the 2026-06-16 integration
even though their branch tips were already absorbed by current `main`:

| Worktree                                                           | Branch                                         | Disposition                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/bryan/projects/open-practice-meeting-availability`         | `feature/meeting-availability-requests`        | Absorbed into `main`; do not land the stale standalone OP-T159 proof or parked dirty diff. Current `main` already contains the scheduling request routes, repository helpers, route manifest entries, dashboard controls, and validation coverage through the Clio parity workflow-depth closure.                                              |
| `/Users/bryan/projects/open-practice-contact-history-export-scope` | `feature/matter-scoped-contact-history-export` | Absorbed into `main`; do not land the stale standalone matter-scope proof or parked dirty diff. Current `main` already contains optional `matterId` scoping for synchronous and queued contact-history exports, metadata boundaries, dashboard selector behavior, and worker/download rechecks through the Clio parity workflow-depth closure. |

Absorption evidence before local cleanup:

- Root status was on occupied branch `docs/root-adopter-readme` with unrelated
  `CONTRIBUTING.md`, `docs/README.md`, and root `README.md` edits, so this reconciliation was
  isolated in sibling worktree
  `/Users/bryan/projects/open-practice-parked-worktree-reconciliation` on branch
  `docs/parked-worktree-reconciliation-2026-06-17`.
- `git worktree list --porcelain` showed both parked worktrees at
  `d1aa96c276c257fda411909b33f193939a0ee00e`.
- `git merge-base --is-ancestor d1aa96c2 main` returned success.
- `git branch --no-merged main` returned no branches.
- Current `main` is `81c3adbec03a79c76ad0b98f5378fccabbc2f8b7`.

Cleanup commands approved for only these absorbed lanes:

```sh
git worktree remove --force /Users/bryan/projects/open-practice-meeting-availability
git worktree remove --force /Users/bryan/projects/open-practice-contact-history-export-scope
git branch -d feature/meeting-availability-requests
git branch -d feature/matter-scoped-contact-history-export
git worktree prune
```

Cleanup results:

- `git worktree remove --force /Users/bryan/projects/open-practice-meeting-availability` passed.
- `git worktree remove --force /Users/bryan/projects/open-practice-contact-history-export-scope`
  passed.
- `git branch -d feature/meeting-availability-requests` passed and deleted local branch
  `feature/meeting-availability-requests` at `d1aa96c2`.
- `git branch -d feature/matter-scoped-contact-history-export` passed and deleted local branch
  `feature/matter-scoped-contact-history-export` at `d1aa96c2`.
- `git worktree prune` passed.

Final local inventory after cleanup:

- `git worktree list --porcelain` shows the root checkout on `docs/root-adopter-readme`, the
  preserved `open-practice-docker-footprint-hardening` worktree, this
  `docs/parked-worktree-reconciliation-2026-06-17` worktree, and the preserved
  `open-practice-promotional-root-readme` worktree. It no longer lists the two retired parked
  worktrees.
- `git branch --format='%(refname:short) %(objectname:short) %(upstream:short)'` shows only
  `audit/clio-parity-gap-closure-2026-06-16`, `codex/docker-footprint-hardening`,
  `docs/parked-worktree-reconciliation-2026-06-17`, `docs/promotional-root-readme`,
  `docs/root-adopter-readme`, and `main`.
- `git branch --no-merged main` returned no branches.
- Stash count remained `42`; no stashes were touched.
- No API, schema, route, UI, worker, domain, database, dependency, copied excerpt, vendored asset,
  reference-derived code, client data, matter data, credential, payment, or private deployment
  detail changed.

### Parked Worktree Reconciliation Validation

The final changed path set for this addendum is:

- `docs/planning-and-progress.md`
- `docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md`
- `docs/validation/README.md`

`pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md docs/validation/README.md`
passed and selected:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

Validation results:

| Command             | Result | Notes                                                                                                                   |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | Passed | Prettier check passed after formatting the three touched Markdown files.                                                |
| `pnpm docs:check`   | Passed | Documentation link validation passed.                                                                                   |
| `pnpm policy:check` | Passed | Secrets, package policy, dead-code, migration, OSS reuse, docs, proof index, Docker ignore, and boundary checks passed. |
| `git diff --check`  | Passed | No whitespace errors.                                                                                                   |

## Unpublished Mainline Delta Revalidation - 2026-06-17

Before any push or release handoff, the current checkout was revalidated at
`5f15fc87cec13b12143a4a5b3dc746b1534f5c9c`. The checkout was on
`feature/op-t134-timer-draft-lock-proof`, with local `main` pointing at the same commit. The
committed `origin/main...HEAD` and `origin/main..HEAD` path sets matched, and `origin/main` was an
ancestor of `HEAD`.

Final committed mainline path set used for selector input:

```text
.dockerignore
.env.example
CONTRIBUTING.md
Dockerfile
README.md
apps/web/next.config.mjs
docker-compose.yml
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docs/README.md
docs/deployment-hardening.md
docs/development/getting-started.md
docs/planning-and-progress.md
docs/testing/TESTING.md
docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md
docs/validation/README.md
scripts/docker-app-smoke.mjs
```

Selector output:

```bash
pnpm verify:select -- --files .dockerignore .env.example CONTRIBUTING.md Dockerfile README.md apps/web/next.config.mjs docker-compose.yml docker/mailpit/Dockerfile docker/minio/Dockerfile docs/README.md docs/deployment-hardening.md docs/development/getting-started.md docs/planning-and-progress.md docs/testing/TESTING.md docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md docs/validation/README.md scripts/docker-app-smoke.mjs
```

```text
Recommended validation commands:
pnpm docker:residual-watch
pnpm docker:app-smoke
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Validation results:

| Command                                      | Result  | Notes                                                                                                                                                                        |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --files <18 paths>`   | Passed  | Output listed above.                                                                                                                                                         |
| `pnpm docker:residual-watch`                 | Blocked | Artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-17T22-42-26Z`; Docker server/socket checks and Scout image scans were blocked.              |
| `pnpm docker:app-smoke`                      | Blocked | Docker build and cleanup could not connect to `unix:///Users/bryan/.docker/run/docker.sock`.                                                                                 |
| `pnpm e2e:docker`                            | Blocked | Workspace package builds completed first; Docker-backed Redis/image setup failed on the same missing Docker socket.                                                          |
| `pnpm format:check`                          | Passed  | All matched files used Prettier style in the final rerun.                                                                                                                    |
| `pnpm docs:check`                            | Passed  | Documentation link validation passed in the final rerun.                                                                                                                     |
| `pnpm policy:check`                          | Passed  | Secret scan, package policy, dead-code, migration parity, OSS reuse, docs links, proof index, local-evidence `.dockerignore`, and boundary policy passed in the final rerun. |
| `pnpm test`                                  | Passed  | Turbo package tests passed; script tests passed 63 tests across 13 suites.                                                                                                   |
| `pnpm --filter @open-practice/web test`      | Passed  | 37 files and 201 tests passed.                                                                                                                                               |
| `pnpm --filter @open-practice/web typecheck` | Passed  | TypeScript check passed.                                                                                                                                                     |
| `pnpm build`                                 | Passed  | Turbo build passed for all six workspaces.                                                                                                                                   |
| `git diff --check`                           | Passed  | No whitespace errors in the final rerun.                                                                                                                                     |

The residual-watch artifact also reported two review candidates: Postgres
`postgres-upstream-18-alpine-manifest` registry-manifest drift and Mailpit `v1.30.2` as a newer
upstream source tag. This validation pass did not push or perform a release handoff. The current
handoff is blocked on Docker daemon availability for app-smoke and Docker E2E proof, plus a separate
review of the residual-watch candidates.

After proof/index/workboard reconciliation, the working tree also contained unrelated OP-T134 dirty
paths:

```text
apps/api/src/routes/billing.test.ts
docs/improvement-opportunities.md
docs/validation/OP-T134_TIME_EXPENSE_CAPTURE_PROOF_2026-05-31.md
```

The final selector was rerun over the 21-path union of the committed mainline delta plus those dirty
paths. It added `pnpm --filter @open-practice/api test` and
`pnpm --filter @open-practice/api typecheck` to the validation contract. Final non-Docker reruns
passed: `pnpm format:check`, `pnpm docs:check`, `pnpm policy:check`, `pnpm test`,
`pnpm --filter @open-practice/api test`, `pnpm --filter @open-practice/api typecheck`,
`pnpm --filter @open-practice/web test`, `pnpm --filter @open-practice/web typecheck`,
`pnpm build`, and `git diff --check`.
