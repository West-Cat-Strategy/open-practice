#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SYNTHETIC_CONFIG_KEY = "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const DEV_EXAMPLE_JWT_SECRET = "dev-only-change-me-at-least-16-chars";
const REQUIRED_ENV_KEYS = [
  "OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN",
  "OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID",
  "OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD",
  "OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET",
  "OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY",
  "OPEN_PRACTICE_SELFHOST_S3_ENDPOINT",
  "OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY",
];

export function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function isPlaceholder(value) {
  return /(?:change-me|synthetic|example)/i.test(value);
}

function decodeConfigKey(value) {
  const raw = value.startsWith("base64:") ? value.slice("base64:".length) : value;
  const decoders = [
    () => Buffer.from(raw, "base64url"),
    () => Buffer.from(raw, "base64"),
    () => (/^[0-9a-f]+$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.alloc(0)),
  ];
  for (const decode of decoders) {
    const buffer = decode();
    if (buffer.length === 32) return buffer;
  }
  return Buffer.alloc(0);
}

function requireHttpsUrl(name, value, { allowSyntheticExample }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (url.protocol !== "https:" && !allowSyntheticExample) {
    throw new Error(`${name} must use https for self-hosting`);
  }
  return url;
}

function requireS3EndpointUrl(value, { allowSyntheticExample }) {
  const url = requireHttpsUrl("OPEN_PRACTICE_SELFHOST_S3_ENDPOINT", value, {
    allowSyntheticExample: true,
  });
  if (url.protocol === "https:" || allowSyntheticExample) return url;
  if (url.protocol === "http:" && url.hostname === "minio") return url;
  throw new Error(
    "OPEN_PRACTICE_SELFHOST_S3_ENDPOINT must use https unless it is the private http://minio:9000 Compose endpoint",
  );
}

