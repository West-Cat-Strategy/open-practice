#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { inspectRenderedCompose, parseEnvFile, validateSelfhostEnv } from "./selfhost-check.mjs";

const DEFAULT_ENV_FILE = path.join("docker", "selfhost.example.env");
const DEFAULT_OPERATOR_ENV_FILE = ".env.selfhost.local";
const DEFAULT_EVIDENCE_ROOT = path.join(".tmp", "open-practice-selfhost-restore-drill");
const DISPOSABLE_PROJECT_PREFIX = "open-practice-selfhost-restore-drill-";
const MINIO_COMPOSE_ENDPOINT = "http://minio:9000";
const OBJECT_STORAGE_MODES = {
  bundledMinio: "bundled_minio",
  externalHttpsS3: "external_https_s3",
};
const RESTORE_MARKER_TABLE = "open_practice_restore_drill_marker";
const REDACTED = "[redacted]";

const BOUNDARY_ENABLEMENT_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPEN_PRACTICE_ENABLE_LIVE_PAYMENTS",
  "OPEN_PRACTICE_ENABLE_LIVE_SETTLEMENT",
  "OPEN_PRACTICE_TRUST_POSTING_ENABLED",
  "OPEN_PRACTICE_AUTO_TRUST_POSTING",
  "TRUST_POSTING_ENABLED",
  "OPEN_PRACTICE_BANK_FEED_ENABLED",
  "PUBLIC_CONSULTATION_INTAKE_ENABLED",
  "SMTP_HOST",
  "SMTP_PASSWORD",
  "IMAP_HOST",
  "IMAP_PASSWORD",
  "WEBRTC_MEETING_PROVIDER_KEY",
];

const COMPOSE_BOUNDARY_ENV_PATTERNS = [
  /^STRIPE_/,
  /^OPEN_PRACTICE_ENABLE_LIVE_/,
  /^OPEN_PRACTICE_(?:AUTO_)?TRUST_POSTING/,
  /^TRUST_POSTING/,
  /^OPEN_PRACTICE_BANK_FEED/,
  /^BANK_FEED_/,
  /^SMTP_/,
  /^IMAP_/,
  /^WEBRTC_MEETING_PROVIDER_KEY$/,
  /^AI_PROVIDER$/,
];

function truthy(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
}

function boundaryValueEnabled(key, value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (/(?:_ENABLED|ENABLE_|TRUST_POSTING)/.test(key)) return truthy(text);
  return true;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/selfhost-restore-drill.mjs [--env-file <path>] [--evidence-root <path>] [--project-name <name>]",
    "  node scripts/selfhost-restore-drill.mjs --bootstrap-env-file <path>",
    "  node scripts/selfhost-restore-drill.mjs --env-file <path> --preflight-only",
    "",
    "Defaults to docker/selfhost.example.env and a disposable Compose project.",
    "The checked-in synthetic env is allowed automatically; copied synthetic env files require --allow-synthetic-example.",
    "Use --bootstrap-env-file to create an ignored external-S3 operator template without secrets.",
    "Use --preflight-only to validate an ignored external-S3 operator env without Docker or S3 actions.",
  ].join("\n");
}

export function restoreDrillTimestamp(now = new Date()) {
  return now
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function isDefaultEnvFile(envFile, cwd = process.cwd()) {
  return path.resolve(cwd, envFile) === path.resolve(cwd, DEFAULT_ENV_FILE);
}

function defaultProjectName(pid = process.pid) {
  return `${DISPOSABLE_PROJECT_PREFIX}${pid}`;
}

export function assertDisposableProjectName(projectName) {
  if (!projectName.startsWith(DISPOSABLE_PROJECT_PREFIX)) {
    throw new Error(
      `Restore drill project names must start with ${DISPOSABLE_PROJECT_PREFIX} to avoid touching a non-disposable Compose project.`,
    );
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(projectName)) {
    throw new Error(
      "Restore drill project name must use only lowercase letters, numbers, underscores, or hyphens.",
    );
  }
}

export function parseRestoreDrillArgs(rawArgs, { cwd = process.cwd(), pid = process.pid } = {}) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  let envFile = DEFAULT_ENV_FILE;
  let bootstrapEnvFile = null;
  let evidenceRoot = DEFAULT_EVIDENCE_ROOT;
  let projectName = defaultProjectName(pid);
  let allowSyntheticExample;
  let preflightOnly = false;
  let sawEnvFile = false;
  let sawEvidenceRoot = false;
  let sawProjectName = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--env-file") {
      envFile = args[index + 1];
      sawEnvFile = true;
      index += 1;
      if (!envFile || envFile.startsWith("--")) throw new Error("--env-file requires a path.");
      continue;
    }
    if (arg === "--bootstrap-env-file") {
      bootstrapEnvFile = args[index + 1];
      index += 1;
      if (!bootstrapEnvFile || bootstrapEnvFile.startsWith("--")) {
        throw new Error("--bootstrap-env-file requires a path.");
      }
      continue;
    }
    if (arg === "--preflight-only") {
      preflightOnly = true;
      continue;
    }
    if (arg === "--allow-synthetic-example") {
      allowSyntheticExample = true;
      continue;
    }
    if (arg === "--evidence-root") {
      evidenceRoot = args[index + 1];
      sawEvidenceRoot = true;
      index += 1;
      if (!evidenceRoot || evidenceRoot.startsWith("--")) {
        throw new Error("--evidence-root requires a path.");
      }
      continue;
    }
    if (arg === "--project-name") {
      projectName = args[index + 1];
      sawProjectName = true;
      index += 1;
      if (!projectName || projectName.startsWith("--"))
        throw new Error("--project-name requires a value.");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    bootstrapEnvFile &&
    (sawEnvFile ||
      sawEvidenceRoot ||
      sawProjectName ||
      preflightOnly ||
      allowSyntheticExample !== undefined)
  ) {
    throw new Error("--bootstrap-env-file cannot be combined with restore-drill options.");
  }

  assertDisposableProjectName(projectName);
  return {
    envFile,
    bootstrapEnvFile,
    evidenceRoot,
    projectName,
    allowSyntheticExample: allowSyntheticExample ?? isDefaultEnvFile(envFile, cwd),
    preflightOnly,
  };
}

