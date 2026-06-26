# Self-Hosting

This page covers the focused single-host Docker profile for operators who run Open Practice behind
their own TLS reverse proxy. It is not a release publication profile and it does not relax the
production safety gates in [Deployment Hardening](../deployment-hardening.md).

## Boundaries

- Use `docker-compose.selfhost.yml` for self-host render checks and single-host operation.
- Keep `docker-compose.yml` as the loopback-only local development stack.
- Publish only the web service through an operator-managed TLS reverse proxy for normal use.
- Keep the API private to Docker and the host loopback setup port. Browser requests use same-origin
  `/api` paths and the Next.js server rewrites them to the internal API service.
- Do not enable Mailpit, development seed data, memory persistence, Docker bridge setup, relaxed
  CSP, live Stripe, bank feeds, automatic trust posting, or production email delivery through this
  profile.
- Use synthetic values only in examples and validation proof. Store real secrets in an ignored env
  file or deployment secret manager.

## Environment

The checked-in `docker/selfhost.example.env` file is for render checks only. Create an ignored file
such as `.env.selfhost.local`, copy the variable names, and replace every secret before startup.

Required operator values:

- `OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN`: external HTTPS web origin served by the reverse proxy.
- `OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID`: hostname from the public web origin.
- `OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET`: unique session secret, at least 32 characters.
- `OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY`: unique 32-byte base64, base64url, or hex key.
- `OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD`: PostgreSQL password.
- `OPEN_PRACTICE_SELFHOST_S3_ENDPOINT`: `http://minio:9000` for the bundled private MinIO service,
  or an HTTPS object-storage endpoint for external S3-compatible storage.
- `OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY`: object-storage secret.

The self-host profile sets `S3_SERVER_SIDE_ENCRYPTION=AES256` for API and worker containers. If the
operator uses MinIO, the matching MinIO encryption/KMS posture still needs to be configured and
tested before claiming encrypted object storage at rest.

## Preflight

Run the self-host check before starting or changing the profile:

```bash
pnpm selfhost:check -- --env-file .env.selfhost.local
```

For the checked-in synthetic example only:

```bash
pnpm selfhost:check -- --env-file docker/selfhost.example.env --allow-synthetic-example
```

The check validates required env values, rejects placeholder production secrets unless the synthetic
example flag is present, renders `docker-compose.selfhost.yml`, and verifies that the rendered
profile stays production-mode, same-origin, Mailpit-free, loopback-published only, and free of
development seed/setup flags.

## Startup

Render the profile first:

```bash
docker compose --env-file .env.selfhost.local -f docker-compose.selfhost.yml config
```

Then build and start it:

```bash
docker compose --env-file .env.selfhost.local -f docker-compose.selfhost.yml up -d --build
```

The web service publishes on `127.0.0.1:${OPEN_PRACTICE_SELFHOST_WEB_HOST_PORT:-33080}` for the
operator reverse proxy. The API setup port publishes on
`127.0.0.1:${OPEN_PRACTICE_SELFHOST_API_SETUP_HOST_PORT:-34080}` only for operator-local bootstrap
and health checks. PostgreSQL, Redis, and Worker publish no host ports.

## First-Run Setup

Production first-run setup intentionally remains operator-local at the API. Public or proxied setup
requests must stay blocked until an owner-admin exists.

Bootstrap sequence:

1. Start the self-host profile while the reverse proxy still points only to the web service or is not
   public yet.
2. Complete first-run setup from the host through the loopback API setup port, using only synthetic
   or operator-entered values. The setup API accepts a backup-password owner bootstrap without a
   passkey; passkeys can be added after sign-in from the final HTTPS origin.
3. Verify `/api/setup/status` no longer reports setup required.
4. Expose the web origin through the TLS reverse proxy.
5. Sign in at `OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN` and configure optional providers from the
   owner-admin UI.

Do not enable `OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP` or development auth helpers in this profile.

## Operations

- Back up PostgreSQL and object storage together, and test restores before relying on the profile.
- Run
  `pnpm selfhost:restore-drill -- --env-file docker/selfhost.example.env --allow-synthetic-example`
  for the checked-in synthetic MinIO profile, then repeat with
  `pnpm selfhost:restore-drill -- --env-file .env.selfhost.local` for an ignored operator env before
  relying on a deployment. The bundled-MinIO path uses a disposable Compose project, synthetic
  PostgreSQL and MinIO markers, `pg_dump`, a MinIO object-storage archive, fresh-volume restore,
  checksum verification, API `/health`, and web `/api/setup/status`. An external HTTPS
  S3-compatible endpoint uses the same PostgreSQL drill plus a synthetic S3 marker write, backup,
  deliberate overwrite, restore, and checksum verification without requiring list or delete
  permissions. Both modes write redacted local evidence under
  `.tmp/open-practice-selfhost-restore-drill/<timestamp>/`.
- Treat bundled MinIO as a private-pilot readiness blocker when `pnpm docker:residual-watch`
  reports archived upstream posture or Critical/High CVEs. Successful external HTTPS S3
  restore-drill evidence is manual release-handoff evidence for an external object-storage path; it
  does not make `pnpm release:local -- --private-pilot` green while bundled MinIO residual-watch
  blockers remain. Use separate MinIO hardening proof when bundled MinIO remains the release path.
- Treat Redis as execution state, not a legal record. PostgreSQL remains the durable source of truth
  for job lifecycle and legal/audit records.
- Run `pnpm docker:residual-watch`, `pnpm docker:app-smoke`, and `pnpm e2e:docker` for image,
  Compose, or release-browser proof when Docker is available.
- Run dependency, secret, policy, and license checks before deployment handoff.
- Keep production email delivery, OCR/transcription/AI providers, live payments, bank feeds, and
  trust/funds automation disabled until their separate runbooks and validation evidence exist.
