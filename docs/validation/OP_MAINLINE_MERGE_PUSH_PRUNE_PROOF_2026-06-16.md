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

## Final Active-Lane Publication And Prune - 2026-06-18

Short proof branch: `proof/open-practice-mainline-closeout-2026-06-18`
Base: published `main` at `9b4937a12b85c188de373eead11cb5defbb255c6`

After the Docker gate closeout commit, the primary checkout switched to `main`,
fast-forwarded from `5f15fc87cec13b12143a4a5b3dc746b1534f5c9c` to
`9b4937a12b85c188de373eead11cb5defbb255c6`, and pushed `origin/main` from
`81c3adbec03a79c76ad0b98f5378fccabbc2f8b7` to
`9b4937a12b85c188de373eead11cb5defbb255c6`.

Post-push parity before pruning:

- `git rev-parse HEAD`, `git rev-parse main`, and `git rev-parse origin/main` all returned
  `9b4937a12b85c188de373eead11cb5defbb255c6`.
- `git ls-remote --heads origin main` returned
  `9b4937a12b85c188de373eead11cb5defbb255c6 refs/heads/main`.
- `git status --short --branch` returned `## main...origin/main` with no dirty paths.
- Stash count remained `42`; stashes were not touched.

Clean sibling worktrees removed with `git worktree remove`:

- `/Users/bryan/projects/open-practice-aged-receivables`
- `/Users/bryan/projects/open-practice-docker-residual-postgres-drift`
- `/Users/bryan/projects/open-practice-document-retention-hold-design`
- `/Users/bryan/projects/open-practice-expense-category-registry`
- `/Users/bryan/projects/open-practice-financial-export-field-profiles`
- `/Users/bryan/projects/open-practice-inbound-email-recovery-metadata-2026-06-17`
- `/Users/bryan/projects/open-practice-ledger-balance-snapshot-comparison`
- `/Users/bryan/projects/open-practice-matter-lifecycle-commands`
- `/Users/bryan/projects/open-practice-payment-import-boundary-2026-06-17`
- `/Users/bryan/projects/open-practice-provider-doc-conversion-boundary-2026-06-17`
- `/Users/bryan/projects/open-practice-rebac-contact-list-fixtures`
- `/Users/bryan/projects/open-practice-retire-merged-sibling-worktrees-2026-06-17`
- `/Users/bryan/projects/open-practice-trust-posting-action-descriptors`

Local branches deleted with `git branch -d` after `git branch --merged main` proved them merged and
`git branch --no-merged main` returned no branches:

- `audit/clio-parity-gap-closure-2026-06-16`
- `codex/docker-residual-postgres-drift-2026-06-17`
- `codex/financial-export-field-profiles-2026-06-17`
- `codex/inbound-email-recovery-metadata-2026-06-17`
- `codex/matter-lifecycle-command-policy-2026-06-17`
- `codex/rebac-contact-list-fixtures`
- `codex/trust-posting-action-descriptors`
- `docs/document-retention-hold-design-2026-06-17`
- `docs/payment-import-boundary-2026-06-17`
- `docs/provider-document-conversion-boundary-2026-06-17`
- `docs/retire-merged-sibling-worktrees-2026-06-17`
- `docs/root-adopter-readme`
- `feature/aged-receivables-report`
- `feature/expense-category-registry`
- `feature/op-t134-timer-draft-lock-proof`
- `feature/reviewer-ledger-balance-snapshot-comparison`
- `merge/open-practice-active-lanes-2026-06-17`

`git worktree prune` and `git remote prune origin` both passed.

Final inventory before this proof-only addendum:

- `git worktree list --porcelain` showed only `/Users/bryan/projects/open-practice` on `main` at
  `9b4937a12b85c188de373eead11cb5defbb255c6`.
- `git branch --format='%(refname:short)'` showed only `main`.
- `git branch --merged main --format='%(refname:short)'` showed only `main`; `git branch --no-merged
main --format='%(refname:short)'` returned no branches.
- `git status --short --branch` returned `## main...origin/main` with no dirty paths.
- Stash count remained `42`; no stash entries were applied, dropped, or rewritten.

