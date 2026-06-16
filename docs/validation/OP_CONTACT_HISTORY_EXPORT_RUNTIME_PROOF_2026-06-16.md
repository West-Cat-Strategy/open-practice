# CRM Contact-History Export Runtime Proof

Date: 2026-06-16 PDT

## Scope

This lane implemented the smallest selected synchronous contact-history export runtime:

- `POST /api/contacts/:contactId/history-export`;
- existing `contact:export` permission only, with no broadened CRM roles;
- strict `{ purpose: "staff_review", reviewReason }` request body;
- transient single-contact JSON generated synchronously from authorized contact detail, visible
  dossier, visible contact timeline, portal posture, conflict summaries, and duplicate-review
  posture;
- Contacts dashboard action shown only when the contacts capability includes `export`, requiring a
  short review reason before calling the API and generating a browser-side JSON download from the
  response.

Current follow-up: the queued/download-link slice is recorded separately in
[OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md](OP_CONTACT_HISTORY_EXPORT_QUEUE_LINKS_PROOF_2026-06-16.md).
This proof's no-queue/no-link statements describe the synchronous route above, which remains
available unchanged.

## Privacy And Retention Boundaries

The synchronous runtime preserves the contact-history export decision packet's selected first-slice
posture:

- no schema, migration, queue, worker, provider, object-storage artifact, persistent download link,
  retained export body, or raw body in audit/job metadata;
- no retention deadline, deletion workflow, legal-hold override, approval workflow, or
  jurisdiction-certified compliance claim;
- no raw private contact history, notes, private notes, relationship private notes,
  matter-association private notes, raw matched values, token/hash/storage/checksum values,
  provider payloads, credentials, privileged document text, task titles/descriptions, scheduling
  source labels, hidden matter details, or arbitrary metadata values;
- matter associations and timeline cues rely on the existing authorized dossier/timeline visibility
  instead of widening matter reads.

Audit evidence uses `contact_history_export.requested` with category `contacts`, resource type
`contact_history_export`, optional matter scope, and an allowlist of IDs/counts/posture strings:
`contactId`, `purpose`, `reviewReasonPresent`, `generatedCategoryCount`, `timelineEntryCount`,
`matterAssociationCount`, `portalGrantCount`, `conflictSummaryCount`, `retentionPosture`,
`legalHoldPosture`, and `privacyPosture`.

## Changed Paths

- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/contacts.test.ts`
- `apps/web/app/_features/contacts/models.ts`
- `apps/web/app/dashboard/contacts-section.tsx`
- `apps/web/app/dashboard-client.tsx`
- `apps/web/app/dashboard-client.test.ts`
- `packages/domain/src/audit-taxonomy.ts`
- `packages/domain/src/audit-taxonomy.test.ts`
- `scripts/route-authorization-manifest.mjs`
- `docs/api-and-state-machines.md`
- `docs/contact-history-export-retention-privacy-decision-packet.md`
- `docs/improvement-opportunities.md`
- `docs/planning-and-progress.md`
- `docs/validation/README.md`
- `docs/validation/OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md`

## Selector

Passed:

```bash
pnpm verify:select -- --files apps/api/src/routes/contacts.test.ts apps/api/src/routes/contacts.ts apps/web/app/_features/contacts/models.ts apps/web/app/dashboard-client.test.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/contacts-section.tsx docs/api-and-state-machines.md docs/contact-history-export-retention-privacy-decision-packet.md docs/improvement-opportunities.md docs/planning-and-progress.md docs/validation/README.md docs/validation/OP_CONTACT_HISTORY_EXPORT_RUNTIME_PROOF_2026-06-16.md packages/domain/src/audit-taxonomy.test.ts packages/domain/src/audit-taxonomy.ts scripts/route-authorization-manifest.mjs
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
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation

Initial focused validation:

```bash
pnpm --filter @open-practice/domain build
pnpm --filter @open-practice/database build
pnpm --filter @open-practice/providers build
pnpm --filter @open-practice/domain test -- audit-taxonomy.test.ts permissions.test.ts
pnpm --filter @open-practice/web test -- dashboard-client.test.ts
pnpm --filter @open-practice/api exec vitest run src/routes/contacts.test.ts
```

Results:

- Domain build passed.
- Database build passed.
- Providers build passed.
- Domain focused tests passed: 27 files, 184 tests.
- Web focused dashboard tests passed: 35 files, 191 tests.
- API focused contacts route tests passed: 1 file, 7 tests.

Note: `pnpm --filter @open-practice/api test -- contacts.test.ts` was attempted first, but the
package script ran the broader API suite and hit an unrelated timeout in
`src/routes/webauthn.test.ts`. The exact contacts route test was rerun with
`pnpm --filter @open-practice/api exec vitest run src/routes/contacts.test.ts` and passed.

Additional selector-driven validation will be recorded before closeout.

Selector/static/package validation:

```bash
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/domain typecheck
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/providers test
pnpm --filter @open-practice/worker test
pnpm --filter @open-practice/api test
pnpm test
pnpm build
git diff --check
```

Results:

- API typecheck passed.
- Web typecheck passed.
- Domain typecheck passed.
- `pnpm format:check` initially found changed-file wrapping in
  `apps/web/app/dashboard-client.test.ts` and `docs/api-and-state-machines.md`; Prettier was run on
  the exact changed-path set, then `pnpm format:check` passed.
- `pnpm docs:check` passed.
- `pnpm policy:check` passed.
- Providers tests passed: 9 files, 20 tests.
- Worker tests passed: 5 files, 42 tests.
- API tests passed: 41 files, 530 tests.
- `pnpm test` passed on rerun: 9 Turbo tasks plus 63 script tests. The first root attempt hit an
  unrelated generated-document-ID ordering assertion in `apps/worker/src/processors.test.ts` even
  though the standalone worker lane was green before and after; no product code was changed for that
  unrelated flake.
- `pnpm build` passed: 6 Turbo build tasks.
- `git diff --check` passed.

Browser validation:

```bash
pnpm e2e:host
pnpm e2e:matterless
pnpm e2e:client-portal
node scripts/run-e2e.mjs first-run
```

Results:

- Host E2E passed: 35 Playwright tests.
- Matterless E2E passed: 1 Playwright test.
- Client portal E2E passed: 2 Playwright tests.
- First-run E2E passed: 1 Playwright test.

## Skipped Checks

None.