export function validateSelfhostEnv(env, { allowSyntheticExample = false } = {}) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required self-host env value(s): ${missing.join(", ")}`);
  }

  const publicWebOrigin = requireHttpsUrl(
    "OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN",
    env.OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN,
    { allowSyntheticExample },
  );
  if (env.OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID !== publicWebOrigin.hostname) {
    throw new Error(
      "OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID must match OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN hostname",
    );
  }

  requireS3EndpointUrl(env.OPEN_PRACTICE_SELFHOST_S3_ENDPOINT, {
    allowSyntheticExample,
  });

  if (env.OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET.length < 32) {
    throw new Error("OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET must be at least 32 characters");
  }
  if (env.OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET === DEV_EXAMPLE_JWT_SECRET) {
    throw new Error("OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET must not use the development example");
  }

  if (decodeConfigKey(env.OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY).length !== 32) {
    throw new Error("OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  for (const key of [
    "OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD",
    "OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET",
    "OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY",
    "OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY",
  ]) {
    if (!allowSyntheticExample && isPlaceholder(env[key])) {
      throw new Error(`${key} still looks like a placeholder`);
    }
  }
  if (
    !allowSyntheticExample &&
    env.OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY === SYNTHETIC_CONFIG_KEY
  ) {
    throw new Error("OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY must be unique per deployment");
  }
}

function serviceEnv(service) {
  const environment = service?.environment ?? {};
  if (Array.isArray(environment)) {
    return Object.fromEntries(
      environment.map((entry) => {
        const separator = entry.indexOf("=");
        return separator === -1
          ? [entry, ""]
          : [entry.slice(0, separator), entry.slice(separator + 1)];
      }),
    );
  }
  return environment;
}

function assertNoTruthyEnv(env, serviceName, keys) {
  for (const key of keys) {
    if (["1", "true", "yes", "on"].includes(String(env[key] ?? "").toLowerCase())) {
      throw new Error(`${serviceName} must not set ${key}=true`);
    }
  }
}

function assertLoopbackPorts(serviceName, service) {
  for (const port of service?.ports ?? []) {
    const hostIp = port.host_ip ?? port.hostIp ?? "";
    if (hostIp !== "127.0.0.1") {
      throw new Error(`${serviceName} publishes a non-loopback port`);
    }
  }
}

export function inspectRenderedCompose(rendered) {
  const services = rendered.services ?? {};
  const serviceNames = Object.keys(services).sort();
  const expected = [
    "api",
    "db-migrate",
    "minio",
    "minio-bucket-init",
    "postgres",
    "redis",
    "web",
    "worker",
  ];

  for (const service of expected) {
    if (!services[service]) throw new Error(`Rendered self-host Compose is missing ${service}`);
  }
  if (serviceNames.includes("mailpit")) {
    throw new Error("Self-host Compose must not include Mailpit");
  }

  const runtimeServices = ["api", "web", "worker"];
  if (services["worker-ocr"]) runtimeServices.push("worker-ocr");
  for (const service of runtimeServices) {
    const env = serviceEnv(services[service]);
    if (env.NODE_ENV !== "production") {
      throw new Error(`${service} must run with NODE_ENV=production`);
    }
    assertNoTruthyEnv(env, service, [
      "OPEN_PRACTICE_USE_MEMORY_REPO",
      "OPEN_PRACTICE_DEV_SEED",
      "OPEN_PRACTICE_ALLOW_DOCKER_BRIDGE_SETUP",
      "OPEN_PRACTICE_DOCKER_LOCAL_DEV",
      "OPEN_PRACTICE_RELAXED_CSP",
    ]);
  }

  const storageServices = ["api", "worker"];
  if (services["worker-ocr"]) storageServices.push("worker-ocr");
  for (const service of storageServices) {
    const env = serviceEnv(services[service]);
    if (env.S3_SERVER_SIDE_ENCRYPTION !== "AES256") {
      throw new Error(`${service} must set S3_SERVER_SIDE_ENCRYPTION=AES256`);
    }
    if (!env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY) {
      throw new Error(`${service} must set OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY`);
    }
  }

  const webEnv = serviceEnv(services.web);
  if (webEnv.OPEN_PRACTICE_BROWSER_API_MODE !== "same-origin") {
    throw new Error("web must set OPEN_PRACTICE_BROWSER_API_MODE=same-origin");
  }
  if (webEnv.API_BASE_URL !== "http://api:4000") {
    throw new Error("web must rewrite same-origin API calls to http://api:4000");
  }

  assertLoopbackPorts("api", services.api);
  assertLoopbackPorts("web", services.web);
  assertLoopbackPorts("minio", services.minio);
  const privateServices = ["postgres", "redis", "worker"];
  if (services["worker-ocr"]) privateServices.push("worker-ocr");
  for (const service of privateServices) {
    if ((services[service].ports ?? []).length > 0) {
      throw new Error(`${service} must not publish host ports in self-host Compose`);
    }
  }

  const workerEnv = serviceEnv(services.worker);
  if (
    String(workerEnv.WORKER_QUEUES ?? "")
      .split(",")
      .includes("ocr")
  ) {
    throw new Error("worker must not consume the OCR queue; use worker-ocr");
  }
  if (services["worker-ocr"]) {
    const workerOcrEnv = serviceEnv(services["worker-ocr"]);
    if (workerOcrEnv.WORKER_QUEUES !== "ocr") {
      throw new Error("worker-ocr must run with WORKER_QUEUES=ocr");
    }
    if (workerOcrEnv.OCR_PROVIDER !== "local_cli") {
      throw new Error("worker-ocr must run with OCR_PROVIDER=local_cli");
    }
  }
}

function parseArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let envFile;
  let allowSyntheticExample = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--env-file") {
      envFile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--allow-synthetic-example") {
      allowSyntheticExample = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { envFile, allowSyntheticExample };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/selfhost-check.mjs --env-file <path> [--allow-synthetic-example]",
    "",
    "Use --allow-synthetic-example only with docker/selfhost.example.env render checks.",
  ].join("\n");
}

function renderCompose(env, envFile) {
  const args = ["compose"];
  if (envFile) args.push("--env-file", envFile);
  args.push("-f", "docker-compose.selfhost.yml", "config", "--format", "json");
  return JSON.parse(execFileSync("docker", args, { encoding: "utf8", env }));
}

export function runSelfhostCheck(rawArgs = process.argv.slice(2)) {
  const options = parseArgs(rawArgs);
  if (options.help) {
    console.log(usage());
    return;
  }

  const envFile = options.envFile ? resolve(options.envFile) : undefined;
  const fileEnv = envFile ? parseEnvFile(readFileSync(envFile, "utf8")) : {};
  const env = { ...process.env, ...fileEnv };
  validateSelfhostEnv(env, { allowSyntheticExample: options.allowSyntheticExample });
  inspectRenderedCompose(renderCompose(env, envFile));
  console.log("Self-host Compose check passed.");
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  try {
    runSelfhostCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}
