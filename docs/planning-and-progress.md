# Planning and Progress

**Last Updated:** 2026-05-12

Use this file for live tracked work, immediate next moves, and the forward-looking development plan.
Use `docs/planning.md` for the durable roadmap, `docs/improvement-opportunities.md` for candidate
backlog ideas, and `docs/archive/` for historical snapshots and completed validation proof.

## At a Glance

| Snapshot              | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Current focus         | OP-T89 is in review with local proof recorded.                       |
| Next recommended pick | OP-T90 worker-owned async report/export requests.                    |
| Ready rows            | 0                                                                    |
| Candidate rows        | 6                                                                    |
| In progress rows      | 0                                                                    |
| Review rows           | 1                                                                    |
| Blocked rows          | 0                                                                    |
| Archive               | Historical snapshots and proof live in [Archive](archive/README.md). |
| Status vocabulary     | `Ready`, `Candidate`, `In Progress`, `Review`, `Blocked`, `Done`     |

## Forward Development Plan

| Status    | ID     | Task                                              | Immediate Next Move                                                                                                                                                                                                        | Validation Plan                                                                                                                                                                                  |
| --------- | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Review    | OP-T89 | Validation proof index and client action hub      | Review the completed validation proof index, linked docs map, candidate harvest rows, token `Needs attention` summaries, unsupported intake schema lockout, and selector runtime-config coverage.                          | Proof recorded in [OP-T89 validation note](validation/OP-T89_NONPROFIT_HARVEST_CLIENT_ACTION_HUB_PROOF_2026-05-12.md).                                                                           |
| Candidate | OP-T90 | Worker-owned async report/export requests         | Move large audit, billing, or trust exports toward queued create/poll/download semantics using job metadata that excludes report bodies and sensitive client data.                                                         | Start with `pnpm verify:select -- --files apps/api/src/routes apps/worker/src packages/domain/src packages/database/src docs/improvement-opportunities.md`.                                      |
| Candidate | OP-T91 | Dashboard lane freshness and error-state controls | Add explicit refresh/cache/error-state cues for dashboard lanes so staff can refresh queues/provider/audit data without reloading a sensitive workspace.                                                                   | Start with `pnpm verify:select -- --files apps/web/app/dashboard-client.tsx apps/web/app/dashboard apps/web/app/operational-focus-panel.ts`.                                                     |
| Candidate | OP-T92 | Intake/form authoring diagnostics                 | Add non-persistent diagnostics for duplicate keys, broken conditions, and missing mapping targets in the structured intake builder before staff publish client-facing flows.                                               | Start with `pnpm verify:select -- --files apps/web/app/intake-forms/StructuredIntakeBuilder.tsx apps/web/app/intake-forms`.                                                                      |
| Candidate | OP-T93 | Connector secret masking and redaction hardening  | Ensure connector/webhook secret reads return only masked sentinels, unchanged-secret writes preserve stored values, and retry/backup/export paths stay redacted.                                                           | Start with `pnpm verify:select -- --files apps/api/src/routes/connectors.ts apps/worker/src packages/database/src`.                                                                              |
| Candidate | OP-T94 | Route and validation boundary ratchets            | Extend `scripts/validate-open-practice-boundaries.mjs` and selector coverage for route-family ownership, auth/validation helpers, and runtime-sensitive changes without importing nonprofit-manager scripts.               | Start with `pnpm verify:select -- --files scripts/validate-open-practice-boundaries.mjs scripts/select-validation.mjs scripts/select-validation.test.mjs apps/api/src/routes apps/api/src/http`. |
| Candidate | OP-T95 | Local release proof and SBOM handoff              | Replace the current lightweight `release:local` surface with an Open Practice-native local release artifact that records audit, license, validation, and SBOM evidence.                                                    | Start with `pnpm verify:select -- --files package.json scripts docs/development/github-maintenance.md docs/testing/TESTING.md`.                                                                  |
| Done      | OP-T88 | Connector delivery worker V1                      | Added the `connectors` worker queue, durable connector-outbox leasing, HMAC-signed HTTPS summary delivery, redacted retry/dead-letter settlement, and job/API status coverage without exposing secrets or raw payloads.    | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                |
| Done      | OP-T86 | Calendar event lifecycle slice                    | Added staff create/update, cancel/reschedule, and manual reminder-state records for matter-scoped calendar events; attendee, invitation, iCalendar, and meeting-link behavior stayed bounded.                              | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                |
| Done      | OP-T85 | Document suggestions review queue                 | Added reviewer-only OCR/extraction suggestion summaries for classification, duplicate/supersession, matter/contact hints, and missing metadata; no automatic merge, classification write, metadata write, or merge action. | 2026-05-12 proof archived in [Planning completed archive](archive/planning-completed-archive.md).                                                                                                |

Historical snapshots and completed-work proof live in [Archive](archive/README.md).

## Coordination Rules

- Update this file before starting tracked work if status, owner, blocker, or immediate next move changes.
- Keep rows concrete; do not add summary-only tasks.
- Keep implementation rows scoped to one subsystem unless a coordinated exception is recorded here.
- Promote candidate work to `Ready` only when the first slice, owning paths, and validation plan are clear.
- Record fresh validation output before moving a reviewed row to `Done`.
- Preserve completed validation proof in [Archive](archive/README.md) instead of the active board.
- Do not edit `/Users/bryan/projects/nonprofit-manager` from this workboard.
