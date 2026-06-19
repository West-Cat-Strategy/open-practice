#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import net from "node:net";
import { pathToFileURL } from "node:url";

export const DEFAULT_PORTS = [
  ["web", 33000],
  ["api", 34000],
  ["postgres", 35432],
  ["redis", 36379],
  ["minio", 39000],
  ["minio-console", 39001],
  ["mailpit-smtp", 31025],
  ["mailpit-web", 38025],
];

function parseMajor(version) {
  return Number.parseInt(String(version).split(".")[0] ?? "0", 10);
}

function execText(exec, command, args) {
  return exec(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function parseEnvExample(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    values.set(
      key,
      rest
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, ""),
    );
  }
  return values;
}

export function playwrightCacheCandidates({
  env = process.env,
  home = homedir(),
  cwd = process.cwd(),
} = {}) {
  return [
    env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(home, "Library", "Caches", "ms-playwright"),
    path.join(home, ".cache", "ms-playwright"),
    path.join(cwd, "node_modules", ".cache", "ms-playwright"),
  ].filter(Boolean);
}

export function checkLoopbackPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve({ available: false, error: error.code ?? error.message });
    });
    server.once("listening", () => {
      server.close(() => resolve({ available: true, error: null }));
    });
    server.listen(port, host);
  });
}

function result(status, label, detail) {
  return { status, label, detail };
}

export async function runDoctor({
  cwd = process.cwd(),
  env = process.env,
  nodeVersion = process.versions.node,
  home = homedir(),
  exec = execFileSync,
  readText = (file) => readFileSync(file, "utf8"),
  pathExists = existsSync,
  checkPort = checkLoopbackPort,
  ports = DEFAULT_PORTS,
} = {}) {
  const checks = [];

  const nodeMajor = parseMajor(nodeVersion);
  checks.push(
    nodeMajor >= 24
      ? result("pass", "node", `Node ${nodeVersion}`)
      : result("fail", "node", `Node ${nodeVersion}; expected 24 or newer`),
  );

  try {
    const pnpmVersion = execText(exec, "pnpm", ["--version"]);
    checks.push(
      pnpmVersion.startsWith("11.")
        ? result("pass", "pnpm", `pnpm ${pnpmVersion}`)
        : result("warn", "pnpm", `pnpm ${pnpmVersion}; package.json pins pnpm 11.5.3`),
    );
  } catch (error) {
    checks.push(result("fail", "pnpm", error instanceof Error ? error.message : String(error)));
  }

  try {
    execText(exec, "docker", ["info"]);
    checks.push(result("pass", "docker", "Docker daemon is reachable"));
  } catch (error) {
    checks.push(
      result(
        "fail",
        "docker",
        `Docker daemon is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  try {
    execText(exec, "docker", ["compose", "config"]);
    checks.push(result("pass", "compose", "docker compose config is valid"));
  } catch (error) {
    checks.push(
      result(
        "fail",
        "compose",
        `docker compose config failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  const envExamplePath = path.join(cwd, ".env.example");
  try {
    const envExample = parseEnvExample(readText(envExamplePath));
    const hasDatabaseUrl = Boolean(env.DATABASE_URL || envExample.get("DATABASE_URL"));
    const encryptionKey =
      env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY ??
      envExample.get("OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY");
    if (hasDatabaseUrl && !encryptionKey) {
      checks.push(
        result(
          "warn",
          "env",
          "Host-local PostgreSQL needs OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY before API/worker startup",
        ),
      );
    } else {
      checks.push(result("pass", "env", ".env.example has required local runtime keys documented"));
    }
  } catch (error) {
    checks.push(
      result(
        "fail",
        "env",
        `Could not read .env.example: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  const playwrightCache = playwrightCacheCandidates({ env, home, cwd }).find((candidate) =>
    pathExists(candidate),
  );
  checks.push(
    playwrightCache
      ? result("pass", "playwright", `Browser cache found at ${playwrightCache}`)
      : result(
          "warn",
          "playwright",
          "No Playwright browser cache found; run pnpm exec playwright install chromium when browser checks need it",
        ),
  );

  for (const [name, port] of ports) {
    const portResult = await checkPort(port);
    checks.push(
      portResult.available
        ? result("pass", `port:${name}`, `127.0.0.1:${port} is available`)
        : result(
            "warn",
            `port:${name}`,
            `127.0.0.1:${port} is unavailable: ${portResult.error ?? "in use"}`,
          ),
    );
  }

  return checks;
}

export function formatDoctorReport(checks) {
  const counts = checks.reduce(
    (accumulator, check) => {
      accumulator[check.status] += 1;
      return accumulator;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
  return [
    "Open Practice dev doctor",
    `Summary: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`,
    ...checks.map((check) => `[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`),
  ].join("\n");
}

export async function runCli() {
  const checks = await runDoctor();
  console.log(formatDoctorReport(checks));
  if (checks.some((check) => check.status === "fail")) process.exitCode = 1;
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isCliEntrypoint()) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
