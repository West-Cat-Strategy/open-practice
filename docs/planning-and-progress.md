# Planning and Progress

**Last Updated:** 2026-05-16

Use this file for live tracked work, immediate next moves, and the forward-looking development plan.
Use `docs/planning.md` for the durable roadmap, `docs/improvement-opportunities.md` for candidate
backlog ideas, and `docs/archive/` for historical snapshots and completed validation proof.

## At a Glance

| Snapshot              | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Current focus         | OP-T91 dashboard lane freshness controls are review-ready.              |
| Next recommended pick | Select the next bounded dashboard or reporting row after OP-T91 review. |
| Ready rows            | 0                                                                       |
| Candidate rows        | 0                                                                       |
| In progress rows      | 0                                                                       |
| Review rows           | 1                                                                       |
| Blocked rows          | 0                                                                       |
| Archive               | Historical snapshots and proof live in [Archive](archive/README.md).    |
| Status vocabulary     | `Ready`, `Candidate`, `In Progress`, `Review`, `Blocked`, `Done`        |

## Forward Development Plan

| Status | ID     | Task                                              | Immediate Next Move                                                                                                                                                                                                        | Validation Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review | OP-T91 | Dashboard lane freshness and error-state controls | Added explicit refresh, freshness, stale, and error-state cues for queue, provider, and audit lanes using existing authorized dashboard endpoints; no backend contract changes.                                            | Proof: `pnpm verify:select -- --files docs/planning-and-progress.md docs/planning.md apps/web/app/dashboard-client.tsx apps/web/app/dashboard/queues-section.tsx apps/web/app/dashboard-utils.ts apps/web/app/operational-focus-panel.ts apps/web/app/provider-status-dashboard.ts apps/web/app/dashboard-client.test.ts apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/90-responsive-motion.css`; `pnpm format:check`; `pnpm docs:check`; `pnpm policy:check`; `pnpm --filter @open-practice/web test`; `pnpm --filter @open-practice/web typecheck`. |
| Done   | OP-T88 | Connector delivery worker V1                      | Added the `connectors` worker queue, durable connector-outbox leasing, HMAC-signed HTTPS summary delivery, redacted retry/dead-letter settlement, and job/API status coverage without exposing secrets or raw payloads.    | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Done   | OP-T86 | Calendar event lifecycle slice                    | Added staff create/update, cancel/reschedule, and manual reminder-state records for matter-scoped calendar events; attendee, invitation, iCalendar, and meeting-link behavior stayed bounded.                              | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Done   | OP-T85 | Document suggestions review queue                 | Added reviewer-only OCR/extraction suggestion summaries for classification, duplicate/supersession, matter/contact hints, and missing metadata; no automatic merge, classification write, metadata write, or merge action. | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Historical snapshots and completed-work proof live in [Archive](archive/README.md).

## Coordination Rules

- Update this file before starting tracked work if status, owner, blocker, or immediate next move changes.
- Keep rows concrete; do not add summary-only tasks.
- Keep implementation rows scoped to one subsystem unless a coordinated exception is recorded here.
- Promote candidate work to `Ready` only when the first slice, owning paths, and validation plan are clear.
- Record fresh validation output before moving a reviewed row to `Done`.
- Preserve completed validation proof in [Archive](archive/README.md) instead of the active board.
- Do not edit `/Users/bryan/projects/nonprofit-manager` from this workboard.