export function buildRestoreEvidenceDir({
  cwd = process.cwd(),
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
  now = new Date(),
} = {}) {
  return path.resolve(cwd, evidenceRoot, restoreDrillTimestamp(now));
}

function readEnvFile(envFile) {
  return parseEnvFile(readFileSync(envFile, "utf8"));
}

function operatorEnvTemplate() {
  return [
    "# Ignored Open Practice self-host operator env bootstrap.",
    "# Replace every change-me value before running preflight or restore-drill evidence.",
    "# Do not commit this file; .env.selfhost.local is ignored by the repo .gitignore.",
    "",
    "OPEN_PRACTICE_SELFHOST_PUBLIC_WEB_ORIGIN=https://change-me-practice.example.test",
    "OPEN_PRACTICE_SELFHOST_PUBLIC_API_ORIGIN=https://change-me-practice.example.test",
    "OPEN_PRACTICE_SELFHOST_WEBAUTHN_RP_ID=change-me-practice.example.test",
    "OPEN_PRACTICE_SELFHOST_WEB_HOST_PORT=33080",
    "OPEN_PRACTICE_SELFHOST_API_SETUP_HOST_PORT=34080",
    "OPEN_PRACTICE_SELFHOST_MINIO_HOST_PORT=39080",
    "",
    "OPEN_PRACTICE_SELFHOST_POSTGRES_DB=open_practice",
    "OPEN_PRACTICE_SELFHOST_POSTGRES_USER=open_practice",
    "OPEN_PRACTICE_SELFHOST_POSTGRES_PASSWORD=change-me-postgres-password",
    "",
    "OPEN_PRACTICE_SELFHOST_AUTH_JWT_SECRET=change-me-unique-jwt-secret-at-least-32-chars",
    "OPEN_PRACTICE_SELFHOST_CONFIG_ENCRYPTION_KEY=change-me-32-byte-base64-base64url-or-hex-key",
    "",
    "OPEN_PRACTICE_SELFHOST_S3_ENDPOINT=https://change-me-s3.example.test",
    "OPEN_PRACTICE_SELFHOST_S3_REGION=change-me-region",
    "OPEN_PRACTICE_SELFHOST_S3_BUCKET=change-me-bucket",
    "OPEN_PRACTICE_SELFHOST_S3_ACCESS_KEY=change-me-access-key",
    "OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY=change-me-secret-key",
    "",
    "OPEN_PRACTICE_SELFHOST_SESSION_TTL_HOURS=12",
    "OPEN_PRACTICE_SELFHOST_WORKER_QUEUES=email,inbound_email,ai_triage,transcription,media",
    "OPEN_PRACTICE_SELFHOST_WORKER_CONCURRENCY=2",
    "",
    "OPEN_PRACTICE_SELFHOST_OCR_WORKER_QUEUES=ocr",
    "OPEN_PRACTICE_SELFHOST_OCR_WORKER_CONCURRENCY=1",
    "OPEN_PRACTICE_SELFHOST_OCR_PROVIDER=local_cli",
    "OPEN_PRACTICE_SELFHOST_OCR_CLI_TIMEOUT_SECONDS=120",
    "OPEN_PRACTICE_SELFHOST_OCR_TEMP_DIR=",
    "",
  ].join("\n");
}

function pathForGitCheck(cwd, file) {
  const resolved = path.resolve(cwd, file);
  const relativePath = path.relative(cwd, resolved).replaceAll("\\", "/");
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
    ? relativePath
    : resolved;
}

