# Planning and Progress

**Last Updated:** 2026-05-01

Use this file for live tracked work, immediate next moves, and the forward-looking development plan.
Use `docs/planning.md` for the durable roadmap, `docs/improvement-opportunities.md` for candidate
backlog ideas, and `docs/planning-completed-archive.md` for historical validation proof.

## At a Glance

| Snapshot              | Value                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- |
| Current focus         | `OP-T34` Calendar/deadline radar                                                       |
| Next recommended pick | `OP-T34` native matter calendar dashboard slice                                        |
| Ready rows            | 1                                                                                      |
| Candidate rows        | 3                                                                                      |
| In progress rows      | 0                                                                                      |
| Review rows           | 0                                                                                      |
| Blocked rows          | 0                                                                                      |
| Completed archive     | Historical proof moved to [Planning Completed Archive](planning-completed-archive.md). |
| Status vocabulary     | `Ready`, `Candidate`, `In Progress`, `Review`, `Blocked`, `Done`                       |

## Forward Development Plan

| Status    | ID     | Task                                | Immediate Next Move                                                                                                                                                            | Validation Plan                                                                                                                                                                                        |
| --------- | ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ready     | OP-T34 | Calendar/deadline radar             | Build a native matter calendar dashboard/deadline radar from the existing calendar/CalDAV foundation; keep meeting invitations as a separate explicit-capability slice.        | Run selector on calendar domain/database/API/web/docs paths; include calendar/domain/API/web tests, CalDAV negative regressions, `db:check` if schema changes, and docs/policy checks.                 |
| Candidate | OP-T35 | Legal clinic workflow foundation    | Define legal clinics as the first specialized workflow with clinic programs, eligibility/referral metadata, relationship roles, and reuse of intake/email/calendar/documents.  | Start with docs/API/domain design selector; expand to API/domain/database/web tests only after the first clinic surface is chosen and implemented.                                                     |
| Candidate | OP-T37 | Document/email operations follow-up | Add inbound email ingestion idempotency, reviewed attachment-to-document promotion, OCR queue activation, richer document review queues, and governed email template previews. | Run selector on inbound-email/document-processing/worker/provider/database/API/docs paths; include worker/API/database tests, `db:check`, docs/policy checks, and local gate for cross-worker changes. |
| Candidate | OP-T38 | Trust controls workbench            | Add reconciliation dry-runs, maker-checker inbox filters, trust ledger reports, and posting diagnostics while deferring holds, accounting dimensions, and compliance packs.    | Run selector on ledger/domain/database/API/web/docs paths; include ledger/domain/API/database tests, `db:check`, docs/policy checks, and cautious trust/funds docs review.                             |

## Recently Completed

| ID     | Outcome                            | Concise Proof                                                                                                                                                                         |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-T33 | Local AI drafting assist           | Disabled-by-default draft assist records, fake provider, synchronous draft/document assist API, review state, dashboard panel, insertion-without-save helper, docs, and local gates.  |
| OP-T32 | Guided intake branching/packages   | Embedded template definitions, branch resolution, package document generation, snapshot-authoritative rendering, persistence, redacted audit events, docs, and local gates.           |
| OP-T36 | Email workflow closure             | Generic SMTP/Redis-gated `/api/mail/outbox`, shared outbox helper, source-specific notifications, token emails, and worker sent/failed lifecycle closure.                             |
| OP-T30 | Audit event coverage pass          | Route audit events and assertions cover signatures, intake, drafts, documents, billing, ledger, email outbox, shares, and external uploads, with bodies/tokens out of audit metadata. |
| OP-T31 | Dashboard section deep links       | `/?section=...` dashboard hydration, sidebar URL sync, and route-catalog fallback behavior for unknown, disabled, queue, and non-sidebar entries without API changes.                 |
| OP-T29 | External upload capability flow    | Repository-backed upload links, token-scoped S3 intent/complete flow, S3-disabled fallback, access logs, dashboard controls, route catalog coverage, docs, and local gates.           |
| OP-T28 | Secure shares v1                   | Token-hashed create/list/revoke share links, public token-scoped document metadata, access logs, audit events, dashboard controls, API/docs alignment, and `pnpm ci:local`.           |
| OP-M3  | Local-only CI/CD refactor          | Local gate docs, scripts, GitHub automation cleanup, dependency audit guidance, `pnpm ci:local`, `pnpm deps:audit`, docs/policy checks, and skill validation.                         |
| OP-T27 | Drafting dashboard flow completion | Template-backed draft creation, dashboard draft loading, API/web/domain regressions, package typechecks, `pnpm build`, docs/policy checks, and `git diff --check`.                    |
| OP-T26 | Trust/funds DB approval hardening  | Persistent client-balance guards, atomic ledger updates, approval/reconciliation persistence, package tests/typechecks, migration replay, docs/policy, and verify.                    |
| OP-T25 | Inbound email parsing and triage   | `mailparser` parsing, parsed-message persistence, matter-scoped reads, provider/worker/database/API/domain checks, docs/policy checks, and `pnpm verify`.                             |
| OP-T24 | Drafting foundation and templates  | Repository-backed draft APIs, TipTap/ProseMirror validation, sanitized snapshots, migrations, route regressions, docs/policy alignment, and `pnpm verify`.                            |

See [Planning Completed Archive](planning-completed-archive.md) for the full historical workboard and validation ledger.

## Coordination Rules

- Update this file before starting tracked work if status, owner, blocker, or immediate next move changes.
- Keep rows concrete; do not add summary-only tasks.
- Keep implementation rows scoped to one subsystem unless a coordinated exception is recorded here.
- Promote candidate work to `Ready` only when the first slice, owning paths, and validation plan are clear.
- Record fresh validation output before moving a reviewed row to `Done`.
- Preserve completed validation proof in [Planning Completed Archive](planning-completed-archive.md) instead of the active board.
- Do not edit `/Users/bryan/projects/nonprofit-manager` from this workboard.
