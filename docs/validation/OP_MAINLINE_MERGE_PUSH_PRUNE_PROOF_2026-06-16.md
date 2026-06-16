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
