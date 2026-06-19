#!/usr/bin/env node

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const keepUp = args.includes("--keep-up");
const refresh = args.includes("--refresh");
const projectName = keepUp ? undefined : `open-practice-app-smoke-${process.pid}`;
const compose = ["compose", ...(projectName ? ["--project-name", projectName] : [])];
const ports = keepUp
  ? {
      api: "34000",
      web: "33000",
      postgres: "35432",
      redis: "36379",
      minio: "39000",
      minioConsole: "39001",
      mailpitSmtp: "31025",
      mailpitWeb: "38025",
    }
  : {
      api: "44000",
      web: "43000",
      postgres: "45432",
      redis: "46379",
      minio: "49000",
      minioConsole: "49001",
      mailpitSmtp: "41025",
      mailpitWeb: "48025",
    };
const composeEnv = {
  OPEN_PRACTICE_DOCKER_API_HOST_PORT: ports.api,
  OPEN_PRACTICE_DOCKER_WEB_HOST_PORT: ports.web,
  OPEN_PRACTICE_DOCKER_POSTGRES_HOST_PORT: ports.postgres,
  OPEN_PRACTICE_DOCKER_REDIS_HOST_PORT: ports.redis,
  OPEN_PRACTICE_DOCKER_MINIO_HOST_PORT: ports.minio,
  OPEN_PRACTICE_DOCKER_MINIO_CONSOLE_HOST_PORT: ports.minioConsole,
  OPEN_PRACTICE_DOCKER_MAILPIT_SMTP_HOST_PORT: ports.mailpitSmtp,
  OPEN_PRACTICE_DOCKER_MAILPIT_WEB_HOST_PORT: ports.mailpitWeb,
  OPEN_PRACTICE_PUBLIC_API_ORIGIN: `http://localhost:${ports.api}`,
  OPEN_PRACTICE_PUBLIC_WEB_ORIGIN: `http://localhost:${ports.web}`,
};
const apiHealthUrl = `http://127.0.0.1:${ports.api}/health`;
const webUrl = `http://127.0.0.1:${ports.web}/`;
const webSetupStatusUrl = new URL("/api/setup/status", webUrl).href;
let passed = false;

function prefixedLine(prefix, chunk, writer) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) writer(`[${prefix}] ${line}\n`);
  }
}

function run(name, command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      prefixedLine(name, chunk, process.stdout.write.bind(process.stdout));
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      prefixedLine(name, chunk, process.stderr.write.bind(process.stderr));
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${name} failed with exit code ${code ?? "null"}`));
    });
  });
}

function runCompose(name, commandArgs, options = {}) {
  return run(name, "docker", [...compose, ...commandArgs], {
    ...options,
    env: { ...composeEnv, ...options.env },
  });
}

async function waitForRun(name, command, commandArgs, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await run(name, command, commandArgs, options);
    } catch (error) {
      lastError = error;
      await delay(options.intervalMs ?? 1000);
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
      if (response.ok || (options.acceptStatus?.includes(response.status) ?? false)) {
        return response;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(options.intervalMs ?? 750);
  }
  throw new Error(`${name} was not ready at ${url}: ${lastError}`);
}

export function assertSetupStatusShape(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.required !== "boolean" ||
    typeof value.blocked !== "boolean"
  ) {
    throw new Error(
      `Expected setup status JSON with boolean required and blocked, got ${JSON.stringify(value)}`,
    );
  }
}

async function cleanup() {
  if (keepUp) {
    if (passed) {
      console.log("Docker app smoke passed; leaving the Compose dev stack running.");
      return;
    }
    console.log("Docker app smoke failed; stopping the Compose stack.");
  }
  await runCompose("docker-down", [
    "down",
    "--remove-orphans",
    ...(keepUp ? [] : ["--volumes"]),
  ]).catch((error) => {
    process.stderr.write(`[docker-down] ${error.message}\n`);
  });
}

async function main() {
  if (refresh) {
    await runCompose("docker-pull", ["pull", "redis"]);
  }
  await runCompose(
    "docker-build",
    [
      "build",
      ...(refresh ? ["--pull"] : []),
      "postgres",
      "minio",
      "mailpit",
      "api",
      "web",
      "worker",
      "db-migrate",
    ],
    {
      env: { DOCKER_BUILDKIT: "1" },
    },
  );

  await runCompose("docker-up-infra", [
    "up",
    "-d",
    "minio-bucket-init",
    "postgres",
    "redis",
    "minio",
    "mailpit",
  ]);
  await waitForRun(
    "postgres-ready",
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      "open_practice",
      "-d",
      "open_practice",
    ],
    { env: composeEnv },
  );
  await waitForRun(
    "redis-ready",
    "docker",
    [...compose, "exec", "-T", "redis", "redis-cli", "ping"],
    { env: composeEnv },
  );
  await waitForUrl("minio", `http://127.0.0.1:${ports.minio}/minio/health/ready`);
  await waitForUrl("mailpit", `http://127.0.0.1:${ports.mailpitWeb}`);

  await runCompose("docker-up-apps", ["up", "-d", "api", "worker", "web"]);
  const health = await waitForUrl("API", apiHealthUrl, { timeoutMs: 90_000 });
  const healthBody = await health.json();
  if (healthBody.persistence !== "postgres") {
    throw new Error(`Expected PostgreSQL-backed API health, got ${JSON.stringify(healthBody)}`);
  }
  await waitForUrl("web", webUrl, { timeoutMs: 90_000, acceptStatus: [307, 308] });
  const setupStatus = await waitForUrl("web setup status rewrite", webSetupStatusUrl, {
    timeoutMs: 90_000,
  });
  assertSetupStatusShape(await setupStatus.json());

  console.log(
    `Docker app smoke passed: ${apiHealthUrl} is PostgreSQL-backed, ${webUrl} serves, and ${webSetupStatusUrl} returns API setup status JSON.`,
  );
  passed = true;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
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
}
