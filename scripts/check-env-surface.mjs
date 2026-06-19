#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_SURFACE_FILES = [
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "apps/api/src/server.ts",
  "apps/worker/src/worker.ts",
  "apps/web/next.config.mjs",
  "apps/web/app/api-base-urls.ts",
  "apps/web/app/_shared/server-api.ts",
  "apps/web/app/page.tsx",
  "packages/database/drizzle.config.ts",
  "scripts/run-e2e.mjs",
  "scripts/docker-app-smoke.mjs",
  "scripts/check-migration-integrity.mjs",
  "scripts/clone-oss-references.mjs",
  "scripts/reference-governance.mjs",
  "scripts/create-release-proof.mjs",
];

export const ENV_ALLOWLIST = {
  DOCASSEMBLE_API_KEY: "deprecated provider env intentionally omitted from local defaults",
  DOCASSEMBLE_BASE_URL: "deprecated provider env intentionally omitted from local defaults",
  DOCASSEMBLE_RETURN_URL: "deprecated provider env intentionally omitted from local defaults",
  DOCUSEAL_API_KEY: "deprecated provider env intentionally omitted from local defaults",
  DOCUSEAL_BASE_URL: "deprecated provider env intentionally omitted from local defaults",
  DOCUSEAL_WEBHOOK_REPLAY_WINDOW_SECONDS:
    "deprecated provider env intentionally omitted from local defaults",
  DOCUSEAL_WEBHOOK_SECRET_HEADER:
    "deprecated provider env intentionally omitted from local defaults",
  DOCUSEAL_WEBHOOK_SECRET_VALUE:
    "deprecated provider env intentionally omitted from local defaults",
  APP_NAME: "Docker build argument set by Compose per app image",
  E2E_A11Y_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_A11Y_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_CLIENT_PORTAL_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_CLIENT_PORTAL_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_DOCKER_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_DOCKER_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_FIRST_RUN_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_FIRST_RUN_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_HOST_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_HOST_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_MATTERLESS_API_PORT: "Playwright harness override, not an application runtime default",
  E2E_MATTERLESS_WEB_PORT: "Playwright harness override, not an application runtime default",
  E2E_MODE: "test harness marker set by scripts/run-e2e.mjs",
  E2E_API_BASE_URL: "test harness marker set by scripts/run-e2e.mjs",
  E2E_WEB_BASE_URL: "test harness marker set by scripts/run-e2e.mjs",
  HOSTNAME: "Docker image runtime default, not a developer-provided application setting",
  MIGRATION_REPLAY_DATABASE_URL: "migration replay override documented in testing guidance",
  MINIO_ROOT_PASSWORD: "Compose-internal local service credential, not an app runtime setting",
  MINIO_ROOT_USER: "Compose-internal local service credential, not an app runtime setting",
  NEXT_TELEMETRY_DISABLED: "Docker image runtime default, not a developer-provided setting",
  npm_config_user_agent: "CycloneDX compatibility override local to release proof generation",
  npm_execpath: "CycloneDX compatibility override local to release proof generation",
  OIDC_CLIENT_ID: "deprecated provider env intentionally omitted from local defaults",
  OIDC_CLIENT_SECRET: "deprecated provider env intentionally omitted from local defaults",
  OIDC_ISSUER_URL: "deprecated provider env intentionally omitted from local defaults",
  OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP: "Compose-only bootstrap switch documented in hardening",
  OPEN_PRACTICE_DOCKER_API_HOST_PORT: "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_LOCAL_DEV: "Compose image-profile marker documented in hardening",
  OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT:
    "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT:
    "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT:
    "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT: "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT:
    "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT: "Compose host-port override documented in getting started",
  OPEN_PRACTICE_DOCKER_WEB_HOST_PORT: "Compose host-port override documented in getting started",
  OPEN_PRACTICE_IMAGE_PROFILE: "Compose image-profile marker documented in hardening",
  OPEN_PRACTICE_RELAXED_CSP: "Compose-local CSP escape hatch documented in hardening",
  PATH: "Docker image runtime path, not a developer-provided application setting",
  PLAYWRIGHT_HTML_OPEN: "Playwright reporter control local to scripts/run-e2e.mjs",
  PNPM_HOME: "Docker image build path, pinned by Dockerfile rather than .env.example",
  PNPM_VERSION: "Docker build argument verified by toolchain:check",
  POSTGRES_DB: "Compose-internal local service setting, not an app runtime setting",
  POSTGRES_PASSWORD: "Compose-internal local service credential, not an app runtime setting",
  POSTGRES_USER: "Compose-internal local service setting, not an app runtime setting",
  PORT: "Docker web runtime port, configured by image defaults and Compose bindings",
  REFERENCE_REPOS_INDEX: "reference-governance override documented with reference tooling",
  REFERENCE_REPOS_ROOT: "reference-governance override documented with reference tooling",
  REPLAY_DATABASE_RE: "JavaScript regex constant that resembles a shell substitution in text scan",
  STRIPE_SECRET_KEY: "production-rejected payment processor env documented in hardening",
  TURBO_TELEMETRY_DISABLED: "Docker image runtime default, not a developer-provided setting",
  TURBO_VERSION: "Docker build argument pinned beside the root Turbo dependency",
  WEBAUTHN_RP_ID: "advanced WebAuthn relying-party override; local default is localhost",
  WEBAUTHN_RP_NAME: "advanced WebAuthn relying-party override; local default is Open Practice",
};

