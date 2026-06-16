# Contact-History Export, Retention, And Privacy Decision Packet

This packet records the policy surface for contact-history exports. The first approved runtime
slice is selected and shipped: a transient `staff_review` JSON export for one visible CRM contact,
generated from existing authorized dossier/detail/timeline projections with a required review
reason and no retained export body. A follow-up now adds the smallest queued request/poll/
short-lived authenticated download-link path for the same purpose and permission while still
storing no export body.

Open Practice currently has the Full CRM Contacts foundation: contact and organization records,
relationship links, matter-contact associations, portal-access posture, conflict-check integration,
authorization-filtered CRM panels, the first single-contact staff-review export runtime, and the
metadata-only queued/download-link follow-up. Broader contact-history export work must stay behind
explicit product, privacy, and legal review before implementation.

## Selected Synchronous Runtime Slice

The selected first synchronous runtime is intentionally narrow:

- request path: `POST /api/contacts/:contactId/history-export`;
- purpose: `staff_review` only;
- requester path: authenticated owner-admin/licensee staff with existing `contact:export`;
- context: one firm-scoped contact visible through the existing dossier/detail visibility rules;
- body: strict `{ purpose: "staff_review", reviewReason: string }`, with a short review reason
  required before generation;
- output: synchronous JSON built from authorized contact detail, visible dossier, visible timeline,
  portal posture, conflict summaries, and duplicate-review posture;
- storage posture: transient regeneration only, no server-side retained export body, no object
  storage artifact, no queue payload, no job metadata body, no provider, no persistent download
  link, no schema, and no migration;
- audit posture: `contact_history_export.requested` stores only bounded IDs, purpose, reason
  presence, generated counts, and retention/hold/privacy posture strings.

This slice does not create retention deadlines, deletion automation, legal-hold override behavior,
approval workflows, matter-scoped export packets, jurisdiction-certified records-disposition
claims, or privacy-law compliance claims.

## Queued Download-Link Follow-Up

The queued/download-link follow-up keeps the same `staff_review` purpose and existing
`contact:export` authorization, but moves staff review into a request/poll/download flow:

- request path: `POST /api/contacts/:contactId/history-export-requests`;
- poll path: `GET /api/contacts/:contactId/history-export-requests/:exportJobId`;
- download path:
  `GET /api/contacts/:contactId/history-export-requests/:exportJobId/download`;
- queue posture: existing `reports` queue and existing `job_lifecycle_records`, with `jobName`
  and `targetResourceType` set to `contact_history_export`;
- download posture: authenticated route only, 24-hour `downloadExpiresAt` link expiry, regenerated
  from current requester visibility at download time;
- metadata posture: job id, contact id, purpose, status/timestamps, safe counts, review-reason
  presence, poll/download URLs in responses, `downloadExpiresAt`, and posture strings/booleans
  only;
- storage posture: no retained export body, no retained export artifact, no object storage
  artifact, no provider, no schema, no migration, no deletion automation, no retention deadline,
  and no legal-hold override.

The queued follow-up treats `downloadExpiresAt` as link expiry only. It does not create a contact
records-retention deadline, policy eligibility decision, legal-hold override, revocation workflow,
object-storage artifact, provider boundary, or jurisdiction-certified compliance claim.

## Purpose And Audience

Future contact-history exports may support practice administration, audit response, and
client/matter record review without becoming broad data dumps. The first runtime purpose is
selected as `staff_review` for one visible contact, so the runtime constrains fields,
authorization, retention posture, and audit evidence to that purpose.

Before any broader implementation, the product owner and reviewer should decide:

- which request paths are allowed, such as staff export for one contact, matter-scoped contact
  history, administrative review, or audit-response packet;
- which roles can request each path, and whether owner-admin, auditor, staff, or client-portal
  actors receive different projections;
- whether a request needs a matter context, contact context, review reason, legal-hold state, or
  approval step;
- whether download links are regenerated from authorized projections at request time, as the
  single-contact queued follow-up now does, instead of storing export bodies in job metadata;
- how export request, poll, download, expiry, and revocation events will be reflected in audit
  evidence without recording private field values.

All examples in future implementation proof must use synthetic data only.

## Exportable History Categories

The selected first export design defines policy categories without exposing raw private history. The
safe starting catalogue is:

- contact identity posture, such as person or organization type, lifecycle status, role categories,
  and reviewer-maintained identifiers;
- name history posture, including aliases or former names where the requester is authorized to see
  them;
- contact-method posture, including email, phone, address, website, preference, review, and
  do-not-contact state;
- relationship history, including directional links, status, dates, and matter scope when allowed;
- matter-party history, including role, side or alignment, status, dates, confidential-party
  posture, and adverse/protected-party posture;
- portal-access posture, including invited, active, suspended, revoked, or expired state and
  matter-scoped permission summaries;
- conflict-review posture, including match categories, risk summaries, and explanations only at the
  authorization level already allowed for the requester;