This proof-only addendum changes documentation status only. No API, schema, route, UI, worker, domain,
database, Docker image, Compose runtime, dependency, copied excerpt, vendored asset, client data,
matter data, credential, payment, or private deployment detail changed after the published
active-lane closeout.

## All Active Local Lanes Docker Gate Closeout - 2026-06-18

Branch: `merge/open-practice-active-lanes-2026-06-17`
Worktree: `/Users/bryan/projects/open-practice`
Integration tip before this closeout: `5363ace1`

Preflight confirmed the integration branch was still clean and fast-forwardable before Docker
validation/fixes:

- `origin/main` and `git ls-remote --heads origin main` both resolved to
  `81c3adbec03a79c76ad0b98f5378fccabbc2f8b7`; no force push was needed or attempted.
- Local `main` remained `5f15fc87cec13b12143a4a5b3dc746b1534f5c9c`.
- `git branch --no-merged HEAD` returned no branches, and every active sibling worktree status was
  clean.
- Stash count was `42`; stashes were not touched.

Docker Engine became available, so the hard gate was rerun instead of publishing the blocked
integration. The first post-image-build residual watch reported two same-contract review candidates:
Postgres `postgres-upstream-18-alpine-manifest` drift and Mailpit `v1.30.2`. The closeout fixed those
owned Docker surfaces only:

- `docker/postgres/Dockerfile` now pins `postgres:18-alpine` at
  `sha256:1b1689b20d16a014a3d195653381cf2caa75a41a92d93b255a9d6ea29fd353aa`.
- `docker/mailpit/Dockerfile` now pins Mailpit `v1.30.2` with source archive SHA-256
  `239f044997dcb6ec27ed1b85b5ca3bba9d5996d66dad67014c3f4aa75549269b`.
- `docker-compose.yml` now uses `open-practice-mailpit:v1.30.2-go1.26.4`.
- `scripts/watch-docker-residuals.test.mjs` now reflects the current source tag and image posture.

Closeout validation:

