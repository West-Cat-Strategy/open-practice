# Document Retention And Hold Workflow Design

This design records how Open Practice should talk about document retention, hold review, and
records-disposition support. Current runtime support remains limited to non-mutating
retention-review hints, bounded retention/hold reviewer metadata, and metadata-only disposition
posture; there is no deletion automation, retention-deadline enforcement, legal-hold release
command, destructive records-disposition workflow, or jurisdiction-certified compliance claim.

Use this design as the review packet for later implementation planning. Product, privacy, legal,
and deployment reviewers still need to approve any runtime retention, deletion, or disposition
behavior before code changes.

## Current State

Open Practice has these relevant foundations:

- OP-T120 added read-only retention-review hints in the matter-scoped document-processing
  workbench. The hints are derived from legal hold, supersession, upload/checksum/scan state, and
  review state. They do not decide policy eligibility or delete records.
- A follow-up document-processing workbench slice now derives read-only disposition metadata from
  the existing retention/hold review posture: candidate state, safe blocker counts, source cue
  counts, optional `reviewAfter` and `minimumRetainThrough` fields, and fixed non-destructive flags.
  It does not add a command, audit write, schema, migration, deadline enforcement, object deletion,
  legal-hold release, raw payload retention, or compliance claim.
- A later bounded firm-settings slice adds one default disposition review schedule profile with a
  staff-readable, owner-admin-updatable `label`, `reviewCadence`, and optional day-offset hints.
  The workbench projects that profile inside `retentionHoldReview.dispositionMetadata` as reviewer
  context only. It does not compute retention deadlines, decide disposition eligibility, release
  holds, delete objects, store raw policy/export bodies, or claim compliance.
- Contact-history export work uses transient or regenerated export bodies and stores only bounded
  request/link metadata. Its retention language explicitly avoids retained export bodies,
  retention deadlines, deletion automation, legal-hold overrides, and compliance claims.
- Document-processing review and conversion-review surfaces keep raw OCR text, raw Markdown,
  annotation bodies, chunks, embeddings, provider payloads, object bodies, storage keys, and private
  excerpts out of durable metadata, API posture, audit metadata, and proof notes.
- Portal document access already treats legal hold, supersession, privilege/work-product defaults,
  verified upload/checksum/scan state, and accepted external-upload review state as safety gates
  before client-visible file access.
- Trust, billing, deployment, and privacy docs use cautious language: operational controls can help
  staff review records, but the product should not claim legal-records, retention, privacy,
  accounting, tax, trust, or law-society compliance without jurisdiction-specific review.

## Timeline Model

Retention timelines should be practice-configured review schedules, not hard-coded legal defaults.
Future runtime work may model the following fields only after review:

- `retentionTrigger`: the event that starts review scheduling, such as matter closure,
  supersession, client request, upload verification, external-upload acceptance, or audit-response
  completion.
- `reviewAfter`: the date when a record may first become a disposition-review candidate.
- `minimumRetainThrough`: the earliest date before which the document should not enter
  disposition review.
- `reviewCadence`: the practice-configured repeat interval for records that remain held or need
  more evidence.
- `dispositionCandidateState`: a reviewer-facing state such as `not_ready`, `blocked_by_hold`,
  `ready_for_reviewer_packet`, `reviewed_keep`, or `reviewed_superseded`.
- `scheduleProfile`: the bounded default firm-settings profile currently projected into reviewer
  metadata as staff context only; its day offsets are hints, not enforced deadlines.

Any example duration must stay illustrative. For example, a synthetic practice policy might say
"review dormant superseded drafts after 180 days" or "review closed-matter administrative copies
after two years," but those examples are not legal defaults, jurisdictional advice, or certified
records-disposition periods.

## Hold Overrides

A hold blocks disposition review until an authorized reviewer records release evidence. Holds
should be conservative, matter-scoped where possible, and visible as review posture rather than
automatic mutation.

