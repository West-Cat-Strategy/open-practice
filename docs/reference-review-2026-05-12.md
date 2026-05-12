# Open Practice Reference Review - 2026-05-12

This read-only review compared Open Practice against the central reference corpus and a short list of
newly verified upstream candidates. The goal is clean-room product planning: learn workflow patterns,
record reuse posture, and turn gaps into small Open Practice implementation candidates without
copying third-party code, schemas, tests, UI, or distinctive prose.

## Corpus Findings

- `/Users/bryan/projects/reference-repos/docs/index.json` is the central source of truth. The corpus
  is currently metadata-first; missing local clones are treated as absent source evidence, not as
  reviewed implementation material.
- Open Practice docs already named several references that were missing from the central index. The
  2026-05-12 reconciliation added metadata profiles for Papermerge Core, OpenContracts, Documenso,
  Nextcloud Server, Zulip, Jitsi Meet, Activepieces, Temporal, OpenFGA, MarkItDown, Zerox, and
  Unstructured.
- GitHub metadata and license files were checked on 2026-05-12 before adding the profiles. Permissive
  licenses do not automatically allow product reuse; AI/document-extraction and mixed-license
  projects remain reference-only until privacy, provider, and file-level reuse posture is explicit.
- Existing references such as paperless-ngx, DocuSeal, Automatisch, Kimai, LedgerSMB, Midaz, and
  Nextcloud-style collaboration systems stay clean-room references only unless a later documented
  license decision says otherwise.

## Priority Product Signals

- **OP-T85 document suggestions** is the first actionable lane. Open Practice already stores
  document metadata, checksum, scan/review state, OCR jobs, and extraction records; the missing layer
  is a reviewer-only `documentSuggestionSummaries` surface for classification, duplicate or
  supersession cues, matter/contact hints, and missing metadata.
- **Connector delivery** should start with visibility before mutation: expose existing delivery
  attempts read-only, then add a first worker slice that leases pending outbox rows, requires
  allowlisted HTTPS, signs payloads, and records redacted delivery/dead-letter outcomes.
- **Communications** should build on shipped conversation topics and inbox aggregation by adding
  matter-scoped message records, ownership, private notes, and consent/channel follow-up state. Do
  not add realtime chat, federation, or broad support-desk channels in the first slice.
- **Calendar and meetings** should keep the existing event/invitation/export/meeting-link boundary
  intact. Future native WebRTC work should be a separate hosted-session/lobby/access-control lane.
- **Trust, billing, and reporting** already have the core ledger, invoice, reconciliation, and
  trust-reporting surfaces. Useful next work is review-first: bank-statement import preview,
  transfer approve/reject/link flow, billing locks/rate rules, reconciliation exception decisions,
  and async report export requests.

## Reference Additions

| Reference        | Verified license posture             | Reuse posture     | Open Practice signal                                                               |
| ---------------- | ------------------------------------ | ----------------- | ---------------------------------------------------------------------------------- |
| Papermerge Core  | Apache-2.0                           | Adopt selectively | Document lifecycle, OCR metadata, review-state patterns for OP-T85.                |
| OpenContracts    | MIT                                  | Reference-only    | Legal document annotation, corpus review, semantic search, and redaction concepts. |
| Documenso        | AGPL-3.0                             | Reference-only    | TypeScript e-sign recipient and evidence workflow comparison.                      |
| Nextcloud Server | AGPL-3.0-or-later                    | Reference-only    | Secure share/upload lifecycle and file activity vocabulary.                        |
| Zulip            | Apache-2.0                           | Adopt selectively | Topic-threaded message semantics and retention ideas.                              |
| Jitsi Meet       | Apache-2.0                           | Adopt selectively | Hosted meeting-room, lobby, and guest-session boundary ideas.                      |
| Activepieces     | MIT core with enterprise directories | Architecture-only | Connector/action UX, retries, and secret-handling patterns.                        |
| Temporal         | MIT                                  | Adopt selectively | Durable workflow history, retries, timeouts, and worker visibility.                |
| OpenFGA          | Apache-2.0                           | Architecture-only | Relationship-based authorization modeling for matter-scoped access.                |
| MarkItDown       | MIT                                  | Reference-only    | Optional document-conversion research only.                                        |
| Zerox            | MIT                                  | Reference-only    | Optional vision-model extraction research only.                                    |
| Unstructured     | Apache-2.0                           | Reference-only    | Optional document ETL/chunking research only.                                      |

## Duplicate And Avoid Warnings

- Do not re-propose shipped trust ledger posting, invoice lifecycle, reconciliation statements,
  jurisdictional trust reports, external upload review, OCR queueing, calendar invite/export,
  stored meeting-link boundary, or conversation topic foundations as missing features.
- Do not import GPL/AGPL/LGPL/source-available code, schemas, tests, UI, assets, or distinctive text
  into the Apache-2.0 core.
- Do not treat an absent central clone as source-reviewed evidence. Restore or shallow-sync clones
  first if a future pass needs implementation-level comparison.
- Do not turn optional AI/OCR/document-conversion references into runtime dependencies without a
  separate privacy, model-provider, dependency, and local-processing review.

## Candidate Follow-Through

Use `docs/improvement-opportunities.md` for inactive candidate rows and
`docs/planning-and-progress.md` for the live workboard. The best next implementation sequence is:

1. Finish OP-T85 as a read-only suggestion summary layer.
2. Add connector delivery attempt visibility before sending live webhooks.
3. Add connector/webhook delivery worker V1.
4. Add conversation message records V1.
5. Add communications ownership and private notes.
6. Add trust statement import preview.
7. Add trust transfer review and link flow.
8. Add billing period locks and rate rules.
9. Add async billing/trust report export requests.
