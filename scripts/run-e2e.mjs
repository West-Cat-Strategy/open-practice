#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? "host";
const passthroughArgs = process.argv[3] === "--" ? process.argv.slice(4) : process.argv.slice(3);
const spawned = [];
let dockerDatabaseName;
let dockerStarted = false;
let nextEnvSnapshot;

const commonSecret = "e2e-local-secret-at-least-32-characters";
const syntheticConfigEncryptionKey = "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const dockerComposeBaseArgs = ["compose", "-p", "open-practice-e2e"];
const nextEnvPath = join(root, "apps/web/next-env.d.ts");

function prefixedLine(prefix, chunk, writer) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) writer(`[${prefix}] ${line}\n`);
  }
}

function spawnLongLived(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) =>
    prefixedLine(name, chunk, process.stdout.write.bind(process.stdout)),
  );
  child.stderr.on("data", (chunk) =>
    prefixedLine(name, chunk, process.stderr.write.bind(process.stderr)),
  );
  child.on("exit", (code, signal) => {
    if (!child.killed && code !== 0) {
      process.stderr.write(
        `[${name}] exited with code ${code ?? "null"} signal ${signal ?? "null"}\n`,
      );
    }
  });
  spawned.push({ name, child });
  return child;
}

function stopLongLivedChild(child, signal) {
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function run(name, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      prefixedLine(name, chunk, process.stdout.write.bind(process.stdout));
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      prefixedLine(name, chunk, process.stderr.write.bind(process.stderr));
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${name} failed with exit code ${code}`));
    });
  });
}

async function waitForRun(name, command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await run(name, command, args, options);
    } catch (error) {
      lastError = error;
      await delay(1000);
    }
  }
  throw lastError ?? new Error(`${name} did not finish before timeout`);
}

async function waitForUrl(name, url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || (options.acceptStatus?.includes(response.status) ?? false)) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(750);
  }
  throw new Error(`${name} was not ready at ${url}: ${lastError}`);
}

async function cleanup() {
  for (const { name, child } of spawned.reverse()) {
    if (child.exitCode === null && !child.killed) {
      process.stdout.write(`[${name}] stopping\n`);
      stopLongLivedChild(child, "SIGTERM");
    }
  }
  await delay(1000);
  for (const { child } of spawned) {
    if (child.exitCode === null && !child.killed) stopLongLivedChild(child, "SIGKILL");
  }
  await restoreNextEnv();
  if (dockerDatabaseName) {
    await run("docker-db-cleanup", "docker", [
      ...dockerComposeBaseArgs,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "open_practice",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dockerDatabaseName}';`,
    ])
      .then(() =>
        run("docker-db-drop", "docker", [
          ...dockerComposeBaseArgs,
          "exec",
          "-T",
          "postgres",
          "dropdb",
          "-U",
          "open_practice",
          "--if-exists",
          "--force",
          dockerDatabaseName,
        ]),
      )
      .catch((error) => {
        process.stderr.write(`[docker-db-cleanup] ${error.message}\n`);
      });
  }
  if (dockerStarted) {
    await run("docker-down", "docker", [
      ...dockerComposeBaseArgs,
      "down",
      "-v",
      "--remove-orphans",
    ]).catch((error) => {
      process.stderr.write(`[docker-down] ${error.message}\n`);
    });
    dockerStarted = false;
  }
}

async function snapshotNextEnv() {
  nextEnvSnapshot = await readFile(nextEnvPath, "utf8").catch(() => undefined);
}

async function restoreNextEnv() {
  if (nextEnvSnapshot === undefined) return;
  const current = await readFile(nextEnvPath, "utf8").catch(() => undefined);
  if (current !== nextEnvSnapshot) {
    await writeFile(nextEnvPath, nextEnvSnapshot);
  }
}

async function buildRuntimeWorkspacePackages() {
  for (const packageName of [
    "@open-practice/domain",
    "@open-practice/providers",
    "@open-practice/database",
  ]) {
    await run("workspace-build", "pnpm", ["--filter", packageName, "build"]);
  }
}

