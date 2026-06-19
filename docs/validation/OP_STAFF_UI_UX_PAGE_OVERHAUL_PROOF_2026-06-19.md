# Open Practice Staff UI/UX Page Overhaul Proof - 2026-06-19

## Summary

Branch:
`refactor/staff-ui-ux-page-overhaul-20260619`

Worktree:
`/Users/bryan/projects/open-practice-staff-ui-ux-overhaul`

This branch splits the staff dashboard into canonical staff pages, keeps legacy
`/?section=...` links working, adds the Communications staff route, and applies a light legal-ops
visual refresh. The work preserves backend HTTP APIs, database schema, worker/provider behavior,
permission contracts, public token routes, client portal routes, settlement behavior, trust posting
behavior, and synthetic-only proof data boundaries.

Public runner routes remain separate from staff operations pages:

- Staff share-links page: `/operations/share-links`
- Staff external-upload page: `/operations/external-uploads`
- Public routes remain `/share-links`, `/external-uploads`, `/intake-forms`, and
  `/guest-sessions`.

## Canonical Staff Pages

Workspace:
`/workspace/matters`, `/workspace/contacts`, `/workspace/communications`,
`/workspace/documents`, `/workspace/research`, `/workspace/drafting`, `/workspace/calendar`

Finance:
`/finance/trust-funds`, `/finance/billing`

Operations:
`/operations/tasks`, `/operations/share-links`, `/operations/external-uploads`,
`/operations/signatures`, `/operations/intake`, `/operations/queues`

Review:
`/review/audit`, `/review/reports`, `/review/admin-readiness`

## Implementation Notes

- Added route-catalog canonical paths and pathname matching while preserving legacy
  `section` query aliases.
- Added a pathless staff route group with one server page per canonical staff route.
- Moved the root server dashboard renderer into `open-practice-home.tsx` and kept `app/page.tsx`
  as the root entrypoint.
- Added shared staff-page definitions and metadata helpers.
- Updated dashboard shell navigation to render enabled sections as page links in path mode while
  keeping disabled-route buttons and permission messaging intact.
- Preserved `?matter=` through the global matter selector.
- Added a page-scoped Communications section instead of folding it into the root dashboard only.
- Refreshed dashboard styles toward a light content workspace, restrained navigation rail,
  compact forms, stable toolbars/action strips, clear status cues, and 8px-or-less radii.
- Updated the E2E runner so Docker E2E honors the existing compose host-port environment
  variables for Postgres, Redis, and MinIO. This allowed selector-required Docker validation to run
  beside the existing local dev stack without stopping unrelated containers.
- Updated screenshot helpers so `UI_UX_SCREENSHOT_DIR` can persist local-only PNG evidence in an
  ignored `.tmp` directory while still attaching screenshots to Playwright reports.

## Subagent Execution

- Worker A: route catalog, staff route group, root legacy behavior, shell navigation, route tests.
- Worker B: workspace pages for Matters, Contacts, Communications, Documents, Research, Drafting,
  and Calendar.
- Worker C: Finance, Operations, and Review pages including Billing, Trust Funds, Intake, Queues,
  Reports, Admin, Audit, Tasks, Shares, Uploads, and Signatures.
- Worker D: light visual refresh, responsive/a11y sweep, UI/UX E2E coverage, and screenshot
  evidence.

## Final Changed Paths

```text
apps/web/app/(staff)/finance/billing/page.tsx
apps/web/app/(staff)/finance/trust-funds/page.tsx
apps/web/app/(staff)/operations/external-uploads/page.tsx
apps/web/app/(staff)/operations/intake/page.tsx
apps/web/app/(staff)/operations/queues/page.tsx
apps/web/app/(staff)/operations/share-links/page.tsx
apps/web/app/(staff)/operations/signatures/page.tsx
apps/web/app/(staff)/operations/tasks/page.tsx
apps/web/app/(staff)/review/admin-readiness/page.tsx
apps/web/app/(staff)/review/audit/page.tsx
apps/web/app/(staff)/review/reports/page.tsx
apps/web/app/(staff)/workspace/calendar/page.tsx
apps/web/app/(staff)/workspace/communications/page.tsx
apps/web/app/(staff)/workspace/contacts/page.tsx
apps/web/app/(staff)/workspace/documents/page.tsx
apps/web/app/(staff)/workspace/drafting/page.tsx
apps/web/app/(staff)/workspace/matters/page.tsx
apps/web/app/(staff)/workspace/research/page.tsx
apps/web/app/_features/dashboard/dashboard-shell-model.ts
apps/web/app/_features/dashboard/dashboard-shell-state.test.ts
apps/web/app/_features/dashboard/dashboard-shell-state.ts
apps/web/app/_features/staff-pages/finance-pages.ts
apps/web/app/_features/staff-pages/operations-pages.ts
apps/web/app/_features/staff-pages/review-pages.ts
apps/web/app/_features/staff-pages/shared.tsx
apps/web/app/_features/staff-pages/workspace-pages.test.tsx
apps/web/app/_features/staff-pages/workspace-pages.tsx
apps/web/app/dashboard-client.test.ts
apps/web/app/dashboard-client.tsx
apps/web/app/dashboard-utils.ts
apps/web/app/dashboard/communications-section.tsx
apps/web/app/dashboard/dashboard-shell.test.tsx
apps/web/app/dashboard/dashboard-shell.tsx
apps/web/app/open-practice-home.tsx
apps/web/app/page.tsx
apps/web/app/staff-dashboard-page.tsx
apps/web/app/styles/10-shell-navigation.css
apps/web/app/styles/20-dashboard-panels.css
apps/web/app/styles/30-feature-surfaces.css
apps/web/app/styles/40-public-forms-intake-share.css
apps/web/app/styles/50-setup-auth.css
apps/web/app/styles/95-setup-wizard-extensions.css
apps/web/routes/routeCatalog.test.ts
apps/web/routes/routeCatalog.ts
docs/planning-and-progress.md
docs/validation/OP_STAFF_UI_UX_PAGE_OVERHAUL_PROOF_2026-06-19.md
docs/validation/README.md
e2e/helpers/ui-ux-assertions.ts
e2e/ui-ux.spec.ts
scripts/run-e2e.mjs
```