| Command                                           | Result | Notes                                                                                                                             |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `docker info`                                     | Passed | Docker server was available; `ServerVersion` was `29.5.3`.                                                                        |
| `pnpm verify:select -- --base origin/main`        | Passed | Selected the Docker, docs/policy, package, build, and web/local gates listed above.                                               |
| `pnpm docker:app-smoke`                           | Passed | Rebuilt refreshed support images; API health was PostgreSQL-backed and the Web root served.                                       |
| `pnpm docker:residual-watch`                      | Passed | Artifact: `/tmp/codex-security-scans/open-practice/docker-residual-watch/2026-06-18T20-44-47Z`; no blockers or review candidates. |
| `pnpm e2e:docker`                                 | Passed | After installing the missing local Chromium cache with `pnpm exec playwright install chromium`, rerun passed 3 Playwright tests.  |
| `pnpm format:check`                               | Passed | Prettier check passed.                                                                                                            |
| `pnpm docs:check`                                 | Passed | Documentation link validation passed.                                                                                             |
| `pnpm policy:check`                               | Passed | Secrets, package policy, dead-code, migration, OSS reuse, docs, proof index, Docker ignore, and boundary checks passed.           |
| `pnpm test`                                       | Passed | Turbo package tests passed; script tests passed 63 tests across 13 suites.                                                        |
| `pnpm --filter @open-practice/domain test`        | Passed | 31 files and 222 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/domain typecheck`   | Passed | `tsc -p tsconfig.json --noEmit` passed.                                                                                           |
| `pnpm --filter @open-practice/domain build`       | Passed | Manual build gate passed.                                                                                                         |
| `pnpm --filter @open-practice/database test`      | Passed | 22 files and 128 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/database db:check`  | Passed | Drizzle check passed.                                                                                                             |
| `pnpm migrations:check`                           | Passed | Migration parity passed: 65 SQL files match 65 journal entries.                                                                   |
| `pnpm --filter @open-practice/database typecheck` | Passed | `tsc -p tsconfig.json --noEmit` passed.                                                                                           |
| `pnpm --filter @open-practice/database build`     | Passed | Database package build passed.                                                                                                    |
| `pnpm --filter @open-practice/api test`           | Passed | 42 files and 558 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/api typecheck`      | Passed | `tsc -p tsconfig.json --noEmit` passed.                                                                                           |
| `pnpm --filter @open-practice/providers test`     | Passed | 9 files and 20 tests passed.                                                                                                      |
| `pnpm --filter @open-practice/worker test`        | Passed | 5 files and 46 tests passed.                                                                                                      |
| `pnpm --filter @open-practice/worker typecheck`   | Passed | `tsc -p tsconfig.json --noEmit` passed.                                                                                           |
| `pnpm --filter @open-practice/worker build`       | Passed | Worker build passed.                                                                                                              |
| `pnpm --filter @open-practice/web test`           | Passed | 37 files and 202 tests passed.                                                                                                    |
| `pnpm --filter @open-practice/web typecheck`      | Passed | `tsc -p tsconfig.json --noEmit` passed.                                                                                           |
| `pnpm build`                                      | Passed | Turbo build passed for all six workspaces.                                                                                        |
| `pnpm ci:local`                                   | Passed | Full local verification gate passed. Logs are under `/tmp/open-practice-closeout-20260618T204924Z`.                               |
| `git diff --check`                                | Passed | No whitespace errors.                                                                                                             |

This validation commit records green publication readiness only. At this point in the proof, `main`
has not yet been fast-forwarded, `origin/main` has not yet been pushed, branch/worktree prune has not
yet run, remote prune has not yet run, and the 42 stashes remain untouched. Final parity and prune
evidence will be recorded after `main` publication.

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

## Merged Sibling Worktree Retirement - 2026-06-17

Live follow-up audit found three sibling worktrees whose branch tips were already merged into local
`main`; a fourth cleanup worktree was created from `main` so the occupied root checkout and other
active sibling lanes stayed untouched:

| Worktree                                                             | Branch                                           | Disposition                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/bryan/projects/open-practice-docker-footprint-hardening`     | `codex/docker-footprint-hardening`               | Clean and merged into local `main`; removed with its attached local branch.                                                                         |
| `/Users/bryan/projects/open-practice-parked-worktree-reconciliation` | `docs/parked-worktree-reconciliation-2026-06-17` | Clean and merged into local `main`; removed with its attached local branch.                                                                         |
| `/Users/bryan/projects/open-practice-promotional-root-readme`        | `docs/promotional-root-readme`                   | Merged into local `main` but carried untracked promotional `README.md` residue; preserved to ignored local evidence before forced worktree removal. |

Pre-cleanup audit evidence:

- `git status --short --branch` in the primary checkout showed
  `feature/op-t134-timer-draft-lock-proof`, so cleanup ran in
  `/Users/bryan/projects/open-practice-retire-merged-sibling-worktrees-2026-06-17` on branch
  `docs/retire-merged-sibling-worktrees-2026-06-17`.
- `git worktree list --porcelain` also showed active preserved worktrees for aged receivables,
  document-retention hold design, financial export field profiles, and payment-import boundary.
- `git branch --merged main` listed the three target branches, and `git branch --no-merged main`
  returned no branches.
- Per-worktree status showed the Docker footprint and parked reconciliation worktrees were clean.
  The promotional root README worktree only carried untracked `README.md` residue.
- The promotional README residue was copied to
  `.tmp/worktree-retirement/2026-06-17/promotional-root-readme/README.md` before removal; SHA-256:
  `a6e672928440324307f5570dd051d387b353d320287be696a1613bd1c1e9f801`.
- Empty ignored link-target placeholders were added under the same `.tmp` evidence directory because
  repository doc-link validation walks ignored Markdown files; the preserved README bytes and hash
  stayed unchanged.

Cleanup commands approved for only these merged sibling worktrees:

```sh
git worktree remove /Users/bryan/projects/open-practice-docker-footprint-hardening
git worktree remove /Users/bryan/projects/open-practice-parked-worktree-reconciliation
git worktree remove --force /Users/bryan/projects/open-practice-promotional-root-readme
git branch -d codex/docker-footprint-hardening docs/parked-worktree-reconciliation-2026-06-17 docs/promotional-root-readme
git worktree prune
```

Cleanup results:

- `git worktree remove /Users/bryan/projects/open-practice-docker-footprint-hardening` passed.
- `git worktree remove /Users/bryan/projects/open-practice-parked-worktree-reconciliation` passed.
- `git worktree remove --force /Users/bryan/projects/open-practice-promotional-root-readme` passed
  after preserving the untracked README residue.
- `git branch -d codex/docker-footprint-hardening docs/parked-worktree-reconciliation-2026-06-17 docs/promotional-root-readme`
  passed, deleting the branches at `81e480a7`, `0524d1d5`, and `d1aa96c2`.
- `git worktree prune` passed.

Post-cleanup inventory captured during this proof refresh:

- `git worktree list --porcelain` shows the primary checkout on
  `feature/op-t134-timer-draft-lock-proof`; preserved sibling worktrees for aged receivables,
  Docker residual Postgres drift, document-retention hold design, expense category registry,
  financial export field profiles, inbound-email recovery metadata, ledger-balance snapshot
  comparison, matter lifecycle commands, payment-import boundary, provider document-conversion
  boundary, ReBAC contact-list fixtures, and trust posting action descriptors; and this cleanup
  worktree on `docs/retire-merged-sibling-worktrees-2026-06-17`.
- Per-worktree status after cleanup showed unrelated modified or untracked files in the preserved
  active lanes; all were left untouched. This cleanup worktree carried only the three
  docs/proof/index changes listed below.
- `git branch --format='%(refname:short) %(objectname:short) %(upstream:short)'` shows preserved
  merged non-worktree branches `audit/clio-parity-gap-closure-2026-06-16` and
  `docs/root-adopter-readme`, plus the unrelated active sibling branches. The three retired target
  branches are absent.
- `git branch --no-merged main` returned no branches.
- Stash count remained `42`; no stashes were touched.
- No remote refs were pruned or pushed.
- No API, schema, route, UI, worker, domain, database, dependency, copied excerpt, vendored asset,
  reference-derived code, client data, matter data, credential, payment, root README adoption, or
  private deployment detail changed.

### Merged Sibling Worktree Retirement Validation

The final changed path set for this addendum is:

- `docs/planning-and-progress.md`
- `docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md`
- `docs/validation/README.md`

`pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md docs/validation/README.md`
selected:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

Validation results:

| Command             | Result | Notes                                                                                                                   |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | Passed | Passed after formatting only the touched proof/workboard Markdown files.                                                |
| `pnpm docs:check`   | Passed | Documentation link validation passed with ignored evidence link-target placeholders present.                            |
| `pnpm policy:check` | Passed | Secrets, package policy, dead-code, migration, OSS reuse, docs, proof index, Docker ignore, and boundary checks passed. |
| `git diff --check`  | Passed | No whitespace errors.                                                                                                   |

## All Active Local Lanes Integration - 2026-06-17

Branch: `merge/open-practice-active-lanes-2026-06-17`
Base before integration: local `main` at `5f15fc87cec13b12143a4a5b3dc746b1534f5c9c`
Remote base: `origin/main` at `81c3adbec03a79c76ad0b98f5378fccabbc2f8b7`
Integration tip before blocker recording: `3a0dac0e367a6e43a01b3da759c5b1beed21a296`

The 13 dirty active lanes were committed branch-locally, then merged one at a time into the
integration branch. The clean `docs/retire-merged-sibling-worktrees-2026-06-17` branch was merged
last. Conflict resolution preserved row-local proof notes, validation index rows, workboard notes,
route-authorization entries, migration metadata, and existing privacy/trust boundaries. No new
public API decision was invented during conflict resolution.

Integrated lane tips:

| Branch                                                  | Commit     | Subject                                                     |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `feature/op-t134-timer-draft-lock-proof`                | `5348eb3c` | `test: cover timer draft lock proof`                        |
| `feature/aged-receivables-report`                       | `de6c5c08` | `feat: add aged receivables report`                         |
| `codex/docker-residual-postgres-drift-2026-06-17`       | `5f42dfd9` | `docs: record Docker residual Postgres drift`               |
| `docs/document-retention-hold-design-2026-06-17`        | `8488a27d` | `docs: add document retention hold workflow design`         |
| `feature/expense-category-registry`                     | `84ab15bd` | `feat: add expense category registry`                       |
| `codex/financial-export-field-profiles-2026-06-17`      | `94a5668a` | `feat: add financial export field profiles`                 |
| `codex/inbound-email-recovery-metadata-2026-06-17`      | `f6ede8d8` | `feat: add inbound email recovery metadata`                 |
| `feature/reviewer-ledger-balance-snapshot-comparison`   | `151d4678` | `feat: add ledger balance snapshot comparison`              |
| `codex/matter-lifecycle-command-policy-2026-06-17`      | `9a229bf8` | `docs: add matter lifecycle command policy plan`            |
| `docs/payment-import-boundary-2026-06-17`               | `410f2b8e` | `docs: add payment import deposit matching boundary packet` |
| `docs/provider-document-conversion-boundary-2026-06-17` | `036826c8` | `docs: record provider document conversion boundary`        |
| `codex/rebac-contact-list-fixtures`                     | `052c5ec1` | `test: add ReBAC contact list fixture coverage`             |
| `codex/trust-posting-action-descriptors`                | `e71bc416` | `feat: add trust posting action descriptors`                |
| `docs/retire-merged-sibling-worktrees-2026-06-17`       | `ad669ed9` | Clean branch merged last for historical retirement proof    |

Final integrated path set against `origin/main` before this blocker note contained 101 paths:

```text
.dockerignore
.env.example
CONTRIBUTING.md
Dockerfile
README.md
apps/api/src/routes/billing.test.ts
apps/api/src/routes/billing/controls.ts
apps/api/src/routes/billing/dashboard.ts
apps/api/src/routes/billing/expenses.ts
apps/api/src/routes/billing/export-requests.ts
apps/api/src/routes/contacts.test.ts
apps/api/src/routes/inbound-email.test.ts
apps/api/src/routes/inbound-email/imap-polling.ts
apps/api/src/routes/inbound-email/mailgun-raw-mime.ts
apps/api/src/routes/inbound-email/parser-jobs.ts
apps/api/src/routes/inbound-email/shared.ts
apps/api/src/routes/jobs.test.ts
apps/api/src/routes/ledger.test.ts
apps/api/src/routes/ledger/read.ts
apps/api/src/routes/ledger/reports.ts
apps/api/src/routes/outbound-email.ts
apps/api/src/routes/reports.test.ts
apps/api/src/routes/reports.ts
apps/web/app/_features/billing/models.ts
apps/web/app/_features/billing/server-resources.ts
apps/web/app/billing-dashboard.ts
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard/billing-section.test.tsx
apps/web/app/dashboard/billing-section.tsx
apps/web/app/dashboard/reports-section.test.tsx
apps/web/app/dashboard/reports-section.tsx
apps/web/app/dashboard/trust-controls-section.test.tsx
apps/web/app/dashboard/trust-controls-section.tsx
apps/web/app/trust-controls-dashboard.ts
apps/web/app/types.ts
apps/web/next.config.mjs
apps/worker/src/processors.test.ts
apps/worker/src/processors/inbound-email-poll.test.ts
apps/worker/src/processors/inbound-email-poll.ts
apps/worker/src/processors/reports.ts
docker-compose.yml
docker/mailpit/Dockerfile
docker/minio/Dockerfile
docs/README.md
docs/api-and-state-machines.md
docs/deployment-hardening.md
docs/development/getting-started.md
docs/document-retention-hold-workflow-design.md
docs/improvement-opportunities.md
docs/license-policy.md
docs/payment-import-deposit-matching-boundary-packet.md
docs/planning-and-progress.md
docs/planning.md
docs/testing/TESTING.md
docs/threat-model.md
docs/trust-funds-caveats.md
docs/validation/OP-T134_TIME_EXPENSE_CAPTURE_PROOF_2026-05-31.md
docs/validation/OP-T159_AGED_RECEIVABLES_REPORT_PROOF_2026-06-17.md
docs/validation/OP_DOCKER_APP_IMAGE_FOOTPRINT_COMPOSE_HARDENING_PROOF_2026-06-16.md
docs/validation/OP_DOCUMENT_RETENTION_HOLD_WORKFLOW_DESIGN_PROOF_2026-06-17.md
docs/validation/OP_EXPENSE_CATEGORY_REGISTRY_PROOF_2026-06-17.md
docs/validation/OP_FINANCIAL_EXPORT_FIELD_PROFILES_PROOF_2026-06-17.md
docs/validation/OP_INBOUND_EMAIL_REPLAY_RECOVERY_PROOF_2026-06-03.md
docs/validation/OP_LEDGER_BALANCE_SNAPSHOT_COMPARISON_PROOF_2026-06-17.md
docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md
docs/validation/OP_MATTER_LIFECYCLE_COMMAND_POLICY_PLAN_PROOF_2026-06-17.md
docs/validation/OP_PAYMENT_IMPORT_DEPOSIT_MATCHING_BOUNDARY_PACKET_PROOF_2026-06-17.md
docs/validation/OP_PROVIDER_DOCUMENT_CONVERSION_BOUNDARY_PROOF_2026-06-17.md
docs/validation/OP_REBAC_FIXTURE_CATALOGUE_PROOF_2026-06-16.md
docs/validation/OP_TRUST_POSTING_ACTION_DESCRIPTORS_PROOF_2026-06-17.md
docs/validation/README.md
packages/database/migrations/0064_billing_expense_categories.sql
packages/database/migrations/meta/_journal.json
packages/database/src/repository/billing-entries-contracts.ts
packages/database/src/repository/billing-entries/drizzle.ts
packages/database/src/repository/billing-entries/memory.ts
packages/database/src/repository/drizzle-mappers.ts
packages/database/src/repository/drizzle.ts
packages/database/src/repository/memory.ts
packages/database/src/schema/billing.ts
packages/database/src/seed.ts
packages/database/test/repository.billing-controls.test.ts
packages/domain/src/audit-taxonomy.ts
packages/domain/src/authorization-fixtures.ts
packages/domain/src/billing.test.ts
packages/domain/src/billing.ts
packages/domain/src/financial-export-profiles.test.ts
packages/domain/src/financial-export-profiles.ts
packages/domain/src/index.ts
packages/domain/src/ledger.test.ts
packages/domain/src/ledger.ts
packages/domain/src/models.ts
packages/domain/src/operational-actions.test.ts
packages/domain/src/operational-actions.ts
packages/domain/src/permissions.test.ts
packages/domain/src/permissions.ts
packages/domain/src/reports.test.ts
packages/domain/src/reports.ts
scripts/docker-app-smoke.mjs
scripts/route-authorization-manifest.mjs
```

