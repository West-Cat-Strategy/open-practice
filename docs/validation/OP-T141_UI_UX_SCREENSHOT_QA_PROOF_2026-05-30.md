# OP-T141 UI/UX Screenshot QA Proof

Date: 2026-05-30 PDT

## Scope

Adds UI/UX screenshot QA and layout-health coverage over the existing Open Practice browser harness:

- Added `e2e/ui-ux.spec.ts` to sweep every committed staff dashboard route-catalog section:
  Matters, Contacts, Funds, Billing, Documents, Shares, Uploads, Drafting, Calendar, Signatures,
  Intake, Audit, Reports, Queues, and Admin Readiness.
- Added reusable UI/UX assertions for app-wide horizontal overflow, clipped readable labels, framework
  overlays, console/page errors, visible route headings, reachable route controls, active nav state,
  review-rail stability, and Playwright screenshot attachments.
- Extended Docker-backed browser proof for provider-backed Uploads and a MinIO-backed external upload
  receipt, while keeping public share, intake, and guest-session token flows in the host suite.
- Tightened the rendered UI where the review found issues: command jump buttons now auto-fit, public
  token action copy and row actions wrap, zero-matter mobile navigation uses a compact sidebar state,
  secondary buttons align consistently, and audit activity dates use stable compact formatting to avoid
  WebKit hydration mismatches.
- Raised only the E2E-mode global API rate-limit ceiling so full browser route sweeps do not trip
  synthetic `/api/jobs` request bursts; production readiness continues to reject `E2E_MODE`.
- No production API, database schema, dependency, or provider contract changes were made.

## Local Proof

Selector guidance:

```sh
pnpm verify:select -- --files apps/api/src/server.test.ts apps/api/src/server.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/40-public-forms-intake-share.css apps/web/app/styles/50-setup-auth.css apps/web/app/styles/90-responsive-motion.css docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T141_UI_UX_SCREENSHOT_QA_PROOF_2026-05-30.md e2e/helpers/e2e-fixtures.ts e2e/helpers/ui-ux-assertions.ts e2e/ui-ux.spec.ts
```

Recommended commands:

```sh
pnpm e2e:host
pnpm e2e:docker
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm build
pnpm format:check
pnpm docs:check
pnpm policy:check
```

Passed before the docs closeout:

```sh
pnpm exec prettier --check apps/api/src/server.test.ts apps/api/src/server.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/40-public-forms-intake-share.css apps/web/app/styles/50-setup-auth.css apps/web/app/styles/90-responsive-motion.css e2e/helpers/e2e-fixtures.ts e2e/helpers/ui-ux-assertions.ts e2e/ui-ux.spec.ts
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm build
pnpm e2e:host -- e2e/ui-ux.spec.ts
pnpm e2e:docker -- e2e/ui-ux.spec.ts
pnpm e2e:host
pnpm e2e:docker
```

Results:

- Web tests passed: 14 files, 122 tests.
- Web typecheck passed.
- API tests passed: 39 files, 408 tests.
- API typecheck passed.
- Production build passed: 6 packages.
- Focused host UI/UX spec passed: 13 passed, 3 skipped for non-host-chromium breakpoint coverage.
- Focused Docker UI/UX spec passed: 2 passed.
- Full host E2E passed: 33 passed, 3 skipped.
- Full Docker E2E passed: 5 passed.

Final docs-aware validation is recorded in the closeout results below.

After OP-T142 landed on `main`, the UI/UX sweep also includes an `admin` route sentinel for the
Admin Readiness section and checks `Access and support controls` plus `Portability and migration`
copy.

## Docker Stack Proof

Ran the requested explicit dev compose workflow:

```sh
docker compose build
docker compose up -d postgres redis minio mailpit
DATABASE_URL=postgresql://open_practice:open_practice@localhost:35432/open_practice pnpm --filter @open-practice/database db:migrate
docker compose up -d api worker web
docker compose ps
curl -fsS http://localhost:34000/health
curl -fsSI http://localhost:33000
docker compose down
```

Results:

- `docker compose build` completed for Postgres, Mailpit, API, Worker, and Web images.
- `docker compose ps` showed Postgres, Redis, API, and Mailpit healthy; MinIO, Worker, and Web were
  running on the expected dev ports.
- API health returned `{"ok":true,"service":"open-practice-api","persistence":"postgres"}`.
- The web root returned `HTTP/1.1 200 OK`.
- The stack was stopped with `docker compose down`; volumes were intentionally preserved.