function startApi(env) {
  return spawnLongLived(
    "api",
    "pnpm",
    ["--filter", "@open-practice/api", "exec", "tsx", "src/server.ts"],
    { env },
  );
}

function startWeb(env) {
  return spawnLongLived("web", "pnpm", ["--filter", "@open-practice/web", "dev"], { env });
}

async function runPlaywright(env, projects) {
  const args = [
    "exec",
    "playwright",
    "test",
    ...projects.flatMap((project) => ["--project", project]),
    ...passthroughArgs,
  ];
  await run("playwright", "pnpm", args, {
    env: {
      ...env,
      PLAYWRIGHT_HTML_OPEN: "never",
    },
  });
}

function runtimeEnv(input) {
  return {
    NODE_ENV: "development",
    API_PORT: String(input.apiPort),
    WEB_PORT: String(input.webPort),
    API_BASE_URL: input.apiBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: input.apiBaseUrl,
    PUBLIC_WEB_BASE_URL: input.webBaseUrl,
    WEBAUTHN_ORIGIN: input.webBaseUrl,
    AUTH_JWT_SECRET: commonSecret,
    DEV_AUTH_FIRM_ID: process.env.DEV_AUTH_FIRM_ID ?? "firm-west-legal",
    DEV_AUTH_USER_ID: process.env.DEV_AUTH_USER_ID ?? "user-admin",
    WEBRTC_MEETING_PROVIDER_KEY: `${input.mode}-meeting-provider`,
    WEBRTC_MEETING_BASE_URL: `${input.webBaseUrl}/meeting`,
    E2E_MODE: input.mode,
    E2E_API_BASE_URL: input.apiBaseUrl,
    E2E_WEB_BASE_URL: input.webBaseUrl,
  };
}

async function startHostRuntime() {
  const apiPort = Number(process.env.E2E_HOST_API_PORT ?? 34110);
  const webPort = Number(process.env.E2E_HOST_WEB_PORT ?? 33110);
  const apiBaseUrl = `http://localhost:${apiPort}`;
  const webBaseUrl = `http://localhost:${webPort}`;
  const env = {
    ...runtimeEnv({ mode: "host", apiPort, webPort, apiBaseUrl, webBaseUrl }),
    DATABASE_URL: "",
    REDIS_URL: "",
    S3_ENDPOINT: "",
    S3_ACCESS_KEY: "",
    S3_SECRET_KEY: "",
    OPEN_PRACTICE_USE_MEMORY_REPO: "true",
    OPEN_PRACTICE_DEV_SEED: "true",
  };

  startApi(env);
  await waitForUrl("API", `${apiBaseUrl}/health`);
  startWeb(env);
  await waitForUrl("web", webBaseUrl, { timeoutMs: 90_000 });

  return env;
}

async function startFirstRunRuntime() {
  const apiPort = Number(process.env.E2E_FIRST_RUN_API_PORT ?? 34130);
  const webPort = Number(process.env.E2E_FIRST_RUN_WEB_PORT ?? 33130);
  const apiBaseUrl = `http://localhost:${apiPort}`;
  const webBaseUrl = `http://localhost:${webPort}`;
  const env = {
    NODE_ENV: "development",
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    API_BASE_URL: apiBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    PUBLIC_WEB_BASE_URL: webBaseUrl,
    WEBAUTHN_ORIGIN: webBaseUrl,
    AUTH_JWT_SECRET: commonSecret,
    DEV_AUTH_FIRM_ID: process.env.DEV_AUTH_FIRM_ID ?? "firm-west-legal",
    DEV_AUTH_USER_ID: process.env.DEV_AUTH_USER_ID ?? "user-admin",
    E2E_API_BASE_URL: apiBaseUrl,
    E2E_WEB_BASE_URL: webBaseUrl,
    DATABASE_URL: "",
    REDIS_URL: "",
    S3_ENDPOINT: "",
    S3_ACCESS_KEY: "",
    S3_SECRET_KEY: "",
    OPEN_PRACTICE_USE_MEMORY_REPO: "true",
    OPEN_PRACTICE_DEV_SEED: "false",
  };

  startApi(env);
  await waitForUrl("API", `${apiBaseUrl}/health`);
  startWeb(env);
  await waitForUrl("web", webBaseUrl, { timeoutMs: 90_000 });

  return env;
}