Future review packets should treat these active states as disposition blockers:

- legal hold or litigation hold;
- matter lifecycle hold, pause, reopen, appeal, or active dispute;
- audit response, investigation, regulator, or insurer review;
- disputed identity, adverse-party, confidential-party, or protected-party posture;
- client request, access request, correction request, or do-not-destroy instruction;
- security incident, malware review, checksum mismatch, scan failure, or upload-integrity review;
- trust, billing, invoice, manual-payment, settlement-review, or reconciliation evidence linkage;
- signature, intake, portal share, client portal document access, conversation, inbound-email, or
  export dependency;
- backup/restore, migration rollback/roll-forward, or disaster-recovery proof dependency;
- supersession ambiguity, duplicate-review ambiguity, classification uncertainty, privilege, or
  work-product review.

The product language should say "hold blocks disposition" rather than "hold override completed"
unless the later approved workflow has a specific reviewer release record, actor, reason, evidence
summary, timestamp, and audit trail.

## Deletion-Review Gates

Deletion, purge, suppression, or destructive disposition must not be automatic. Before any future
destructive action is implemented, the reviewer packet should require all of these gates:

- server-side authorization for the actor and firm;
- matter-scoped access to the document and any linked matter/contact records;
- hold clearance across legal, matter, audit, client-request, security, billing/trust, signature,
  portal/share, backup/restore, and document-integrity inputs;
- classification, privilege, work-product, confidential-party, adverse-party, and protected-party
  review;
- upload, checksum, malware-scan, external-upload, and storage-integrity review;
- supersession, duplicate, and replacement-record review;
- portal document access, public share-link, signature-envelope, intake, inbound-email, export, and
  conversation dependency review;
- audit-chain evidence showing who prepared, reviewed, approved, rejected, or deferred the packet;
- second-review or maker-checker approval for any destructive outcome;
- metadata-only proof that avoids raw client text, raw OCR text, raw converted Markdown, private
  excerpts, storage keys, provider payloads, tokens, credentials, arbitrary metadata values, and
  payment or trust evidence payloads.

If any gate is unclear, the document should remain a review candidate or blocked-by-hold record.
The safe default is to preserve the record and schedule another review, not to delete it.

## Records-Disposition Language

Use operational wording that keeps the posture review-first:

- "review candidate";
- "hold blocks disposition";
- "ready for reviewer packet";
- "practice-configured policy";
- "minimum-retain-through date";
- "review-after date";
- "metadata-only disposition posture";
- "reviewed keep";
- "reviewed superseded";
- "destructive action deferred."

Avoid wording that claims the product has made a legal conclusion:

- "legally safe to delete";
- "certified retention period";
- "compliant destruction";
- "jurisdiction-approved disposition";
- "legal-hold override";
- "automatic purge";
- "law-society compliant retention";
- "privacy-law compliant deletion."

Records-disposition support can be described as reviewer workflow support only until a later
jurisdiction-specific review covers record classes, retention periods, notices, authorizations,
audit evidence, backups, exports, recovery, reporting, privacy rights, professional obligations, and
role/province rules.

## Future Implementation Boundary

Future runtime slices should remain non-destructive unless reviewers explicitly approve more. The
current metadata implementation exposes only read-only disposition posture, blocked-by-hold counts,
ready-for-review packet metadata, and one bounded default firm-settings schedule profile derived
from existing authorized projections. Later work should not add retention-deadline enforcement,
background purge jobs, object deletion, legal-hold release commands, public/client disposition
controls, broad export packages, provider payload storage, new compliance claims, or
reference-derived source without separate review.

Reference systems such as ArkCase, Nextcloud, and paperless-ngx may inform vocabulary and workflow
shape only under the existing clean-room policy. Do not copy implementation code, schemas,
migrations, UI markup, styles, assets, sample documents, tests, or distinctive prose from those
projects into the Apache-2.0 core unless a later reuse decision and legal review explicitly approve
it.