## Screenshot Review

Playwright attached UI screenshots for the host desktop, host mobile, and Docker projects from the
new UI/UX spec. The final Docker report included named attachments for every dashboard section plus
deep-review screenshots for Documents, Uploads, Calendar, Intake, and the external-upload receipt.

Reviewed screenshots showed:

- Seeded dashboard shell, dense operator panels, route-catalog sections, and review rail remained
  readable without app-wide horizontal overflow after the CSS fixes.
- Documents, Uploads, Calendar, and Intake deep-review panels retained visible headings, reachable
  controls, and stable right-rail behavior.
- Public share verification, verified share, intake draft/incomplete submit, guest check-in, and
  Docker-backed external upload receipt pages remained readable and did not leak token text into page
  body assertions.
- Live compose first-run setup and post-setup desktop screenshots rendered cleanly on the planned
  dev stack.

Fixed findings in this slice:

- WebKit hydration mismatch from locale-sensitive audit timestamps.
- Command jump action buttons crowding/clipping on narrow review widths.
- Public-token action and row controls that could resist wrapping with long synthetic text.
- False-positive not-found checks when legitimate synthetic token strings contained `404`.
- Zero-matter mobile navigation now uses a scoped compact sidebar state instead of the standard
  horizontally scrollable grouped route strip.

Residual finding:

- None for the previously observed zero-matter mobile disabled-navigation strip; the follow-up is
  limited to the empty-matter dashboard sidebar/mobile layout seam.

Skipped/fallback notes:

- Dedicated Browser plugin controls were not exposed to this turn after tool discovery. Screenshot
  review used Playwright attachments and local image inspection instead.
- No golden pixel snapshots were committed; screenshot artifacts remain test/report output only.

## Closeout Results

Docs-aware selector:

```sh
pnpm verify:select -- --files apps/api/src/server.test.ts apps/api/src/server.ts apps/web/app/dashboard-client.tsx apps/web/app/dashboard/dashboard-shell.test.tsx apps/web/app/dashboard/dashboard-shell.tsx apps/web/app/styles/20-dashboard-panels.css apps/web/app/styles/40-public-forms-intake-share.css apps/web/app/styles/50-setup-auth.css apps/web/app/styles/90-responsive-motion.css docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T141_UI_UX_SCREENSHOT_QA_PROOF_2026-05-30.md e2e/helpers/e2e-fixtures.ts e2e/helpers/ui-ux-assertions.ts e2e/ui-ux.spec.ts
```

Recommended:

```sh
pnpm e2e:host
pnpm e2e:docker
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
```

Passed:

```sh
pnpm exec prettier --write docs/planning-and-progress.md docs/validation/README.md docs/validation/OP-T141_UI_UX_SCREENSHOT_QA_PROOF_2026-05-30.md
pnpm format:check
pnpm docs:check
pnpm policy:check
pnpm --filter @open-practice/api test
pnpm --filter @open-practice/api typecheck
pnpm --filter @open-practice/web test
pnpm --filter @open-practice/web typecheck
pnpm build
pnpm e2e:host
pnpm e2e:docker
```

Results:

- Formatting passed after proof, workboard, and validation-index edits.
- Documentation link validation passed.
- Policy passed: tracked-secret scan, package manifest policy, migration parity, OSS reuse policy,
  documentation links, and Open Practice boundary policy.
- API tests passed: 39 files, 408 tests, including E2E-mode rate-limit headroom.
- API typecheck passed.
- Web tests passed: 14 files, 122 tests.
- Web typecheck passed.
- Production build passed: 6 packages.
- Host E2E passed: 33 passed, 3 skipped.
- Docker E2E passed: 5 passed, including provider-backed Uploads route health and MinIO-backed
  external upload receipt layout.

## Follow-Up Results

The final slice includes two follow-ups from screenshot QA review:

- The zero-matter mobile sidebar now uses a compact disabled-navigation state, covered by the web
  dashboard shell test and the rerun host/Docker UI/UX sweeps.
- The synthetic route sweep no longer trips the API global rate limit in E2E mode; production
  startup still rejects `E2E_MODE`, and the API regression test covers the raised E2E-only ceiling.

## Notes

- All examples, uploads, tokens, setup data, and screenshots use synthetic data only.
- No client, matter, credential, payment, private deployment, or privileged document details were
  added.
- No migrations, new dependencies, production API routes, provider behavior, native mobile surfaces,
  offline sync, push notifications, biometrics, or payment capture were added.