function lines(text) {
  return text.split(/\r?\n/);
}

export function envExampleNames(text) {
  return new Set(
    lines(text)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].trim())
      .filter(Boolean),
  );
}

export function envNamesFromText(text) {
  const names = new Set();
  const patterns = [
    /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
    /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
    /\benv\.([A-Z][A-Z0-9_]*)\b/g,
    /^\s*([A-Z][A-Z0-9_]*):/gm,
    /\$\{([A-Z][A-Z0-9_]*)(?::[-?][^}]*)?\}/g,
    /^\s*-\s*([A-Z][A-Z0-9_]*)=/gm,
    /^\s*ARG\s+([A-Z][A-Z0-9_]*)=/gm,
    /^\s*ENV\s+([A-Z][A-Z0-9_]*)=/gm,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }

  return names;
}

export function collectEnvSurface({ files, exampleText, allowlist = ENV_ALLOWLIST }) {
  const documented = envExampleNames(exampleText);
  const used = new Map();

  for (const [file, text] of Object.entries(files)) {
    for (const name of envNamesFromText(text)) {
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(file);
    }
  }

  const allowlisted = new Set(Object.keys(allowlist));
  const missing = [...used.keys()]
    .filter((name) => !documented.has(name) && !allowlisted.has(name))
    .sort();
  const staleAllowlist = [...allowlisted].filter((name) => !used.has(name)).sort();

  return {
    documented: [...documented].sort(),
    used: [...used.entries()].map(([name, paths]) => ({ name, paths: [...paths].sort() })),
    missing,
    staleAllowlist,
  };
}

export function checkEnvSurface({ cwd = process.cwd(), read = readFileSync } = {}) {
  const exampleText = read(join(cwd, ".env.example"), "utf8");
  const files = Object.fromEntries(
    ENV_SURFACE_FILES.filter((file) => file !== ".env.example").map((file) => [
      file,
      read(join(cwd, file), "utf8"),
    ]),
  );
  return collectEnvSurface({ files, exampleText });
}

function runCli() {
  const result = checkEnvSurface();
  const failures = [];
  if (result.missing.length > 0) {
    failures.push(
      `Runtime env vars need .env.example entries or ENV_ALLOWLIST reasons: ${result.missing.join(
        ", ",
      )}`,
    );
  }

  if (failures.length > 0) {
    console.error("Environment surface validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Environment surface passed: ${result.documented.length} .env.example entries, ${result.used.length} used names, ${Object.keys(ENV_ALLOWLIST).length} documented allowlist entries.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
