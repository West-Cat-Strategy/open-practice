# Contact-History Export, Retention, And Privacy Decision Packet

This packet is a pre-implementation policy surface for future contact-history exports. It records
the decisions Open Practice needs before adding runtime export behavior, retention timelines,
deletion workflows, or privacy-policy-facing claims.

Open Practice currently has the Full CRM Contacts foundation: contact and organization records,
relationship links, matter-contact associations, portal-access posture, conflict-check integration,
and authorization-filtered CRM panels. The remaining contact-history export work must stay behind
explicit product, privacy, and legal review before implementation.

## Purpose And Audience

A future contact-history export should support staff review, practice administration, audit
response, and client/matter record review without becoming a broad data dump. The export purpose
must be selected before implementation so the runtime can constrain fields, authorization,
retention, and audit evidence to that purpose.

Before implementation, the product owner and reviewer should decide:

- which request paths are allowed, such as staff export for one contact, matter-scoped contact
  history, administrative review, or audit-response packet;
- which roles can request each path, and whether owner-admin, auditor, staff, or client-portal
  actors receive different projections;
- whether a request needs a matter context, contact context, review reason, legal-hold state, or
  approval step;
- whether download links are regenerated from authorized projections at request time, as existing
  report and billing export docs prefer, instead of storing export bodies in job metadata;
- how export request, poll, download, expiry, and revocation events will be reflected in audit
  evidence without recording private field values.

All examples in future implementation proof must use synthetic data only.

## Exportable History Categories

The first export design should define categories at the policy level before choosing fields. A safe
starting catalogue is:

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

The packet does not approve a field list. Runtime work must define a minimum field allowlist for
each request path and must avoid raw private notes, arbitrary metadata values, storage keys,
checksum hashes, token values, credentials, provider payloads, or privileged document text unless a
later review explicitly approves a narrower projection.

## Authorization, Redaction, And Matter Boundaries

Future export behavior must preserve the same server-side authorization posture as contact
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
- Download links should be short-lived and revocable, and object storage should remain private with
  access mediated by server-side authorization.

The export design must treat privacy and matter-scoped access as required behavior, not UI-only
ergonomics.

## Retention And Hold Decisions

Open Practice already has read-only document retention-review hints based on legal hold,
supersession, upload/checksum/scan state, and review state. That precedent does not approve contact
retention timelines, deletion workflows, policy eligibility, or records-disposition claims.

Before contact-history export implementation, reviewers must answer:

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

Until those answers are reviewed, future work may add only review-ready decision surfaces or
non-mutating hints. It must not add deletion automation, retention deadlines, retention-policy
eligibility, or jurisdiction-specific records-disposition claims.

## Privacy-Policy Choices Before Runtime Work

The privacy-policy owner should decide the user-facing posture before the first export route ships:

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

This packet does not add or approve:

- API routes, database tables, migrations, UI, workers, providers, dependencies, or generated export
  files;
- live CRM sync, outbound email, SMS, payment, AI, provider side effects, or portal notification
  behavior;
- export body storage in job metadata, audit metadata, queue payloads, or arbitrary review
  metadata;
- deletion automation, retention deadlines, retention-policy eligibility, legal-hold overrides, or
  records-disposition workflows;
- jurisdiction-certified privacy, trust-accounting, tax, legal, or records-retention claims;
- client, matter, credential, payment, private deployment, privileged-document, or private audit
  examples.

The next implementation-ready slice should return to this packet, choose one narrow export purpose,
define its minimum authorized field allowlist, and record validation proof before any runtime
change.
