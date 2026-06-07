# Repository Guide

Open Practice is a TypeScript monorepo for Canadian legal-practice operations. Treat matter authorization, confidentiality, auditability, trust/funds caution, and clean-room reuse as ordinary engineering constraints, not separate review chores.

## Workspace Ownership

| Area            | Owns                                                                                                                        | Main paths                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| API             | Fastify runtime, auth, route contracts, API authorization, provider/bootstrap wiring                                        | `apps/api/src/server.ts`, `apps/api/src/http/`, `apps/api/src/routes/` |
| Web             | API-backed operational dashboard and navigation metadata                                                                    | `apps/web/app/`, `apps/web/routes/routeCatalog.ts`                     |
| Worker          | Queue dispatch, worker lifecycle updates, queue-family processors, redacted job metadata                                    | `apps/worker/src/`, `apps/worker/src/processors/`                      |
| Domain          | Provider-neutral models, permissions, legal rules, audit hashes, trust/funds, signatures, intake contracts, billing helpers | `packages/domain/src/`                                                 |
| Database        | Drizzle schema, migrations, repository interfaces and implementations, seed support                                         | `packages/database/src/`, `packages/database/migrations/`              |
| Providers       | Embedded signature and document-automation adapters                                                                         | `packages/providers/src/`                                              |
| Docs and policy | Architecture, API/state machines, testing, planning, deployment, reuse, license policy                                      | `docs/`, `scripts/validate-*.mjs`                                      |

Start with the owning workspace before choosing commands. If a change touches `packages/domain` or `packages/database`, assume at least one API check is needed because API routes expose most domain and repository behavior.

## Core Boundaries

- `packages/domain` stays pure TypeScript. It should not import Fastify, Drizzle, S3 clients, environment config, provider SDKs, or runtime adapters.
- `apps/api/src/server.ts` owns bootstrap, authentication hooks, environment setup, central error handling, and route registrar wiring. New route families belong under `apps/api/src/routes/`; route submodules may own feature-specific route declarations when `scripts/validate-open-practice-boundaries.mjs` lists them in the parent registrar's `routeFiles`.
- `apps/worker/src/processors.ts` stays the queue dispatcher and lifecycle wrapper. Queue-family implementations belong under `apps/worker/src/processors/`.
- `packages/database` is the persistence boundary. Schema, migrations, in-memory behavior, PostgreSQL behavior, seed data, and repository tests should move together.
- Database schema groups may live under `packages/database/src/schema/`; `packages/database/src/schema.ts` remains the compatibility aggregator until consumers are migrated to narrower schema modules. Preserve migrations unless the data model itself changes.
- Repository capability contracts should live in focused modules under `packages/database/src/repository/`; `OpenPracticeRepository` remains the temporary aggregate compatibility surface while consumers migrate to narrower capabilities.
- `apps/web` consumes API-shaped data. UI capability checks improve ergonomics but do not replace server-side authorization.
- `apps/web/app/_features` owns feature-specific dashboard resources and UI helpers; `apps/web/app/_shared` owns server-safe resources that are reused across dashboard features.
- `packages/providers` holds embedded provider implementations. Provider-specific HTTP or SDK logic should not leak into domain rules.

## Package Graph

The workspace import graph is intentionally one-way:

| Owner                | May import workspace packages                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| `packages/domain`    | none                                                                           |
| `packages/database`  | `@open-practice/domain`                                                        |
| `packages/providers` | `@open-practice/domain`                                                        |
| `apps/api`           | `@open-practice/domain`, `@open-practice/database`, `@open-practice/providers` |
| `apps/worker`        | `@open-practice/domain`, `@open-practice/database`, `@open-practice/providers` |
| `apps/web`           | browser-safe `@open-practice/domain` exports only                              |

App workspaces must import packages through package exports, not `packages/*/src` source paths. New browser-facing domain imports should prefer web-safe subpaths as they are added; the boundary policy ratchets existing root `@open-practice/domain` usage instead of allowing broad new imports.

`@open-practice/domain`, `@open-practice/database`, and `@open-practice/providers` must keep `main`, `types`, and `exports["."]` aligned with their built root entrypoints. Keep root exports as compatibility shims while consumers migrate to narrower subpaths.

Validation should build upstream packages before downstream checks when shared-package code or manifests change. In practice, run the selector first, then preserve this order for focused commands: domain build, database build, providers build, then API/worker/web tests and typechecks.

## Common Edit Paths

- API endpoint change: update or add a route registrar, shared HTTP validation/auth helpers if needed, API tests, `docs/api-and-state-machines.md`, and validation guidance when the command surface changes.
- Domain invariant change: update `packages/domain/src/*`, domain tests, any API tests that expose the rule, and state-machine docs if external behavior changes.
- Database concept change: update Drizzle schema, migrations, sample data, repository interface, in-memory repository, PostgreSQL repository, database tests, API tests, and deployment notes if rollout changes.
- Dashboard change: update dashboard components, route catalog metadata, web tests, and API payload types or fallbacks when data shape changes.
- Documentation or policy change: update the docs index when adding pages, keep local links relative, and run the docs and policy checks.

## Product Invariants

- Every matter, document, portal message, signature request, trust entry, billing record, and audit event needs server-side authorization.
- Audit events are append-only and hash chained.
- Trust/funds ledger postings must be balanced, idempotent, no-overdraft, and reversible by explicit mirrored transactions.
- Billing, manual payments, and trust-transfer requests are operational records. They are not live settlement, tax advice, or jurisdiction-certified trust accounting.
- Embedded auth, signatures, and intake are the current runtime. Legacy DocuSeal, docassemble, and OIDC configuration is deprecated for production.
- Reference projects may inform ideas only within the boundaries in [Reuse Decision Policy](../reuse-decision-policy.md) and [License Policy](../license-policy.md).

## Local Orientation

Use [Getting Started](getting-started.md) for runtime setup, [Testing](../testing/TESTING.md) for command selection, [Maintenance](maintenance.md) for release and policy upkeep, and [Agent Workflows](agent-workflows.md) for Codex-specific workflow.