Integrated selector:

```bash
pnpm verify:select -- --base origin/main
```

Selected commands:

- `pnpm docker:residual-watch`
- `pnpm docker:app-smoke`
- `pnpm e2e:docker`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm test`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/worker typecheck`
- `pnpm --filter @open-practice/worker build`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Integrated Docker hard-gate result:

| Command                                    | Result  | Notes                                                                                                                                                |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:select -- --base origin/main` | Passed  | Selector output listed above.                                                                                                                        |
| `pnpm docker:residual-watch`               | Blocked | Printed `$ node scripts/watch-docker-residuals.mjs`, stayed silent for roughly 3.5 minutes, and was interrupted with Ctrl-C. The command exited 130. |

Because a Docker-backed validation command hung, this integration is not publish- or prune-ready.
`main` was not fast-forwarded, `origin/main` was not pushed, selected source branches and worktrees
were left intact, remote refs were not pruned, and stashes were not touched.

### All-Active-Lanes Blocker Note Validation

The final changed path set for this blocker note is:

- `docs/planning-and-progress.md`
- `docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md`
- `docs/validation/README.md`

`pnpm verify:select -- --files docs/planning-and-progress.md docs/validation/OP_MAINLINE_MERGE_PUSH_PRUNE_PROOF_2026-06-16.md docs/validation/README.md`
selected:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`

Validation results:

| Command             | Result | Notes                                                                                                                   |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | Passed | Proof, workboard, and validation-index Markdown formatting passed after targeted Prettier.                              |
| `pnpm docs:check`   | Passed | Documentation link validation passed with ignored evidence link-target placeholders present.                            |
| `pnpm policy:check` | Passed | Secrets, package policy, dead-code, migration, OSS reuse, docs, proof index, Docker ignore, and boundary checks passed. |
| `git diff --check`  | Passed | No whitespace errors.                                                                                                   |

