# Contact Duplicate Review Assistance Proof

Date: 2026-06-16 PDT

## Scope

This slice adds review-only duplicate assistance to the existing Contacts dossier and review-queue
surfaces. It keeps duplicate cues derived from visible contact data, records reviewer decisions only
through the existing append-only contact data-quality resolution path, and adds no automatic merge,
merge preview, duplicate-case table, migration, dependency, provider integration, or contact rewrite.

Runtime changes:

- Contact dossier duplicate cues now group one visible candidate per signal and include safe
  candidate display metadata, matched field categories, match counts, and shared visible matter
  counts.
- Duplicate matching reuses the conflict-check token normalization posture for names, aliases,
  former names, identifiers, contact methods, websites, and address components.
- Contact dossier detail and review-queue API serialization keep raw matched values redacted while
  exposing only review-safe duplicate metadata.
- The Contacts dashboard shows duplicate candidate context in the review queue and selected dossier
  quality-review rows while keeping the existing `Not duplicate` and `Needs review` reviewer
  actions.

## Boundaries

- No duplicate cue creates, updates, merges, archives, or deletes contacts.
- No duplicate cue changes matter-party associations, relationships, portal grants, conflict-check
  records, conflict dispositions, or audit-chain semantics.
- Duplicate candidate metadata is limited to contacts already visible through the caller's existing
  contact and matter authorization.
- Audit metadata for reviewer decisions continues to record safe IDs/booleans/count posture only;
  raw matched values and reviewer note bodies are not copied into audit metadata.
- Test data remains synthetic.

## Validation

Selector command:

```sh
pnpm verify:select -- --files packages/domain/src/contacts.ts packages/domain/src/contacts.test.ts apps/api/src/routes/contacts.ts apps/api/src/routes/contacts.test.ts apps/web/app/contact-dossiers-dashboard.ts apps/web/app/dashboard/contacts-section.tsx apps/web/app/dashboard-client.test.ts docs/api-and-state-machines.md docs/improvement-opportunities.md docs/validation/README.md docs/validation/OP_CONTACT_DUPLICATE_REVIEW_ASSISTANCE_PROOF_2026-06-16.md
```

Selector result:

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm policy:check`
- `pnpm --filter @open-practice/domain test`
- `pnpm --filter @open-practice/domain typecheck`
- `pnpm --filter @open-practice/api test`
- `pnpm --filter @open-practice/api typecheck`
- `pnpm --filter @open-practice/providers test`
- `pnpm --filter @open-practice/worker test`
- `pnpm --filter @open-practice/web test`
- `pnpm --filter @open-practice/web typecheck`
- `pnpm build`

Focused and selector-selected checks:

| Command                                                                          | Result        |
| -------------------------------------------------------------------------------- | ------------- |
| `pnpm --filter @open-practice/domain test -- contacts.test.ts conflicts.test.ts` | Pass          |
| `pnpm --filter @open-practice/domain build`                                      | Pass          |
| `pnpm --filter @open-practice/domain typecheck`                                  | Pass          |
| `pnpm --dir apps/api exec vitest run src/routes/contacts.test.ts`                | Pass          |
| `pnpm --filter @open-practice/api test`                                          | Pass          |
| `pnpm --filter @open-practice/api typecheck`                                     | Pass          |
| `pnpm --filter @open-practice/providers test`                                    | Pass          |
| `pnpm --filter @open-practice/worker test`                                       | Pass          |
| `pnpm --filter @open-practice/web test -- dashboard-client.test.ts`              | Pass          |
| `pnpm --filter @open-practice/web typecheck`                                     | Pass          |
| `pnpm docs:check`                                                                | Pass          |
| `pnpm policy:check`                                                              | Pass          |
| `pnpm format:check`                                                              | Pass          |
| `pnpm test`                                                                      | Pass          |
| `pnpm build`                                                                     | Pass          |
| `pnpm e2e:host`                                                                  | Pass on retry |
| `git diff --check`                                                               | Pass          |
| `docker compose -p open-practice-e2e down -v --remove-orphans`                   | Pass          |

Additional browser/database posture:

- First `pnpm e2e:host` attempt reached 34 passed and 1 failed in WebKit on a Next dev-server
  chunk-load error for the unavailable deep-link UI/UX case. The retry passed all 35 host
  Playwright checks in 1.4 minutes.
- `docker info --format '{{json .ServerVersion}}'` returned Docker server `29.5.3`, so Docker was
  available.
- `pnpm e2e:docker` was attempted and blocked before tests by the already-running
  `open-practice-dev-mailpit-1` container holding `127.0.0.1:31025`. The runner's Docker mode
  hardcodes the same local infrastructure URLs it asks Compose to expose, so this could not be
  rerouted with port environment overrides without changing validation tooling. The partially
  created `open-practice-e2e` Compose stack was removed with volumes and orphans.

Fixes during validation:

- The initial domain focused test expected the wrong duplicate field category for the synthetic
  identifier match; the expectation was corrected to the safe `identifier` category.
- Strict domain build/typecheck surfaced fixture/helper typing issues, which were fixed before the
  passing reruns.
- `pnpm format:check` initially reported formatting drift in task-owned TypeScript and Markdown
  files; Prettier was run on those files and the final format check passed.
- An early API package test run saw stale domain build output and parallel-load timeouts before the
  domain package was rebuilt; the final isolated API package test passed.