- data-quality and duplicate-review posture, without automatic merges or hidden source mutation.

The first runtime approves only a minimum field allowlist for the `staff_review` single-contact
path. Runtime work must continue to avoid raw private notes, arbitrary metadata values, storage
keys, checksum hashes, token values, credentials, provider payloads, task titles/descriptions,
raw matched values, scheduling source labels, hidden matter details, or privileged document text
unless a later review explicitly approves a narrower projection.

## Authorization, Redaction, And Matter Boundaries

Export behavior must preserve the same server-side authorization posture as contact
dossiers, matter-contact associations, conflict checks, portal grants, and document access.

- Firm scoping and authenticated server-side authorization are required for every export request.
- A requester who can see a contact but not a related matter should receive a redacted association
  summary rather than hidden matter details.
- Matter-scoped exports must not reveal unrelated matters, confidential parties, protected-party
  cues, or adverse-party details beyond the requester authorization level.
- Portal grants must not bypass matter authorization, document authorization, scan/checksum status,
  legal holds, sharing rules, document classification restrictions, or confidential-party account
  binding.
- Conflict-check detail should keep the existing owner-admin/auditor detailed visibility and
  aggregate or redacted output for other authorized readers.
- Export jobs and audit events should store bounded request metadata, status, purpose, actor,
  timestamps, and taxonomy summaries, not raw export rows or arbitrary metadata values.
- The synchronous first runtime has no download link or object-storage artifact. The queued
  follow-up uses a short-lived authenticated download route that regenerates the export from current
  visibility and still has no object-storage artifact. Future download-link or object-storage work
  needs a separate reviewed revocation/storage decision.

The export design must treat privacy and matter-scoped access as required behavior, not UI-only
ergonomics.

## Retention And Hold Decisions

Open Practice already has read-only document retention-review hints based on legal hold,
supersession, upload/checksum/scan state, and review state. That precedent does not approve contact
retention timelines, deletion workflows, policy eligibility, or records-disposition claims.

Before broader contact-history export implementation, reviewers must answer:

- whether contact-history export records are transient request artifacts, retained audit evidence,
  regenerated downloads, or some combination of those;
- whether export job metadata, download links, and regenerated export content have different expiry
  and revocation rules;
- how legal hold, matter hold, disputed identity, adverse-party posture, client request, and audit
  response states affect export availability;
- whether contact-history records can be deleted, suppressed, amended, or marked superseded, and
  which actor/reason/evidence is required;
- whether a retention policy is practice-configured, matter-scoped, contact-scoped, or
  intentionally absent in the first runtime slice;
- how backup/restore proof and migration rollback/roll-forward drills should preserve or expire
  export evidence consistently;
- which decisions need jurisdiction-specific legal review before the product can claim retention or
  records-disposition support.

The current single-contact staff-review surfaces answer the narrow storage question as transient
generation/regeneration with no retained export body, no retained artifact, no retention deadline,
no deletion workflow, and no compliance claim. Until broader answers are reviewed, future work may
add only review-ready decision surfaces or non-mutating hints. It must not add deletion automation,
retention deadlines, retention-policy eligibility, or jurisdiction-specific records-disposition
claims.

## Privacy-Policy Choices Before Runtime Work

The privacy-policy owner selected the first-route posture as internal staff review of one visible
contact from an authorized, redacted projection. Before broader routes ship, the privacy-policy
owner should decide:

- what contact-history information the practice may export and for what purpose;
- whether exports can include communication preferences, do-not-contact state, confidential-party
  posture, adverse/protected-party markers, and conflict-review summaries;
- how requester role, matter access, portal account binding, and client visibility change the
  export projection;
- how export request, download, expiry, revocation, and denial events are audited and explained;
- what minimum review reason or approval evidence is required for administrative or audit-response
  exports;
- how the product describes contact-history exports without claiming legal advice, privacy-law
  compliance, trust-accounting compliance, or jurisdiction-certified records management.

This repo should continue to avoid production compliance claims until jurisdiction-specific review
covers records, authorizations, retention, reporting, privacy notices, and role/province rules.

## Explicit Non-Goals

This packet and the selected first runtime do not add or approve:

- database tables, migrations, providers, dependencies, stored export files, object-storage
  artifacts, persistent download links, retained export bodies, broad export queues, or queue
  payloads that contain raw history;
- live CRM sync, outbound email, SMS, payment, AI, provider side effects, or portal notification
  behavior;
- export body storage in job metadata, audit metadata, queue payloads, or arbitrary review
  metadata;
- deletion automation, retention deadlines, retention-policy eligibility, legal-hold overrides, or
  records-disposition workflows;
- jurisdiction-certified privacy, trust-accounting, tax, legal, or records-retention claims;
- client, matter, credential, payment, private deployment, privileged-document, or private audit
  examples.

The next implementation-ready slice should return to this packet, choose a separate narrow export
purpose or scope beyond single-contact `staff_review`, define its minimum authorized field
allowlist, and record validation proof before any broader runtime change.