## Selector Output

Final selector after proof/index/workboard reconciliation:

```sh
pnpm verify:select -- --files <exact final changed paths...>
```

Selected:

```text
pnpm e2e:host
pnpm e2e:docker
node scripts/run-e2e.mjs first-run
pnpm e2e:matterless
pnpm e2e:client-portal
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm test
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

## Validation Results

| Command                                                                                                                                                                                                                                                                                                     | Result                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm --filter @open-practice/web exec vitest run routes/routeCatalog.test.ts app/_features/dashboard/dashboard-shell-state.test.ts app/dashboard/dashboard-shell.test.tsx app/_features/staff-pages/workspace-pages.test.tsx`                                                                              | Passed; 4 files, 30 tests.                                                                  |
| `pnpm --filter @open-practice/web test`                                                                                                                                                                                                                                                                     | Passed; 38 files, 207 tests.                                                                |
| `pnpm --filter @open-practice/web typecheck`                                                                                                                                                                                                                                                                | Passed.                                                                                     |
| `pnpm format:check`                                                                                                                                                                                                                                                                                         | Passed after proof/index/workboard update.                                                  |
| `pnpm docs:check`                                                                                                                                                                                                                                                                                           | Passed after proof/index/workboard update.                                                  |
| `pnpm policy:check`                                                                                                                                                                                                                                                                                         | Passed after proof/index/workboard update.                                                  |
| `pnpm build`                                                                                                                                                                                                                                                                                                | Passed; Next route table included canonical staff pages and unchanged public runner routes. |
| `pnpm test`                                                                                                                                                                                                                                                                                                 | Passed; package/script suite completed successfully.                                        |
| `pnpm e2e:host`                                                                                                                                                                                                                                                                                             | Passed; 36 browser checks.                                                                  |
| `pnpm e2e:matterless`                                                                                                                                                                                                                                                                                       | Passed; 1 browser check.                                                                    |
| `pnpm e2e:client-portal`                                                                                                                                                                                                                                                                                    | Passed; 2 browser checks.                                                                   |
| `node scripts/run-e2e.mjs first-run`                                                                                                                                                                                                                                                                        | Passed; 1 browser check.                                                                    |
| `OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT=35433 OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT=36380 OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT=39002 OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT=39003 OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT=31026 OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT=38026 pnpm e2e:docker` | Passed; 3 Docker-backed browser checks, disposable E2E stack cleaned up.                    |
| `UI_UX_SCREENSHOT_DIR=.tmp/validation/staff-ui-ux-page-overhaul/screenshots pnpm e2e:host -- --grep "captures selected staff page screenshots\|keeps dashboard rail"`                                                                                                                                       | Passed; 5 focused browser checks and stable screenshot PNGs.                                |
| `UI_UX_SCREENSHOT_DIR=.tmp/validation/staff-ui-ux-page-overhaul/screenshots pnpm e2e:matterless -- --grep "renders matterless deep links"`                                                                                                                                                                  | Passed; 1 focused browser check and zero-matter screenshot PNGs.                            |

## Screenshot Evidence

Stable local screenshot evidence is stored under:

```text
.tmp/validation/staff-ui-ux-page-overhaul/screenshots/
```

This directory is local-only and ignored. It contains 28 PNG files, including:

- Default Matters desktop/mobile:
  `ui-staff-matters-desktop-host-chromium.png`,
  `ui-staff-matters-mobile-host-chromium.png`
- Contacts desktop/mobile:
  `ui-staff-contacts-desktop-host-chromium.png`,
  `ui-staff-contacts-mobile-host-chromium.png`
- Communications desktop/mobile:
  `ui-staff-communications-desktop-host-chromium.png`,
  `ui-staff-communications-mobile-host-chromium.png`
- Billing desktop/mobile:
  `ui-staff-billing-desktop-host-chromium.png`,
  `ui-staff-billing-mobile-host-chromium.png`
- Trust Funds desktop/mobile:
  `ui-staff-funds-desktop-host-chromium.png`,
  `ui-staff-funds-mobile-host-chromium.png`
- Calendar desktop/mobile:
  `ui-staff-calendar-desktop-host-chromium.png`,
  `ui-staff-calendar-mobile-host-chromium.png`
- Intake desktop/mobile:
  `ui-staff-intake-desktop-host-chromium.png`,
  `ui-staff-intake-mobile-host-chromium.png`
- Queues desktop/mobile:
  `ui-staff-queues-desktop-host-chromium.png`,
  `ui-staff-queues-mobile-host-chromium.png`
- Zero-matter Contacts/Calendar:
  `ui-dashboard-matterless-contacts-matterless-chromium.png`,
  `ui-dashboard-matterless-calendar-matterless-chromium.png`
- Review rail expanded/collapsed:
  `ui-dashboard-review-rail-expanded-host-chromium.png`,
  `ui-dashboard-review-rail-collapsed-host-chromium.png`,
  `ui-dashboard-review-rail-expanded-host-mobile-chromium.png`,
  `ui-dashboard-review-rail-collapsed-host-mobile-chromium.png`

## Skipped Checks

None. Docker E2E was selector-required and passed after using alternate host ports so the existing
local `open-practice-dev-*` stack could remain untouched.
