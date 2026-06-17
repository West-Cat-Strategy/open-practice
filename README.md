# Open Practice

Open Practice is a pre-release, self-hosted TypeScript monorepo for legal-practice operations. It
centers matter-scoped access, confidentiality, auditability, local-first services, and clean-room
reuse discipline as ordinary engineering constraints.

The repository currently ships a Next.js web application, a Fastify API, a BullMQ worker surface,
provider-neutral domain packages, Drizzle-backed persistence, embedded signature and document
automation adapters, and a Docker Compose local stack with PostgreSQL, MinIO, Redis, and Mailpit.

## What Is Here

- Matter, contact CRM, document, drafting, task, calendar, intake, signature, share-link, external
  upload, and hosted guest-session workspace surfaces.
- Billing, manual-payment, trust/funds, reconciliation, reporting, audit, admin-readiness, and queue
  review surfaces with explicit operational review boundaries.
- Embedded first-run setup, auth/session support, local object storage, local email capture, and
  optional worker/provider posture for OCR, AI assistance, transcription, and inbound/outbound mail.
- Local validation, policy, migration, documentation, license, and security checks that are intended
  to be run before handoff.

Billing and trust/funds workflows are operational records and review aids. They are not live payment
settlement, tax advice, jurisdiction-certified trust accounting, or automatic trust-ledger posting
unless a future implementation explicitly documents that posture.

## Quick Start

```bash
pnpm install
docker compose up -d
```

Open the app at `http://localhost:33000`.

For local runtime modes, service ports, first-run setup, and focused development commands, use
[Getting Started](docs/development/getting-started.md).

## Repository Map

- [Internal documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [API and state machines](docs/api-and-state-machines.md)
- [Testing guide](docs/testing/TESTING.md)
- [License policy](docs/license-policy.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

The root README is the GitHub-facing overview. The canonical internal documentation map remains
[docs/README.md](docs/README.md).

## License And Reuse

Open Practice is Apache-2.0. Do not copy implementation code, schemas, migrations, tests, UI markup,
styles, assets, provider payload shapes, sample legal content, or distinctive prose from
reference-only projects into the core. Follow [License Policy](docs/license-policy.md) and
[Reuse Decision Policy](docs/reuse-decision-policy.md) before adding dependencies, vendored assets,
or source excerpts.

Use synthetic data only in code, docs, tests, fixtures, screenshots, issues, and pull requests. Do
not publish client, matter, credential, payment, privileged document, trust/funds, audit-log, or
private deployment details.