async function ensureMinioBucket(env) {
  await run("minio-bucket", "docker", [
    ...dockerComposeBaseArgs,
    "exec",
    "-T",
    "minio",
    "sh",
    "-c",
    `mkdir -p /data/${env.S3_BUCKET}`,
  ]);
}

async function startDockerRuntime() {
  const apiPort = Number(process.env.E2E_DOCKER_API_PORT ?? 34120);
  const webPort = Number(process.env.E2E_DOCKER_WEB_PORT ?? 33120);
  const apiBaseUrl = `http://localhost:${apiPort}`;
  const webBaseUrl = `http://localhost:${webPort}`;
  dockerDatabaseName = `open_practice_e2e_${Date.now()}`;
  const databaseUrl = `postgresql://open_practice:open_practice@localhost:35432/${dockerDatabaseName}`;
  const env = {
    ...runtimeEnv({ mode: "docker", apiPort, webPort, apiBaseUrl, webBaseUrl }),
    DATABASE_URL: databaseUrl,
    REDIS_URL: "redis://localhost:36379/0",
    S3_ENDPOINT: "http://localhost:39000",
    S3_REGION: "local",
    S3_BUCKET: "open-practice-documents",
    S3_ACCESS_KEY: "open_practice",
    S3_SECRET_KEY: "open_practice_secret",
    OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: syntheticConfigEncryptionKey,
    OPEN_PRACTICE_DEV_SEED: "true",
    WORKER_QUEUES: "email,inbound_email,ai_triage,ocr,transcription,media",
  };

  await run("docker", "docker", [
    ...dockerComposeBaseArgs,
    "up",
    "-d",
    "postgres",
    "redis",
    "minio",
    "mailpit",
  ]);
  dockerStarted = true;
  await waitForRun("docker-postgres", "docker", [
    ...dockerComposeBaseArgs,
    "exec",
    "-T",
    "postgres",
    "pg_isready",
    "-U",
    "open_practice",
    "-d",
    "open_practice",
  ]);
  await waitForUrl("minio", "http://localhost:39000/minio/health/ready");
  await run("docker-db-create", "docker", [
    ...dockerComposeBaseArgs,
    "exec",
    "-T",
    "postgres",
    "createdb",
    "-U",
    "open_practice",
    dockerDatabaseName,
  ]);
  await run("db-migrate", "pnpm", ["--filter", "@open-practice/database", "db:migrate"], { env });
  await ensureMinioBucket(env);

  startApi(env);
  await waitForUrl("API", `${apiBaseUrl}/health`);
  spawnLongLived("worker", "pnpm", ["--filter", "@open-practice/worker", "dev"], { env });
  startWeb(env);
  await waitForUrl("web", webBaseUrl, { timeoutMs: 90_000 });

  return env;
}

async function main() {
  if (!["host", "docker", "first-run"].includes(mode)) {
    throw new Error("Usage: node scripts/run-e2e.mjs <host|docker|first-run> [playwright args...]");
  }

  process.once("SIGINT", () => {
    void cleanup().then(() => process.exit(130));
  });
  process.once("SIGTERM", () => {
    void cleanup().then(() => process.exit(143));
  });

  await buildRuntimeWorkspacePackages();
  await snapshotNextEnv();
  const env =
    mode === "docker"
      ? await startDockerRuntime()
      : mode === "first-run"
        ? await startFirstRunRuntime()
        : await startHostRuntime();
  const projects =
    mode === "docker"
      ? ["docker-chromium"]
      : mode === "first-run"
        ? ["first-run-chromium"]
        : ["host-chromium", "host-mobile-chromium", "host-firefox", "host-webkit"];
  await runPlaywright(env, projects);
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
