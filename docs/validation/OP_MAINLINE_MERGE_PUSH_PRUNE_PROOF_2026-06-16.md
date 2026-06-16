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