## 2026-06-19 Database Efficiency Merge/Push/Prune Closeout

Scope: merged the three active 2026-06-18 database efficiency lanes through
`merge/open-practice-db-efficiency`, fast-forwarded and pushed `main`, then pruned only clean merged
worktrees and branches.

Branch SHAs:

- `refactor/db-access-hot-path-efficiency`: `5949d83f`
- `refactor/contact-list-efficiency`: `c9b9a79a`
- `refactor/email-outbox-child-bulk-reads`: `b2c1f92b`
- Integration branch after merge/lint cleanup: `fd53556d`
- First `main`/`origin/main` publication parity: `fd53556d`

Integrated changed-path selector:

```bash
pnpm verify:select -- --base origin/main
```

Selected commands:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/database test`
- `pnpm --filter @open-practice/database db:check`
- `pnpm migrations:check`
- `pnpm --filter @open-practice/database typecheck`
- `pnpm --filter @open-practice/database build`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`

Validation results:

| Command                                           | Result | Notes                                                                                                                          |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify:select -- --base origin/main`        | Passed | Selected the integrated database/API/docs gate listed above.                                                                   |
| `pnpm format:check`                               | Passed | Prettier check passed.                                                                                                         |
| `pnpm docs:check`                                 | Passed | Documentation link validation passed.                                                                                          |
| `pnpm policy:check`                               | Passed | Secrets, package policy, dead-code, migration parity, OSS reuse, docs, proof index, local-evidence, and boundary gates passed. |
| `pnpm --filter @open-practice/database test`      | Passed | 23 files and 136 tests passed.                                                                                                 |
| `pnpm --filter @open-practice/database db:check`  | Passed | Drizzle schema check passed.                                                                                                   |
| `pnpm migrations:check`                           | Passed | 66 SQL files match 66 journal entries.                                                                                         |
| `pnpm --filter @open-practice/database typecheck` | Passed | Database typecheck passed.                                                                                                     |
| `pnpm --filter @open-practice/database build`     | Passed | Database build passed.                                                                                                         |
| `pnpm --filter @open-practice/api test`           | Passed | 42 files and 560 tests passed.                                                                                                 |
| `pnpm --filter @open-practice/api typecheck`      | Passed | API typecheck passed.                                                                                                          |
| `pnpm ci:local`                                   | Passed | Initial run found one unused internal helper; after removing it, full verify/build/whitespace gate passed.                     |
| `pnpm migrations:replay`                          | Passed | First run found local Postgres unavailable; after `docker compose up -d postgres`, 66 migrations replayed and cleaned up.      |
| `git diff --check`                                | Passed | No whitespace errors.                                                                                                          |

Docker validation was not selected or run for this closeout because no Dockerfile, Compose,
app-image, object-storage, or Docker-backed runtime path changed.

Publication and prune results:

- `git branch -f main HEAD` fast-forwarded local `main` to the integration branch.
- `git push origin main` updated `origin/main` from `431c5ee9` to `fd53556d`.
- `git fetch origin main` followed by `git rev-parse main origin/main HEAD` confirmed parity at
  `fd53556dd41be7e27c7f0627459a2bb9866a0519`.
- Removed clean merged worktrees:
  `/Users/bryan/projects/open-practice-contact-list-efficiency` and
  `/Users/bryan/projects/open-practice-email-outbox-child-bulk-reads`.
- Deleted merged local branches:
  `refactor/db-access-hot-path-efficiency`, `refactor/contact-list-efficiency`, and
  `refactor/email-outbox-child-bulk-reads`.
- Ran `git worktree prune` and `git remote prune origin`.
- Stash count before and after prune stayed `42`; no stashes were touched.

Closeout proof-addendum validation:

| Command             | Result | Notes                                                                                                                   |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | Passed | Final proof-addendum formatting check passed.                                                                           |
| `pnpm docs:check`   | Passed | Documentation link validation passed.                                                                                   |
| `pnpm policy:check` | Passed | Secrets, package policy, dead-code, migration, OSS reuse, docs, proof index, Docker ignore, and boundary checks passed. |
| `git diff --check`  | Passed | No whitespace errors.                                                                                                   |