export function assertIgnoredEnvPath(
  envFile,
  { cwd = process.cwd(), checkIgnored = defaultCheckIgnored } = {},
) {
  const target = pathForGitCheck(cwd, envFile);
  if (!checkIgnored(cwd, target)) {
    throw new Error(
      `${target} must be ignored before it can be used for self-host operator secrets.`,
    );
  }
}

function defaultCheckIgnored(cwd, target) {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--", target], { cwd });
    return true;
  } catch {
    return false;
  }
}

export function bootstrapOperatorEnvFile(
  envFile = DEFAULT_OPERATOR_ENV_FILE,
  { cwd = process.cwd(), checkIgnored = defaultCheckIgnored } = {},
) {
  const target = path.resolve(cwd, envFile);
  assertIgnoredEnvPath(target, { cwd, checkIgnored });
  if (existsSync(target)) {
    throw new Error(`${pathForGitCheck(cwd, target)} already exists; refusing to overwrite it.`);
  }

  mkdirSync(path.dirname(target), { recursive: true });
  const fd = openSync(target, "wx", 0o600);
  try {
    writeFileSync(fd, operatorEnvTemplate(), "utf8");
  } finally {
    closeSync(fd);
  }

  return {
    file: pathForGitCheck(cwd, target),
    mode: "external_https_s3_template",
    valuesRedacted: true,
  };
}

function placeholderOperatorKeys(env) {
  return Object.entries(env)
    .filter(([key, value]) => {
      if (!key.startsWith("OPEN_PRACTICE_SELFHOST_")) return false;
      return /(?:change-me|replace-me|placeholder|synthetic)/i.test(String(value ?? ""));
    })
    .map(([key]) => key)
    .sort();
}

export function preflightRestoreDrillEnv(
  envFile,
  { cwd = process.cwd(), checkIgnored = defaultCheckIgnored } = {},
) {
  const resolvedEnvFile = path.resolve(cwd, envFile);
  assertIgnoredEnvPath(resolvedEnvFile, { cwd, checkIgnored });
  const fileEnv = readEnvFile(resolvedEnvFile);
  const placeholders = placeholderOperatorKeys(fileEnv);
  if (placeholders.length > 0) {
    throw new Error(
      `Self-host operator env still has placeholder value(s): ${placeholders.join(", ")}`,
    );
  }

  const objectStorageMode = validateRestoreDrillEnv(fileEnv, fileEnv, {
    allowSyntheticExample: false,
  });
  validateRestoreDrillEnv(
    fileEnv,
    { ...process.env, ...fileEnv },
    { allowSyntheticExample: false },
  );
  if (objectStorageMode !== OBJECT_STORAGE_MODES.externalHttpsS3) {
    throw new Error(
      "External S3 restore-drill preflight requires an external HTTPS S3-compatible endpoint, not bundled MinIO.",
    );
  }

  return {
    env: {
      file: pathForGitCheck(cwd, resolvedEnvFile),
      valuesRedacted: true,
      ignored: true,
    },
    objectStorage: {
      mode: objectStorageMode,
      endpointRedacted: true,
      bucketRedacted: true,
    },
    status: "passed",
  };
}

export function restoreDrillObjectStorageMode(env) {
  const endpoint = String(env.OPEN_PRACTICE_SELFHOST_S3_ENDPOINT ?? "").trim();
  if (endpoint === MINIO_COMPOSE_ENDPOINT) return OBJECT_STORAGE_MODES.bundledMinio;

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("OPEN_PRACTICE_SELFHOST_S3_ENDPOINT must be a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error(
      "External self-host restore drill object storage endpoints must use https unless they are the private http://minio:9000 Compose endpoint.",
    );
  }
  return OBJECT_STORAGE_MODES.externalHttpsS3;
}

