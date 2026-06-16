# Queued Contact-History Export Links Proof

Date: 2026-06-16 PDT

## Scope

This lane adds the smallest queued/download-link follow-up to the shipped single-contact CRM
contact-history export runtime:

- keeps `POST /api/contacts/:contactId/history-export` available unchanged as the synchronous
  transient `staff_review` route;
- adds `POST /api/contacts/:contactId/history-export-requests`;
- adds `GET /api/contacts/:contactId/history-export-requests/:exportJobId`;
- adds `GET /api/contacts/:contactId/history-export-requests/:exportJobId/download`;
- keeps the same `staff_review` purpose and existing `contact:export` authorization;
- stores request/link metadata only in existing `job_lifecycle_records` on the existing `reports`
  queue with `jobName: "contact_history_export"` and
  `targetResourceType: "contact_history_export"`;
- treats `downloadExpiresAt` as a 24-hour authenticated link expiry only, not as a records-retention
  deadline;
- regenerates the JSON only in the authenticated download route from current requester visibility.

## Privacy And Retention Boundaries

The queued request stores only bounded staff-review metadata:

- job id, contact id, purpose, status, queued/started/finished/failed timestamps, poll/download
  URLs in the API response, `downloadExpiresAt`, review-reason presence, and safe counts;
- posture strings/booleans for no retained body, no retained artifact, no deletion automation, no
  retention deadline, no legal-hold override, and redacted authorized projection;
- safe worker completion counts after rechecking that the requesting user still exists, still has
  `contact:export`, and can still see the contact.

The slice does not add a database schema, migration, provider, object-storage artifact, retained
export body, export body in job/audit metadata, broad CRM permission, retention policy, retention
deadline, deletion workflow, legal-hold override, revocation route, or compliance claim. Metadata
redaction keeps raw review reasons, raw private contact history, private notes, raw matched values,
task text, contact identifier values, storage keys, tokens, provider payloads, and export bodies out
of queue/audit metadata.

## Changed Paths

- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/contacts.test.ts`
- `apps/api/src/server.ts`
- `apps/web/app/_features/contacts/models.ts`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `apps/web/app/dashboard/contacts-section.tsx`
- `apps/worker/src/processors/reports.ts`
- `apps/worker/src/processors.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/permissions.test.ts`
- `scripts/route-authorization-manifest.mjs`
- `docs/api-and-state-machines.md`
- `docs/contact-history-export-retention-privacy-decision-packet.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md`
- `docs/validation/OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md`
- `docs/validation/OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md`

## Focused Validation

Initial upstream package build preparation passed:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
```

Focused package/API/web/worker validation passed:

```bash
pnpm --filter @open-practice/domain test -- permissions.test.ts audit-taxonomy.test.ts
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api exec vitest run src/routes/contacts.test.ts --reporter=dot
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/web test -- dashboard-client.test.ts
pnpm --filter @open-practice/web typecheck
```

Results:

- Domain focused tests passed: 28 files, 190 tests.
- Domain typecheck passed.
- API focused contacts route tests passed: 1 file, 9 tests.
- API typecheck passed.
- Worker tests passed: 5 files, 44 tests.
- Worker typecheck passed.
- Web focused dashboard tests passed: 35 files, 193 tests.
- Web typecheck passed.

## Selector

Passed:

```bash
pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/api/src/routes/contacts.ts apps/api/src/server.ts apps/web/app/_features/contacts/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/contacts-section.tsx apps/worker/src/processors.test.ts apps/worker/src/processors/reports.ts docs/api-and-state-machines.md docs/contact-history-export-retention-privacy-decision-packet.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md docs/validation/OP_CONTACT_HISTORY_EXPORT_RETENTION_PRIVACY_DECISION_PACKET_PROOF_2026-06-15.md docs/validation/OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md docs/validation/README.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts packages/domain/src/permissions.test.ts packages/domain/src/permissions.ts scripts/route-authorization-manifest.mjs
```

Selected:

```text
Recommended validation commands:
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Selector-Driven Validation

Passed:

```bash
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/domain test
pnpm --filter @open-practice/domain typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/worker typecheck
pnpm --filter @open-practice/worker build
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm test
pnpm build
git diff --check
```

Results:

- `pnpm format:check` passed after Prettier was run on the exact changed-path set.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- Domain tests passed: 28 files, 190 tests.
- Domain typecheck passed.
- API tests passed: 41 files, 539 tests.
- API typecheck passed.
- Providers tests passed: 9 files, 20 tests.
- Worker tests passed: 5 files, 44 tests.
- Worker typecheck passed.
- Worker build passed.
- Web tests passed: 35 files, 193 tests.
- Web typecheck passed.
- Root `pnpm test` passed: 9 Turbo tasks plus 63 script tests.
- Root `pnpm build` passed: 6 Turbo build tasks.
- `git diff --check` passed.

## Skipped Checks

None.
