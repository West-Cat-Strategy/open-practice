# Planning and Progress

**Last Updated:** 2026-05-12

Use this file for live tracked work, immediate next moves, and the forward-looking development plan.
Use `docs/planning.md` for the durable roadmap, `docs/improvement-opportunities.md` for candidate
backlog ideas, and `docs/archive/` for historical snapshots and completed validation proof.

## At a Glance

| Snapshot              | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Current focus         | No active implementation row.                                        |
| Next recommended pick | OP-T85 document suggestions review queue.                            |
| Ready rows            | 0                                                                    |
| Candidate rows        | 1                                                                    |
| In progress rows      | 0                                                                    |
| Review rows           | 0                                                                    |
| Blocked rows          | 0                                                                    |
| Archive               | Historical snapshots and proof live in [Archive](archive/README.md). |
| Status vocabulary     | `Ready`, `Candidate`, `In Progress`, `Review`, `Blocked`, `Done`     |

## Forward Development Plan

| Status    | ID     | Task                              | Immediate Next Move                                                                                                                                               | Validation Plan                                                                                                     |
| --------- | ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Candidate | OP-T85 | Document suggestions review queue | Add reviewer-only OCR/extraction suggestion summaries for classification, duplicate/supersession, matter/contact hints, and missing metadata; no automatic merge. | Selector on document-processing API/domain/database/web docs; focused document-processing tests; API/web typecheck. |

Historical snapshots and completed-work proof live in [Archive](archive/README.md).

## Coordination Rules

- Update this file before starting tracked work if status, owner, blocker, or immediate next move changes.
- Keep rows concrete; do not add summary-only tasks.
- Keep implementation rows scoped to one subsystem unless a coordinated exception is recorded here.
- Promote candidate work to `Ready` only when the first slice, owning paths, and validation plan are clear.
- Record fresh validation output before moving a reviewed row to `Done`.
- Preserve completed validation proof in [Archive](archive/README.md) instead of the active board.
- Do not edit `/Users/bryan/projects/nonprofit-manager` from this workboard.