export function validateRestoreDrillEnv(
  fileEnv,
  mergedEnv,
  { allowSyntheticExample = false } = {},
) {
  void fileEnv;
  validateSelfhostEnv(mergedEnv, { allowSyntheticExample });
  const objectStorageMode = restoreDrillObjectStorageMode(mergedEnv);

  const enabledBoundaryKeys = BOUNDARY_ENABLEMENT_KEYS.filter((key) =>
    boundaryValueEnabled(key, mergedEnv[key]),
  );
  if (enabledBoundaryKeys.length > 0) {
    throw new Error(
      `Self-host restore drill env must not enable live settlement, trust posting, or external provider flags: ${enabledBoundaryKeys.join(", ")}`,
    );
  }
  if (mergedEnv.AI_PROVIDER && mergedEnv.AI_PROVIDER !== "disabled") {
    throw new Error("Self-host restore drill env must not enable AI_PROVIDER.");
  }
  return objectStorageMode;
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

export function inspectRestoreDrillComposeBoundaries(rendered) {
  for (const [serviceName, service] of Object.entries(rendered.services ?? {})) {
    for (const key of Object.keys(serviceEnv(service))) {
      if (COMPOSE_BOUNDARY_ENV_PATTERNS.some((pattern) => pattern.test(key))) {
        throw new Error(`${serviceName} must not receive ${key} during the restore drill.`);
      }
    }
  }
}

function sha256(bufferOrText) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildMarkerSql({ markerId, markerSha256 }) {
  return [
    `CREATE TABLE IF NOT EXISTS ${RESTORE_MARKER_TABLE} (marker_id text PRIMARY KEY, marker_sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `DELETE FROM ${RESTORE_MARKER_TABLE} WHERE marker_id = ${sqlLiteral(markerId)}`,
    `INSERT INTO ${RESTORE_MARKER_TABLE} (marker_id, marker_sha256) VALUES (${sqlLiteral(markerId)}, ${sqlLiteral(markerSha256)})`,
  ].join(";\n");
}

function markerSelectSql(markerId) {
  return `SELECT marker_sha256 FROM ${RESTORE_MARKER_TABLE} WHERE marker_id = ${sqlLiteral(markerId)};`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function safeMarkerId(now = new Date()) {
  return `restore-drill-${restoreDrillTimestamp(now).toLowerCase().replaceAll(":", "-")}`;
}

function objectMarkerBody(markerId) {
  return [
    "Open Practice self-host restore drill synthetic marker.",
    `markerId=${markerId}`,
    "This file is generated in a disposable Compose project and contains no client or matter data.",
    "",
  ].join("\n");
}

function disturbedObjectMarkerBody(markerId) {
  return [
    "Open Practice self-host restore drill synthetic disturbed marker.",
    `markerId=${markerId}`,
    "This file proves external S3 restore evidence can recover the backed-up marker body.",
    "",
  ].join("\n");
}

function redactText(text, secretValues = []) {
  let redacted = String(text);
  for (const value of secretValues) {
    if (value.length >= 4) redacted = redacted.split(value).join(REDACTED);
  }
  return redacted
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi, `$1${REDACTED}$2`)
    .replace(/\b(password|passwd|secret|token|key)=([^\s]+)/gi, `$1=${REDACTED}`)
    .replace(/\b(password|secret|token|key)\b\s*:\s*([^\s,}]+)/gi, `$1: ${REDACTED}`);
}

export function createRedactor(env) {
  const secretValues = [];
  for (const [key, value] of Object.entries(env)) {
    if (
      !/(PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL|REDIS_URL|ENDPOINT|BUCKET)/i.test(key) ||
      !value
    ) {
      continue;
    }
    const text = String(value);
    if (text.length >= 4) secretValues.push(text);
    try {
      const hostname = new URL(text).hostname;
      if (hostname.length >= 4) secretValues.push(hostname);
    } catch {
      // Non-URL secret values are redacted by exact value above.
    }
  }
  return (text) => redactText(text, secretValues);
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolve(String(port));
        else reject(new Error("Failed to reserve a loopback port."));
      });
    });
  });
}

async function allocateRestoreDrillPorts() {
  return {
    api: await reserveLoopbackPort(),
    web: await reserveLoopbackPort(),
    minio: await reserveLoopbackPort(),
  };
}

function composeBaseArgs({ projectName, envFile }) {
  return [
    "compose",
    "--project-name",
    projectName,
    "--env-file",
    envFile,
    "-f",
    "docker-compose.selfhost.yml",
  ];
}

async function runCommand({
  id,
  command,
  args,
  cwd,
  env,
  input,
  commands,
  redactor,
  captureStdout = false,
}) {
  const startedAt = new Date().toISOString();
  const stdoutChunks = [];
  const stderrChunks = [];
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    if (captureStdout) stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk);
  });

  if (input) child.stdin.end(input);
  else child.stdin.end();

  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal }));
  });
  const finishedAt = new Date().toISOString();
  const stderrText = Buffer.concat(stderrChunks).toString("utf8");
  const entry = {
    id,
    status: status.code ?? 1,
    signal: status.signal ?? null,
    startedAt,
    finishedAt,
  };
  if (status.code !== 0 && stderrText.trim()) {
    entry.stderrPreview = redactor(stderrText).slice(0, 2000);
  }
  commands.push(entry);

  if (status.code !== 0) {
    throw new Error(`${id} failed with exit code ${status.code ?? "null"}`);
  }
  return { stdout: Buffer.concat(stdoutChunks), stderr: stderrText };
}

function createRunner({ cwd, env, projectName, envFile, commands, redactor }) {
  const composePrefix = composeBaseArgs({ projectName, envFile });
  return {
    run: (id, command, args, options = {}) =>
      runCommand({
        id,
        command,
        args,
        cwd,
        env: { ...env, ...options.env },
        commands,
        redactor,
        input: options.input,
        captureStdout: options.captureStdout,
      }),
    compose: (id, args, options = {}) =>
      runCommand({
        id,
        command: "docker",
        args: [...composePrefix, ...args],
        cwd,
        env: { ...env, ...options.env },
        commands,
        redactor,
        input: options.input,
        captureStdout: options.captureStdout,
      }),
  };
}

async function waitForCommand(label, command, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await command();
    } catch (error) {
      lastError = error;
      await delay(options.intervalMs ?? 1000);
    }
  }
  throw lastError ?? new Error(`${label} did not become ready before timeout.`);
}

async function waitForStableCommand(label, command, options = {}) {
  const firstResult = await waitForCommand(label, command, options);
  await delay(options.stabilityMs ?? 1000);
  await waitForCommand(`${label} stable`, command, {
    ...options,
    timeoutMs: options.stabilityTimeoutMs ?? 15_000,
  });
  return firstResult;
}

async function waitForUrl(label, url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 5000);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || (options.acceptStatus?.includes(response.status) ?? false)) {
        return response;
      }
      const body = await response.text().catch(() => "");
      const bodyPreview = body.trim()
        ? ` body=${(options.redactor ? options.redactor(body) : body).slice(0, 500)}`
        : "";
      lastError = `${response.status} ${response.statusText}${bodyPreview}`;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(options.intervalMs ?? 1000);
  }
  throw new Error(`${label} was not ready at ${url}: ${lastError}`);
}

export function assertSetupStatusShape(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.required !== "boolean" ||
    typeof value.blocked !== "boolean"
  ) {
    throw new Error("Expected setup status JSON with boolean required and blocked fields.");
  }
}

function artifactMetadata(file) {
  const stat = statSync(file);
  return {
    path: path.basename(file),
    sizeBytes: stat.size,
    sha256: sha256(readFileSync(file)),
  };
}

function artifactMetadataWithoutSha(file) {
  const stat = statSync(file);
  return {
    path: path.basename(file),
    sizeBytes: stat.size,
    sha256: REDACTED,
  };
}

export function externalS3MarkerKey(markerId) {
  return `restore-drill/${markerId}.txt`;
}

async function loadApiS3Module(cwd) {
  const apiRequire = createRequire(pathToFileURL(path.resolve(cwd, "apps/api/package.json")));
  return await import(pathToFileURL(apiRequire.resolve("@aws-sdk/client-s3")).href);
}

async function createExternalS3({ cwd, env, s3Module }) {
  const module = s3Module ?? (await loadApiS3Module(cwd));
  return {
    client: new module.S3Client({
      endpoint: env.OPEN_PRACTICE_SELFHOST_S3_ENDPOINT,
      region: env.OPEN_PRACTICE_SELFHOST_S3_REGION || "local",
      credentials: {
        accessKeyId: env.OPEN_PRACTICE_SELFHOST_S3_ACCESS_KEY || "open_practice",
        secretAccessKey: env.OPEN_PRACTICE_SELFHOST_S3_SECRET_KEY,
      },
      forcePathStyle: true,
    }),
    GetObjectCommand: module.GetObjectCommand,
    PutObjectCommand: module.PutObjectCommand,
  };
}

async function objectBodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body?.transformToByteArray) return Buffer.from(await body.transformToByteArray());
  if (body?.transformToString) return Buffer.from(await body.transformToString(), "utf8");
  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("External S3 restore marker body was not readable.");
}

export async function writeExternalS3Marker({ s3, bucket, key, markerBody }) {
  await s3.client.send(
    new s3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(markerBody, "utf8"),
      ServerSideEncryption: "AES256",
    }),
  );
}

async function readExternalS3Marker({ s3, bucket, key }) {
  const result = await s3.client.send(
    new s3.GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  return objectBodyToBuffer(result.Body);
}

export async function backupExternalS3Marker({ s3, bucket, key, backupPath }) {
  const body = await readExternalS3Marker({ s3, bucket, key });
  writeFileSync(backupPath, body);
  return artifactMetadataWithoutSha(backupPath);
}

export async function restoreExternalS3Marker({ s3, bucket, key, backupPath }) {
  await s3.client.send(
    new s3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: readFileSync(backupPath),
      ServerSideEncryption: "AES256",
    }),
  );
}

export async function verifyExternalS3Marker({ s3, bucket, key, markerSha256 }) {
  const body = await readExternalS3Marker({ s3, bucket, key });
  if (sha256(body) !== markerSha256) {
    throw new Error("Restored external S3 marker checksum did not match.");
  }
}

async function captureFailureLogs({ runner, evidenceDir, evidence, redactor }) {
  try {
    const result = await runner.compose(
      "selfhost-failure-logs",
      ["logs", "--no-color", "--tail", "200", "api", "web"],
      { captureStdout: true },
    );
    const logPath = path.join(evidenceDir, "failure-api-web.redacted.log");
    writeFileSync(logPath, redactor(result.stdout.toString("utf8")));
    evidence.failureLogs = { path: path.basename(logPath), redacted: true };
  } catch (error) {
    evidence.failureLogs = {
      status: "unavailable",
      error: redactor(error instanceof Error ? error.message : String(error)),
    };
  }
}

async function writePostgresMarker({ runner, markerId, markerSha256, dbUser, dbName }) {
  await runner.compose("postgres-marker-create", [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    dbUser,
    "-d",
    dbName,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    buildMarkerSql({ markerId, markerSha256 }),
  ]);
}

async function verifyPostgresMarker({ runner, markerId, markerSha256, dbUser, dbName }) {
  const result = await runner.compose(
    "postgres-marker-verify",
    [
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      dbUser,
      "-d",
      dbName,
      "-At",
      "-c",
      markerSelectSql(markerId),
    ],
    { captureStdout: true },
  );
  const actual = result.stdout.toString("utf8").trim();
  if (actual !== markerSha256) {
    throw new Error("Restored PostgreSQL marker checksum did not match.");
  }
}

async function writeMinioMarker({ runner, bucket, markerId, markerBody }) {
  const markerPath = `/data/${bucket}/restore-drill/${markerId}.txt`;
  await runner.compose(
    "minio-marker-create",
    [
      "exec",
      "-T",
      "minio",
      "sh",
      "-c",
      `mkdir -p ${shellQuote(path.posix.dirname(markerPath))} && cat > ${shellQuote(markerPath)}`,
    ],
    { input: Buffer.from(markerBody, "utf8") },
  );
}

async function verifyMinioMarker({ runner, bucket, markerId, markerSha256 }) {
  const markerPath = `/data/${bucket}/restore-drill/${markerId}.txt`;
  const result = await runner.compose(
    "minio-marker-verify",
    ["exec", "-T", "minio", "sha256sum", markerPath],
    { captureStdout: true },
  );
  const actual = result.stdout.toString("utf8").trim().split(/\s+/)[0];
  if (actual !== markerSha256) {
    throw new Error("Restored MinIO marker checksum did not match.");
  }
}

export async function runRestoreDrill(rawArgs = process.argv.slice(2), dependencies = {}) {
  const options = parseRestoreDrillArgs(rawArgs);
  if (options.help) {
    console.log(usage());
    return { status: "help" };
  }

  const cwd = dependencies.cwd ?? process.cwd();
  const checkIgnored = dependencies.checkIgnored ?? defaultCheckIgnored;
  if (options.bootstrapEnvFile) {
    const result = bootstrapOperatorEnvFile(options.bootstrapEnvFile, { cwd, checkIgnored });
    console.log(`Created ignored external S3 operator env template: ${result.file}`);
    console.log("Replace every placeholder value before running preflight or restore-drill proof.");
    return { status: "bootstrapped", ...result };
  }

  if (options.preflightOnly) {
    const result = preflightRestoreDrillEnv(options.envFile, { cwd, checkIgnored });
    console.log(`External S3 restore-drill preflight passed for ignored env: ${result.env.file}`);
    console.log("Values, endpoint, and bucket are redacted; no Docker or S3 actions were run.");
    return { ...result, status: "preflight-passed" };
  }

  const now = dependencies.now ?? new Date();
  const evidenceDir = buildRestoreEvidenceDir({
    cwd,
    evidenceRoot: options.evidenceRoot,
    now,
  });
  mkdirSync(evidenceDir, { recursive: true });

  const envFile = path.resolve(cwd, options.envFile);
  const fileEnv = readEnvFile(envFile);
  const mergedEnv = { ...process.env, ...fileEnv };
  const objectStorageMode = validateRestoreDrillEnv(fileEnv, mergedEnv, {
    allowSyntheticExample: options.allowSyntheticExample,
  });
  const usesBundledMinio = objectStorageMode === OBJECT_STORAGE_MODES.bundledMinio;

  const markerId = safeMarkerId(now);
  const dbMarkerBody = `Open Practice restore drill synthetic database marker: ${markerId}\n`;
  const objectBody = objectMarkerBody(markerId);
  const disturbedObjectBody = disturbedObjectMarkerBody(markerId);
  const marker = {
    id: markerId,
    postgresSha256: sha256(dbMarkerBody),
    objectSha256: sha256(objectBody),
    disturbedObjectSha256: usesBundledMinio ? undefined : sha256(disturbedObjectBody),
  };
  const ports = dependencies.allocatePorts
    ? await dependencies.allocatePorts()
    : await allocateRestoreDrillPorts();
  const composeEnv = {
    ...mergedEnv,
    OPEN_PRACTICE_SELFHOST_API_SETUP_HOST_PORT: ports.api,
    OPEN_PRACTICE_SELFHOST_WEB_HOST_PORT: ports.web,
    OPEN_PRACTICE_SELFHOST_MINIO_HOST_PORT: ports.minio,
  };
  const redactor = createRedactor(composeEnv);
  const evidence = {
    generatedAt: now.toISOString(),
    status: "running",
    projectName: options.projectName,
    disposableComposeProject: true,
    env: {
      file: path.relative(cwd, envFile),
      syntheticExampleAllowed: options.allowSyntheticExample,
      valuesRedacted: true,
    },
    objectStorage: {
      mode: objectStorageMode,
      endpointRedacted: true,
      bucketRedacted: true,
      markerKeySha256: sha256(externalS3MarkerKey(markerId)),
      serverSideEncryption: "AES256",
    },
    ports: {
      api: `127.0.0.1:${ports.api}`,
      web: `127.0.0.1:${ports.web}`,
      minio: `127.0.0.1:${ports.minio}`,
    },
    marker,
    artifacts: {},
    checks: [],
    commands: [],
    privacy:
      "Synthetic restore-drill evidence only. Environment values, credentials, client data, matter data, private deployment details, payment data, trust postings, provider payloads, and raw audit exports are not recorded.",
  };
  const evidenceJsonPath = path.join(evidenceDir, "restore-drill-evidence.json");
  writeJson(evidenceJsonPath, evidence);

  const runner = createRunner({
    cwd,
    env: composeEnv,
    projectName: options.projectName,
    envFile,
    commands: evidence.commands,
    redactor,
  });
  const dbUser = composeEnv.OPEN_PRACTICE_SELFHOST_POSTGRES_USER || "open_practice";
  const dbName = composeEnv.OPEN_PRACTICE_SELFHOST_POSTGRES_DB || "open_practice";
  const bucket = composeEnv.OPEN_PRACTICE_SELFHOST_S3_BUCKET || "open-practice-documents";
  const apiHealthUrl = `http://127.0.0.1:${ports.api}/health`;
  const webSetupStatusUrl = `http://127.0.0.1:${ports.web}/api/setup/status`;
  const postgresDumpPath = path.join(evidenceDir, "postgres.dump");
  const minioArchivePath = path.join(evidenceDir, "minio-data.tgz");
  const objectMarkerBackupPath = path.join(evidenceDir, "external-s3-marker.txt");
  const objectMarkerKey = externalS3MarkerKey(markerId);
  const externalS3 = usesBundledMinio
    ? null
    : await createExternalS3({
        cwd,
        env: composeEnv,
        s3Module: dependencies.s3Module,
      });
  let mainError;

  console.log(`Self-host restore drill starting in disposable project ${options.projectName}.`);
  console.log(`Evidence directory: ${evidenceDir}`);

  try {
    const rendered = JSON.parse(
      (
        await runner.compose("selfhost-compose-render", ["config", "--format", "json"], {
          captureStdout: true,
        })
      ).stdout.toString("utf8"),
    );
    inspectRenderedCompose(rendered);
    inspectRestoreDrillComposeBoundaries(rendered);
    evidence.checks.push({ id: "selfhost-env-and-compose", status: "passed" });
    writeJson(evidenceJsonPath, evidence);

    await runner.compose(
      "selfhost-build-images",
      ["build", "postgres", "minio", "db-migrate", "api", "web", "worker"],
      { env: { DOCKER_BUILDKIT: "1" } },
    );
    await runner.compose("selfhost-up-data-services", [
      "up",
      "-d",
      "minio-bucket-init",
      "postgres",
      "redis",
      "minio",
    ]);
    await waitForCommand("PostgreSQL", () =>
      runner.compose("postgres-ready", [
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        dbUser,
        "-d",
        dbName,
      ]),
    );
    await waitForUrl("MinIO", `http://127.0.0.1:${ports.minio}/minio/health/ready`);
    await runner.compose("db-migrate-initial", ["run", "--rm", "db-migrate"]);
    evidence.checks.push({ id: "initial-data-services", status: "passed" });
    writeJson(evidenceJsonPath, evidence);

    await writePostgresMarker({
      runner,
      markerId,
      markerSha256: marker.postgresSha256,
      dbUser,
      dbName,
    });
    if (usesBundledMinio) {
      await writeMinioMarker({ runner, bucket, markerId, markerBody: objectBody });
    } else {
      await writeExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        markerBody: objectBody,
      });
    }
    evidence.checks.push({ id: "synthetic-markers-created", status: "passed" });

    const dump = await runner.compose(
      "postgres-dump",
      [
        "exec",
        "-T",
        "postgres",
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "-U",
        dbUser,
        "-d",
        dbName,
      ],
      { captureStdout: true },
    );
    writeFileSync(postgresDumpPath, dump.stdout);
    evidence.artifacts.postgresDump = artifactMetadata(postgresDumpPath);

    if (usesBundledMinio) {
      const minioArchive = await runner.compose(
        "minio-data-archive",
        ["exec", "-T", "minio", "sh", "-c", "cd /data && tar -czf - ."],
        { captureStdout: true },
      );
      writeFileSync(minioArchivePath, minioArchive.stdout);
      evidence.artifacts.minioArchive = artifactMetadata(minioArchivePath);
    } else {
      evidence.artifacts.externalS3Marker = await backupExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        backupPath: objectMarkerBackupPath,
      });
    }
    evidence.checks.push({ id: "backup-artifacts-created", status: "passed" });
    writeJson(evidenceJsonPath, evidence);

    if (!usesBundledMinio) {
      await writeExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        markerBody: disturbedObjectBody,
      });
      await verifyExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        markerSha256: marker.disturbedObjectSha256,
      });
      evidence.checks.push({ id: "external-s3-marker-disturbed", status: "passed" });
      writeJson(evidenceJsonPath, evidence);
    }

    await runner.compose("selfhost-down-before-restore", ["down", "--volumes", "--remove-orphans"]);
    await runner.compose("selfhost-up-restore-infra", ["up", "-d", "postgres", "redis"]);
    await waitForStableCommand("restored PostgreSQL", () =>
      runner.compose("restored-postgres-ready", [
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        dbUser,
        "-d",
        dbName,
      ]),
    );
    await runner.compose(
      "postgres-restore",
      [
        "exec",
        "-T",
        "postgres",
        "pg_restore",
        "--clean",
        "--if-exists",
        "--no-owner",
        "-U",
        dbUser,
        "-d",
        dbName,
      ],
      { input: readFileSync(postgresDumpPath) },
    );
    if (usesBundledMinio) {
      await runner.compose("minio-data-restore", [
        "run",
        "--rm",
        "--no-deps",
        "--entrypoint",
        "sh",
        "--volume",
        `${minioArchivePath}:/restore/minio-data.tgz:ro`,
        "minio",
        "-c",
        "rm -rf /data/* /data/.[!.]* /data/..?* && tar -xzf /restore/minio-data.tgz -C /data",
      ]);
      await runner.compose("selfhost-up-restored-minio", ["up", "-d", "minio"]);
      await waitForUrl("restored MinIO", `http://127.0.0.1:${ports.minio}/minio/health/ready`);
    } else {
      await restoreExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        backupPath: objectMarkerBackupPath,
      });
      await runner.compose("selfhost-up-restored-minio", ["up", "-d", "minio"]);
      await waitForUrl(
        "supporting MinIO service",
        `http://127.0.0.1:${ports.minio}/minio/health/ready`,
      );
    }
    evidence.checks.push({ id: "fresh-volumes-restored", status: "passed" });
    writeJson(evidenceJsonPath, evidence);

    await verifyPostgresMarker({
      runner,
      markerId,
      markerSha256: marker.postgresSha256,
      dbUser,
      dbName,
    });
    if (usesBundledMinio) {
      await verifyMinioMarker({
        runner,
        bucket,
        markerId,
        markerSha256: marker.objectSha256,
      });
    } else {
      await verifyExternalS3Marker({
        s3: externalS3,
        bucket,
        key: objectMarkerKey,
        markerSha256: marker.objectSha256,
      });
    }
    evidence.checks.push({ id: "restored-marker-checksums", status: "passed" });
    writeJson(evidenceJsonPath, evidence);

    await runner.compose("selfhost-up-restored-apps", ["up", "-d", "api", "web", "worker"]);
    const healthResponse = await waitForUrl("API health", apiHealthUrl, {
      timeoutMs: 120_000,
      redactor,
    });
    const health = await healthResponse.json();
    if (!health?.ok || health.persistence !== "postgres") {
      throw new Error("API /health did not report PostgreSQL-backed readiness.");
    }
    const setupStatusResponse = await waitForUrl("web setup status rewrite", webSetupStatusUrl, {
      timeoutMs: 120_000,
      redactor,
    });
    const setupStatus = await setupStatusResponse.json();
    assertSetupStatusShape(setupStatus);
    evidence.checks.push({ id: "api-health", status: "passed", persistence: health.persistence });
    evidence.checks.push({
      id: "web-setup-status",
      status: "passed",
      required: setupStatus.required,
      blocked: setupStatus.blocked,
    });
    evidence.status = "passed";
  } catch (error) {
    mainError = error;
    await captureFailureLogs({ runner, evidenceDir, evidence, redactor });
    evidence.status = "failed";
    evidence.error = redactor(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await runner.compose("selfhost-cleanup", ["down", "--volumes", "--remove-orphans"]);
      evidence.cleanup = { status: "passed" };
    } catch (cleanupError) {
      evidence.cleanup = {
        status: "failed",
        error: redactor(
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        ),
      };
      if (!mainError) mainError = cleanupError;
      evidence.status = "failed";
    }
    writeJson(evidenceJsonPath, evidence);
  }

  if (mainError) throw mainError;
  console.log(`Self-host restore drill passed. Evidence: ${evidenceDir}`);
  return evidence;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  runRestoreDrill().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  });
}
